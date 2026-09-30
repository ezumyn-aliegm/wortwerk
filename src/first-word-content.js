export function firstWordContent(word) {
  const pages = [
    {label:'Use it in a sentence', answer:word.example, translation:word.translation, explanation:word.tip},
    ...word.usages.map(([sentence,translation,answer], i) => ({label:`Practice example ${i+1}`, answer:sentence.replace('___',answer), translation, explanation:word.tip})),
    ...word.forms.map(([prompt,answer,explanation]) => ({label:'Learn this form', prompt, answer, explanation})),
  ];
  const seen = new Set();
  return pages.filter(page => {
    const key = page.prompt || page.answer;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
