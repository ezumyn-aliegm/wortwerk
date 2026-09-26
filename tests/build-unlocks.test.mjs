import test from "node:test";
import assert from "node:assert/strict";
import { WORDS } from "../src/data.js";
import { BUILDINGS, freshGame, awardGame, constructBuild, validateGame, buildRequirement, gameStatus } from "../src/game.js";

const BASE = Date.parse("2026-09-26T18:00:00Z");
function fundedGame() {
  let game = freshGame(), at = 0;
  for (const word of WORDS.slice(0, 4)) for (const type of ["meaning", "spelling"])
    game = awardGame(game, { wordId: word.id, type, correct: true, assisted: false, retry: 0, at: BASE + at++ });
  return game;
}

test("all 27 word learning gates use introduction thirds and full completion", () => {
  const total = 27;
  for (const [id, threshold] of [["cabin", 0], ["lookout", 9], ["greenhouse", 18], ["library", 27]]) {
    assert.equal(buildRequirement(id, { introduced: threshold, ready: 0, total }), null, id);
    if (threshold) assert.equal(typeof buildRequirement(id, { introduced: threshold - 1, ready: 0, total }), "string", id);
  }
  assert.equal(typeof buildRequirement("portal", { introduced: 27, ready: 0, total }), "string");
  assert.equal(typeof buildRequirement("portal", { introduced: 27, ready: 26, total }), "string");
  assert.equal(buildRequirement("portal", { introduced: 27, ready: 27, total }), null);
});

test("small two-word waves round introduction thresholds upward", () => {
  const total = 2;
  assert.equal(buildRequirement("lookout", { introduced: 1, ready: 0, total }), null);
  assert.equal(typeof buildRequirement("greenhouse", { introduced: 1, ready: 0, total }), "string");
  assert.equal(buildRequirement("greenhouse", { introduced: 2, ready: 0, total }), null);
  assert.equal(typeof buildRequirement("library", { introduced: 1, ready: 2, total }), "string");
  assert.equal(buildRequirement("library", { introduced: 2, ready: 0, total }), null);
  assert.equal(buildRequirement("portal", { introduced: 0, ready: 2, total }), null);
});

test("learning gates block affordable builds while legacy calls and prior builds remain valid", () => {
  const game = fundedGame();
  const lookoutCost = BUILDINGS.find((b) => b.id === "lookout").cost;
  assert.ok(gameStatus(game).availableBlocks >= lookoutCost);
  const learning = { introduced: 0, ready: 0, total: WORDS.length };
  assert.equal(constructBuild(game, "lookout", learning), game);
  const legacyBuilt = constructBuild(game, "lookout");
  assert.deepEqual(legacyBuilt.built, ["lookout"], "two-argument calls remain compatible");
  assert.equal(validateGame(legacyBuilt, WORDS), true);
  assert.equal(typeof buildRequirement("lookout", learning), "string", "later lower learning does not invalidate a built structure");
  const built = constructBuild(game, "cabin");
  assert.equal(validateGame(built, WORDS), true);
  assert.equal(buildRequirement("cabin", learning), null, "prior builds remain valid as learning changes");
});
