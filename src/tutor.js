import { requiredSkills } from "./data.js";
import { freshGame, freshVillage, updateVillage, awardGame, gameStatus, validateGame } from "./game.js";
import { usesLearningScore, freshLearning, learningTargets, targetKey, learningSummary, recordLearning, exposeLearning, validateLearning, DELAY_MS, assessedFormVariants } from './scoring.js';

export function createTutor(WORDS, { deadlineAt = null } = {}) {
  const BY_ID = Object.fromEntries(WORDS.map((w) => [w.id, w]));
  const scoringV2 = usesLearningScore(WORDS);

  const STORAGE_KEY = "wortwerk.progress.v1";
  const HOUR = 3_600_000;
  const TYPES = ["teach", "meaning", "spelling", "usage", "form"];
  function teachingPages(word, question = {}) {
    if (question.focus) return teachingPages(word).filter((page) => page.tags.includes(question.focus));
    if (question.intro) return [{
      kind: "discovery",
      label: "Word forge",
      tags: ["meaning", "spelling"],
      answer: word.german,
    }];
    return [
      {
        kind: "picture",
        label: "Make a link",
        tags: ["meaning"],
        answer: word.german,
      },
      {
        kind: "spelling",
        label: "Spell it",
        tags: ["spelling"],
        answer: word.german,
      },
      {
        kind: "example",
        label: "Use it",
        tags: [],
        answer: word.example,
        translation: word.translation,
        explanation: word.tip,
      },
      ...word.usages.map(([sentence, translation, answer], variant) => ({
        kind: "usage",
        label: `Sentence ${variant + 1}`,
        tags: [`usage:${variant}`],
        prompt: sentence,
        answer: sentence.replace("___", answer),
        translation,
        explanation: word.tip,
      })),
      ...assessedFormVariants(word).map((variant) => {
        const [prompt, answer, explanation] = word.forms[variant];
        return {
        kind: "form",
        label: `Word form ${variant + 1}`,
        tags: [`form:${variant}`],
        prompt,
        answer,
        explanation,
      }; }),
    ];
  }
  function questionTopic(q) {
    const w = BY_ID[q.wordId];
    return ["usage", "form"].includes(q.type)
      ? `${q.type}:${q.variant % (q.type === "usage" ? w.usages.length : w.forms.length)}`
      : q.type;
  }
  function missingTeaching(state) {
    const a = state.active;
    if (scoringV2 && a && !a.feedback && a.queue[0].type === 'teach') {
      const word = BY_ID[a.queue[0].wordId];
      return { kind: 'complete', label: 'Meet your new word', wordId: word.id, topic: 'intro',
        answer: word.german, tags: teachingPages(word).flatMap((p) => p.tags) };
    }
    if (!a || a.feedback || a.queue[0].type === "teach") return null;
    const check =
      a.kind === "exam" || (!scoringV2 && a.kind === "course" && a.phase === 4)
        ? a.queue
        : a.queue.slice(0, 1);
    for (const q of check) {
      if (q.type === "teach") continue;
      const topic = questionTopic(q);
      if (!(state.words[q.wordId].taught || []).includes(topic)) {
        const page = teachingPages(BY_ID[q.wordId]).find((p) =>
          p.tags.includes(topic),
        );
        return { ...page, wordId: q.wordId, topic };
      }
    }
    return null;
  }
  function acknowledgeTeaching(original, now = Date.now()) {
    if (scoringV2 && original.active?.queue[0].type === 'teach') {
      let state = original;
      const q = original.active.queue[0];
      for (let step = 1; step < teachingPages(BY_ID[q.wordId], q).length; step++) state = setTeachingStep(state, step);
      return advance(state, now);
    }
    const lesson = missingTeaching(original);
    if (!lesson) return original;
    const state = structuredClone(original),
      p = state.words[lesson.wordId];
    p.taught = [...new Set([...(p.taught || []), ...lesson.tags])];
    p.lastExposedAt = now;
    if (scoringV2) {
      p.seen = true;
      p.introducedAt ||= now;
      exposeLearning(state.learning, lesson.wordId, lesson.topic, now);
    }
    const a = state.active;
    a.taughtHere = [
      ...new Set([...(a.taughtHere || []), `${lesson.wordId}/${lesson.topic}`]),
    ];
    a.preparationAdded = true;
    return state;
  }
  const PHASES = [
    {
      title: "Meet your first words",
      short: "First words",
      day: 1,
      minutes: "15–20",
      coach:
        "I’ll introduce a few words at a time. Then you’ll try them from memory.",
    },
    {
      title: "Build on what you know",
      short: "Next words",
      day: 1,
      minutes: "15–20",
      coach:
        "New words, plus a few familiar ones. I’ll bring back anything that needs another look.",
    },
    {
      title: "Meet the remaining words",
      short: "Remaining words",
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
        "All your words, mixed together. This will show us what needs attention next.",
    },
    {
      title: "What stayed with you?",
      short: "Recall check",
      day: 2,
      minutes: "10–15",
      coach:
        "Try every word from memory before reviewing. It’s okay to forget: that tells me what to teach next.",
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
      coach: `${WORDS.length * 2} questions: every word from memory, then sentence use or word forms. Answers stay hidden until the end. Take your time.`,
    },
  ];
  function freshState() {
    return {
      ...(scoringV2 ? { learning: freshLearning(WORDS), game: freshVillage() } : {}),
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
            taught: [],
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
  function mastery(state, id) {
    if (scoringV2) {
      const targets = learningTargets([BY_ID[id]]).map((q) => state.learning.targets[targetKey(q)]);
      const v = state.learning.verification[id];
      const ready = targets.every((t) => t.steps === 2) && v.delayed && v.finalSpelling && v.finalTransfer;
      const percent = 90 * targets.reduce((n, t) => n + t.steps, 0) / (targets.length * 2)
        + 5 * Number(v.delayed) + 5 * Number(v.finalSpelling && v.finalTransfer);
      return { percent: ready ? 100 : Math.min(99, Math.floor(percent)), ready, label: ready ? 'Verified' : state.words[id].seen ? 'Practicing' : 'Not introduced' };
    }
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
  function summary(state) {
    if (scoringV2) return { ...learningSummary(state.learning, WORDS), introduced: WORDS.filter((w) => state.words[w.id].seen).length };
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
  function dayTwoAt(state) {
    if (scoringV2) return summary(state).nextDelayedAt;
    if (!state.startedAt) return 0;
    const tomorrow = new Date(state.startedAt);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const latestIntro = Math.max(
      state.startedAt,
      ...Object.values(state.words).map((w) => w.introducedAt),
    );
    const spaced = Math.max(tomorrow.getTime(), latestIntro + 8 * HOUR);
    // Leave room for repair and rehearsal before class. Short recall is never
    // credited as delayed mastery: answerQuestion still requires eight hours.
    return deadlineAt ? Math.min(spaced, deadlineAt - 12 * HOUR) : spaced;
  }
  function delayedReviewAt(state) {
    if (scoringV2) return summary(state).initialComplete ? summary(state).nextDelayedAt : 0;
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
  function dueAt(state) {
    if (scoringV2) {
      const stats = summary(state);
      if (stats.complete) return 0;
      // Failed final items can be repaired now; waiting applies only when every other check is complete.
      const finalDone = Object.values(state.learning.verification).every((v) => v.finalSpelling && v.finalTransfer);
      return stats.initialComplete && finalDone ? stats.nextDelayedAt : 0;
    }
    return Math.max(
      state.nextAt,
      state.phase === 4 ? dayTwoAt(state) : 0,
      delayedReviewAt(state),
    );
  }
  const phaseInfo = (state) => scoringV2 ? {
    title: summary(state).initialComplete ? 'Verify and repair' : 'Learn to build',
    short: 'Village mission', minutes: '5–8', day: 1,
    coach: 'Independent recall builds your village. Guided practice helps you prepare.',
  } :
    PHASES[state.phase] || {
      title: "Make the last words stick",
      short: "Follow-up practice",
      day: 2,
      minutes: "10–15",
      coach:
        "Your results choose this session. We’ll revisit weak skills and check recall after a gap.",
    };
  const hash = (str) =>
    [...str].reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 7) >>>
    0;
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
  ].filter((id) => BY_ID[id]);
  courseOrder.push(
    ...WORDS.filter((w) => !courseOrder.includes(w.id)).map((w) => w.id),
  );
  function weakestSkills(state, id) {
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
      const skills = weakestSkills(state, id).filter(
        (k) => p.skills[k].wins < 2,
      );
      if (
        !p.delayed &&
        now - p.lastExposedAt >= 8 * HOUR &&
        !skills.includes("spelling")
      )
        skills.unshift("spelling");
      if (deadlineAt && deadlineAt - now <= 24 * HOUR)
        skills.sort(
          (a, b) => Number(b === "spelling") - Number(a === "spelling"),
        );
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
  function buildQueue(state, kind = "course", now = Date.now()) {
    if (scoringV2) {
      const stats = summary(state);
      if (stats.complete) return [];
      if (stats.initialComplete && kind !== 'extra') {
        const verification = state.learning.verification;
        const first = !state.sessions.some((s) => s.kind === 'exam');
        const checks = [
          ...WORDS.filter((w) => first || !verification[w.id].finalSpelling || (!verification[w.id].delayed && now >= verification[w.id].exposedAt + DELAY_MS))
            .map((w) => question(w.id, 'spelling')),
          ...WORDS.filter((w) => first || !verification[w.id].finalTransfer).map((w, i) => {
            const forms = assessedFormVariants(w);
            const type = forms.length && i % 2 === 0 ? 'form' : 'usage';
            return question(w.id, type, type === 'form' ? forms[(state.sessions.length + i) % forms.length] : (state.sessions.length + i) % w.usages.length);
          }),
        ];
        const spaced = [], simulated = structuredClone(state.learning.targets), targets = learningTargets(WORDS);
        for (const q of checks) {
          while (simulated[targetKey(q)].other < 3) {
            const filler = targets.find((t) => targetKey(t) !== targetKey(q) && simulated[targetKey(t)].other >= 3);
            if (!filler) break;
            spaced.push(question(filler.wordId, filler.type, filler.variant, { spacingOnly: true }));
            for (const [key, t] of Object.entries(simulated)) t.other = key === targetKey(filler) ? 0 : Math.min(3, t.other + 1);
          }
          spaced.push(q);
          for (const [key, t] of Object.entries(simulated)) t.other = key === targetKey(q) ? 0 : Math.min(3, t.other + 1);
        }
        return spaced;
      }
      const targets = learningTargets(WORDS);
      const needs = targets.filter((q) => state.learning.targets[targetKey(q)].steps < 2);
      if (!needs.length) return [];
      const queue = [], simulated = structuredClone(state.learning.targets);
      while (queue.length < 6) {
        const due = needs.filter((q) => !queue.some((a) => targetKey(a) === targetKey(q)))
          .sort((a, b) => Number(simulated[targetKey(b)].other >= 3) - Number(simulated[targetKey(a)].other >= 3)
            || (kind === 'extra' ? Number(b.type === 'spelling') - Number(a.type === 'spelling') : Number(['usage', 'form'].includes(b.type)) - Number(['usage', 'form'].includes(a.type)))
            || simulated[targetKey(a)].attempts - simulated[targetKey(b)].attempts);
        let q = due.find((q) => simulated[targetKey(q)].other >= 3);
        // Space a remaining repair with already learned OTHER targets, even in a one-word wave.
        q ||= targets.find((q) => simulated[targetKey(q)].other >= 3);
        q ||= due[0];
        if (!q) break;
        queue.push(question(q.wordId, q.type, q.variant));
        for (const [key, t] of Object.entries(simulated)) t.other = key === targetKey(q) ? 0 : Math.min(3, t.other + 1);
      }
      const introduced = new Set();
      return queue.flatMap((q) => {
        if (state.words[q.wordId].seen || introduced.has(q.wordId)) return [q];
        introduced.add(q.wordId);
        return [question(q.wordId, 'teach'), q];
      });
    }
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
      const start = Math.floor((state.phase * WORDS.length) / 3);
      const end = Math.floor(((state.phase + 1) * WORDS.length) / 3);
      const ids = courseOrder.slice(start, end);
      const queue = [];
      for (let i = 0; i < ids.length; i += 3) {
        const batch = ids.slice(i, i + 3);
        batch.forEach((id) => queue.push(
          question(id, "teach", 0, { intro: true }),
          question(id, "meaning"),
          question(id, "spelling"),
        ));
        for (const type of ["usage", "form"])
          batch.forEach((id) => {
            if (type !== "form" || BY_ID[id].forms.length)
              queue.push(question(id, type));
          });
      }
      if (state.phase)
        queue.push(
          ...shuffle(courseOrder.slice(0, start), "old-" + state.phase)
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
    if (state.phase === 5) {
      // Practice every remaining variant before the final rehearsal, one short
      // explanation at a time. Group by variant to space the same word apart.
      const missing = WORDS.filter((w) => state.words[w.id].seen).flatMap((w) =>
        ["usage", "form"].flatMap((type) =>
          (type === "usage" ? w.usages : w.forms).map((_, variant) => question(w.id, type, variant)),
        ),
      ).filter((q) => !(state.words[q.wordId].taught || []).includes(questionTopic(q)))
        .sort((a, b) => a.variant - b.variant || a.type.localeCompare(b.type));
      const repair = repairQueue(state, now);
      return [...missing, ...repair.filter((q) => !missing.some((m) =>
        m.wordId === q.wordId && questionTopic(m) === questionTopic(q)))];
    }
    return repairQueue(state, now);
  }
  function startSession(original, now = Date.now(), kind = "course") {
    if (original.active) return original;
    if (scoringV2) {
      if (kind === 'exam' && !summary(original).initialComplete) return original;
      if (now < dueAt(original) || summary(original).complete) return original;
    }
    if (!scoringV2 && kind === "course" && original.phase === 4 && now < dayTwoAt(original))
      return original;
    if (!scoringV2 && kind === "course" && now < delayedReviewAt(original)) return original;
    if (kind === "extra" && !summary(original).introduced) return original;
    const state = structuredClone(original);
    while (
      !scoringV2 && kind === "course" &&
      state.phase < 3 &&
      Math.floor((state.phase * WORDS.length) / 3) ===
        Math.floor(((state.phase + 1) * WORDS.length) / 3)
    )
      state.phase++;
    state.startedAt ||= now;
    const queue = buildQueue(state, kind, now);
    if (!queue.length) return original;
    state.active = {
      kind:
        scoringV2 ? (summary(state).initialComplete && kind !== 'extra' ? 'exam' : kind) : kind === "exam" || (kind === "course" && state.phase === 6)
          ? "exam"
          : kind,
      advances: kind === "course",
      phase: state.phase,
      queue,
      initialCount: scoringV2 ? queue.filter((q) => q.type !== 'teach').length : queue.length,
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
  function describe(q) {
    const w = BY_ID[q.wordId];
    if (q.type === "teach") return { title: w.german, answer: w.german };
    if (q.type === "meaning") {
      if (scoringV2) return { title: `What does “${w.german}” mean?`, answer: w.english,
        instruction: 'Recall the English meaning without choices.', explanation: `${w.german} means ${w.english}. ${w.tip}` };
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
      const [title, translation, answer] =
        w.usages[q.variant % w.usages.length];
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
  function normalize(text) {
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
  function grade(q, input) {
    const spec = describe(q),
      actual = canonicalAnswer(input, q),
      expected = normalize(spec.answer);
    if (actual === expected || (scoringV2 && q.type === 'meaning' && [BY_ID[q.wordId].english, ...(BY_ID[q.wordId].meaningAnswers || [])]
      .some((answer) => normalize(answer).toLowerCase() === actual.toLowerCase())))
      return {
        correct: true,
        expected: spec.answer,
        message: spec.explanation,
      };
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
    else if (q.type === 'spelling') {
      const bareExpected = expected.replace(/^(der|die|das|sich) /, '');
      const bareActual = actual.replace(/^(der|die|das|sich) /, '');
      if (bareExpected === bareActual && BY_ID[q.wordId].kind === 'noun') {
        reason = `The noun is spelled correctly. Check the article: learn ${expected} together.`;
      } else {
        const pattern = ['ie', 'ei', 'sch', 'ch', 'ff', 'mm', 'pp', 'ss', 'rr', 'ck'].find(part =>
          bareExpected.includes(part) && !bareActual.includes(part));
        reason = pattern
          ? `You wrote “${actual}”. In “${expected}”, notice the spelling block “${pattern}”. Copy the correct spelling, then try it from memory later.`
          : `You wrote “${actual}”. Compare it with “${expected}”: check the letters and their order. Copy it once, then try from memory later.`;
      }
    }
    return {
      correct: false,
      expected: spec.answer,
      message: `${reason} ${spec.explanation}`,
    };
  }
  function setDraft(original, draft) {
    if (!original.active || original.active.feedback) return original;
    return {
      ...original,
      active: { ...original.active, draft: draft.slice(0, 200) },
    };
  }
  function setCorrection(original, correction) {
    if (!original.active?.feedback || original.active.kind === "exam")
      return original;
    return {
      ...original,
      active: { ...original.active, correction: correction.slice(0, 200) },
    };
  }
  function setTeachingStep(original, teachingStep) {
    if (
      !original.active ||
      original.active.queue[0].type !== "teach" ||
      !Number.isInteger(teachingStep) ||
      teachingStep < 0 ||
      teachingStep >=
        teachingPages(BY_ID[original.active.queue[0].wordId], original.active.queue[0]).length ||
      teachingStep > (original.active.teachingStep || 0) + 1
    )
      return original;
    const state = structuredClone(original),
      p = state.words[state.active.queue[0].wordId];
    if (teachingStep > (state.active.teachingStep || 0)) {
      const page = teachingPages(BY_ID[state.active.queue[0].wordId], state.active.queue[0])[
        state.active.teachingStep || 0
      ];
      p.taught = [...new Set([...(p.taught || []), ...page.tags])];
    }
    state.active.teachingStep = teachingStep;
    return state;
  }
  function startCorrection(original) {
    if (!correctionNeeded(original)) return original;
    return { ...original, active: { ...original.active, correcting: true } };
  }
  function correctionNeeded(state) {
    const a = state.active;
    return !!(
      a &&
      a.kind !== "exam" &&
      ["spelling", "usage", "form"].includes(a.queue[0].type) &&
      a.feedback &&
      !a.feedback.correct
    );
  }
  function correctionReady(state) {
    return (
      !correctionNeeded(state) ||
      grade(state.active.queue[0], state.active.correction || "").correct
    );
  }
  function useHint(original, now = Date.now()) {
    if (
      !original.active ||
      original.active.kind === "exam" ||
      (!scoringV2 && original.active.phase === 4 && original.active.kind === "course") ||
      original.active.feedback
    )
      return original;
    const state = structuredClone(original);
    state.active.helped = true;
    state.words[state.active.queue[0].wordId].lastExposedAt = now;
    if (scoringV2) exposeLearning(state.learning, state.active.queue[0].wordId, questionTopic(state.active.queue[0]), now);
    return state;
  }
  function visitWordbank(original, now = Date.now()) {
    if (
      original.active &&
      (original.active.kind === "exam" ||
        (!scoringV2 && original.active.phase === 4 && original.active.kind === "course"))
    )
      return original;
    const state = structuredClone(original);
    for (const word of Object.values(state.words))
      if (word.seen) word.lastExposedAt = now;
    if (scoringV2) for (const w of WORDS) if (state.words[w.id].seen)
      for (const q of learningTargets([w])) exposeLearning(state.learning, w.id, questionTopic(q), now);
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
  function answerQuestion(original, input, now = Date.now()) {
    if (!original.active || original.active.feedback) return original;
    if (missingTeaching(original)) return original;
    const state = structuredClone(original),
      active = state.active,
      q = active.queue[0],
      p = state.words[q.wordId];
    if (q.type === "teach") return original;
    const result = grade(q, input),
      assisted =
        active.helped ||
        (active.taughtHere || []).includes(`${q.wordId}/${questionTopic(q)}`);
    state.totalSteps++;
    if (!scoringV2) recordSkill(p, q.type, result.correct, assisted, state.totalSteps);
    if (!scoringV2 && q.type === "spelling") {
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
      retry: q.retry,
      at: now,
      ...(scoringV2 && q.spacingOnly ? { spacingOnly: true } : {}),
    };
    if (scoringV2 && active.kind !== 'exam') {
      const independentSuccess = recordLearning(state.learning, q, { ...result, assisted, at: now, exam: active.kind === 'exam' });
      state.game = updateVillage(state.game, summary(state), independentSuccess);
      response.independentSuccess = independentSuccess;
      // Mirror aggregate skills only for legacy parent displays; scoring uses per-target evidence.
      for (const type of requiredSkills(BY_ID[q.wordId])) {
        const targets = learningTargets([BY_ID[q.wordId]]).filter((t) => t.type === type).map((t) => state.learning.targets[targetKey(t)]);
        if (!targets.length) continue;
        p.skills[type].wins = Math.min(...targets.map((t) => t.steps));
        p.skills[type].attempts = targets.reduce((n, t) => n + t.attempts, 0);
      }
      p.delayed = state.learning.verification[q.wordId].delayed;
    } else if (!scoringV2 && active.kind !== "exam") {
      const game = state.game || freshGame();
      const previousMiss = [
        ...active.answers,
        ...state.sessions.flatMap((s) => s.mistakes),
      ].some((a) => a.wordId === q.wordId && a.type === q.type && !a.correct);
      state.game = awardGame(game, response, { previousMiss });
      response.reward =
        gameStatus(state.game).earnedBlocks - gameStatus(game).earnedBlocks;
    }
    active.answers.push(response);
    if (active.taughtHere)
      active.taughtHere = active.taughtHere.filter(
        (topic) => topic !== `${q.wordId}/${questionTopic(q)}`,
      );
    active.feedback = active.kind === "exam" ? { hidden: true } : response;
    if (
      !scoringV2 && active.kind !== "exam" &&
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
          question(q.wordId, "teach", q.variant, {
            revisit: true,
            ...(["meaning", "spelling"].includes(q.type)
              ? { intro: true }
              : { focus: questionTopic(q) }),
          }),
        );
      active.queue.splice(
        Math.min(active.queue.length, position + (q.retry >= 1 ? 4 : 0)),
        0,
        retry,
      );
    }
    return state;
  }
  function advance(original, now = Date.now()) {
    if (!original.active) return original;
    const current = original.active.queue[0];
    if (current.intro && normalize(original.active.draft) !== normalize(BY_ID[current.wordId].german))
      return original;
    if (
      current.type === "teach" &&
      (original.active.teachingStep || 0) !==
        teachingPages(BY_ID[current.wordId], current).length - 1
    )
      return original;
    if (current.type !== "teach" && !original.active.feedback) return original;
    if (!correctionReady(original)) return original;
    const state = structuredClone(original),
      active = state.active,
      p = state.words[current.wordId];
    if (current.type === "teach") {
      const page = teachingPages(BY_ID[current.wordId], current)[active.teachingStep];
      p.taught = [...new Set([...(p.taught || []), ...page.tags])];
      p.seen = true;
      p.introducedAt ||= now;
      p.lastExposedAt = now;
      if (scoringV2) for (const tag of teachingPages(BY_ID[current.wordId], current).flatMap((p) => p.tags))
        exposeLearning(state.learning, current.wordId, tag, now);
      if (scoringV2) active.taughtHere = [...new Set([...(active.taughtHere || []),
        ...teachingPages(BY_ID[current.wordId], current).flatMap((p) => p.tags).map((tag) => `${current.wordId}/${tag}`)])];
    }
    if (scoringV2 && current.type !== 'teach' && active.kind !== 'exam')
      exposeLearning(state.learning, current.wordId, questionTopic(current), now);
    active.queue.shift();
    if (!scoringV2 || current.type !== 'teach') active.completed++;
    active.feedback = null;
    active.helped = false;
    active.draft = "";
    active.correction = "";
    active.teachingStep = 0;
    active.correcting = false;
    if (active.queue.length) return state;
    if (scoringV2 && active.kind === 'exam') {
      // Apply grades together so neither village movement nor coverage leaks answers during inspection.
      for (const a of active.answers) {
        if (!state.learning.targets[targetKey(a)]) continue;
        a.independentSuccess = recordLearning(state.learning, a, { ...a, exam: true });
        state.game = updateVillage(state.game, summary(state), a.independentSuccess);
        state.words[a.wordId].delayed = state.learning.verification[a.wordId].delayed;
      }
    }
    const assessedAnswers = scoringV2 ? active.answers.filter(a => state.learning.targets[targetKey(a)]) : active.answers;
    const retiredAnswers = active.answers.filter(a => !assessedAnswers.includes(a));
    const correct = assessedAnswers.filter(
      (a) => scoringV2 ? a.independentSuccess : a.correct && !a.assisted,
    ).length;
    const session = {
      kind: active.kind,
      phase: active.phase,
      startedAt: active.startedAt,
      finishedAt: now,
      count: assessedAnswers.length,
      correct,
      score: assessedAnswers.length
        ? Math.round((correct / assessedAnswers.length) * 100)
        : 0,
      mistakes: assessedAnswers.filter((a) => !a.correct || a.assisted),
      ...(retiredAnswers.length ? {retiredAnswers} : {}),
      firstTry:
        assessedAnswers.length -
        assessedAnswers.filter((a) => !a.correct || a.assisted).length,
      preparationAdded:
        !!active.preparationAdded || !!active.taughtHere?.length,
    };
    state.sessions.push(session);
    if (state.sessions.length > 100) state.sessions.shift();
    if (scoringV2 && active.kind === 'exam') {
      for (const a of active.answers) if (state.learning.targets[targetKey(a)]) exposeLearning(state.learning, a.wordId, questionTopic(a), now);
    }
    if (!scoringV2 && active.kind === "exam")
      active.answers.forEach((a) => {
        state.words[a.wordId].lastExposedAt = now;
        const previousMiss = state.sessions
          .flatMap((s) => s.mistakes)
          .some(
            (r) => r.wordId === a.wordId && r.type === a.type && !r.correct,
          );
        state.game = awardGame(state.game || freshGame(), a, { previousMiss });
      });
    if (active.advances) state.phase++;
    state.nextAt = now + (state.phase === 4 ? 0 : 5 * 60_000);
    state.active = null;
    return state;
  }
  function validateState(value) {
    if (scoringV2 && (!validateLearning(value?.learning, WORDS) || !validateGame(value?.game, WORDS)
      || value.game.percent !== learningSummary(value.learning, WORDS).percent)) return false;
    if (value?.game !== undefined && !validateGame(value.game, WORDS))
      return false;
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
      if (
        p.taught !== undefined &&
        (!Array.isArray(p.taught) ||
          p.taught.length > 30 ||
          new Set(p.taught).size !== p.taught.length ||
          !p.taught.every((t) =>
            teachingPages(w).some((page) => page.tags.includes(t)) ||
              w.forms.some((_, i) => t === `form:${i}`),
          ))
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
            a.teachingStep > 22)) ||
        (a.correcting !== undefined && typeof a.correcting !== "boolean") ||
        (a.preparationAdded !== undefined &&
          typeof a.preparationAdded !== "boolean") ||
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
            (q.intro === undefined || (q.intro === true && q.type === "teach")) &&
            (q.focus === undefined || (q.type === "teach" && !q.intro &&
              typeof q.focus === "string" && teachingPages(BY_ID[q.wordId]).some((page) => page.tags.includes(q.focus)))) &&
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
        a.taughtHere !== undefined &&
        (!Array.isArray(a.taughtHere) ||
          a.taughtHere.length > 3000 ||
          !a.taughtHere.every((t) => typeof t === "string" && t.length < 120))
      )
        return false;
      if (
        a.queue[0].type === "teach" &&
        (a.teachingStep || 0) >= teachingPages(BY_ID[a.queue[0].wordId], a.queue[0]).length
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

  return {
    scoringV2,
    WORDS,
    BY_ID,
    teachingPages,
    questionTopic,
    missingTeaching,
    acknowledgeTeaching,
    STORAGE_KEY,
    PHASES,
    freshState,
    mastery,
    summary,
    dayTwoAt,
    delayedReviewAt,
    dueAt,
    phaseInfo,
    weakestSkills,
    buildQueue,
    startSession,
    describe,
    normalize,
    grade,
    setDraft,
    setCorrection,
    setTeachingStep,
    startCorrection,
    correctionNeeded,
    correctionReady,
    useHint,
    visitWordbank,
    answerQuestion,
    advance,
    validateState,
  };
}
