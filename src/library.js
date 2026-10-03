import { WORDS } from "./data.js";
import { MEMORY } from "./memory.js";
import { createTutor } from "./tutor.js";
import { freshActivity, validateActivity } from "./activity.js";

export const WAVE_ONE_DEADLINE = Date.parse("2026-09-28T09:00:00-04:00");
export const LIBRARY_KEY = "wortwerk.library.v2";
const originalTutor = createTutor(WORDS);
const text = (v, max = 2000) =>
  typeof v === "string" && v.trim().length > 0 && v.length <= max;
const idOK = (v) =>
  typeof v === "string" &&
  /^[a-zA-Z0-9_-]{1,80}$/.test(v) &&
  !["__proto__", "constructor", "prototype"].includes(v);
const tuple = (v) =>
  Array.isArray(v) && v.length === 3 && v.every((s) => text(s));
export function validWords(words) {
  return (
    Array.isArray(words) &&
    words.length >= 1 &&
    words.length <= 90 &&
    new Set(words.map((w) => w?.id)).size === words.length &&
    words.every(
      (w) =>
        w &&
        idOK(w.id) &&
        (w.studyVersion === undefined || w.studyVersion === 1 || w.studyVersion === 2) &&
        (w.meaningAnswers === undefined || (Array.isArray(w.meaningAnswers) && w.meaningAnswers.length <= 30 && w.meaningAnswers.every((s) => text(s, 200)))) &&
        (w.nounForms === undefined || (w.kind === 'noun' && w.nounForms &&
          ['singular', 'plural', 'singularEnglish', 'pluralEnglish', 'rule'].every(k => text(w.nounForms[k])) &&
          [w.nounForms.singular, w.nounForms.plural].includes(w.german))) &&
        text(w.german, 200) &&
        ["german", "english", "kind", "example", "translation", "tip"].every(
          (k) => text(w[k]),
        ) &&
        Array.isArray(w.usages) &&
        w.usages.length >= 1 &&
        w.usages.length <= 10 &&
        w.usages.every((v) => tuple(v) && text(v[2], 200) && v[0].includes("___")) &&
        Array.isArray(w.forms) &&
        (w.assessedFormVariants === undefined || (Array.isArray(w.assessedFormVariants) &&
          new Set(w.assessedFormVariants).size === w.assessedFormVariants.length &&
          w.assessedFormVariants.every(i => Number.isInteger(i) && i >= 0 && i < w.forms.length))) &&
        w.forms.length <= 10 &&
        w.forms.every((v) => tuple(v) && text(v[1], 200)) &&
        w.memory &&
        ["scene", "watch", "recall"].every((k) => text(w.memory[k])) &&
        Array.isArray(w.memory.chunks) &&
        w.memory.chunks.length >= 1 &&
        w.memory.chunks.length <= 30 &&
        w.memory.chunks.every(
          (c) => typeof c === "string" && c.length > 0 && c.length <= 80,
        ) &&
        w.memory.chunks.join("").normalize("NFC") ===
          w.german.replace(/^(der|die|das|sich) /, "").normalize("NFC"),
    )
  );
}
export function validateLibrary(value) {
  try {
    if (
      value?.version !== 2 ||
      !Array.isArray(value.waves) ||
      !value.waves.length ||
      value.waves.length > 50 ||
      new Set(value.waves.map((w) => w?.id)).size !== value.waves.length ||
      !value.waves.some((w) => w.id === value.selectedWaveId)
    )
      return false;
    if (
      !value.waves.every(
        (w) =>
          w &&
          idOK(w.id) &&
          text(w.title, 100) &&
          Number.isFinite(w.dueAt) &&
          w.dueAt > 0 &&
          w.dueAt < 8.64e15 &&
          validWords(w.words) &&
          createTutor(w.words).validateState(w.progress),
      )
    )
      return false;
    return validateActivity(value.activity, value.waves);
  } catch {
    return false;
  }
}
export function validateSave(value) {
  try {
    return value?.version === 2
      ? validateLibrary(value)
      : originalTutor.validateState(value);
  } catch {
    return false;
  }
}
export function migrateLibrary(
  value = originalTutor.freshState(),
  now = Date.now(),
) {
  if (!validateSave(value))
    throw new Error("This save is not compatible. It has not been replaced.");
  if (value.version === 2) return value;
  return {
    version: 2,
    selectedWaveId: "wave-1",
    waves: [
      {
        id: "wave-1",
        title: "Wave 1",
        dueAt: WAVE_ONE_DEADLINE,
        words: WORDS.map((w) => ({ ...w, memory: MEMORY[w.id] })),
        progress: structuredClone(value),
      },
    ],
    activity: freshActivity(now),
  };
}
export function parseWave(raw, id) {
  if (raw.length > 500_000)
    throw new Error("Lesson file is too large (maximum 500 KB).");
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("Choose a prepared Wortwerk lesson JSON file.");
  }
  const dueAt =
    typeof value.dueAt === "string" &&
    /(?:Z|[+-]\d{2}:\d{2})$/.test(value.dueAt)
      ? Date.parse(value.dueAt)
      : NaN;
  if (
    !idOK(id) ||
    !text(value.title, 100) ||
    !Number.isFinite(dueAt) ||
    dueAt <= 0 ||
    !validWords(value.words)
  )
    throw new Error(
      "A lesson needs a title, a dueAt date with time zone, and 1–90 complete words with examples, exercises, and memory tips. Download the sample for the format.",
    );
  return {
    id,
    title: value.title.trim(),
    dueAt,
    words: value.words,
    progress: createTutor(value.words).freshState(),
  };
}
export function saveCounts(value) {
  const states =
    value?.version === 2 ? value.waves.map((w) => w.progress) : [value];
  return {
    answers: states.reduce((n, s) => n + (s?.totalSteps || 0), 0),
    steps: states.reduce((n, s) => n + (s?.active?.completed || 0), 0),
  };
}
export function waveStatus(wave, now = Date.now()) {
  const stats = createTutor(wave.words).summary(wave.progress);
  if (stats.scoringVersion === 2 && stats.complete) return 'Ready';
  if (stats.scoringVersion !== 2 && stats.ready === wave.words.length && wave.progress.phase >= 7)
    return "Ready";
  if (now >= wave.dueAt) return "Past due";
  return wave.progress.startedAt ? "Studying" : "Upcoming";
}
export function wavePlan(wave, now = Date.now()) {
  const tutor = createTutor(wave.words, { deadlineAt: wave.dueAt });
  const p = wave.progress,
    stats = tutor.summary(p),
    hours = (wave.dueAt - now) / 3600000;
  const remaining = Math.max(0, wave.words.length - stats.ready);
  const overdue = hours <= 0,
    urgent = hours <= 24;
  const availableAt = tutor.dueAt(p);
  if (tutor.scoringV2) {
    const categories = stats.categories;
    const evidenceLeft = Object.entries(categories).filter(([key]) => key !== 'verification')
      .reduce((n, [, c]) => n + c.possible - c.earned, 0);
    const checks = Object.values(p.learning.verification);
    const verificationLeft = checks.reduce((n, v) => n + Number(!v.delayed) + Number(!v.finalSpelling) + Number(!v.finalTransfer), 0);
    // Lower-bound workload: teaching, spacing fillers and future mistakes can add questions.
    const sessionsLeft = Math.ceil((evidenceLeft + verificationLeft) / 6);
    const days = Math.max(1, Math.ceil(Math.max(hours, 0) / 24));
    return {
      kind: 'course', availableAt, urgent, remaining, sessionsLeft,
      tight: sessionsLeft > days * 3, evidenceLeft, verificationLeft,
      message: stats.complete ? 'All targets and verification complete.'
        : availableAt > now ? 'Delayed recall is waiting for its eight-hour gap. Your progress is saved.'
        : `${overdue ? 'Deadline passed; keep repairing. ' : ''}At least ${sessionsLeft} short mission equivalents remain (${evidenceLeft} evidence steps, ${verificationLeft} checks). Teaching and spacing may add questions. Aim for ${Math.ceil(sessionsLeft / days)} per day.`,
      steps: [
        { title: 'Learn every target', done: stats.initialComplete, at: now },
        { title: 'Delayed recall & repair', done: checks.every((v) => v.delayed) && !stats.repairs.length, at: Number.isFinite(stats.nextDelayedAt) ? stats.nextDelayedAt : now + 8 * 3600000 },
        { title: 'Final inspection', done: stats.initialComplete && checks.every((v) => v.finalSpelling && v.finalTransfer), at: now },
      ],
    };
  }
  let kind = "course";
  if (!p.active && availableAt > now && urgent && stats.introduced)
    kind = "extra";
  const sessionsLeft = Math.max(0, 7 - p.phase);
  const slots = Math.max(1, Math.ceil(Math.max(hours, 0) / 24) * 3);
  const daily = Math.ceil(
    sessionsLeft / Math.max(1, Math.ceil(Math.max(hours, 0) / 24)),
  );
  const learnAt = Math.max(now, wave.dueAt - 48 * 3600000);
  const recallAt = Math.max(
    learnAt,
    wave.dueAt - 24 * 3600000,
    p.startedAt ? tutor.dayTwoAt(p) : 0,
  );
  const rehearsalAt = Math.max(recallAt, wave.dueAt - 12 * 3600000);
  return {
    kind,
    availableAt,
    urgent,
    remaining,
    sessionsLeft,
    message:
      waveStatus(wave, now) === "Ready"
        ? "Ready for class. A short review can keep it fresh."
        : overdue
          ? "The deadline has passed. Keep practicing the weak words; your work is still saved."
          : hours < 12
            ? "Deadline soon: prioritize weak spellings, then rehearse. A short recall check is not proof of overnight memory."
            : `Aim for ${Math.max(1, daily)} short study block${daily > 1 ? "s" : ""} per day, with breaks and a final rehearsal before class.`,
    tight: sessionsLeft > slots,
    steps: [
      { title: "Learn & mix", done: p.phase >= 4, at: learnAt },
      { title: "Recall & repair", done: p.phase >= 6, at: recallAt },
      { title: "Final rehearsal", done: p.phase >= 7, at: rehearsalAt },
    ],
  };
}
export function recommendedWave(library, now = Date.now()) {
  const waves = library.waves.filter((w) => waveStatus(w, now) !== "Ready");
  const future = waves.filter((w) => w.dueAt > now);
  const pool = future.length ? future : waves.length ? waves : library.waves;
  // Prefer waves with actionable work, then earliest deadline. Never replace
  // an in-progress exercise: selecting a wave resumes its exact saved state.
  return [...pool].sort((a, b) => {
    const waiting = (w) =>
      !w.progress.active &&
      createTutor(w.words, { deadlineAt: w.dueAt }).dueAt(w.progress) > now &&
      (createTutor(w.words).scoringV2 || !wavePlan(w, now).urgent);
    return Number(waiting(a)) - Number(waiting(b)) || a.dueAt - b.dueAt;
  })[0];
}
export const formatDeadline = (value) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
export function miamiInput(value) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(value)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
export function parseMiami(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error("Enter a valid Miami date and time.");
  const candidates = ["-04:00", "-05:00"]
    .map((offset) => Date.parse(value + offset))
    .filter((t) => Number.isFinite(t) && miamiInput(t) === value);
  if (candidates.length !== 1)
    throw new Error(
      "This time is skipped or repeated by daylight saving. Choose another time.",
    );
  return candidates[0];
}
