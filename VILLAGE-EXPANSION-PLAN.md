# One village that grows with each lesson

October 4, 2026. WW-09 follow-up. Proposed implementation plan, not implemented. The current graphics/control fixes are a separate release. This document does not authorize changing learning evidence, resetting waves or generating assets.

## Recommended experience

Build one connected settlement. Every vocabulary wave adds a permanent district to the same place. Starting a new wave never replaces the old village. Each district remains selectable so the student can return to unfinished lessons and resume the exact saved question or correction.

Use connected district panels on the Waves screen. Render the selected district at full size during study. Panels wrap into rows and use simple roads or bridges as visual connections. Avoid a freely moving camera, a game engine and a second world database. Those add work without helping vocabulary practice.

The land appears when the lesson is added. It is available to study immediately. Buildings and upgrades are earned through that wave's existing learning rules. Old incomplete districts do not block a new assignment.

## What the current waves become

| Wave | Place | Progress rule |
|---|---|---|
| Wave 1 | Original home district | Keep accepted artwork and actual saved buildings. Label construction as legacy rewards, not certified mastery. |
| Wave 2 | Autumn district beside the home district | Keep current learning-linked 25 upgrades and saved evidence. Retain the corrected block-art renderer. |
| Next wave | New adjacent district with its own architecture | Freeze its targets, milestones, design and deadline before studying starts. |

Do not create missing buildings for Wave 1 or infer learning completion from its buildings. Its previous deadline is not evidence of mastery. Imported lessons get a neutral placeholder district without changing their learning contract.

## New places need different buildings

Proposed later districts include a market with stalls and a bakery, a harbor with a dock and boat shed, and a workshop district with a forge and mill. Select a theme alongside the next vocabulary set. These are proposed asset briefs, not assets currently available.

Keep five logical progress slots where the existing learning contract uses them, but let each district map those slots to different art. A slot need not always mean cabin, lookout, greenhouse, library or portal. New place names, building silhouettes and layouts should visibly distinguish districts. Recoloring five clones does not meet acceptance.

Reuse current assets for the first two districts. Prepare small matching sprite packs once, as future lessons are authored. No paid generation or runtime image API is included in this plan. Genuine roof/wall construction stages require matching staged art; muted completed sprites must remain labeled as upgrades instead.

## Progress and fair repairs

Each modern district has its own learning percentage and construction percentage, which remain identical. Its genuine 100 percent requires all frozen learning targets and delayed/final checks. A new assignment does not lower an old district's percentage by adding a new denominator.

The settlement overview shows district counts and unfinished work. Do not use one overall percentage that falls whenever a lesson is added. Show current mastery separately from a previously reached completion milestone. Existing highPercent can support a previous achievement, but cannot invent a completion date or conceal current repairs.

Independent errors affect only the existing evidence target and its own district. Preserve previous-upgrade markers. No damage to another lesson, absence penalties, duplicate rewards or bonus credit for copied repairs. Old districts offer Resume mission, Continue learning or Review as appropriate. Overdue lessons remain available. Recommend the current assignment first, then a small due repair mission in an older district when useful. Do not add compulsory old-wave work to the current deadline contract.

## Small implementation shape

Existing library.waves remains the source of ownership, order and progress. A static presentation catalog maps stable wave IDs to theme, layout and art for each slot. A neutral design handles unknown imported waves.

The derived district view contains waveId, design, currentPercent, historicalPercent, repairs, savedMission and completion status. Legacy construction uses actual saved buildings and an explicit legacy label. It must not masquerade as a modern learning percentage.

No new saved world state is needed for the first release. Derive the map from the library. Freeze authored visual metadata before study; never reorder existing districts when adding a wave. Later user placement or persistent completion dates would require a separately reviewed additive schema change, not guessed historical records.

## Delivery order

1. Add a connected settlement overview from existing wave summaries. Keep current study screens and both saved waves unchanged. District selection resumes the existing session.
2. Give the first two districts distinct surrounding terrain and layouts. Preserve Wave 1 artwork. Keep Wave 2's accepted graphics and scoring. Inspect real empty, partial, repaired and complete scenes before release.
3. With the next word set, prepare the first genuinely new district sprite pack. Review its silhouettes, scale, markers and frozen milestone map before the student starts.
4. Add optional older-district repair recommendations using existing due work. Verify that these never block the new assignment or expose hidden inspection answers.

Each increment gets an isolated test, a narrow commit, a backup and an explicitly paused live release. No migration/reset of Wave 1 is part of this plan.

## Alternatives

| Approach | Decision |
|---|---|
| Connected responsive district panels | Recommended. Simple, legible, and append-only. |
| Continuous camera-controlled world | Defer. More collision, camera, small-screen and save-position work. |
| Separate reset islands or five repeated buildings forever | Reject. Does not create the requested growing place. |

Connections are initially schematic rather than a seamless explorable game map. This is the deliberate cost tradeoff.

## Acceptance before implementation is called done

- Adding a lesson adds a district without moving or replacing older ones.
- Entering or rendering the map changes no progress, draft, session, history, evidence or selected-wave data.
- Switching districts and back resumes the exact answer/correction. Stale callbacks cannot update another wave.
- One wave's answers affect only that district. Modern 100 percent still requires every existing verification gate.
- Historical milestones remain visible while current repairs remain truthful. Wave 1 gets no invented mastery or rewards.
- New districts introduce visibly different architecture. Test scenes at every level and at mixed levels, not only equal-level completion fixtures.
- Desktop, passenger, compact and mobile layouts have intact roofs, no clipping and readable markers. Inspect actual screenshots. Test navigation with many waves.
- No camera motion in passenger mode. No mandatory new currencies, background AI calls, game engine or database.
- Existing offline, sync, duplicate-submission, session-resume and answer-hiding protections pass.

Prove It Works requires visual and navigation checks against the running app. Model the Domain keeps district presentation derived from wave ownership rather than duplicating learning state.
