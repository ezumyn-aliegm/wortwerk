# A practical guide to the next vocabulary waves

## The simple family workflow

1. Send clear photos or the teacher's list. Mark exactly which entries belong to the new wave.
2. Give the wave a name and an exact deadline, including time and time zone. For example: “Wave 2 — school life, Monday October 5, 2026 at 9:00 a.m., Miami.” Avoid “next Monday” in saved lesson files.
3. Have the assistant prepare and review the lesson, exercises, and German/English recordings. Review uncertainties rather than silently guessing.
4. Download an all-waves backup before adding the new lesson. For bundled Autumn Wave 2, use **Add Wave 2 · Autumn adventure** on the waves screen. Otherwise use **Import lesson file**, not **Restore backup**. Adding/importing preserves the library; restore replaces it.
5. Open the new wave and check its title, due date, word count, first card, and sound. Wait for synchronization and offline readiness before switching devices or leaving home.
6. Let the student follow the tutor. Use the parent dashboard to check independent accuracy and recurring errors, not just minutes or rewards.

Do not overwrite Wave 1 to make Wave 2. Each wave needs its own history. For a correction to a wave already in use, preserve its word IDs, exercise ordering, expected answers, progress, and current draft whenever possible. A change to the answer itself needs an explicit migration plan and retesting, not an invisible replacement.

## What every vocabulary entry needs

| Part | Authoring rule |
|---|---|
| Meaning | Use the teacher's intended sense, in plain English. Do not overload a beginner with every dictionary meaning. |
| Noun | Teach article + singular + plural together: **der Brief → die Briefe**. Explain English/German number differences such as **die Treppe**, one staircase, versus English “the stairs.” |
| Verb | Give the dictionary form and useful first-person sentence. Include required reflexive pronouns and prepositions: **sich interessieren für … / Ich interessiere mich für Musik.** |
| Separable verb | Show one joined dictionary form and one separated sentence: **mitkommen / Ich komme mit.** Teach irregular changes before asking for them. |
| Example | One short, natural German sentence with a natural English translation. Explain unavoidable unfamiliar words; avoid testing incidental vocabulary. |
| Memory link | One short link to the meaning or spelling. Familiar school, friends, sports, or Minecraft situations are optional, not mandatory. Never invent a translation or etymology to make a joke work. |
| Spelling | Highlight one or two real traps: **ie/ei**, double letters, umlauts, **ß**, capitals, spaces, or endings. Chunks are spelling blocks, not necessarily spoken syllables. |
| Sound | Record the word and useful sentence in German. Explain sound–spelling links in English; English approximations are starting points, not exact pronunciation. |
| Practice | Recognition, guided construction, hidden-answer spelling, sentence use, and applicable word forms. Every assessed form needs its own worked example first. |
| Correction | Show the exact expected answer, identify the error, require a supported repair, and revisit later without the answer visible. |

Aim for one teachable point at a time. Put the word and meaning first, a short memory cue next, and grammar detail in the worked example. Do not make the student read a paragraph to find the answer.

## The learning sequence

**Hear and understand → build with support → hide and retrieve → use in context → revisit later.**

Example for a plural:

- Show and say **der Brief / die Briefe**: one letter / several letters.
- Explain the change: keep **Brief**, add **e**.
- Supported practice: complete **die Brief_** with the model available.
- Independent recall later: “Write the letters in German, with the article.”
- Transfer: **Ich schreibe zwei Briefe.** Explain **zwei** before using it if it is new.

The current app offers worked examples, supported first attempts, delayed retries, and spelling/form checks. It does not provide free-form conversation assessment or automatic pronunciation scoring. Its readiness label means success on its prepared tasks, not general fluency. New question formats such as unrestricted sentence production require additional implementation and grading rules.

For a two-day deadline, introduce all assigned words on Day 1 in short sessions; mix them at the end. On Day 2, start with recall before review, repair the weak points, then do a mixed rehearsal. Leave time overnight: the app requires an eight-hour gap for its delayed-recall evidence. Do not cram until bedtime simply to fill a progress meter.

## Review checklist before release

- Transcription matches the highlighted source; no guessed articles or plurals.
- Meanings and example sentences are accurate and natural.
- Dictionary/worksheet disagreements are flagged for the teacher. For Wave 1, **Fahrradtrial** remains a class-sheet article exception, not a settled general rule.
- English-speaking pitfalls are explained: articles, singular/plural mismatches, reflexive pronouns, prepositions, false friends, and word order.
- Every tested answer has a worked teaching example; no new conjugation appears only in a quiz.
- The prompt has one intended answer. If several German answers are valid, constrain the prompt or implement accepted alternatives rather than calling valid German wrong.
- Spelling blocks reconstruct the exact entry, excluding its leading article or **sich**.
- A fresh test profile can finish the first lesson, make a deliberate mistake, see a useful correction, and resume after reload.
- Existing saved progress survives the update. Test in a separate profile; do not practice on the student's live account.
- Listen to new recordings, particularly umlauts, **ch**, compound words, and mixed-language explanations. An MP3 file existing is not a pronunciation check.
- Review the student's recurring errors after the first session. Revise an ineffective cue based on recall, not model rankings alone.

## Import format and audio: what the app currently supports

Use **Download format example** for the current JSON structure. A lesson contains **title**, **dueAt** (ISO timestamp with explicit time-zone offset), and **words**. Each word has **id, german, english, kind, example, translation, tip, usages, forms, memory**. Use the established kinds, especially **noun**, **reflexive verb**, and **separable verb**; behavior depends on these labels.

- A usage is `[German sentence containing ___, English translation, expected answer]`. Prefer one blank.
- A form is `[English prompt, expected German answer, explanation]`. The current two-part verb format asks for both missing words in order, separated by a space.
- Memory contains **scene, watch, recall, chunks**.
- The importer accepts 1–90 words per wave, up to 50 waves, and files up to 500 KB. These are technical limits, not ideal session sizes.
- JSON validation checks structure, not German accuracy or pedagogical quality.

**Important: a JSON import alone does not create audio.** The recording collector includes bundled Wave 1 and Autumn Wave 2. For another wave, the maintainer must include that wave's spoken lines in the collection, generate them with the existing Grok Voice batch script, rebuild the audio catalog/offline bundle, and test playback. There is no paid speech request during study. Unchanged recordings are reused. Keep API keys outside the project and browser.

New learning-linked waves opt in with `studyVersion: 2` on every word. Their reviewed targets and answers are frozen into saved progress. Every usage and form variant has its own evidence. Include `nounForms` (singular, plural, English meanings, rule) for explicit comparison cards, including nouns supplied in the plural. Do not opt an ongoing legacy wave into new scoring by editing its saved words. The bundled Wave 2 has a reproducible import file: run `node scripts/prepare-wave-two.mjs` to regenerate `wave-2-autumn.json` from `src/wave-two.js`.

For corrections, retain recordings needed by older tabs and unchanged imported lessons. Do not delete old clips as part of a routine content edit.

## Safe live updates

While anyone is studying, prepare and test locally only. Before replacing the live container: pause, wait for **Synced across devices**, export a backup, close study tabs, and preserve a server-data backup and prior image. Do not reset progress unless explicitly requested. After updating, verify the saved question, draft, counts, audio, and synchronization before other devices reopen. No deployment is scheduled automatically.

## Reusable request for the next set

> Prepare a new Wortwerk wave for an English-speaking eighth grader from these highlighted words. Title: [title]. Deadline: [date, time, time zone]. Preserve all existing waves and progress. Verify the transcription and flag teacher/dictionary disagreements. For every entry, teach meaning, sound, exact spelling, a natural sentence, and any assessed article, plural, reflexive, preposition, or separable-verb form before testing it. Use short age-appropriate memory links; no forced stories. Produce the validated lesson JSON, generate the needed German and English recordings using our existing Grok Voice workflow, and test a fresh lesson plus a wrong-answer correction and reload. Do not update the live container until everyone has paused and synced. Report what is ready locally versus live.
