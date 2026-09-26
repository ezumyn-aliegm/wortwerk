import { freshState, validateState, STORAGE_KEY } from "./engine.js";

export function loadProgress(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { state: freshState(), issue: "", blocked: false };
    const parsed = JSON.parse(raw);
    if (!validateState(parsed)) throw new Error("invalid");
    return { state: parsed, issue: "", blocked: false };
  } catch {
    return {
      state: freshState(),
      issue:
        "I couldn’t read your saved progress. It has not been overwritten. You can download the saved data or restore a backup in Progress.",
      blocked: true,
    };
  }
}
export function saveProgress(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
export function parseBackup(raw) {
  if (raw.length > 2_000_000)
    throw new Error("This file is too large for a Wortwerk backup.");
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(
      "That file is not readable JSON. Choose a Wortwerk backup.",
    );
  }
  if (!validateState(value))
    throw new Error(
      "That file is not a compatible Wortwerk progress backup. Your current progress is unchanged.",
    );
  return value;
}
