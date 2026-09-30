import React from 'react';
import { nounComparison } from './noun-forms.js';
import './noun-forms.css';

export default function NounComparison({word, Speech}) {
  const forms = nounComparison(word);
  if (!forms) return null;
  return <section className="noun-comparison" aria-label="Singular and plural forms">
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
        <strong lang="de">{forms.plural.slice(0,-forms.ending.length)}<mark>{forms.ending}</mark></strong>
        <p>{forms.pluralEnglish}</p>
        <Speech text={forms.plural} label="Hear plural form" caption="Hear plural" />
      </div>
    </div>
    <p className="noun-form-rule">Add <strong lang="de">-{forms.ending}</strong>. Learn both articles with the noun.</p>
    {forms.note && <p>{forms.note}</p>}
  </section>;
}
