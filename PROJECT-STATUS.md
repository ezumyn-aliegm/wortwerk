# Wortwerk project status

Updated September 30, 2026. Internal family-use application.

## Records

- [Linear project](https://linear.app/ezumyn/project/wortwerk-b26d30da83ed): delivery tasks, dependencies and acceptance.
- [Notion project hub](https://app.notion.com/p/3e7f3f6888788136882cc335e5f0ed66): requirements, decisions, content guidance and release history.
- [GitHub](https://github.com/ezumyn-aliegm/wortwerk): versioned source, tests, recordings and specifications.
- [Next-wave guide](VOCABULARY-GUIDE.md) and [village proposal](VILLAGE-IMPROVEMENT-PROPOSAL.md).

## Baseline and next work

The September 30 source snapshot includes reviewed mnemonic content, prerecorded audio, educator corrections, explicit noun comparisons and complete first teaching cards. All 146 tests and the production build passed on September 30. These checks do not establish pronunciation quality or learning outcomes.

Source baseline: commit `1cfa770f4c9b67df7511ebaea57a6be7f72528bf`, annotated tag `baseline-2026-09-30`. Published to GitHub and verified September 30 after GitHub CLI authentication was restored. The tag resolves to that exact baseline commit; management records follow in subsequent commits. GitHub publication is complete, and the live deployment remains separate.

Last recorded deployed image: `wortwerk:mnemonics-20260926`. Deployment was not re-audited on September 30. New local card/educator corrections are not deployed. No student progress was read or changed during this management update.

The village improvements remain a proposal. The family intends to trigger work with the next vocabulary set and timeline. No new content, start date or deadline has been supplied. Wave 1's historical deadline was September 28, 2026, 9:00 a.m., America/New_York; passing that date does not establish completion.

| Work | Linear | State |
|---|---|---|
| WW-01, WW-07, WW-08: teaching-card/audio release | [EZU-51](https://linear.app/ezumyn/issue/EZU-51) | Ready locally; waiting for safe deployment |
| WW-02: version and publish baseline | [EZU-52](https://linear.app/ezumyn/issue/EZU-52) | Done: baseline and tag published; remote references verified |
| WW-03: Fahrradtrial article clarification | [EZU-53](https://linear.app/ezumyn/issue/EZU-53) | Awaiting teacher clarification |
| WW-04: pronunciation and observed lesson | [EZU-54](https://linear.app/ezumyn/issue/EZU-54) | Open |
| WW-05: next vocabulary wave | [EZU-55](https://linear.app/ezumyn/issue/EZU-55) | Waiting for words and exact deadline |
| WW-06: supported transfer exercises | [EZU-56](https://linear.app/ezumyn/issue/EZU-56) | Optional backlog |
| WW-09: learning-linked village improvements | [EZU-57](https://linear.app/ezumyn/issue/EZU-57) | Proposed; waiting for next-wave trigger |

## Version and release rules

1. Use Git commits to identify code/content snapshots. The September 30 snapshot is tagged `baseline-2026-09-30`; the tag represents reviewed local work, not a deployment.
2. Keep vocabulary wave IDs separate from application versions. Before starting a wave, record its content version, deadline/timezone, taught targets, scoring rules and construction mapping. Do not silently change the active denominator.
3. Record each deployed release's exact Git SHA, image tag, deployment date, validation and private backup/rollback reference. Never equate a pushed commit with a deployed release.
4. Keep proposal status distinct from accepted scope and implementation. At the next-wave trigger, update EZU-55/EZU-57 with the supplied content, schedule, agreed mapping and acceptance checks.
5. Preserve saved sessions through updates. Require a current safe pause/sync/closed-tab window before container replacement and retain a backup/rollback image. Old reset permission is not reusable.
6. Keep credentials, private environment files, backups and student records out of Git, Linear and Notion.
7. Update these records during project work. No unattended maintenance or automatic cross-tool synchronization is configured.
