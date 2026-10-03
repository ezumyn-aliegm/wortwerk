export const LEARNING_WEIGHTS = Object.freeze({ meaning: 20, spelling: 40, usage: 20, form: 10 });
export const DELAY_MS = 8 * 3_600_000;
export const usesLearningScore = (words) => words.length > 0 && words.every((w) => w.studyVersion === 2);
export const targetKey = (q) => `${q.wordId}/${q.type}${['usage', 'form'].includes(q.type) ? `:${q.variant}` : ''}`;
export const assessedFormVariants = (word) => word.assessedFormVariants ?? word.forms.map((_, i) => i);

export function learningTargets(words) {
  return words.flatMap((w) => [
    { wordId: w.id, type: 'meaning', variant: 0 },
    { wordId: w.id, type: 'spelling', variant: 0 },
    ...w.usages.map((_, variant) => ({ wordId: w.id, type: 'usage', variant })),
    ...assessedFormVariants(w).map((variant) => ({ wordId: w.id, type: 'form', variant })),
  ]);
}

export function freshLearning(words) {
  if (!words.every((w) => w.usages.length) || !words.some((w) => w.forms.length))
    throw new Error('Wave2 needs usage for every word and reviewed form targets.');
  return {
    version: 2,
    // Freeze the denominator and reviewed answers in the save.
    contract: JSON.stringify(words.map((w) => [w.id, w.german, w.english, w.meaningAnswers || [], w.usages, w.forms,
      ...(w.assessedFormVariants === undefined ? [] : [w.assessedFormVariants])])),
    targets: Object.fromEntries(learningTargets(words).map((q) => [targetKey(q), { steps: 0, attempts: 0, other: 3, repair: false }])),
    verification: Object.fromEntries(words.map((w) => [w.id, { delayed: false, finalSpelling: false, finalTransfer: false, exposedAt: 0 }])),
  };
}

export function exposeLearning(learning, wordId, topic, now) {
  const key = `${wordId}/${topic}`;
  if (learning.targets[key]) learning.targets[key].other = 0;
  // Sentence/form feedback also displays German; conservatively restart its clock.
  learning.verification[wordId].exposedAt = now;
}

export function learningSummary(learning, words) {
  const categories = {};
  let percent = 0;
  for (const [type, weight] of Object.entries(LEARNING_WEIGHTS)) {
    const targets = learningTargets(words).filter((q) => q.type === type);
    const earned = targets.reduce((n, q) => n + learning.targets[targetKey(q)].steps, 0);
    categories[type] = { earned, possible: targets.length * 2, weight };
    percent += weight * earned / (targets.length * 2);
  }
  const initialComplete = Object.values(learning.targets).every((t) => t.steps === 2);
  const checks = Object.values(learning.verification);
  const earned = checks.reduce((n, v) => n + Number(v.delayed) + Number(v.finalSpelling && v.finalTransfer), 0);
  categories.verification = { earned, possible: words.length * 2, weight: 10 };
  percent += 10 * earned / (words.length * 2);
  const complete = initialComplete && checks.every((v) => v.delayed && v.finalSpelling && v.finalTransfer);
  return {
    scoringVersion: 2, percent: complete ? 100 : Math.min(99.9, Math.floor((percent + 1e-9) * 10) / 10),
    complete, initialComplete, categories,
    repairs: Object.entries(learning.targets).filter(([, t]) => t.repair).map(([key]) => key),
    attempts: Object.values(learning.targets).reduce((n, t) => n + t.attempts, 0),
    ready: words.filter((w) => learningTargets([w]).every((q) => learning.targets[targetKey(q)].steps === 2)
      && learning.verification[w.id].delayed && learning.verification[w.id].finalSpelling && learning.verification[w.id].finalTransfer).length,
    nextDelayedAt: Math.min(...checks.filter((v) => !v.delayed && v.exposedAt > 0).map((v) => v.exposedAt + DELAY_MS)),
  };
}

// Called once per accepted question. Tutor feedback guards duplicate deliveries.
export function recordLearning(learning, q, { correct, assisted, at, exam = false }) {
  const key = targetKey(q), t = learning.targets[key], v = learning.verification[q.wordId];
  // Historical answers to retired targets remain in the session history, not mastery.
  if (!t) return false;
  const independent = !assisted && !q.retry && (correct ? t.other >= 3 : !t.repair || t.other >= 3);
  t.attempts++;
  if (independent) {
    if (correct) {
      t.steps = Math.min(2, t.steps + 1);
      t.repair = false;
    } else {
      t.steps = Math.max(0, t.steps - 1);
      t.repair = true;
      if (q.type === 'spelling') { v.delayed = false; v.finalSpelling = false; }
      if (q.type === 'usage' || q.type === 'form') v.finalTransfer = false;
    }
    if (q.type === 'spelling' && correct && v.exposedAt > 0 && at - v.exposedAt >= DELAY_MS) v.delayed = true;
    if (exam && !q.spacingOnly) {
      if (q.type === 'spelling') v.finalSpelling = correct;
      else if (q.type === 'usage' || q.type === 'form') v.finalTransfer = correct;
    }
  }
  // Every retry resets spacing; only questions on OTHER targets count.
  for (const [otherKey, other] of Object.entries(learning.targets))
    other.other = otherKey === key ? 0 : Math.min(3, other.other + 1);
  if (!exam) exposeLearning(learning, q.wordId, key.split('/')[1], at);
  return independent && correct;
}

export function validateLearning(value, words) {
  try {
    const fresh = freshLearning(words);
    if (value?.version !== 2 || value.contract !== fresh.contract) return false;
    if (Object.keys(value.targets).length !== Object.keys(fresh.targets).length
      || Object.keys(value.verification).length !== words.length) return false;
    return Object.keys(fresh.targets).every((key) => {
      const t = value.targets[key];
      return t && Number.isInteger(t.steps) && t.steps >= 0 && t.steps <= 2
        && Number.isSafeInteger(t.attempts) && t.attempts >= 0
        && Number.isInteger(t.other) && t.other >= 0 && t.other <= 3 && typeof t.repair === 'boolean';
    }) && words.every((w) => {
      const v = value.verification[w.id];
      return v && ['delayed', 'finalSpelling', 'finalTransfer'].every((k) => typeof v[k] === 'boolean')
        && Number.isFinite(v.exposedAt) && v.exposedAt >= 0;
    });
  } catch { return false; }
}
