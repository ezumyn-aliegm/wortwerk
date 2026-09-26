# A small shared family tutor

The user narrowed this project to internal family use. This supersedes the earlier platform-style proposal.

## Scope

- One student profile, multiple vocabulary waves beginning with the existing 27 words, one shared password.
- One Node container. One JSON progress file on a persistent volume, plus its previous version. No database service, accounts, pairing, or separate permission roles.
- Home-network access only for now. Trusted HTTPS is needed for browser offline installation.
- Preserve the adaptive engine, mnemonics, strict spelling, and large car layout.
- Public code, a small GitHub board, tests, CI, and clear instructions. Never publish saves, credentials, or private deployment settings.

## Progress and offline use

Save locally first, synchronize when connected. Compare server revisions; a stale device cannot silently overwrite newer answers. Retry interrupted uploads with the same operation ID. If devices have different work, ask which session to continue and retain a recovery copy. Do not merge learning histories.

Use one device at a time and wait for **Synced across devices** before switching. Download the app on the home network before a drive. Offline answers sync on returning home. Cache app assets, never API responses or passwords. A plain HTTP LAN address cannot install a service worker; say so honestly.

Migrate the current Safari session using the existing backup format and verify its exact question on a second browser. Keep the original backup private and unchanged.

## Implementation and acceptance

1. Backend: cookie authorization, same-origin writes, input validation, atomic files and previous-save backup. Test stale saves, duplicate retries, restart persistence, and corrupt-file protection.
2. Browser: local outbox, sync status, login and conflict choice. Test pending typing during an upload, reload recovery, and cross-device resume.
3. Offline: content-versioned shell cache, API exclusion, conservative updates. Verify offline navigation and subsequent sync.
4. Delivery: persistent container volume, health check, public repository, CI and a concise project board. Verify actual HTTPS access and migration before calling deployment complete.

## Not included

Multi-user permissions, device management, history merging, third-party analytics, live AI, a rich lesson-authoring portal, automatic public internet exposure, or photo extraction.

## Approved wave and parent-statistics update

- Wave 1 is due Monday September 28, 2026 at 9 a.m. America/New_York. New prepared lesson JSON files can be imported with their own due time, full exercises and mnemonic content. All waves retain separate sessions and mastery; names/deadlines are editable without resetting them.
- One recommended study action prioritizes actionable upcoming work. Plans adjust to the deadline; shortened cold recall is not credited as eight-hour recall. Past due is never a substitute for mastery.
- Parent view shows measured practice visits/time, questions, first-try accuracy versus retries/hints, dates, spelling mistakes, current readiness and rehearsal results. Filters use Miami dates. Private counters share the existing offline/revisioned save. Historical timing is explicitly unknown, not inferred from learning scores.
- Legacy migration wraps the original state unchanged, including in-progress question, typed draft, feedback and teaching screen. A stale version-1 client cannot overwrite a version-2 server save. Tests use only synthetic records.
- TTS is explicitly deferred; existing device speech is unchanged.
- Deployment is gated on a family pause and successful sync. Preserve a fresh volume backup and image, compare server revisions before restart, and verify exact session continuity after updating. Do not touch the live container while a session may be ongoing.

## Teaching repair and game update

- Each tested topic/variant needs a recorded worked lesson. Legacy sessions get prerequisite teaching without reset; supported first tries do not earn mastery. Typed form/usage errors require the exact requested correction. Exams preflight missing content and clearly label supported results.
- The student likes Minecraft; the approved direction is an original block-building outpost. Six-answer missions, selectable blueprints, capped resources for unaided recall and comeback rewards make a real construction loop. No timers, lost lives, public leaderboards, or extra services. Game progress lives inside each wave and remains separate from mastery.
- Scope stays internal and lightweight. The student-facing game uses generated, bundled voxel art and existing React; no 3D engine or new runtime dependencies. Parent statistics and deadline scheduling remain the same. TTS is still deferred.
