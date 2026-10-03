import React from 'react';
import { nounComparison } from './noun-forms.js';
import './noun-forms.css';

export default function NounComparison({word, Speech}) {
  const forms = nounComparison(word);
  if (!forms) return null;
  const comparison = <section className="noun-comparison" aria-label="Singular and plural forms">
    <h3>One or more than one?</h3>
    <div className="noun-form-pair">
      <div>
        <h4>Singular · one</h4>
        <strong lang="de">{forms.singular}</strong>
        <p>{forms.singularEnglish}</p>
        <Speech text={forms.singular} label="Hear singular form" caption="Hear singular" />
      </div>
      <div>
        <h4>Plural · more than one</h4>
        <strong lang="de">{forms.ending ? <>{forms.plural.slice(0,-forms.ending.length)}<mark>{forms.ending}</mark></> : forms.plural}</strong>
        <p>{forms.pluralEnglish}</p>
        <Speech text={forms.plural} label="Hear plural form" caption="Hear plural" />
      </div>
    </div>
    <p className="noun-form-rule">{forms.rule}</p>
    {forms.note && <p>{forms.note}</p>}
  </section>;
  return word.assessedFormVariants !== undefined ? <details className="optional-noun-forms">
    <summary>Good to know · other noun forms (not tested)</summary>
    <p>Learn the assigned word: <strong lang="de">{word.german}</strong>. You do not need to convert it to another form for this wave.</p>
    {comparison}
  </details> : comparison;
}
