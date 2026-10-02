import { requiredSkills } from "./data.js";
import { usesLearningScore } from './scoring.js';

export function freshVillage() {
  return { version: 2, percent: 0, highPercent: 0, totalAnswers: 0, checkpointAnswers: 0,
    successes: 0, checkpointSuccesses: 0, repairs: [] };
}
export function villageLevels(percent) {
  const segments = Math.min(25, Math.floor(percent / 4));
  return Object.fromEntries(BUILDINGS.map((b, i) => [b.id, Math.max(0, Math.min(5, Math.floor((segments + 4 - i) / 5)))]));
}
export function updateVillage(game, learning, success = false) {
  return { ...game, percent: learning.percent, highPercent: Math.max(game.highPercent, learning.percent),
    repairs: learning.repairs, totalAnswers: game.totalAnswers + 1, successes: game.successes + Number(success) };
}
function validVillage(g) {
  return g?.version === 2 && Number.isFinite(g.percent) && g.percent >= 0 && g.percent <= 100
    && Number.isFinite(g.highPercent) && g.highPercent >= g.percent && g.highPercent <= 100
    && count(g.totalAnswers, MAX_ANSWERS) && count(g.checkpointAnswers, g.totalAnswers)
    && count(g.successes, g.totalAnswers) && count(g.checkpointSuccesses, g.successes)
    && Array.isArray(g.repairs) && g.repairs.length <= 1980 && g.repairs.every((s) => typeof s === 'string');
}

export const BUILDINGS = Object.freeze([
  { id: "cabin", cost: 6, label: "Cozy cabin", description: "Build a warm home base for your outpost." },
  { id: "lookout", cost: 10, label: "Sky lookout", description: "Raise a tower to spot adventures on the horizon." },
  { id: "greenhouse", cost: 8, label: "Greenhouse", description: "Grow a bright garden under a glass roof." },
  { id: "library", cost: 12, label: "Word library", description: "Give your discoveries a home on the shelves." },
  { id: "portal", cost: 16, label: "Star portal", description: "Light a gateway to the next adventure." },
].map(Object.freeze));

export const MISSION_SIZE = 6;
const WEIGHTS = Object.freeze({ meaning: 1, spelling: 2, usage: 2, form: 2 });
const MAX_PAIRS = 90 * 4;
const MAX_ANSWERS = 1_000_000;
const FIELDS = ["version", "earned", "repairs", "built", "selected", "checkpointAnswers", "totalAnswers", "lastAnswers"];
const count = (value, max) => Number.isSafeInteger(value) && value >= 0 && value <= max;
const wordIdOK = (id) => typeof id === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(id) && !["__proto__", "constructor", "prototype"].includes(id);
const timeOK = (at) => count(at, 8_640_000_000_000_000);
const building = (id) => BUILDINGS.find((item) => item.id === id);
const pairKey = (wordId, type) => `${wordId}/${type}`;
const pairOK = (key) => {
  const parts = key.split("/");
  return parts.length === 2 && wordIdOK(parts[0]) && Object.hasOwn(WEIGHTS, parts[1]);
};
function plain(value) {
  return value !== null && typeof value === "object"
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}
function mapOK(value, validValue) {
  return plain(value) && Reflect.ownKeys(value).length <= MAX_PAIRS
    && Reflect.ownKeys(value).every((key) => typeof key === "string" && pairOK(key) && validValue(value[key]));
}
function budget(game) {
  const earnedBlocks = Object.entries(game.earned).reduce((n, [key, wins]) => n + wins * WEIGHTS[key.split("/")[1]], 0)
    + Object.values(game.repairs).reduce((n, repairs) => n + repairs, 0);
  const spentBlocks = game.built.reduce((n, id) => n + building(id).cost, 0);
  return { earnedBlocks, spentBlocks, availableBlocks: earnedBlocks - spentBlocks };
}

// `lastAnswers` is a per-pair high-water timestamp, not an event history.
// Only fresh graded responses belong here. The caller must not replay tutor
// history when adding game state to an older save. Each word/skill pair needs
// strictly increasing response.at timestamps; ties/older deliveries are ignored.
export function freshGame() {
  return {
    version: 1,
    earned: {},
    repairs: {},
    built: [],
    selected: "cabin",
    checkpointAnswers: 0,
    totalAnswers: 0,
    lastAnswers: {},
  };
}

function validShape(game) {
  try {
    if (!plain(game) || Reflect.ownKeys(game).length !== FIELDS.length
      || !FIELDS.every((key) => Object.hasOwn(game, key)) || game.version !== 1
      || !mapOK(game.earned, (n) => count(n, 2) && n > 0)
      || !mapOK(game.repairs, (n) => n === 1)
      || !mapOK(game.lastAnswers, timeOK)
      || !count(game.totalAnswers, MAX_ANSWERS)
      || !count(game.checkpointAnswers, game.totalAnswers)
      || !Array.isArray(game.built) || game.built.length > BUILDINGS.length
      || Object.keys(game.built).length !== game.built.length
      || !game.built.every((id) => !!building(id))
      || new Set(game.built).size !== game.built.length
      || !building(game.selected)) return false;
    if (game.built.includes(game.selected) && game.built.length !== BUILDINGS.length) return false;
    if (!Object.keys(game.earned).every((key) => Object.hasOwn(game.lastAnswers, key))
      || !Object.keys(game.repairs).every((key) => Object.hasOwn(game.earned, key))) return false;
    return Object.keys(game.lastAnswers).length <= game.totalAnswers
      && Object.values(game.earned).reduce((n, wins) => n + wins, 0) <= game.totalAnswers
      && budget(game).availableBlocks >= 0;
  } catch { return false; }
}

/** Missing optional game state is handled by the library caller, not here. */
export function validateGame(value, words) {
  try {
    if (usesLearningScore(words)) return validVillage(value);
    if (!validShape(value) || !Array.isArray(words) || words.length < 1 || words.length > 90
      || Object.keys(words).length !== words.length
      || !words.every((word) => plain(word) && wordIdOK(word.id) && Array.isArray(word.forms))
      || new Set(words.map((word) => word.id)).size !== words.length) return false;
    const allowed = new Set(words.flatMap((word) => requiredSkills(word).map((type) => pairKey(word.id, type))));
    return [value.earned, value.repairs, value.lastAnswers].every((map) => Object.keys(map).every((key) => allowed.has(key)));
  } catch { return false; }
}

function validResponse(response) {
  return plain(response) && wordIdOK(response.wordId)
    && typeof response.type === "string" && Object.hasOwn(WEIGHTS, response.type)
    && typeof response.correct === "boolean" && typeof response.assisted === "boolean"
    && count(response.retry, 2) && timeOK(response.at)
    && (response.kind === undefined || response.kind === "answer")
    && (response.copied === undefined || typeof response.copied === "boolean")
    && (response.hinted === undefined || typeof response.hinted === "boolean");
}

/**
 * Award once for each new graded response. A correct, unaided first try OR retry
 * earns its skill weight, capped at two wins per pair across all variants.
 * previousMiss is caller-supplied evidence of an earlier miss for this pair;
 * one later unaided recovery can earn one additional block, once per pair.
 * exam:true counts answers but never rewards them, including after completion.
 * Mission UI must wait until feedback/correction is advanced, and until any
 * exam/cold check finishes. This module never advances or changes tutor state.
 */
export function awardGame(game, response, options = {}) {
  try {
    if (!validShape(game) || !validResponse(response) || !plain(options)
      || (options.previousMiss !== undefined && typeof options.previousMiss !== "boolean")
      || (options.exam !== undefined && typeof options.exam !== "boolean")
      || game.totalAnswers === MAX_ANSWERS) return game;
    const key = pairKey(response.wordId, response.type);
    if (Object.hasOwn(game.lastAnswers, key) && response.at <= game.lastAnswers[key]) return game;
    if (!Object.hasOwn(game.lastAnswers, key) && Object.keys(game.lastAnswers).length === MAX_PAIRS) return game;
    const next = {
      ...game,
      earned: { ...game.earned },
      repairs: { ...game.repairs },
      lastAnswers: { ...game.lastAnswers, [key]: response.at },
      totalAnswers: game.totalAnswers + 1,
    };
    const qualifies = !options.exam && response.correct && !response.assisted && !response.copied && !response.hinted;
    if (qualifies) {
      next.earned[key] = Math.min(2, (next.earned[key] || 0) + 1);
      if (options.previousMiss) next.repairs[key] = 1;
    }
    return next;
  } catch { return game; }
}

export function selectBuild(game, buildId) {
  if (!validShape(game) || !building(buildId) || game.built.includes(buildId) || game.selected === buildId) return game;
  return { ...game, selected: buildId };
}

export function buildRequirement(buildId, learning) {
  if (!learning || buildId === "cabin") return null;
  const { introduced, ready, total } = learning;
  if (!Number.isInteger(total) || total < 1 || !Number.isInteger(introduced) || !Number.isInteger(ready))
    return "Keep learning to unlock this build.";
  if (buildId === "portal") return ready >= total ? null
    : `Remember all ${total} words after a break (${ready}/${total}).`;
  const target = buildId === "lookout" ? Math.ceil(total / 3)
    : buildId === "greenhouse" ? Math.ceil(total * 2 / 3) : total;
  return introduced >= target ? null : `Discover ${target} words (${introduced}/${target}).`;
}

export function constructBuild(game, buildId = game?.selected, learning) {
  if (!validShape(game) || !building(buildId) || game.built.includes(buildId)
    || buildRequirement(buildId, learning)
    || budget(game).availableBlocks < building(buildId).cost) return game;
  const built = [...game.built, buildId];
  const selected = built.includes(game.selected)
    ? BUILDINGS.find((item) => !built.includes(item.id))?.id ?? game.selected
    : game.selected;
  return { ...game, built, selected };
}

/** Call only after leaving feedback/correction and outside exams/cold checks. */
export function checkpointGame(game) {
  if (validVillage(game)) return { ...game, checkpointAnswers: game.totalAnswers, checkpointSuccesses: game.successes };
  if (!validShape(game) || game.checkpointAnswers === game.totalAnswers) return game;
  return { ...game, checkpointAnswers: game.totalAnswers };
}

/** Returns null for invalid state; the caller can surface a save error. */
export function gameStatus(game) {
  if (validVillage(game)) {
    const levels = villageLevels(game.percent), historicalLevels = villageLevels(game.highPercent);
    const segment = Math.min(24, Math.floor(game.percent / 4));
    return { ...game, levels, historicalLevels, allBuilt: game.percent === 100, canBuild: false,
      selectedBuild: BUILDINGS[segment % 5], nextThreshold: Math.min(100, (segment + 1) * 4),
      segmentProgress: game.percent === 100 ? 4 : game.percent % 4,
      missionProgress: Math.min(6, game.totalAnswers - game.checkpointAnswers),
      independentSuccesses: game.successes - game.checkpointSuccesses,
      readyCheckpoint: game.totalAnswers - game.checkpointAnswers >= 6 };
  }
  if (!validShape(game)) return null;
  const resources = budget(game);
  const selectedBuild = building(game.selected);
  const allBuilt = game.built.length === BUILDINGS.length;
  const answersSinceCheckpoint = game.totalAnswers - game.checkpointAnswers;
  return {
    ...resources,
    selectedBuild,
    allBuilt,
    canBuild: !allBuilt && resources.availableBlocks >= selectedBuild.cost,
    nextNeeded: allBuilt ? 0 : Math.max(0, selectedBuild.cost - resources.availableBlocks),
    missionSize: MISSION_SIZE,
    missionProgress: Math.min(MISSION_SIZE, answersSinceCheckpoint),
    answersSinceCheckpoint,
    answersRemaining: Math.max(0, MISSION_SIZE - answersSinceCheckpoint),
    readyCheckpoint: answersSinceCheckpoint >= MISSION_SIZE,
    totalAnswers: game.totalAnswers,
  };
}
