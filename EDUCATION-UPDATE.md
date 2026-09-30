# Education corrections — September 26, 2026

Status: implemented and tested locally. NOT deployed. Family confirmed someone is still studying; do not replace the live container until paused and synced.

## Changes

- Follow-up: Wave 1 noun cards now compare singular and plural side by side, highlight the added ending, explain English meanings, and provide separate existing audio buttons. Teaching/review and plural-error repair show the comparison; unaided questions and exam feedback do not. 145 tests pass after this addition; local browser preview verified Treppe/Treppen and plural playback. This follow-up is also local only, recorded as WW-07 in Notion.

- Corrected the ambiguous r count in interessieren and the overly broad plural-article rule.
- Clarified Treppe's singular meaning despite English “stairs.”
- Added English–German explanations for articles, reflexives, prepositions, separable verbs, and fährt; added pronunciation-to-spelling cues.
- Kept Fahrradtrial grading aligned with the worksheet while explicitly flagging the dictionary article disagreement.
- Improved memory wording and error-specific spelling feedback.
- Added VOCABULARY-GUIDE.md with a reusable next-wave workflow, content checklist, import requirements, audio limitations, and safe deployment procedure.
- Generated 29 new recordings; reused 292 existing recordings. No runtime speech API added.

## Progress safety

Known original Wave 1 content receives updated teaching copy at presentation time. Stored words, mastery, queues, drafts, and history are not rewritten. Expected answers and exercise ordering are unchanged. Customized lessons and other waves are excluded. Previous content and recordings are retained for compatibility.

## Verification

- 143 automated tests pass, including old-save presentation upgrades and targeted spelling feedback.
- Production build succeeds; pre-existing lucide directive warnings remain.
- Isolated local preview at http://127.0.0.1:4184/ shows the revised interessieren card and German playback control without console warnings/errors.
- No production session was opened, changed, or reset during this update.
- No claim of child-retention testing or human pronunciation approval. Free-form conversation assessment and new exercise types are not implemented by this content update.

## Next deployment

Follow the README pause/sync/backup procedure. Preserve the latest live state, not an earlier reset snapshot. Include src/previous-content.js in the runtime image (Dockerfile already updated). Verify saved state and audio after replacement; never reset the wave for this update. Current previous deployment and recovery paths are documented in the prior deployment handoff. Do not deploy automatically while waiting for the family.
