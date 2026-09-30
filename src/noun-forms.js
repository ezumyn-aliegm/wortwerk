const nouns = {
  brief: ['der Brief', 'die Briefe', 'the letter', 'the letters', 'e', ''],
  job: ['der Job', 'die Jobs', 'the job', 'the jobs', 's', ''],
  treppe: ['die Treppe', 'die Treppen', 'one staircase', 'several staircases', 'n', 'English “the stairs” can mean one staircase. German die Treppe is singular; die Treppen means several staircases.'],
  fahrradtrial: ['der Fahrradtrial', 'die Fahrradtrials', 'one bike trial', 'several bike trials', 's', 'These articles follow your class sheet. Ask your teacher about the difference from the usual sporting word das Trial.'],
};

export function nounComparison(word) {
  const entry = nouns[word.id];
  if (word.kind !== 'noun' || !entry || word.german !== entry[0] || !word.forms.some(form => form[1] === entry[1])) return null;
  const [singular, plural, singularEnglish, pluralEnglish, ending, note] = entry;
  return {singular, plural, singularEnglish, pluralEnglish, ending, note};
}

export function showNounComparison(word, question, feedback = null, exam = false) {
  const forms = nounComparison(word);
  if (!forms || exam) return false;
  if (question.type === 'teach') return true;
  return question.type === 'form' && feedback?.correct === false &&
    word.forms[question.variant % word.forms.length]?.[1] === forms.plural;
}
