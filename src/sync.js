import { freshState } from "./engine.js";
import { validateSave as validateState } from "./library.js";

export const SHARED_KEY = "wortwerk.shared.v1";
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function validateRemote(remote) {
  if (
    !remote ||
    !Number.isSafeInteger(remote.revision) ||
    remote.revision < 0 ||
    !(remote.state === null || validateState(remote.state))
  )
    throw new Error(
      "The server returned an unreadable save. Your local progress is unchanged.",
    );
  return remote;
}
export function fromRemote(remote) {
  validateRemote(remote);
  return {
    v: 1,
    revision: remote.revision,
    state: remote.state || freshState(),
    dirty: false,
    pending: null,
  };
}
export function editLocal(local, state) {
  if (!validateState(state)) throw new Error("This progress cannot be saved.");
  return equal(local.state, state) ? local : { ...local, state, dirty: true };
}
export function prepareUpload(local, mutationId) {
  if (local.pending || !local.dirty) return local;
  return {
    ...local,
    pending: { revision: local.revision, state: local.state, mutationId },
  };
}
export function acknowledge(local, remote) {
  validateRemote(remote);
  if (!local.pending)
    throw new Error("There is no pending save to acknowledge.");
  return {
    ...local,
    revision: remote.revision,
    pending: null,
    dirty: !equal(local.state, local.pending.state),
  };
}
export function receiveRemote(local, remote) {
  validateRemote(remote);
  if (local.dirty && remote.revision !== local.revision)
    return { conflict: true, local, remote };
  return { conflict: false, local: local.dirty ? local : fromRemote(remote) };
}
export function readLocal(raw) {
  const value = JSON.parse(raw);
  if (
    value?.v !== 1 ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0 ||
    typeof value.dirty !== "boolean" ||
    !validateState(value.state) ||
    !(
      value.pending === null ||
      (value.dirty &&
        value.pending &&
        value.pending.revision === value.revision &&
        typeof value.pending.mutationId === "string" &&
        validateState(value.pending.state))
    )
  ) {
    throw new Error(
      "The local shared save is unreadable. It has not been replaced.",
    );
  }
  return value;
}
