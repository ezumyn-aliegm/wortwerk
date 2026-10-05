# Wortwerk improvement proposal: learn to build

October 4 follow-up: the separate-island recommendation in section 7 is superseded by [One village that grows with each lesson](VILLAGE-EXPANSION-PLAN.md). The proposed connected settlement appends distinct districts and preserves existing waves. Expansion remains planning-only. Existing deployed learning rules are not changed by either proposal.

September 27, 2026 · WW-09 · Proposed, awaiting review · No implementation or deployment authorized by this document

## 1. Recommended direction

Make the existing five-building village a direct representation of demonstrated vocabulary learning. Remove the separate spendable-block economy. Learning completion and village completion must always be the same number; all five buildings fully upgraded means all wave requirements satisfied.

Keep the app autonomous, spelling-focused, suitable for an English-speaking eighth grader, and simple enough for internal family use. Fun should come from visible construction, short achievable missions, choices, and recovering from mistakes—not extra currencies or elaborate graphics.

The reviewed reward rules currently let wrong answers advance mission checkpoints and let recovery earn more than a clean answer. This proposal replaces those incentives. It is a product design, not evidence of improved learning outcomes.

## 2. Define the contract before each wave

Before publishing a wave, prepare and review:

- Its exact vocabulary, meanings, spellings, sentence patterns and assessed forms.
- A teaching card, accepted answers, correction explanation and audio coverage for every target.
- Category weights totaling 100%, target-level success rules and delayed-recall requirements.
- The village upgrade sequence and exact completion thresholds.
- The deadline, including timezone, and sufficient opportunities for delayed practice.

Freeze this configuration when studying starts. Adding content must not silently change the denominator. A necessary correction requires a versioned, explained update; a new set normally becomes a new wave.

For future waves without a forms category, explicitly redistribute its weight before publication. Never create impossible requirements or silently reweight an active wave.

## 3. Wave 1 learning map

Content inventory: 27 words, 54 sentence exercises and 26 form exercises across 13 words. Deadline: September 28, 2026, 9:00 a.m., America/New_York.

| Category | Assessed targets | Completion weight |
|---|---|---:|
| Meaning | 27 word meanings | 20% |
| Spelling | 27 German spellings | 40% |
| Usage | 54 taught sentence exercises | 20% |
| Forms | 26 taught article/plural/verb-form exercises | 10% |
| Verification | Delayed spelling recall and final mixed check for every word | 10% |
| Total | All required targets | 100% |

Each target within a category has equal weight. Duplicated prompts for the same target must not create extra credit. Target identities and acceptable answers are reviewed before publication.

For the first four categories, use two evidence steps per target: 0, 1 or 2. An independent correct answer adds one step, capped at two. A second step requires at least three intervening questions on other targets and no displayed answer or hint. Recognition choices may teach meaning; independent meaning evidence requires recall without choices, accepting reviewed English synonyms.

Category completion is earned evidence steps divided by possible evidence steps. Overall completion is the weighted sum of the five categories. No rounding to 100% until every requirement actually passes.

For each word, verification has two equally weighted checks:

1. Correct independent spelling at least eight hours after the latest exposure to that spelling. Show when this becomes eligible; do not require the app to remain open.
2. A successful usage or form question in the final mixed inspection, after initial learning targets are complete. Rotate choices across words; earlier target tracking still requires all taught forms and sentence exercises.

The final inspection contains 54 questions: spelling plus usage/form for each word. Eligible spelling answers can also satisfy delayed recall. Missed items produce a targeted later recheck, not a complete test restart. Answers stay hidden until the inspection ends. Incorrect answers invalidate the relevant current evidence; historical results remain available.

These are proposed evidence thresholds, not a claim of general German proficiency. The workload must be simulated before release; if it is unrealistic, revise the contract before starting a new wave rather than weakening standards silently mid-wave.

## 4. Five buildings with five upgrades

Twenty-five upgrades divide the village into 4-percentage-point segments. Between thresholds, the next segment visibly fills. These are aggregate learning milestones, not one building per word.

| Building | Level 1 | Level 2 | Level 3 | Level 4 | Level 5 |
|---|---:|---:|---:|---:|---:|
| Cozy cabin | 4% | 24% | 44% | 64% | 84% |
| Sky lookout | 8% | 28% | 48% | 68% | 88% |
| Greenhouse | 12% | 32% | 52% | 72% | 92% |
| Word library | 16% | 36% | 56% | 76% | 96% |
| Star portal | 20% | 40% | 60% | 80% | 100% |

Proposed visible stages:

| Building | L1 | L2 | L3 | L4 | L5 |
|---|---|---|---|---|---|
| Cabin | Platform | Walls | Roof | Chimney/windows | Furnished and lit |
| Lookout | Base | First deck | Tall tower | Covered lookout | Beacon |
| Greenhouse | Beds | Frame | Glass roof | Growing plants | Full garden |
| Library | Foundation | Walls | Roof | Shelves | Filled and lit |
| Portal | Plinth | Pillars | Frame | Crystals | Active portal |

Example: at 46%, the cabin is L3, the other buildings are L2, and the lookout's L3 segment is half complete. This example is not a conversion of the student's existing score.

Keep the construction order fixed for this first release. Offer choices between useful missions, not arbitrary building purchases that would conflict with the agreed threshold map. Free placement and building-order customization can wait.

## 5. Fair consequences and repair

Use one consequence, derived from learning evidence—not a second currency fine.

| Situation | Result |
|---|---|
| First teaching, guided practice or requested hint | Help and explanation; no penalty and no independent credit |
| Independent wrong answer on a taught target | Remove one evidence step from that target, floored at zero; create a named repair |
| Repeated mistakes within that same guided repair | More teaching; no repeated deductions |
| Copied correction or immediate retry | Practice only; no restored evidence or bonus |
| Later independent correct recall | Restore one evidence step, subject to spacing rules |
| Missed delayed/final check | Mark that check incomplete; no loss of unrelated verification |
| Absence, pausing, slow typing or audio/network failure | No game penalty |

A spelling target with two evidence steps loses approximately 0.74 percentage points after one independent miss: 40 / 27 / 2. It does not lose the entire spelling category. Once a later independent challenge begins, a new miss can remove another remaining evidence step.

The world percentage falls by exactly the lost evidence. Preserve previously reached building silhouettes as an achievement outline; show only the currently supported construction as solid. Put a named repair flag at the village workbench, for example: “Brief: repair the ie spelling.” Do not claim an unrelated roof represents that word.

This deliberately refines the earlier damage idea: no arbitrary building destruction and no complex per-answer construction-ownership ledger. The penalty is real lost completion plus required recall; the repair is clearly tied to the learning target. Re-crossing an old milestone restores it without granting a new reward.

## 6. Autonomous, enjoyable sessions

1. On arrival, show the village, completion, next upgrade and one recommended mission.
2. Offer two useful choices, such as “Spelling expedition” or “Sentence workshop.” Both come from targets currently due; a default starts with one click.
3. Use short missions of up to six planned challenges, with roughly five-to-eight-minute sessions as a design target, not a timer or penalty.
4. State the targets and possible construction gain before starting. Do not promise a finished roof unless the available evidence can actually finish it.
5. Teach unfamiliar material first, with meaning, spelling chunks, memory cue, audio, examples and all assessed forms visible.
6. Mix listening-to-spelling, English-to-German and taught usage/form exercises. Different formats assessing the same target do not create duplicate credit.
7. After a miss, explain the exact error, provide at most two guided retries, then move to other material before a later recall check.
8. End the planned mission without endlessly expanding it. Report “Mission finished: 4 targets strengthened, 2 repairs queued,” rather than calling every attempt a success.
9. Show construction gained or repairs remaining, save automatically, and offer a break or another mission. Surface the next delayed-recall time.

Use large text, stable layouts and large controls on Mac. Keep animations brief, optional and reduced-motion compatible; passenger mode avoids moving camera effects. No countdown pressure, streak-loss notifications or compulsory speed rounds.

## 7. Completion, future waves and parent view

At exactly 100%, all buildings are L5 and the portal activates. This requires all learning targets plus verification; there is no hidden extra gate after displaying 100%.

Archive the completed village as a dated achievement. A future wave opens a separate island using the same five-building system. Optional later maintenance can show current recall separately without rewriting the historical completion award. Starting a new wave must not erase an old village.

The parent view should distinguish active study time, visits, unaided accuracy, hints, repairs, category coverage, delayed recall and final-check results. Show mission activity separately from actual learning completion. Never label construction, time spent or repeated attempts as independent proof of learning.

## 8. Safe introduction and limits

Recommend the new scoring contract begin with the next unstarted wave. Changing an active wave's rules can make earned progress appear to disappear, especially near its deadline.

If the family instead wants it applied to current Wave 1, first produce a read-only conversion preview. Preserve all history and the old world as a legacy snapshot. Reuse only evidence the saved records actually establish; missing per-target evidence must not be invented. Show any new checks required and the changed percentage before seeking explicit migration approval. Never reset Wave 1 automatically.

Any eventual deployment still requires everyone paused, synced and study tabs closed, plus a current backup and rollback release. This proposal does not authorize deployment, migration, reset, commit or push.

Initial scope: scoring, village upgrades, fair repairs, short missions and clear progress displays. Defer free-building mode, multiplayer, leaderboards, new currencies, generative missions and new TTS providers. Reuse existing content and recordings where accurate.

## 9. Acceptance checks before release

- Every assessed target is taught and has a correct, useful explanation.
- Category weights total 100%; the 25 milestones end at exactly 100%.
- Learning and village completion agree for fresh, partial, failed, repaired and complete states.
- Six wrong answers cannot earn construction or be labeled six successful challenges.
- Failure then recovery never yields more evidence than equivalent clean learning.
- Guided work earns no independent mastery; repeated guided errors do not stack penalties.
- A missed form does not erase unrelated spelling or meaning progress.
- All variants are covered; aggregate skill wins cannot hide an unlearned plural.
- Delayed recall respects actual exposure times; waiting requirements are visible.
- No rounding or stale final-test result activates the portal prematurely.
- Missions end predictably, with a bounded repair queue and resumable drafts.
- Reload, sync, duplicate submissions and interrupted audio do not duplicate credit or penalties.
- Any migration preserves the original save and records exactly what can and cannot be inferred.
- Test the full wave with simulated strong, struggling and hint-heavy learners; then observe a real short lesson before claiming the design is engaging.

## 10. Review decision

Approve or revise this product proposal before an implementation plan is prepared. The key choices are the 20/40/20/10/10 weighting, fixed 25-upgrade map, one-step recall penalty with guided-repair protection, and starting with the next wave unless a separately approved Wave 1 conversion is requested.

Alternatives considered: merely raising block prices leaves rewards disconnected from learning; one building per word conflicts with the five-building design. The recommended single-score model avoids both.
