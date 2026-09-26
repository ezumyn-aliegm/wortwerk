import { migrateLibrary, validateSave, parseWave } from "./library.js";
import { createTutor } from "./tutor.js";

// Matches the existing server request-body limit, including the sync envelope.
export const UPLOAD_LIMIT = 2 * 1024 * 1024;
export const serializeBackup = (value) => JSON.stringify(value);
const bytes = (raw) => new TextEncoder().encode(raw).length;

export function uploadBody(pending) {
  const raw = serializeBackup(pending);
  if (bytes(raw) > UPLOAD_LIMIT)
    throw Object.assign(new Error(
      "This library is too large to sync. Progress remains in this tab. Download an all-waves backup before moving devices.",
    ), { code: "SAVE_TOO_LARGE" });
  return raw;
}

export function parseLibraryBackup(raw) {
  const value = JSON.parse(raw);
  if (!validateSave(value))
    throw new Error("Not a compatible Wortwerk backup. Your current save is unchanged.");
  // A device backup remains restorable even when it exceeds the upload limit.
  return migrateLibrary(value);
}

export function appendWave(library, wave) {
  if (library.waves.length >= 50)
    throw new Error("This family library supports up to 50 waves.");
  const next = { ...library, waves: [...library.waves, wave] };
  if (bytes(serializeBackup(next)) > 950_000)
    throw new Error("This lesson would leave too little space for saved progress and statistics. No changes were made.");
  return next;
}

export async function importWave(file, updateLibrary, id = crypto.randomUUID(), canApply = () => true) {
  if (file.size > 500_000)
    throw new Error("Lesson file must be smaller than 500 KB.");
  const wave = parseWave(await file.text(), id);
  if (!canApply())
    throw new Error("The saved library changed while the file was loading. Choose the file again; nothing was imported.");
  updateLibrary((latest) => appendWave(latest, wave));
}

export function replaceWaveProgress(library, waveId, progress) {
  const wave = library?.waves.find((w) => w.id === waveId);
  if (!wave || wave.progress === progress) return library;
  return { ...library, waves: library.waves.map((w) =>
    w.id === waveId ? { ...w, progress } : w,
  ) };
}

export function parentLocked(library) {
  return !!library?.waves.some(({ progress: { active } }) =>
    active?.kind === "exam" || (active?.kind === "course" && active.phase === 4),
  );
}

export function prepareParentView(library, now = Date.now()) {
  if (parentLocked(library)) return library;
  return { ...library, waves: library.waves.map((wave) =>
    wave.progress.active ? {
      ...wave,
      progress: createTutor(wave.words).visitWordbank(wave.progress, now),
    } : wave,
  ) };
}

export function emptyStudyClock(now = 0) {
  return { enabled: false, sessionId: null, lastInteraction: 0, accountedAt: now, waveId: null };
}

export function touchStudyClock(clock, waveId, now) {
  if (!clock.enabled || !clock.sessionId || clock.waveId !== waveId) return;
  const gap = now - clock.lastInteraction;
  if (gap < 1000 || gap > 5 * 60000) return;
  if (gap >= 90000) clock.accountedAt = now;
  clock.lastInteraction = now;
}
