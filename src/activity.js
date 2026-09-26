/**
 * Activity v1 is independent of tutor progress. No tutor attempts are backfilled.
 * Lifetime counters survive pruning; calendar detail keeps at most 365 Miami
 * dates, the last 100 visits, and 100 spelling-example groups (160 chars each).
 * A 900 KB UTF-8 ceiling may shorten detail retention for very busy libraries.
 * The last 2,048 event IDs and 1,024 session IDs provide bounded deduplication;
 * replaying older evicted IDs is not supported. Whole-state sync is required.
 * Up to 64 waves can have activity. Events before tracking/retained detail are
 * ignored. Time belongs to the event's Miami date; callers should split midnight
 * segments. `now` selects calendar dates, not an intraday historical snapshot.
 */
export const ACTIVITY_TIME_ZONE = "America/New_York";
const LIMIT_BYTES = 900_000;
const TYPES = ["meaning", "spelling", "usage", "form"];
const FIELDS = ["visits", "activeSeconds", "answers", "firstTries", "firstTryCorrect", "retries", "assisted", "unknownRetries", "correct"];
const ANSWER_FIELDS = FIELDS.slice(2);
const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ACTIVITY_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
});
const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const exact = (v, keys) => object(v) && Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
const text = (v, max = 128) => typeof v === "string" && v.length > 0 && v.length <= max;
const timestamp = (v) => Number.isSafeInteger(v) && v >= 0 && v <= 8_640_000_000_000_000;
const count = (v) => Number.isSafeInteger(v) && v >= 0;
const uuid = (v) => typeof v === "string" && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(v);
const bytes = (v) => new TextEncoder().encode(JSON.stringify(v)).length;
function day(at) {
  const p = Object.fromEntries(dayFormatter.formatToParts(at).map(({ type, value }) => [type, value]));
  return `${p.year}-${p.month}-${p.day}`;
}
function shift(date, n) {
  const at = new Date(`${date}T12:00:00Z`);
  at.setUTCDate(at.getUTCDate() + n);
  return at.toISOString().slice(0, 10);
}
const validDay = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(`${v}T12:00:00Z`)) && new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) === v;
const zero = () => ({ ...Object.fromEntries(FIELDS.map((k) => [k, 0])), lastAt: null });
const skills = () => Object.fromEntries(TYPES.map((type) => [type, zero()]));
const summary = () => ({ totals: zero(), skills: skills(), daysActive: 0 });
function add(a, b) {
  for (const k of FIELDS) a[k] += b[k];
  if (b.lastAt !== null) a.lastAt = Math.max(a.lastAt ?? 0, b.lastAt);
}
function addSummary(a, delta, type) {
  add(a.totals, delta);
  if (type) add(a.skills[type], delta);
}

export function freshActivity(now = Date.now()) {
  if (!timestamp(now) || !validDay(day(now))) throw new TypeError("Invalid activity start time");
  return {
    version: 1, startedAt: now, detailSince: day(now), lifetime: summary(),
    waves: [], days: [], visits: [], spellingErrors: [], eventIds: [], sessions: [],
  };
}

function validEvent(event) {
  if (!object(event) || !uuid(event.id) || !uuid(event.sessionId) || !text(event.waveId) || !timestamp(event.at) || !validDay(day(event.at))) return false;
  if (event.kind === "engage") return true;
  if (event.kind === "time") return typeof event.seconds === "number" && Number.isFinite(event.seconds) && event.seconds > 0;
  return event.kind === "answer" && text(event.wordId) && TYPES.includes(event.type)
    && typeof event.correct === "boolean" && (event.assisted === undefined || typeof event.assisted === "boolean")
    && (event.retry === undefined || count(event.retry))
    && (event.input === undefined || typeof event.input === "string")
    && (event.expected === undefined || typeof event.expected === "string");
}

function prune(state) {
  const latest = state.days.at(-1)?.date ?? state.detailSince;
  state.detailSince = [state.detailSince, shift(latest, -364)].sort().at(-1);
  state.days = state.days.filter((d) => d.date >= state.detailSince);
  state.visits.sort((a, b) => a.lastAt - b.lastAt);
  state.visits = state.visits.slice(-100);
  state.spellingErrors.sort((a, b) => a.lastAt - b.lastAt);
  state.spellingErrors = state.spellingErrors.filter((e) => e.date >= state.detailSince).slice(-100);
  state.eventIds = state.eventIds.slice(-2048);
  state.sessions = state.sessions.slice(-1024);
  // Limit per-visit day/wave slices as well as the number of visit records.
  for (const visit of state.visits) {
    visit.parts.sort((a, b) => a.date.localeCompare(b.date));
    if (visit.parts.length > 32 || visit.parts.some((p) => p.date < state.detailSince)) visit.truncated = true;
    visit.parts = visit.parts.filter((p) => p.date >= state.detailSince).slice(-32);
  }
  while (bytes(state) > LIMIT_BYTES) {
    if (state.days.length > 1) {
      state.days.shift();
      state.detailSince = state.days[0].date;
    } else if (state.visits.length) state.visits.shift();
    else if (state.spellingErrors.length) state.spellingErrors.shift();
    else if (state.sessions.length > 1) state.sessions.shift();
    else if (state.eventIds.length > 1) state.eventIds.shift();
    else break;
  }
  state.spellingErrors = state.spellingErrors.filter((e) => e.date >= state.detailSince);
  for (const visit of state.visits) {
    if (visit.parts.some((p) => p.date < state.detailSince)) visit.truncated = true;
    visit.parts = visit.parts.filter((p) => p.date >= state.detailSince);
  }
}

export function recordActivity(activity, event) {
  if (!validEvent(event) || event.at < activity.startedAt || day(event.at) < activity.detailSince || activity.eventIds.includes(event.id)) return activity;
  const known = activity.sessions.find((s) => s.id === event.sessionId);
  if (known && event.at < known.startedAt) return activity;
  if (event.kind === "time" && (!known || !known.waveIds.includes(event.waveId))) return activity;
  if (!activity.waves.some((w) => w.waveId === event.waveId) && activity.waves.length >= 64) return activity;
  const state = structuredClone(activity);
  const date = day(event.at);
  let session = state.sessions.find((s) => s.id === event.sessionId);
  const newVisit = !session;
  if (!session) {
    session = { id: event.sessionId, startedAt: event.at, waveIds: [] };
    state.sessions.push(session);
  }
  const newWaveVisit = !session.waveIds.includes(event.waveId);
  if (newWaveVisit) session.waveIds.push(event.waveId);
  let wave = state.waves.find((w) => w.waveId === event.waveId);
  if (!wave) { wave = { waveId: event.waveId, ...summary() }; state.waves.push(wave); }
  let daily = state.days.find((d) => d.date === date);
  if (!daily) {
    daily = { date, ...summary(), waves: [] };
    state.days.push(daily);
    state.days.sort((a, b) => a.date.localeCompare(b.date));
    state.lifetime.daysActive += 1;
    daily.daysActive = 1;
  }
  let dailyWave = daily.waves.find((w) => w.waveId === event.waveId);
  if (!dailyWave) {
    dailyWave = { waveId: event.waveId, ...summary() };
    dailyWave.daysActive = 1;
    daily.waves.push(dailyWave);
    wave.daysActive += 1;
  }
  const delta = zero();
  delta.lastAt = event.at;
  if (event.kind === "time") delta.activeSeconds = Math.min(15, event.seconds);
  if (event.kind === "answer") {
    delta.answers = 1;
    delta.correct = Number(event.correct);
    delta.firstTries = Number(event.retry === 0);
    delta.firstTryCorrect = Number(event.retry === 0 && event.correct && event.assisted !== true);
    delta.retries = Number(event.retry !== undefined && event.retry > 0);
    delta.unknownRetries = Number(event.retry === undefined);
    delta.assisted = Number(event.assisted === true);
  }
  const type = event.kind === "answer" ? event.type : null;
  for (const target of [state.lifetime, daily]) addSummary(target, { ...delta, visits: Number(newVisit) }, type);
  for (const target of [wave, dailyWave]) addSummary(target, { ...delta, visits: Number(newWaveVisit) }, type);
  // Visits/time are not skill metrics, even when an answer opens a visit.
  if (type) for (const target of [state.lifetime, daily, wave, dailyWave]) {
    target.skills[type].visits = 0;
    target.skills[type].activeSeconds = 0;
  }
  let visit = state.visits.find((v) => v.sessionId === event.sessionId);
  if (!visit) {
    visit = { sessionId: event.sessionId, startedAt: session.startedAt, lastAt: event.at, truncated: !newVisit, parts: [] };
    state.visits.push(visit);
  }
  visit.lastAt = Math.max(visit.lastAt, event.at);
  let part = visit.parts.find((p) => p.date === date && p.waveId === event.waveId);
  if (!part) { part = { date, waveId: event.waveId, totals: zero() }; visit.parts.push(part); }
  add(part.totals, { ...delta, visits: Number(newWaveVisit) });
  if (type === "spelling" && !event.correct) {
    const input = (event.input ?? "").slice(0, 160);
    const expected = (event.expected ?? "").slice(0, 160);
    let error = state.spellingErrors.find((e) => e.date === date && e.waveId === event.waveId && e.wordId === event.wordId && e.input === input && e.expected === expected);
    if (!error) {
      error = { date, waveId: event.waveId, wordId: event.wordId, input, expected, count: 0, lastAt: event.at };
      state.spellingErrors.push(error);
    }
    error.count += 1;
    error.lastAt = Math.max(error.lastAt, event.at);
  }
  state.eventIds.push(event.id);
  prune(state);
  return state;
}

function validTotals(v, startedAt) {
  return exact(v, [...FIELDS, "lastAt"]) && FIELDS.every((k) => k === "activeSeconds" ? Number.isFinite(v[k]) && v[k] >= 0 && v[k] <= Number.MAX_SAFE_INTEGER : count(v[k]))
    && (v.lastAt === null || timestamp(v.lastAt) && v.lastAt >= startedAt)
    && v.answers === v.firstTries + v.retries + v.unknownRetries
    && v.firstTryCorrect <= v.firstTries && v.firstTryCorrect <= v.correct
    && v.correct <= v.answers && v.assisted + v.firstTryCorrect <= v.answers
    && (v.lastAt !== null || FIELDS.every((k) => v[k] === 0));
}
function validSummary(v, startedAt) {
  return validTotals(v.totals, startedAt) && count(v.daysActive) && exact(v.skills, TYPES)
    && TYPES.every((t) => validTotals(v.skills[t], startedAt) && v.skills[t].visits === 0 && v.skills[t].activeSeconds === 0 && (v.skills[t].lastAt === null || v.totals.lastAt !== null && v.skills[t].lastAt <= v.totals.lastAt))
    && ANSWER_FIELDS.every((k) => TYPES.reduce((n, t) => n + v.skills[t][k], 0) === v.totals[k]);
}
const unique = (values) => new Set(values).size === values.length;
const denseArray = (value, max) => Array.isArray(value) && value.length <= max && Object.keys(value).length === value.length;
const close = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
function consistentWaves(total, waves) {
  return ANSWER_FIELDS.every((k) => waves.reduce((n, w) => n + w.totals[k], 0) === total[k])
    && close(waves.reduce((n, w) => n + w.totals.activeSeconds, 0), total.activeSeconds)
    && waves.every((w) => w.totals.visits <= total.visits)
    && waves.reduce((n, w) => n + w.totals.visits, 0) >= total.visits
    && (waves.length ? Math.max(...waves.map((w) => w.totals.lastAt ?? 0)) === total.lastAt : total.lastAt === null);
}

/** Reject unknown fields, unknown wave/word references, oversize and corrupt data. */
export function validateActivity(value, waves) {
  try {
    if (!exact(value, ["version", "startedAt", "detailSince", "lifetime", "waves", "days", "visits", "spellingErrors", "eventIds", "sessions"]) || value.version !== 1 || !timestamp(value.startedAt) || !validDay(day(value.startedAt)) || !validDay(value.detailSince) || value.detailSince < day(value.startedAt)) return false;
    if (!Array.isArray(waves) || !waves.every((w) => object(w) && text(w.id) && Array.isArray(w.words) && w.words.every((word) => object(word) && text(word.id))) || !unique(waves.map((w) => w.id))) return false;
    const knownWave = (id) => text(id) && waves.some((w) => w.id === id);
    const knownWord = (waveId, wordId) => waves.find((w) => w.id === waveId)?.words.some((w) => w.id === wordId);
    const limits = { waves: 64, days: 365, visits: 100, spellingErrors: 100, eventIds: 2048, sessions: 1024 };
    if (!Object.entries(limits).every(([k, max]) => denseArray(value[k], max)) || bytes(value) > LIMIT_BYTES) return false;
    if (!exact(value.lifetime, ["totals", "skills", "daysActive"]) || !validSummary(value.lifetime, value.startedAt)) return false;
    const waveSummary = (v) => exact(v, ["waveId", "totals", "skills", "daysActive"]) && knownWave(v.waveId) && validSummary(v, value.startedAt);
    if (!value.waves.every(waveSummary) || !unique(value.waves.map((w) => w.waveId))) return false;
    const trackedWave = (id) => value.waves.some((w) => w.waveId === id);
    const detailDate = (d) => validDay(d) && d >= value.detailSince;
    if (!value.days.every((d, i) => exact(d, ["date", "totals", "skills", "daysActive", "waves"]) && detailDate(d.date) && (!i || value.days[i - 1].date < d.date) && validSummary(d, value.startedAt) && d.daysActive === 1 && d.totals.lastAt !== null && day(d.totals.lastAt) === d.date && denseArray(d.waves, 64) && d.waves.length > 0 && unique(d.waves.map((w) => w.waveId)) && d.waves.every((w) => waveSummary(w) && trackedWave(w.waveId) && w.daysActive === 1 && w.totals.lastAt !== null && day(w.totals.lastAt) === d.date) && ANSWER_FIELDS.every((k) => d.waves.reduce((n, w) => n + w.totals[k], 0) === d.totals[k]) && close(d.waves.reduce((n, w) => n + w.totals.activeSeconds, 0), d.totals.activeSeconds) && Math.max(...d.waves.map((w) => w.totals.lastAt)) === d.totals.lastAt)) return false;
    if (!value.eventIds.every(uuid) || !unique(value.eventIds)) return false;
    if (!unique(value.sessions.map((s) => s.id)) || !value.sessions.every((s) => exact(s, ["id", "startedAt", "waveIds"]) && uuid(s.id) && timestamp(s.startedAt) && s.startedAt >= value.startedAt && denseArray(s.waveIds, 64) && s.waveIds.length > 0 && unique(s.waveIds) && s.waveIds.every(trackedWave))) return false;
    if (!unique(value.visits.map((v) => v.sessionId)) || !value.visits.every((v) => exact(v, ["sessionId", "startedAt", "lastAt", "truncated", "parts"]) && uuid(v.sessionId) && timestamp(v.startedAt) && v.startedAt >= value.startedAt && timestamp(v.lastAt) && v.lastAt >= v.startedAt && typeof v.truncated === "boolean" && denseArray(v.parts, 32) && unique(v.parts.map((p) => `${p.date}/${p.waveId}`)) && v.parts.every((p) => exact(p, ["date", "waveId", "totals"]) && detailDate(p.date) && trackedWave(p.waveId) && validTotals(p.totals, v.startedAt) && p.totals.lastAt !== null && day(p.totals.lastAt) === p.date && p.totals.lastAt <= v.lastAt))) return false;
    if (!unique(value.spellingErrors.map((e) => JSON.stringify([e.date, e.waveId, e.wordId, e.input, e.expected]))) || !value.spellingErrors.every((e) => exact(e, ["date", "waveId", "wordId", "input", "expected", "count", "lastAt"]) && detailDate(e.date) && trackedWave(e.waveId) && knownWord(e.waveId, e.wordId) && typeof e.input === "string" && e.input.length <= 160 && typeof e.expected === "string" && e.expected.length <= 160 && count(e.count) && e.count > 0 && timestamp(e.lastAt) && e.lastAt >= value.startedAt && day(e.lastAt) === e.date)) return false;
    // Retained detail cannot exceed lifetime counts (allow fractional-time rounding).
    const covers = (a, b) => FIELDS.every((k) => a[k] + (k === "activeSeconds" ? 1e-6 : 0) >= b[k]);
    const retained = zero();
    for (const d of value.days) add(retained, d.totals);
    return covers(value.lifetime.totals, retained) && value.lifetime.daysActive >= value.days.length
      && consistentWaves(value.lifetime.totals, value.waves)
      && value.waves.every((w) => {
        const total = zero();
        const ds = value.days.flatMap((d) => d.waves.filter((v) => v.waveId === w.waveId));
        ds.forEach((d) => add(total, d.totals));
        const errorCount = value.spellingErrors.filter((e) => e.waveId === w.waveId).reduce((n, e) => n + e.count, 0);
        return covers(w.totals, total) && w.daysActive >= ds.length && errorCount <= w.skills.spelling.answers - w.skills.spelling.correct;
      });
  } catch { return false; }
}

export function activityStats(activity, { now = Date.now(), range = "all", waveId } = {}) {
  if (!timestamp(now) || !["today", "week", "all"].includes(range)) throw new TypeError("Invalid activity filter");
  const today = day(now);
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const from = range === "today" ? today : range === "week" ? shift(today, -((weekday + 6) % 7)) : null;
  const matches = (date, id) => (!from || date >= from) && date <= today && (!waveId || id === waveId);
  let result = summary();
  // Lifetime includes all tracked dates; historical `now` uses retained detail.
  const lifetimeAvailable = !activity.lifetime.totals.lastAt || day(activity.lifetime.totals.lastAt) <= today;
  if (range === "all" && lifetimeAvailable) result = structuredClone(waveId ? activity.waves.find((w) => w.waveId === waveId) ?? result : activity.lifetime);
  else for (const d of activity.days) {
    if (!matches(d.date, waveId)) continue;
    const entry = waveId ? d.waves.find((w) => w.waveId === waveId) : d;
    if (!entry) continue;
    add(result.totals, entry.totals);
    for (const t of TYPES) add(result.skills[t], entry.skills[t]);
    result.daysActive += 1;
  }
  const visits = activity.visits.flatMap((visit) => {
    const parts = visit.parts.filter((p) => matches(p.date, p.waveId));
    if (!parts.length) return [];
    const totals = zero();
    parts.forEach((p) => add(totals, p.totals));
    return [{ sessionId: visit.sessionId, startedAt: visit.startedAt, lastAt: totals.lastAt, truncated: visit.truncated, waveIds: [...new Set(parts.map((p) => p.waveId))], totals }];
  }).sort((a, b) => b.lastAt - a.lastAt);
  const errors = new Map();
  for (const e of activity.spellingErrors.filter((e) => matches(e.date, e.waveId))) {
    const key = JSON.stringify([e.waveId, e.wordId, e.input, e.expected]);
    const existing = errors.get(key);
    if (existing) { existing.count += e.count; existing.lastAt = Math.max(existing.lastAt, e.lastAt); }
    else errors.set(key, { ...e });
  }
  return {
    ...result, firstTryAccuracy: result.totals.firstTries ? result.totals.firstTryCorrect / result.totals.firstTries : null,
    visits, spellingErrors: [...errors.values()].sort((a, b) => b.count - a.count || b.lastAt - a.lastAt),
    startedAt: activity.startedAt, detailSince: activity.detailSince, range, from, through: today,
    detailTruncated: activity.detailSince > day(activity.startedAt),
    rangeIncomplete: (range !== "all" || !lifetimeAvailable) && (from === null || from < activity.detailSince),
    timeZone: ACTIVITY_TIME_ZONE,
  };
}
