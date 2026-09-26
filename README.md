# Wortwerk

A self-guided German vocabulary tutor for family use. Vocabulary waves each have a deadline, saved session, and mastery record. Wave 1 contains 27 words and is due September 28, 2026 at 9:00 a.m. in Miami. The tutor uses memory pictures, spelling chunks, sentence practice, articles, reflexive verbs, and separable verbs. Answers determine what comes next.

React in the browser, one small Node server, one shared progress file. No AI API, account service, third-party analytics, or external database. Parent statistics stay in the same private family save. TTS is unchanged: device voices only.

## Run locally

Requires Node.js 22.12 or newer.

```sh
npm ci
npm test
npm run build
npm start
```

Open http://127.0.0.1:4173. Without a shared password, progress stays in this browser. A prebuilt copy can be launched with `Start Wortwerk.command` on a Mac without installing development dependencies.

## Shared family version

Copy `.env.example` to `.env`, set a strong shared password and your exact HTTPS origin, then:

```sh
docker compose up -d --build
```

The default port is loopback-only. Put a trusted HTTPS reverse proxy in front and restrict it to the home network. A containerized proxy needs a shared private network with the app; its localhost is not the host. Do not expose a public backend port. The app does not configure DNS, router ports, or certificates.

The `wortwerk-data` volume retains the JSON save and previous-save backup across container replacements. Do not use `docker compose down -v` unless deliberately deleting saved work. For a full consistent backup, stop the app briefly and copy the data volume. In-app backups also export the current progress.

Enter the same study password on each device. There is one shared student, not separate accounts. Authorization uses a signed HttpOnly cookie. Changing the password invalidates existing sessions. Offline browser copies are not encrypted: use a separate browser profile on shared computers.

## Switch devices or migrate

1. Wait for **Synced across devices** on the first device.
2. Open the same site on the next device and enter the study password if asked.
3. Continue the same question, draft, teaching step, and mastery record.

If devices diverge, choose which session to continue. The browser retains a conflict recovery copy; the server retains its previous save. Learning histories are not automatically merged. Use one device at a time.

To migrate the original standalone app: **Pause → Download progress backup** there; on the shared site use **Waves → Restore all-waves backup**. A version-1 backup becomes Wave 1 without changing its active question, draft, feedback, or mastery. Wait for sync and verify another device resumes correctly. Keep the original backup. Restore replaces the entire shared library once synced, after confirmation and a local recovery copy.

### Safe upgrade from the single-wave version

Do not update a live container while someone may be studying. First ask the family to pause, wait for **Synced across devices**, download a backup, and close all study tabs. Record the current server revision and preserve a timestamped copy of the volume and current image before deployment. Recheck the revision before restarting; if it changed, stop and resync. Never delete the volume. After deployment, verify the saved question, draft, teaching step, feedback, and counts on one device before others reopen. Keep the pre-upgrade backup. The server accepts old saves for migration, but rejects old-client writes once a version-2 library is stored; a stale tab cannot downgrade it. Do not roll back to the old image against a version-2 volume.

## Vocabulary waves

**Continue studying** recommends an actionable unfinished wave, prioritizing approaching deadlines. Each wave can be resumed independently. Edit its name/deadline in Miami time without resetting progress. Overdue work stays available and is never marked learned because its deadline passed. The route suggests learning, recall/repair and final rehearsal; it cannot send reminders when closed. A deadline within 12 hours brings cold recall forward, but delayed mastery still requires eight hours.

Add another wave with **Import lesson file**. **Download format example** provides a JSON template: `title`, `dueAt` (ISO date/time with explicit offset), and `words`. Every word needs a stable unique ID, German/English text, kind, example, translation, tip, usage tuples `[German sentence with ___, English translation, answer]`, optional form-exercise tuples `[prompt, answer, explanation]`, and `memory: {scene, watch, recall, chunks}`. Chunks must reconstruct the German word without its article or `sich` prefix. Prepared lesson files need language/content review; the app validates structure, not linguistic correctness. It does not extract photos automatically.

Imports support 1–90 words, up to 50 waves, and a 500 KB file limit. A conservative library-size limit reserves space for progress and statistics. Backups include every wave and statistics. The old standalone browser key is kept intact during migration.

## Parent dashboard

Filter by Today, This week (Monday start), All time, and wave, using Miami dates. See actual practice visits, estimated active time, days practiced, answers by skill, first-try accuracy, retries/hints, recent visits, spelling errors, current readiness, and final rehearsal results. Opening the app or dashboard alone is not a practice visit. A visit starts with a learning interaction; a five-minute interaction gap or a new page load starts a new visit. These visits are distinct from completed tutor-route sessions.

Time is conservatively sampled every 10 seconds while the lesson is visible, focused, unpaused, and has had an interaction within 90 seconds. Browser suspension and background time are excluded. Reading/listening can count as activity, not mastery. Time is approximate and the last partial interval may be omitted. No camera or microphone tracking. First-try correctness requires an unassisted answer on the initial attempt; retries cannot repair that score.

Timing and activity start with this update; historical totals are not fabricated from old tutor scores. Mastery retains earlier evidence. All-time totals remain, while detail keeps at most 365 Miami dates, 100 visits and 100 daily spelling examples, subject to the activity storage cap. The dashboard explains truncation. Whole-state revision sync and bounded event IDs prevent duplicate sync counts; divergent offline histories require a choice, not an automatic merge. Last successful sync is shown, and unsynced work from another device cannot be displayed. Parent controls share the family password, not a separate security role.

## Offline and car use

Open the app at home and wait for offline readiness before leaving. The shell and lesson are downloaded; answers stay locally until the server is reachable again. For home-only hosting, sync happens when back home. Unsynced answers cannot appear on another device.

Offline installation requires trusted HTTPS or localhost. Plain HTTP LAN addresses cannot install the offline cache. Clearing browser data removes the downloaded lesson and unsynced answers. Private browsing may not preserve them. Updates activate after old study tabs close, without forcing a mid-answer reload.

Car view is on by default for a **passenger**: large text, wide controls, and Picture it → Spell it → Use it screens. Keys 1–4 select choices; Enter submits typed answers. Buttons insert German characters at the cursor. German and English audio use device voices; some voices need internet. No microphone or pronunciation grading.

## How adaptation works

- New lessons start with an interactive spelling forge: assemble the full German entry from mnemonic chunks, then answer a meaning question and type it with the model hidden. One interactive screen precedes the first typed recall, rather than 19 reading screens. Articles, spaces, capitals, umlauts and reflexive prefixes matter. A copied build earns no mastery or blocks.
- Teach before testing: a short worked example appears immediately before an untaught sentence or word form. Its first response is supported practice; later hidden-answer retrieval can count normally. Day 2 repair covers remaining variants before rehearsal. Older active queues, lesson pages, drafts and feedback are preserved exactly; newly started lessons use the forge. A rehearsal needing preparation is labeled supported practice, not an independent score.
- Learn: three groups of words, then a mixed check (nine words per group for Wave 1).
- Recall: a cold check, targeted practice, and a rehearsal with two questions per word (54 for Wave 1).
- Missed or helped answers return later; repeated misses get another teaching card. Retries are bounded.
- Wrong spelling, sentence completions and word forms require an exact practice correction, then hidden-answer recall. Plural corrections use the plural, not the singular dictionary word. Copies and hints earn no mastery.
- Meaning, spelling, usage, and relevant forms require two unaided successes separated by other questions. A word also needs recall after eight hours.
- Spelling includes noun capitals, articles, reflexive sich, umlauts, ß, and spacing. Whitespace and final punctuation are normalized.
- Final-test grades stay hidden until completion and are separate from mastery.

This is an adaptive rules engine with prepared content, not conversational AI. It guides study while open, but cannot make the student return or send closed-app reminders. Time estimates are not learning guarantees.

## Build an outpost

An original voxel-building game sits around the tutor. Six graded answers offer a building break, including when the student is struggling. Remembering a meaning earns one block; unaided spelling, usage and forms earn two. Rewards are capped at two successes per word/skill, with one extra comeback block after an earlier mistake. Hints, copied corrections and simply reading lessons do not earn resources. Mistakes never remove resources or buildings.

The island, selected blueprint, block inventory and six-answer mission stay visible on the learning screen. Wide Mac layouts put the island beside the lesson; narrower windows put it above. When enough blocks are available, the student can build directly from the mission panel. The full outpost view is for exploring and choosing other blueprints, not the only place the game is visible.

Choose a cabin, lookout, greenhouse, library or portal blueprint, then spend earned blocks to add it to the island. The cabin can be earned early. The lookout, greenhouse and library unlock after discovering one third, two thirds and all of the wave's words. The portal needs every word to meet the repeated-skill and delayed-recall standard. Thresholds scale for imported waves. Existing earned buildings are retained, never taken away. The choice, resources, reward caps, mission checkpoint and buildings are part of that wave’s normal saved progress and backup. Existing saves start with no fabricated game rewards. Short imported waves may not contain enough distinct skills to fund every building; rewards never override learning rules.

Building breaks never interrupt a cold recall check or final rehearsal. Exam resources are awarded only after finishing, so game feedback cannot reveal answers. The art is bundled for offline use; there are no extra game services, subscriptions, tracking, countdowns or required sound. This is an original block-building theme, not Minecraft software or a Minecraft integration.

## Development

`npm run dev` runs the standalone UI. For shared API work, build and use `npm start` with the relevant environment variables. Tests use synthetic saves only.

- `src/data.js`, `src/memory.js`: lesson content and memory aids.
- `src/tutor.js`: learning rules parameterized by wave; `src/engine.js` retains original-wave compatibility.
- `src/library.js`, `src/LibraryApp.jsx`: wave validation, lossless migration, deadline planning and navigation.
- `src/activity.js`, `src/study-clock.js`, `src/ParentDashboard.jsx`: private activity recording and parent view.
- `src/sync.js`, `src/HostedApp.jsx`: shared-session state and UI.
- `server.mjs`, `server/`: authorization and persistence.
- `scripts/build-offline.mjs`, `src/offline.js`: offline shell.

See [scope](HOSTED-DESIGN.md) and [contribution guidance](CONTRIBUTING.md).

## Content and licensing

The initial set follows a supplied 27-word lesson transcription. Original images are not redistributed. Examples and mnemonics are original teaching aids, not etymologies or phonetic transcriptions. Grammar references: [Lingolia reflexive verbs](https://deutsch.lingolia.com/en/grammar/verbs/reflexive-verbs), [verb list](https://deutsch.lingolia.com/de/grammatik/verben/reflexive/liste).

The repository is publicly readable. No open-source license grant has been selected.
