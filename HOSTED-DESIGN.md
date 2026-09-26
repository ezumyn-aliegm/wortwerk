# A small shared family tutor

The user narrowed this project to internal family use. This supersedes the earlier platform-style proposal.

## Scope

- One student profile, the existing 27-word lesson, one shared password.
- One Node container. One JSON progress file on a persistent volume, plus its previous version. No database service, accounts, pairing, or admin portal.
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

Multi-user permissions, device management, history merging, analytics, live AI, a lesson-authoring portal, automatic public internet exposure, or arbitrary lesson imports. Future lessons can be added through the content files.
