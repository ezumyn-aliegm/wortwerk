# Wortwerk

A self-guided German vocabulary tutor for family use. It teaches 27 words over two days with memory pictures, spelling chunks, sentence practice, articles, reflexive verbs, and separable verbs. The student follows one route; answers determine what comes next.

React in the browser, one small Node server, one shared progress file. No AI API, account service, analytics, or external database.

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

To migrate the original standalone app: **Pause → Download progress backup** there; on the shared site use **Progress → Restore backup**. Wait for sync and verify another device resumes correctly. Keep the original backup. Restore and Reset affect the shared student once synced.

## Offline and car use

Open the app at home and wait for offline readiness before leaving. The shell and lesson are downloaded; answers stay locally until the server is reachable again. For home-only hosting, sync happens when back home. Unsynced answers cannot appear on another device.

Offline installation requires trusted HTTPS or localhost. Plain HTTP LAN addresses cannot install the offline cache. Clearing browser data removes the downloaded lesson and unsynced answers. Private browsing may not preserve them. Updates activate after old study tabs close, without forcing a mid-answer reload.

Car view is on by default for a **passenger**: large text, wide controls, and Picture it → Spell it → Use it screens. Keys 1–4 select choices; Enter submits typed answers. Buttons insert German characters at the cursor. German and English audio use device voices; some voices need internet. No microphone or pronunciation grading.

## How adaptation works

- Day 1: three nine-word sessions, then a mixed check.
- Day 2: cold recall, targeted practice, and a 54-question rehearsal.
- Missed or helped answers return later; repeated misses get another teaching card. Retries are bounded.
- Spelling mistakes require a practice copy, then hidden-answer recall. Copies and hints earn no mastery.
- Meaning, spelling, usage, and relevant forms require two unaided successes separated by other questions. A word also needs recall after eight hours.
- Spelling includes noun capitals, articles, reflexive sich, umlauts, ß, and spacing. Whitespace and final punctuation are normalized.
- Final-test grades stay hidden until completion and are separate from mastery.

This is an adaptive rules engine with prepared content, not conversational AI. It guides study while open, but cannot make the student return or send closed-app reminders. Time estimates are not learning guarantees.

## Development

`npm run dev` runs the standalone UI. For shared API work, build and use `npm start` with the relevant environment variables. Tests use synthetic saves only.

- `src/data.js`, `src/memory.js`: lesson content and memory aids.
- `src/engine.js`: learning rules.
- `src/sync.js`, `src/HostedApp.jsx`: shared-session state and UI.
- `server.mjs`, `server/`: authorization and persistence.
- `scripts/build-offline.mjs`, `src/offline.js`: offline shell.

See [scope](HOSTED-DESIGN.md) and [contribution guidance](CONTRIBUTING.md). Another lesson is currently a content/code change, not an upload workflow.

## Content and licensing

The initial set follows a supplied 27-word lesson transcription. Original images are not redistributed. Examples and mnemonics are original teaching aids, not etymologies or phonetic transcriptions. Grammar references: [Lingolia reflexive verbs](https://deutsch.lingolia.com/en/grammar/verbs/reflexive-verbs), [verb list](https://deutsch.lingolia.com/de/grammatik/verben/reflexive/liste).

The repository is publicly readable. No open-source license grant has been selected.
