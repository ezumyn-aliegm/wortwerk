# Recorded lesson voices

German pronunciation and English memory tips use prerecorded xAI Grok Voice
(Eve), not device voices. Playback uses local MP3 files; no API key or speech
service is needed on the student’s device or the deployed server.

After adding or changing lesson text, run from this project:

```sh
node scripts/prepare-voice.mjs
zsh -lc 'python3 ~/.agents/skills/grok-voice/scripts/prerecord.py batch voice-manifest.json'
npm test
npm run build
```

The shared skill loads XAI_API_KEY from the environment; zsh loads ~/.zshenv.
Never copy the key into this project or the browser. Generation incurs xAI
usage charges. Unchanged clips are skipped using public/voice/voice-index.json.
The manifest includes bundled Autumn Wave 2, current audio-button content and retained original-wave
recordings for older tabs and imported copies. Only new text is regenerated. Catalog
paths change when the text changes. New custom waves require regeneration.

The build includes audio in the offline cache. Allow the initial download to
finish while connected before travelling. Updates wait for existing study tabs
to close; they do not force-reload an active lesson. Missing recordings show a
message and leave written practice available, rather than using a poorer voice.

These are AI-generated voices. Review pronunciation before relying on new
lesson material; automated file checks cannot certify accent or pronunciation.

## Reviewed memory links

The 27 original-wave memory cues were replaced after independent reviews and
TypeSafe/Jev scoring. Existing unmodified Wave 1 saves display the revised cues
without rewriting their stored questions, drafts, feedback, mastery, or history.
Customized cues and imported waves remain as saved. The worksheet's
`der Fahrradtrial` remains explicitly qualified as class-sheet wording; no
article grading was silently changed.
