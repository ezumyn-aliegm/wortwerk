import test from "node:test";
import assert from "node:assert/strict";
import { WORDS } from "../src/data.js";
import { createTutor } from "../src/tutor.js";
import { parseBackup } from "../src/storage.js";
import { seedTaught } from "./teaching-fixtures.mjs";
import {
  BUILDINGS, MISSION_SIZE, freshGame, validateGame, awardGame,
  selectBuild, constructBuild, checkpointGame, gameStatus,
} from "../src/game.js";

const BASE = Date.parse("2026-09-26T16:00:00Z");
let tick = 0;
const response = (extra = {}) => ({ wordId: "brief", type: "spelling", correct: true, assisted: false, retry: 0, at: BASE + tick++, ...extra });
const clone = (value) => JSON.parse(JSON.stringify(value));
function fundedGame() {
  let game = freshGame();
  for (const word of WORDS.slice(0, 20)) {
    for (let i = 0; i < 2; i++) game = awardGame(game, response({ wordId: word.id }));
  }
  return game;
}

test("original building catalog has the agreed IDs and fixed costs", () => {
  assert.deepEqual(BUILDINGS.map(({ id, cost }) => [id, cost]), [["cabin", 6], ["lookout", 10], ["greenhouse", 8], ["library", 12], ["portal", 16]]);
  assert.ok(BUILDINGS.every((b) => b.label && b.description && Object.isFrozen(b)));
  assert.equal(MISSION_SIZE, 6);
});

test("fresh games start empty; legacy saves opt in without retroactive history", () => {
  const legacyWave = { words: WORDS, progress: { totalSteps: 1000 } };
  const before = clone(legacyWave);
  assert.equal(validateGame(undefined, WORDS), false);
  assert.equal(legacyWave.game === undefined || validateGame(legacyWave.game, WORDS), true);
  const game = legacyWave.game ?? freshGame();
  assert.equal(validateGame(game, WORDS), true);
  assert.equal(gameStatus(game).availableBlocks, 0);
  assert.equal(gameStatus(game).totalAnswers, 0);
  assert.deepEqual(legacyWave, before);
});

test("weights reward unaided first tries and retries and cap wins across variants", () => {
  for (const [type, weight] of [["meaning", 1], ["spelling", 2], ["usage", 2], ["form", 2]]) {
    const initial = freshGame();
    let game = awardGame(initial, response({ type, variant: 0 }));
    assert.equal(gameStatus(game).availableBlocks, weight);
    game = awardGame(game, response({ type, retry: 1, variant: 1 }));
    game = awardGame(game, response({ type, retry: 2, variant: 500 }));
    assert.equal(gameStatus(game).availableBlocks, weight * 2);
    assert.equal(game.earned[`brief/${type}`], 2);
    assert.equal(game.totalAnswers, 3);
    assert.equal(validateGame(game, WORDS), true);
    assert.deepEqual(initial, freshGame());
  }
});

test("wrong and assisted answers advance missions but hints, teaching, and correction actions do not award", () => {
  let game = freshGame();
  for (const extra of [{ correct: false }, { assisted: true }, { hinted: true }, { copied: true }]) game = awardGame(game, response(extra), { previousMiss: true });
  assert.equal(game.totalAnswers, 4);
  assert.equal(gameStatus(game).availableBlocks, 0);
  for (const extra of [{ type: "teach" }, { type: "correction" }, { kind: "copy" }, { kind: "hint" }, { kind: "teach" }]) {
    assert.equal(awardGame(game, response(extra)), game);
  }
  assert.equal(game.totalAnswers, 4);
});

test("recovery bonus is one block per word/skill and cannot be farmed with repeated misses", () => {
  let game = awardGame(freshGame(), response({ correct: false }));
  game = awardGame(game, response({ retry: 1 }), { previousMiss: true });
  assert.equal(gameStatus(game).availableBlocks, 3);
  for (let i = 0; i < 20; i++) {
    game = awardGame(game, response({ correct: false }));
    game = awardGame(game, response({ retry: 1 }), { previousMiss: true });
  }
  assert.equal(gameStatus(game).availableBlocks, 5);
  assert.equal(game.repairs["brief/spelling"], 1);
  assert.equal(game.earned["brief/spelling"], 2);
  assert.equal(validateGame(game, WORDS), true);
});

test("previousMiss false and assisted recovery do not award repair blocks", () => {
  let game = awardGame(freshGame(), response(), { previousMiss: false });
  game = awardGame(game, response({ assisted: true }), { previousMiss: true });
  assert.deepEqual(game.repairs, {});
  assert.equal(gameStatus(game).availableBlocks, 2);
});

test("duplicate or older deliveries do not add rewards or mission progress, including after restart", () => {
  const first = response();
  let game = awardGame(freshGame(), first);
  assert.equal(awardGame(game, first, { previousMiss: true }), game);
  game = clone(awardGame(game, response()));
  assert.equal(awardGame(game, first), game);
  assert.equal(awardGame(game, { ...first, variant: 10 }), game);
  assert.equal(game.totalAnswers, 2);
  assert.equal(gameStatus(game).availableBlocks, 4);
  assert.equal(validateGame(game, WORDS), true);
});

test("exam answers advance missions identically regardless of correctness and never reveal rewards", () => {
  let right = freshGame(), wrong = freshGame();
  for (let i = 0; i < 7; i++) {
    const answer = response();
    right = awardGame(right, answer, { exam: true, previousMiss: true });
    wrong = awardGame(wrong, { ...answer, correct: false }, { exam: true, previousMiss: true });
  }
  assert.deepEqual(right, wrong);
  assert.equal(gameStatus(right).availableBlocks, 0);
  assert.equal(gameStatus(right).readyCheckpoint, true);
  assert.equal(right.totalAnswers, 7);
  // UI defers this call until the entire exam is complete.
  const after = checkpointGame(right);
  assert.equal(gameStatus(after).readyCheckpoint, false);
  assert.equal(after.checkpointAnswers, 7);
});

test("assisted catch-up on every occurrence offers a checkpoint with no reward; later unaided recovery qualifies", () => {
  let game = freshGame();
  for (let i = 0; i < 6; i++) game = awardGame(game, response({ assisted: true }), { previousMiss: true });
  assert.equal(gameStatus(game).readyCheckpoint, true);
  assert.equal(gameStatus(game).availableBlocks, 0);
  assert.deepEqual(game.earned, {});
  assert.deepEqual(game.repairs, {});
  game = awardGame(checkpointGame(game), response(), { previousMiss: true });
  assert.equal(gameStatus(game).availableBlocks, 3);
  assert.equal(gameStatus(game).missionProgress, 1);
});

test("exam responses cannot be replayed after completion for retroactive rewards", () => {
  const answer = response();
  const game = clone(awardGame(freshGame(), answer, { exam: true }));
  assert.equal(awardGame(game, answer, { previousMiss: true }), game);
  assert.equal(gameStatus(game).availableBlocks, 0);
  assert.equal(game.totalAnswers, 1);
});

test("six graded answers offer a break even when all are wrong; checkpoints require an explicit call", () => {
  let game = freshGame();
  for (let i = 0; i < 5; i++) game = awardGame(game, response({ correct: false }));
  assert.equal(gameStatus(game).readyCheckpoint, false);
  assert.equal(gameStatus(game).answersRemaining, 1);
  game = awardGame(game, response({ correct: false }));
  assert.equal(gameStatus(game).missionProgress, 6);
  assert.equal(gameStatus(game).readyCheckpoint, true);
  assert.equal(game.checkpointAnswers, 0);
  game = awardGame(game, response({ assisted: true }));
  assert.equal(gameStatus(game).missionProgress, 6);
  assert.equal(gameStatus(game).answersSinceCheckpoint, 7);
  const checkpoint = checkpointGame(game);
  assert.equal(game.checkpointAnswers, 0);
  assert.equal(checkpoint.checkpointAnswers, checkpoint.totalAnswers);
  assert.equal(gameStatus(checkpoint).answersRemaining, 6);
  assert.equal(checkpointGame(checkpoint), checkpoint);
});

test("construction refuses insufficient funds, unknown IDs, and duplicate buildings", () => {
  let game = freshGame();
  assert.equal(constructBuild(game), game);
  assert.equal(constructBuild(game, "castle"), game);
  assert.equal(selectBuild(game, "castle"), game);
  game = fundedGame();
  const before = clone(game);
  game = selectBuild(game, "greenhouse");
  assert.equal(gameStatus(game).selectedBuild.id, "greenhouse");
  assert.equal(gameStatus(game).canBuild, true);
  const built = constructBuild(game);
  assert.equal(game.built.length, 0);
  assert.deepEqual(built.built, ["greenhouse"]);
  assert.equal(gameStatus(built).availableBlocks, gameStatus(before).availableBlocks - 8);
  assert.equal(constructBuild(built, "greenhouse"), built);
  assert.equal(selectBuild(built, "greenhouse"), built);
  assert.equal(built.selected, "cabin");
  assert.equal(validateGame(built, WORDS), true);
});

test("exact funding builds without negative resources; completing the outpost is stable", () => {
  let exact = freshGame();
  for (const wordId of ["brief", "traurig", "muede"]) exact = awardGame(exact, response({ wordId }));
  assert.equal(gameStatus(exact).nextNeeded, 0);
  exact = constructBuild(exact);
  assert.equal(gameStatus(exact).availableBlocks, 0);
  assert.equal(gameStatus(exact).nextNeeded, 10);
  assert.equal(constructBuild(exact), exact);
  let complete = fundedGame();
  for (const { id } of BUILDINGS) complete = constructBuild(complete, id);
  const status = gameStatus(complete);
  assert.equal(status.allBuilt, true);
  assert.equal(status.canBuild, false);
  assert.equal(status.nextNeeded, 0);
  assert.equal(status.spentBlocks, 52);
  assert.equal(status.availableBlocks, 28);
  assert.equal(validateGame(clone(complete), WORDS), true);
  assert.equal(constructBuild(complete), complete);
});

test("restart preserves partial mission, selected build, resources, and reward caps", () => {
  let game = awardGame(freshGame(), response(), { previousMiss: true });
  game = awardGame(game, response({ type: "meaning" }));
  game = selectBuild(game, "portal");
  const restored = clone(game);
  assert.equal(validateGame(restored, WORDS), true);
  assert.deepEqual(gameStatus(restored), gameStatus(game));
  assert.equal(restored.selected, "portal");
  assert.equal(gameStatus(restored).missionProgress, 2);
  assert.equal(gameStatus(restored).nextNeeded, 12);
});

test("maximum-size wave uses bounded per-pair maps and remains small after repeated variants", () => {
  const words = Array.from({ length: 90 }, (_, i) => ({ id: `word-${i}`, forms: [["prompt", "answer", "explanation"]] }));
  let game = freshGame();
  for (const word of words) for (const type of ["meaning", "spelling", "usage", "form"]) {
    for (let variant = 0; variant < 3; variant++) {
      game = awardGame(game, response({ wordId: word.id, type, variant }), { previousMiss: true });
    }
  }
  assert.equal(Object.keys(game.earned).length, 360);
  assert.equal(Object.keys(game.repairs).length, 360);
  assert.equal(Object.keys(game.lastAnswers).length, 360);
  assert.equal(game.totalAnswers, 1080);
  assert.ok(Buffer.byteLength(JSON.stringify(game)) < 40_000);
  assert.equal(validateGame(clone(game), words), true);
  assert.equal(awardGame(game, response({ wordId: "overflow" })), game);
  const overfull = clone(game);
  overfull.lastAnswers["overflow/spelling"] = BASE;
  assert.equal(validateGame(overfull, words), false);
});

test("strict validation rejects unknown words/skills, excessive counts, overspending and malformed inputs without throwing", () => {
  const good = awardGame(freshGame(), response(), { previousMiss: true });
  for (const mutate of [
    (g) => { g.version = 2; },
    (g) => { g.extra = 1; },
    (g) => { g.earned["brief/spelling"] = 3; },
    (g) => { g.earned["brief/spelling"] = -1; },
    (g) => { g.repairs["brief/spelling"] = 2; },
    (g) => { g.repairs["brief/meaning"] = 1; },
    (g) => { g.lastAnswers["missing/spelling"] = BASE; },
    (g) => { g.lastAnswers["traurig/form"] = BASE; g.totalAnswers++; },
    (g) => { g.lastAnswers["brief/teach"] = BASE; },
    (g) => { g.lastAnswers["brief/spelling/0"] = BASE; },
    (g) => { g.lastAnswers["brief/spelling"] = NaN; },
    (g) => { g.lastAnswers = {}; },
    (g) => { g.built = ["cabin"]; g.selected = "lookout"; },
    (g) => { g.built = ["cabin", "cabin"]; },
    (g) => { g.built = Array(1); },
    (g) => { g.selected = "castle"; },
    (g) => { g.totalAnswers = 1.5; },
    (g) => { g.totalAnswers = Infinity; },
    (g) => { g.totalAnswers = 1_000_001; },
    (g) => { g.checkpointAnswers = 2; },
    (g) => { g.earned = []; },
    (g) => { g.lastAnswers = null; },
  ]) {
    const bad = clone(good);
    mutate(bad);
    assert.equal(validateGame(bad, WORDS), false, mutate.toString());
  }
  for (const bad of [undefined, null, [], {}, true, "game", 1]) assert.equal(validateGame(bad, WORDS), false);
  for (const words of [undefined, null, [], Array(1), [{ id: "brief" }], [WORDS[0], WORDS[0]]]) assert.equal(validateGame(good, words), false);
  const cyclic = freshGame();
  cyclic.earned["brief/spelling"] = cyclic;
  assert.equal(validateGame(cyclic, WORDS), false);
  assert.equal(validateGame(new Proxy({}, { ownKeys() { throw Error("bad input"); } }), WORDS), false);
});

test("invalid grading and game inputs are no-ops, not free rewards or resets", () => {
  const game = freshGame();
  for (const extra of [{ assisted: undefined }, { correct: "yes" }, { retry: -1 }, { retry: 3 }, { at: NaN }, { wordId: "__proto__" }, { type: "constructor" }]) assert.equal(awardGame(game, response(extra)), game);
  assert.equal(awardGame(game, null), game);
  assert.equal(awardGame(game, response(), null), game);
  assert.equal(awardGame(game, response(), { exam: "false" }), game);
  assert.equal(awardGame(game, response(), { previousMiss: 1 }), game);
  assert.equal(awardGame(undefined, response()), undefined);
  assert.equal(gameStatus(undefined), null);
  assert.equal(constructBuild(undefined), undefined);
  assert.equal(selectBuild(null, "cabin"), null);
  assert.equal(checkpointGame(null), null);
});

test("tutor integration persists game rewards through backup restore without double-invocation awards", () => {
  const tutor = createTutor(WORDS);
  const legacy = seedTaught(tutor.freshState());
  assert.equal(legacy.game, undefined);
  assert.equal(tutor.validateState(legacy), true);
  let state = tutor.startSession(legacy, BASE);
  state.active.queue = [{ wordId: "brief", type: "spelling", variant: 0, retry: 0 }];
  state.active.initialCount = 1;
  const question = state.active.queue[0];
  const answer = tutor.describe(question).answer;
  state = tutor.answerQuestion(state, answer, BASE + 1000);
  assert.equal(state.active.feedback.reward, 2);
  assert.equal(gameStatus(state.game).availableBlocks, 2);
  assert.equal(gameStatus(state.game).totalAnswers, 1);
  assert.equal(tutor.answerQuestion(state, answer, BASE + 1001), state);
  const restored = parseBackup(JSON.stringify(state));
  assert.equal(tutor.validateState(restored), true);
  assert.deepEqual(restored.game, state.game);
  assert.equal(tutor.answerQuestion(restored, answer, BASE + 1002), restored);
  const completed = tutor.advance(restored, BASE + 2000);
  assert.equal(completed.active, null);
  assert.deepEqual(completed.game, state.game);
  assert.deepEqual(parseBackup(JSON.stringify(completed)).game, completed.game);
  assert.equal(tutor.advance(completed, BASE + 3000), completed);
  assert.equal(legacy.game, undefined, "Adding a game must not mutate a legacy save");
});

test("tutor integration rejects invalid optional games instead of silently dropping them", () => {
  const tutor = createTutor(WORDS);
  const state = tutor.freshState();
  assert.equal(tutor.validateState(state), true);
  assert.equal(tutor.validateState({ ...state, game: freshGame() }), true);
  for (const game of [
    null, {}, [], { ...freshGame(), version: 99 },
    { ...freshGame(), built: ["portal"], selected: "cabin" },
    { ...freshGame(), totalAnswers: 1, lastAnswers: { "unknown/spelling": BASE } },
  ]) {
    const malformed = { ...state, game };
    assert.equal(tutor.validateState(malformed), false);
    assert.throws(() => parseBackup(JSON.stringify(malformed)), /not a compatible/);
  }
});

test("tutor exam keeps the whole game unchanged until the final advance, including after resume", () => {
  const tutor = createTutor(WORDS);
  const prepared = seedTaught(tutor.freshState());
  prepared.game = awardGame(freshGame(), response({ type: "meaning", at: BASE - 1000 }));
  const baseline = clone(prepared.game);
  let state = tutor.startSession(prepared, BASE, "exam");
  const count = state.active.initialCount;
  assert.ok(count > MISSION_SIZE, "Exercise a complete exam spanning multiple missions");
  let expectedBlocks = gameStatus(baseline).earnedBlocks;
  for (let i = 0; i < count; i++) {
    const question = state.active.queue[0];
    const now = BASE + (i + 1) * 1000;
    state = tutor.answerQuestion(state, tutor.describe(question).answer, now);
    expectedBlocks += question.type === "meaning" ? 1 : 2;
    assert.deepEqual(state.active.feedback, { hidden: true });
    assert.equal(Object.hasOwn(state.active.answers.at(-1), "reward"), false);
    assert.deepEqual(state.game, baseline, `Answer ${i + 1} must not reveal a resource change`);
    if (i === 5) {
      state = parseBackup(JSON.stringify(state));
      assert.deepEqual(state.game, baseline);
      assert.equal(gameStatus(state.game).readyCheckpoint, false);
    }
    state = tutor.advance(state, now + 1);
    if (i < count - 1) assert.deepEqual(state.game, baseline, "Intermediate exam advance must not award");
  }
  assert.equal(state.active, null);
  assert.equal(state.sessions.at(-1).kind, "exam");
  assert.equal(state.sessions.at(-1).correct, count);
  assert.equal(gameStatus(state.game).earnedBlocks, expectedBlocks);
  assert.equal(gameStatus(state.game).totalAnswers, baseline.totalAnswers + count);
  assert.equal(gameStatus(state.game).readyCheckpoint, true);
  assert.equal(tutor.validateState(state), true);
  const restored = parseBackup(JSON.stringify(state));
  assert.deepEqual(restored.game, state.game);
  assert.equal(tutor.advance(restored, BASE + 100_000), restored);
});

test("resumed legacy exam responses without retry remain valid and do not receive retroactive rewards", () => {
  const tutor = createTutor(WORDS);
  let state = tutor.startSession(seedTaught(tutor.freshState()), BASE, "exam");
  state.active.queue = [
    { wordId: "brief", type: "spelling", variant: 0, retry: 0 },
    { wordId: "traurig", type: "spelling", variant: 0, retry: 0 },
  ];
  state.active.initialCount = 2;
  state = tutor.answerQuestion(state, tutor.describe(state.active.queue[0]).answer, BASE + 1000);
  delete state.active.answers[0].retry;
  state = parseBackup(JSON.stringify(state));
  assert.equal(state.game, undefined);
  state = tutor.advance(state, BASE + 1001);
  assert.equal(state.game, undefined);
  state = tutor.answerQuestion(state, tutor.describe(state.active.queue[0]).answer, BASE + 2000);
  assert.equal(state.game, undefined, "Even the final answer waits for its final advance");
  state = tutor.advance(state, BASE + 2001);
  assert.equal(state.sessions.at(-1).correct, 2, "The legacy answer remains in the rehearsal result");
  assert.equal(gameStatus(state.game).totalAnswers, 1);
  assert.equal(gameStatus(state.game).availableBlocks, 2);
  assert.equal(Object.hasOwn(state.game.earned, "brief/spelling"), false);
  assert.equal(tutor.validateState(state), true);
});
