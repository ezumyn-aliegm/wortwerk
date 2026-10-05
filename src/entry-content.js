export function formContent(word, variant) {
  const [prompt, answer, explanation] = word.forms[variant];
  const wholeNoun = word.studyVersion === 2 && word.kind === 'noun' && /^(der|die|das)$/.test(answer);
  return {
    prompt: wholeNoun ? `Write the complete German entry for ${word.english}, including its article.` : prompt,
    answer: wholeNoun ? word.german : answer,
    explanation,
    wholeNoun,
  };
}
