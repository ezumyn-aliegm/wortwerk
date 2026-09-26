import { WORDS, BY_ID, requiredSkills } from "./data.js";

export const STORAGE_KEY = "wortwerk.progress.v1";
const HOUR = 3_600_000;
const TYPES = ["teach", "meaning", "spelling", "usage", "form"];
export const PHASES = [
  {
    title: "Meet your first 9 words",
    short: "Words 1–9",
    day: 1,
    minutes: "15–20",
    coach:
      "I’ll introduce a few words at a time. Then you’ll try them from memory.",
  },
  {
    title: "Build on what you know",
    short: "Words 10–18",
    day: 1,
    minutes: "15–20",
    coach:
      "Nine new words, plus a few familiar ones. I’ll bring back anything that needs another look.",
  },
  {
    title: "Meet your last 9 words",
    short: "Words 19–27",
    day: 1,
    minutes: "15–20",
    coach: "Let’s meet the rest of your words, then put them to work.",
  },
  {
    title: "Mix it up",
    short: "Mixed check",
    day: 1,
    minutes: "10–15",
    coach:
      "All 27 words, mixed together. This will show us what needs attention tomorrow.",
  },
  {
    title: "What stayed with you?",
    short: "Overnight recall",
    day: 2,
    minutes: "10–15",
    coach:
      "Try all 27 from memory before reviewing. It’s okay to forget: that tells me what to teach next.",
  },
  {
    title: "Fix the tricky bits",
    short: "Targeted practice",
    day: 2,
    minutes: "15–20",
    coach:
      "I’ve picked the words and skills that need you most. Let’s make them stick.",
  },
  {
    title: "Your final rehearsal",
    short: "Final rehearsal",
    day: 2,
    minutes: "20–25",
    coach:
      "54 questions: every word from memory, then sentence use or word forms. Answers stay hidden until the end. Take your time.",
  },
];
export function freshState() {
  return {
    version: 1,
    startedAt: null,
    phase: 0,
    totalSteps: 0,
    nextAt: 0,
    active: null,
    sessions: [],
    words: Object.fromEntries(
      WORDS.map((w) => [
        w.id,
        {
          seen: false,
          introducedAt: 0,
          lastExposedAt: 0,
          delayed: false,
          misses: 0,
          skills: Object.fromEntries(
            requiredSkills(w).map((k) => [
              k,
              { wins: 0, attempts: 0, lastStep: -100 },
            ]),
          ),
        },
      ]),
    ),
  };
}
export function mastery(state, id) {
  const p = state.words[id];
  const skills = requiredSkills(BY_ID[id]);
  const score = skills.reduce((n, k) => n + Math.min(2, p.skills[k].wins), 0);
  return {
    percent: Math.round(
      (100 * (score + Number(p.delayed))) / (skills.length * 2 + 1),
    ),
    ready: skills.every((k) => p.skills[k].wins >= 2) && p.delayed,
    label: !p.seen
      ? "Not introduced"
      : skills.every((k) => p.skills[k].wins >= 2) && p.delayed
        ? "Remembered"
        : score >= skills.length * 2
          ? "Needs later recall"
          : "Practicing",
  };
}
export function summary(state) {
  const values = WORDS.map((w) => mastery(state, w.id));
  return {
    introduced: WORDS.filter((w) => state.words[w.id].seen).length,
    ready: values.filter((v) => v.ready).length,
    percent: Math.round(
      values.reduce((s, v) => s + v.percent, 0) / WORDS.length,
    ),
    attempts: WORDS.reduce(
      (s, w) =>
        s +
        Object.values(state.words[w.id].skills).reduce(
          (a, k) => a + k.attempts,
          0,
        ),
      0,
    ),
  };
}
export function dayTwoAt(state) {
  if (!state.startedAt) return 0;
  const tomorrow = new Date(state.startedAt);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const latestIntro = Math.max(
    state.startedAt,
    ...Object.values(state.words).map((w) => w.introducedAt),
  );
  return Math.max(tomorrow.getTime(), latestIntro + 8 * HOUR);
}
export function delayedReviewAt(state) {
  if (
    state.phase < 7 ||
    WORDS.some((w) =>
      requiredSkills(w).some((k) => state.words[w.id].skills[k].wins < 2),
    )
  )
    return 0;
  const waiting = WORDS.filter((w) => !state.words[w.id].delayed);
  return waiting.length
    ? Math.max(
        ...waiting.map((w) => state.words[w.id].lastExposedAt + 8 * HOUR),
      )
    : 0;
}
export function dueAt(state) {
  return Math.max(
    state.nextAt,
    state.phase === 4 ? dayTwoAt(state) : 0,
    delayedReviewAt(state),
  );
}
export const phaseInfo = (state) =>
  PHASES[state.phase] || {
    title: "Make the last words stick",
    short: "Follow-up practice",
    day: 2,
    minutes: "10–15",
    coach:
      "Your results choose this session. We’ll revisit weak skills and check recall after a gap.",
  };
const hash = (str) =>
  [...str].reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 7) >>> 0;
const shuffle = (items, seed) =>
  [...items].sort(
    (a, b) => hash(seed + JSON.stringify(a)) - hash(seed + JSON.stringify(b)),
  );
const question = (wordId, type, variant = 0, extra = {}) => ({
  wordId,
  type,
  variant,
  retry: 0,
  ...extra,
});
const courseOrder = [
  "traurig",
  "brief",
  "fuehlen",
  "aergern",
  "job",
  "mitkommen",
  "umziehen",
  "weit-weg",
  "fast",
  ...WORDS.slice(9).map((w) => w.id),
];
export function weakestSkills(state, id) {
  return requiredSkills(BY_ID[id]).sort(
    (a, b) =>
      state.words[id].skills[a].wins - state.words[id].skills[b].wins ||
      state.words[id].skills[a].lastStep - state.words[id].skills[b].lastStep,
  );
}
function repairQueue(state, now, limit = 40) {
  const ids = WORDS.filter((w) => state.words[w.id].seen)
    .map((w) => w.id)
    .sort((a, b) => mastery(state, a).percent - mastery(state, b).percent);
  const needs = ids.flatMap((id) => {
    const p = state.words[id];
    const skills = weakestSkills(state, id).filter((k) => p.skills[k].wins < 2);
    if (
      !p.delayed &&
      now - p.lastExposedAt >= 8 * HOUR &&
      !skills.includes("spelling")
    )
      skills.unshift("spelling");
    return skills.map((k) => question(id, k, p.skills[k].attempts % 2));
  });
  // Interleave by skill so a word is retrieved after other words, not copied immediately.
  const queue = [];
  while (needs.length && queue.length < limit) {
    let i = needs.findIndex(
      (q) => !queue.slice(-3).some((prev) => prev.wordId === q.wordId),
    );
    if (i < 0) {
      const filler = WORDS.find(
        (w) =>
          state.words[w.id].seen &&
          !queue.slice(-3).some((prev) => prev.wordId === w.id),
      );
      if (filler) {
        queue.push(question(filler.id, "spelling", 1));
        continue;
      }
      i = 0;
    }
    queue.push(needs.splice(i, 1)[0]);
  }
  return queue.length
    ? queue
    : shuffle(ids, `refresh-${state.totalSteps}`)
        .slice(0, 12)
        .map((id) => question(id, "spelling", 1));
}
export function buildQueue(state, kind = "course", now = Date.now()) {
  if (kind === "extra") return repairQueue(state, now, 18);
  if (kind === "exam" || state.phase === 6)
    return [
      ...shuffle(WORDS, "final-spelling").map((w) =>
        question(w.id, "spelling", 1),
      ),
      ...shuffle(WORDS, "final-transfer").map((w) =>
        question(w.id, w.forms.length ? "form" : "usage", 1),
      ),
    ];
  if (state.phase < 3) {
    const ids = courseOrder.slice(state.phase * 9, state.phase * 9 + 9);
    const queue = [];
    for (let i = 0; i < ids.length; i += 3) {
      const batch = ids.slice(i, i + 3);
      batch.forEach((id) =>
        queue.push(question(id, "teach"), question(id, "meaning")),
      );
      for (const type of ["spelling", "usage", "form"])
        batch.forEach((id) => {
          if (type !== "form" || BY_ID[id].forms.length)
            queue.push(question(id, type));
        });
    }
    if (state.phase)
      queue.push(
        ...shuffle(courseOrder.slice(0, state.phase * 9), "old-" + state.phase)
          .slice(0, 4)
          .map((id) => question(id, "spelling", 1)),
      );
    return queue;
  }
  if (state.phase === 3)
    return shuffle(WORDS, "mixed").map((w, i) =>
      question(w.id, i % 3 === 0 ? "usage" : "spelling", 1),
    );
  if (state.phase === 4)
    return shuffle(WORDS, "overnight").map((w) =>
      question(w.id, "spelling", 1),
    );
  return repairQueue(state, now);
}
export function startSession(original, now = Date.now(), kind = "course") {
  if (original.active) return original;
  if (kind === "course" && original.phase === 4 && now < dayTwoAt(original))
    return original;
  if (kind === "course" && now < delayedReviewAt(original)) return original;
  if (kind === "extra" && !summary(original).introduced) return original;
  const state = structuredClone(original);
  state.startedAt ||= now;
  const queue = buildQueue(state, kind, now);
  if (!queue.length) return original;
  state.active = {
    kind:
      kind === "exam" || (kind === "course" && state.phase === 6)
        ? "exam"
        : kind,
    advances: kind === "course",
    phase: state.phase,
    queue,
    initialCount: queue.length,
    completed: 0,
    answers: [],
    feedback: null,
    helped: false,
    draft: "",
    correction: "",
    teachingStep: 0,
    correcting: false,
    startedAt: now,
  };
  return state;
}
export function describe(q) {
  const w = BY_ID[q.wordId];
  if (q.type === "teach") return { title: w.german, answer: w.german };
  if (q.type === "meaning") {
    const others = shuffle(
      WORDS.filter((v) => v.id !== w.id),
      w.id,
    )
      .slice(0, 3)
      .map((v) => v.english);
    return {
      title: `What does “${w.german}” mean?`,
      answer: w.english,
      options: shuffle([w.english, ...others], w.id + q.retry),
      explanation: `${w.german} means ${w.english}. ${w.tip}`,
    };
  }
  if (q.type === "spelling")
    return {
      title: w.english,
      answer: w.german,
      instruction:
        w.kind === "noun"
          ? "Write the German word with its article (der / die / das)."
          : w.kind === "reflexive verb"
            ? "Write the German infinitive, including sich."
            : "Write the German word or expression.",
      explanation: w.tip,
    };
  if (q.type === "usage") {
    const [title, translation, answer] = w.usages[q.variant % w.usages.length];
    return {
      title,
      translation,
      answer,
      instruction: "Complete the sentence using the English meaning.",
      explanation: `${title.replace("___", answer)} — ${translation} ${w.tip}`,
    };
  }
  const [title, answer, explanation] = w.forms[q.variant % w.forms.length];
  return {
    title,
    answer,
    instruction: title.includes("both blanks")
      ? "Type both missing words in order, separated by a space."
      : "Type the missing word or requested form.",
    explanation,
  };
}
export function normalize(text) {
  return text
    .normalize("NFC")
    .trim()
    .replace(/[.!?]+$/, "")
    .replace(/\s+/g, " ")
    .replace(/^(Der|Die|Das) /, (s) => s.toLowerCase());
}
function canonicalAnswer(text, q) {
  const cleaned = normalize(text);
  if (q.type === "spelling" && BY_ID[q.wordId].kind === "reflexive verb") {
    const match = cleaned.match(/^(.+?)\s*\(sich\)$/);
    if (match) return "sich " + match[1].trim();
  }
  return cleaned;
}
export function grade(q, input) {
  const spec = describe(q),
    actual = canonicalAnswer(input, q),
    expected = normalize(spec.answer);
  if (actual === expected)
    return { correct: true, expected: spec.answer, message: spec.explanation };
  let reason = "Let’s build this answer together.";
  const fold = (str) =>
    str
      .replace(/ä/g, "a")
      .replace(/ö/g, "o")
      .replace(/ü/g, "u")
      .replace(/ß/g, "ss");
  if (!actual)
    reason =
      "No problem. Read the answer once, then we’ll try it again after other words.";
  else if (actual.toLowerCase() === expected.toLowerCase())
    reason =
      "Check the capital letter. German nouns start with a capital; these other words stay lowercase here.";
  else if (
    fold(actual.toLowerCase()) === fold(expected.toLowerCase()) ||
    actual
      .replace(/ae/g, "ä")
      .replace(/oe/g, "ö")
      .replace(/ue/g, "ü")
      .replace(/ss/g, "ß") === expected
  )
    reason =
      "You remembered the word. Now use the exact lesson spelling, including ä, ö, ü or ß. The character keys can help.";
  else if (
    q.type === "spelling" &&
    BY_ID[q.wordId].kind === "noun" &&
    actual === expected.replace(/^(der|die|das) /, "")
  )
    reason = "The word is right. Add its article — learn the two together.";
  else if (
    q.type === "spelling" &&
    BY_ID[q.wordId].kind === "reflexive verb" &&
    actual === expected.replace("sich ", "")
  )
    reason =
      "You have the verb. Include sich for this reflexive vocabulary entry.";
  return {
    correct: false,
    expected: spec.answer,
    message: `${reason} ${spec.explanation}`,
  };
}
export function setDraft(original, draft) {
  if (!original.active || original.active.feedback) return original;
  return {
    ...original,
    active: { ...original.active, draft: draft.slice(0, 200) },
  };
}
export function setCorrection(original, correction) {
  if (!original.active?.feedback || original.active.kind === "exam")
    return original;
  return {
    ...original,
    active: { ...original.active, correction: correction.slice(0, 200) },
  };
}
export function setTeachingStep(original, teachingStep) {
  if (
    !original.active ||
    original.active.queue[0].type !== "teach" ||
    !Number.isInteger(teachingStep) ||
    teachingStep < 0 ||
    teachingStep > 2
  )
    return original;
  return { ...original, active: { ...original.active, teachingStep } };
}
export function startCorrection(original) {
  if (!correctionNeeded(original)) return original;
  return { ...original, active: { ...original.active, correcting: true } };
}
export function correctionNeeded(state) {
  const a = state.active;
  return !!(
    a &&
    a.kind !== "exam" &&
    a.queue[0].type === "spelling" &&
    a.feedback &&
    !a.feedback.correct
  );
}
export function correctionReady(state) {
  return (
    !correctionNeeded(state) ||
    grade(state.active.queue[0], state.active.correction || "").correct
  );
}
export function useHint(original, now = Date.now()) {
  if (
    !original.active ||
    original.active.kind === "exam" ||
    (original.active.phase === 4 && original.active.kind === "course") ||
    original.active.feedback
  )
    return original;
  const state = structuredClone(original);
  state.active.helped = true;
  state.words[state.active.queue[0].wordId].lastExposedAt = now;
  return state;
}
export function visitWordbank(original, now = Date.now()) {
  if (
    original.active &&
    (original.active.kind === "exam" ||
      (original.active.phase === 4 && original.active.kind === "course"))
  )
    return original;
  const state = structuredClone(original);
  for (const word of Object.values(state.words))
    if (word.seen) word.lastExposedAt = now;
  if (
    state.active &&
    !state.active.feedback &&
    state.active.queue[0].type !== "teach"
  )
    state.active.helped = true;
  return state;
}
function recordSkill(p, type, correct, assisted, step) {
  const skill = p.skills[type];
  if (!skill) return;
  skill.attempts++;
  if (!correct) skill.wins = 0;
  else if (!assisted && step - skill.lastStep >= 3) {
    skill.wins = Math.min(2, skill.wins + 1);
    skill.lastStep = step;
  }
}
export function answerQuestion(original, input, now = Date.now()) {
  if (!original.active || original.active.feedback) return original;
  const state = structuredClone(original),
    active = state.active,
    q = active.queue[0],
    p = state.words[q.wordId];
  if (q.type === "teach") return original;
  const result = grade(q, input),
    assisted = active.helped;
  state.totalSteps++;
  recordSkill(p, q.type, result.correct, assisted, state.totalSteps);
  if (q.type === "spelling") {
    recordSkill(p, "meaning", result.correct, assisted, state.totalSteps);
    if (!result.correct) p.delayed = false;
    else if (!assisted && now - p.lastExposedAt >= 8 * HOUR && p.seen)
      p.delayed = true;
  }
  if (!result.correct) p.misses++;
  // Exam answers remain hidden until the completed result screen.
  if (active.kind !== "exam") p.lastExposedAt = now;
  const response = {
    ...result,
    wordId: q.wordId,
    type: q.type,
    variant: q.variant,
    input,
    assisted,
    at: now,
  };
  active.answers.push(response);
  active.feedback = active.kind === "exam" ? { hidden: true } : response;
  if (
    active.kind !== "exam" &&
    !(active.phase === 4 && active.kind === "course") &&
    (!result.correct || assisted) &&
    q.retry < 2
  ) {
    const retry = { ...q, retry: q.retry + 1 };
    const position = Math.min(active.queue.length, 5);
    if (!result.correct && q.retry >= 1)
      active.queue.splice(
        position,
        0,
        question(q.wordId, "teach", q.variant, { revisit: true }),
      );
    active.queue.splice(
      Math.min(active.queue.length, position + (q.retry >= 1 ? 4 : 0)),
      0,
      retry,
    );
  }
  return state;
}
export function advance(original, now = Date.now()) {
  if (!original.active) return original;
  const current = original.active.queue[0];
  if (current.type !== "teach" && !original.active.feedback) return original;
  if (!correctionReady(original)) return original;
  const state = structuredClone(original),
    active = state.active,
    p = state.words[current.wordId];
  if (current.type === "teach") {
    p.seen = true;
    p.introducedAt ||= now;
    p.lastExposedAt = now;
  }
  active.queue.shift();
  active.completed++;
  active.feedback = null;
  active.helped = false;
  active.draft = "";
  active.correction = "";
  active.teachingStep = 0;
  active.correcting = false;
  if (active.queue.length) return state;
  const correct = active.answers.filter((a) => a.correct && !a.assisted).length;
  const session = {
    kind: active.kind,
    phase: active.phase,
    startedAt: active.startedAt,
    finishedAt: now,
    count: active.answers.length,
    correct,
    score: active.answers.length
      ? Math.round((correct / active.answers.length) * 100)
      : 0,
    mistakes: active.answers.filter((a) => !a.correct || a.assisted),
    firstTry:
      active.answers.length -
      active.answers.filter((a) => !a.correct || a.assisted).length,
  };
  state.sessions.push(session);
  if (state.sessions.length > 100) state.sessions.shift();
  if (active.kind === "exam")
    active.answers.forEach((a) => {
      state.words[a.wordId].lastExposedAt = now;
    });
  if (active.advances) state.phase++;
  state.nextAt = now + (state.phase === 4 ? 0 : 5 * 60_000);
  state.active = null;
  return state;
}
export function validateState(value) {
  if (
    !value ||
    value.version !== 1 ||
    !Number.isInteger(value.phase) ||
    value.phase < 0 ||
    value.phase > 10000 ||
    !Number.isInteger(value.totalSteps) ||
    value.totalSteps < 0
  )
    return false;
  if (
    !(value.startedAt === null || Number.isFinite(value.startedAt)) ||
    !Number.isFinite(value.nextAt) ||
    !Array.isArray(value.sessions) ||
    value.sessions.length > 100
  )
    return false;
  for (const w of WORDS) {
    const p = value.words?.[w.id];
    if (
      !p ||
      typeof p.seen !== "boolean" ||
      typeof p.delayed !== "boolean" ||
      !Number.isFinite(p.introducedAt) ||
      !Number.isFinite(p.lastExposedAt) ||
      !Number.isInteger(p.misses) ||
      p.misses < 0
    )
      return false;
    for (const key of requiredSkills(w)) {
      const s = p.skills?.[key];
      if (
        !s ||
        !Number.isInteger(s.wins) ||
        s.wins < 0 ||
        s.wins > 2 ||
        !Number.isInteger(s.attempts) ||
        s.attempts < 0 ||
        !Number.isInteger(s.lastStep)
      )
        return false;
    }
  }
  const responseValid = (r) =>
    !!r &&
    !!BY_ID[r.wordId] &&
    TYPES.includes(r.type) &&
    r.type !== "teach" &&
    typeof r.correct === "boolean" &&
    typeof r.assisted === "boolean" &&
    typeof r.input === "string" &&
    typeof r.expected === "string" &&
    typeof r.message === "string" &&
    Number.isFinite(r.at);
  if (
    !value.sessions.every(
      (s) =>
        s &&
        ["course", "extra", "exam"].includes(s.kind) &&
        Number.isInteger(s.phase) &&
        Number.isFinite(s.finishedAt) &&
        Number.isFinite(s.startedAt) &&
        Number.isInteger(s.count) &&
        s.count >= 0 &&
        Number.isInteger(s.correct) &&
        s.correct >= 0 &&
        s.correct <= s.count &&
        Number.isFinite(s.score) &&
        s.score >= 0 &&
        s.score <= 100 &&
        Array.isArray(s.mistakes) &&
        s.mistakes.every(responseValid),
    )
  )
    return false;
  if (value.active !== null) {
    const a = value.active;
    if (
      !a ||
      !["course", "extra", "exam"].includes(a.kind) ||
      typeof a.advances !== "boolean" ||
      typeof a.helped !== "boolean" ||
      typeof a.draft !== "string" ||
      a.draft.length > 200 ||
      (a.teachingStep !== undefined &&
        (!Number.isInteger(a.teachingStep) ||
          a.teachingStep < 0 ||
          a.teachingStep > 2)) ||
      (a.correcting !== undefined && typeof a.correcting !== "boolean") ||
      (a.correction !== undefined &&
        (typeof a.correction !== "string" || a.correction.length > 200)) ||
      !Number.isInteger(a.phase) ||
      !Number.isInteger(a.initialCount) ||
      !Number.isInteger(a.completed) ||
      !Number.isFinite(a.startedAt) ||
      !Array.isArray(a.answers) ||
      !a.answers.every(responseValid) ||
      !Array.isArray(a.queue) ||
      !a.queue.length ||
      a.queue.length > 500
    )
      return false;
    if (
      !a.queue.every(
        (q) =>
          q &&
          BY_ID[q.wordId] &&
          TYPES.includes(q.type) &&
          (q.type !== "form" || BY_ID[q.wordId].forms.length) &&
          Number.isInteger(q.variant) &&
          q.variant >= 0 &&
          Number.isInteger(q.retry) &&
          q.retry >= 0 &&
          q.retry <= 2,
      )
    )
      return false;
    if (
      a.feedback !== null &&
      !(a.kind === "exam" && a.feedback.hidden === true) &&
      !responseValid(a.feedback)
    )
      return false;
  }
  return true;
}
