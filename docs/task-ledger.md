# Task ledger

## October 3 · Answer verdict investigation

Inherited checkpoint: clean main fc04e2b; live Wave 2 assessment-scope release c579452. Request: investigate a correct answer marked wrong then accepted on retry; fix a reproduced cause. Read-only live replay found no stored wrong answer that now grades correct and no stored identical input/expected text. Deterministic check: all 92 Wave 2 expected answers have the same correct verdict on original and retry. Related reporting repro: six correct guided responses produce correct=0 and six records in mistakes because mastery credit and answer correctness share session fields.

Fixed: both typed-answer forms read the current submitted control, not an older React draft, and save that exact input. Isolated browser red/green reproducer: visible Oktoberfest with draft Oktoberfes was rejected before and accepted after the patch; this is a plausible cause, not confirmation of the student's exact incident. Wrong feedback and correction copying retain submitted/expected text. Mission/final results expose actual wrong responses, including the village checkpoint screen; guided correct responses are never called wrong. Parent accuracy is separated from mastery credits without rewriting evidence/history. Usage prompts explicitly request only missing words.

Verification: 177 tests pass; production/offline build passes. Desktop browser checks cover the stale-field submission, wrong/correct comparison, copying, reload persistence, and completed Wave 2 mission at the village checkpoint. Independent reviewer found and verified the missing Wave 2 results branch; browser checking additionally exposed the checkpoint overlay, now covered by the same reusable results component. No Safari-specific or student-incident reproduction. No save/schema migration, reset, paid audio calls or live writes. Ready locally; fresh pause/sync/closed-tabs confirmation is still required before container replacement.

## October 3 · Wave 2 assessment scope

Inherited checkpoint: clean main at 1c892a3; Wave 2 live, preserve all existing saves.
Request: remove plural conversion from required study/test/mastery in current Wave 2; keep optional reference. Retain assigned die Gummistiefel, articles, spelling and usage. No reset, no Wave 1 migration. Family confirmed everyone paused and synced October 3.

Implementation: explicit assessed form variants, stable evidence keys, revision-checked atomic scope migration, optional collapsed comparison. Preserve retained target evidence, verification, history, activity and other waves. Remove only excluded pending questions; replace a wholly excluded queue with assigned-word spelling to keep the ongoing mission valid.

Validation/deployment: runtime source c579452 deployed as wortwerk:wave2-scope-20261003-c579452. 171 tests pass; production/offline build succeeds. 37 recordings generated, zero failures. Actual-save read-only dry run passed, followed by stopped-service backup, atomic revision 2100 → 2101 update and exact comparison with backup-derived expected state. Authenticated live save/page/new audio and HTTPS health passed. Isolated desktop first-card/optional-reference interaction passed with no console errors/warnings. Independent education review passed; migration review's ongoing-exam score defect was fixed and regression-tested. Wave 1 and retained evidence/history preserved; no reset. Safari/mobile/offline travel not re-tested.
