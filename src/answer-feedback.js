// Read the submitted control, not a potentially older React draft (IME/autofill).
export function submittedAnswer(form, fallback = '') {
  const value = form.elements.namedItem('answer')?.value;
  return typeof value === 'string' ? value : fallback;
}

export function answerFeedback(feedback) {
  if (!feedback.correct) return {
    title:'Let’s fix this together.',
    input:feedback.input || 'No answer entered',
    expected:feedback.expected,
  };
  return {
    title:'Correct!',
    note:feedback.independentSuccess ? 'That was an independent success.'
      : feedback.assisted ? 'That was guided practice. We’ll try it again without help.'
      : 'We’ll check it again later to help it stick.',
  };
}

// Historical sessions used “correct” for mastery credit. Keep that evidence
// unchanged and derive answer accuracy separately from recorded wrong answers.
export function sessionAccuracy(session) {
  const wrong = session.mistakes.filter(a => !a.correct).length;
  const guided = session.mistakes.filter(a => a.correct && a.assisted).length;
  const correct = Math.max(0, session.count - wrong);
  const unaidedCorrect = Math.max(0, correct - guided);
  return {correct, wrong, guided, unaidedCorrect,
    unaidedPercent:session.count ? Math.round(100 * unaidedCorrect / session.count) : 0,
    masteryCredits:session.correct};
}
