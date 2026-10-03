# Wortwerk project status

Updated October 3, 2026. Internal family-use application.

Current live release: `wortwerk:wave2-scope-20261003-c579452`, runtime source `c579452`. October 3 requested scope correction excludes untested plural conversions from current Wave 2 practice/final-test/mastery/village. Assigned die Gummistiefel remains required; alternate forms are optional reference. 92 required targets instead of 106; 171 tests pass. 37 replacement recordings generated (557 cataloged). Confirmed paused/synced; stopped-service backup and exact post-migration comparison preserve Wave 1, retained Wave 2 evidence/history/verification, activity and selected wave. Revision 2100 → 2101. Live authenticated save/page/audio and HTTPS health passed. See WAVE-2-RELEASE.md for the deployment/rollback reference and browser evidence.

## Records

- [Linear project](https://linear.app/ezumyn/project/wortwerk-b26d30da83ed): delivery tasks, dependencies and acceptance.
- [Notion project hub](https://app.notion.com/p/3e7f3f6888788136882cc335e5f0ed66): requirements, decisions, content guidance and release history.
- [GitHub](https://github.com/ezumyn-aliegm/wortwerk): versioned source, tests, recordings and specifications.
- [Next-wave guide](VOCABULARY-GUIDE.md) and [village proposal](VILLAGE-IMPROVEMENT-PROPOSAL.md).

## Baseline and next work

The September 30 source snapshot includes reviewed mnemonic content, prerecorded audio, educator corrections, explicit noun comparisons and complete first teaching cards. All 146 tests and the production build passed on September 30. These checks do not establish pronunciation quality or learning outcomes.

Source baseline: commit `1cfa770f4c9b67df7511ebaea57a6be7f72528bf`, annotated tag `baseline-2026-09-30`. Published to GitHub and verified September 30 after GitHub CLI authentication was restored. The tag resolves to that exact baseline commit; management records follow in subsequent commits. GitHub publication is complete, and the live deployment remains separate.

Live release verified October 1: `wortwerk:wave2-20261001-adb9115`, source commit `adb9115`. Includes teaching-card/educator corrections and Autumn Wave 2. Deployment followed explicit pause/sync confirmation. A stopped-service backup and exact comparison confirmed every existing wave, saved session, activity history and selected wave were preserved. The atomic installer added Wave 2 only (revision 2090 → 2091). HTTPS health, authenticated progress retrieval, HTML and JavaScript passed. Private rollback backup: nest-server `/opt/docker/wortwerk-backups/before-wave2-20261001-adb9115`; old image retained as `wortwerk:mnemonics-20260926`. Rollback must restore the matching save, not run old code against new-wave state.

The family triggered the next wave on October 1: 20 autumn words, with das Bauernhaus and Monday October 5, 2026, 9:00 a.m. America/New_York explicitly confirmed. Wave 2 is ready locally with independent educator review, full introductory/review cards, 199 additional recordings (520 cataloged clips total), separate import/installation, learning-linked village upgrades, adaptive per-target practice and delayed/final verification. See [release contract](WAVE-2-RELEASE.md). All 164 tests and the production/offline build pass; browser checks verified teaching, noun comparisons, German/English playback controls, wrong-answer correction, draft persistence on reload, per-word evidence/review and the parent dashboard. Pronunciation quality/student outcomes are not certified. New source release tag: `wave-2-2026-10-01` (publication tracked in Notion/Linear).

Wave 1 keeps its content, legacy scoring and progress. Wave 2 is now live and separately selectable; installation did not switch away from the existing session. No reset or Wave 1 scoring migration occurred. Wave 1's historical deadline was September 28, 2026, 9:00 a.m., America/New_York; passing that date does not establish completion. Live app: https://wortwerk.dev.ezumyn.com/.

| Work | Linear | State |
|---|---|---|
| WW-01, WW-07, WW-08: teaching-card/audio release | [EZU-51](https://linear.app/ezumyn/issue/EZU-51) | Deployed; existing progress preserved |
| WW-02: version and publish baseline | [EZU-52](https://linear.app/ezumyn/issue/EZU-52) | Done: baseline and tag published; remote references verified |
| WW-03: Fahrradtrial article clarification | [EZU-53](https://linear.app/ezumyn/issue/EZU-53) | Awaiting teacher clarification |
| WW-04: pronunciation and observed lesson | [EZU-54](https://linear.app/ezumyn/issue/EZU-54) | Open |
| WW-05: next vocabulary wave | [EZU-55](https://linear.app/ezumyn/issue/EZU-55) | Wave 2 live; Monday October 5, 9 a.m. Miami |
| WW-06: supported transfer exercises | [EZU-56](https://linear.app/ezumyn/issue/EZU-56) | Optional backlog |
| WW-09: learning-linked village improvements | [EZU-57](https://linear.app/ezumyn/issue/EZU-57) | Live for Wave 2 only; connected-map proposal remains backlog |

## Version and release rules

October 1 release: packaging fix `adb9115` adds the scoring module to the container runtime and an explicit, revision-checked atomic Wave 2 installer. All 166 tests pass. Image `wortwerk:wave2-20261001-adb9115` is deployed on nest-server. Read-only dry-run and post-install exact comparisons passed; live HTTP checks passed. Production/offline build includes 530 cached files and 520 cataloged MP3s. Actual pronunciation quality, student enjoyment and offline travel remain observational checks, not certified outcomes.

1. Use Git commits to identify code/content snapshots. The September 30 snapshot is tagged `baseline-2026-09-30`; the tag represents reviewed local work, not a deployment.
2. Keep vocabulary wave IDs separate from application versions. Before starting a wave, record its content version, deadline/timezone, taught targets, scoring rules and construction mapping. Do not silently change the active denominator.
3. Record each deployed release's exact Git SHA, image tag, deployment date, validation and private backup/rollback reference. Never equate a pushed commit with a deployed release.
4. Keep proposal status distinct from accepted scope and implementation. At the next-wave trigger, update EZU-55/EZU-57 with the supplied content, schedule, agreed mapping and acceptance checks.
5. Preserve saved sessions through updates. Require a current safe pause/sync/closed-tab window before container replacement and retain a backup/rollback image. Old reset permission is not reusable.
6. Keep credentials, private environment files, backups and student records out of Git, Linear and Notion.
7. Update these records during project work. No unattended maintenance or automatic cross-tool synchronization is configured.
