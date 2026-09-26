import test from "node:test";
import assert from "node:assert/strict";
import { freshState, startSession, setDraft } from "../src/engine.js";
import {
  fromRemote,
  editLocal,
  prepareUpload,
  acknowledge,
  receiveRemote,
  readLocal,
} from "../src/sync.js";

const remote = (revision = 0, state = null) => ({
  revision,
  state,
  updatedAt: null,
});
test("a new device loads the exact shared session without scheduling a write", () => {
  const state = startSession(freshState());
  const local = fromRemote(remote(4, state));
  assert.deepEqual(local.state, state);
  assert.equal(local.revision, 4);
  assert.equal(local.dirty, false);
});
test("offline changes survive serialization and use the same operation when retried", () => {
  let local = fromRemote(remote());
  local = editLocal(local, startSession(local.state));
  local = prepareUpload(local, "operation-1");
  const restored = readLocal(JSON.stringify(local));
  assert.equal(restored.dirty, true);
  assert.deepEqual(
    prepareUpload(restored, "operation-2").pending,
    local.pending,
  );
});
test("typing while a save is in flight remains dirty after acknowledgement", () => {
  let local = editLocal(fromRemote(remote()), startSession(freshState()));
  local = prepareUpload(local, "operation-1");
  const sent = structuredClone(local.pending);
  local = editLocal(local, setDraft(local.state, "unfinished"));
  const saved = acknowledge(local, remote(1, sent.state));
  assert.equal(saved.state.active.draft, "unfinished");
  assert.equal(saved.dirty, true);
  assert.equal(saved.revision, 1);
  assert.equal(saved.pending, null);
});
test("an acknowledged unchanged answer is clean and a second device can load it", () => {
  let local = prepareUpload(
    editLocal(fromRemote(remote()), startSession(freshState())),
    "operation-1",
  );
  const server = remote(1, local.pending.state);
  local = acknowledge(local, server);
  assert.equal(local.dirty, false);
  assert.deepEqual(fromRemote(server).state, local.state);
});
test("divergent offline work returns a conflict without overwriting either session", () => {
  const saved = remote(2, startSession(freshState()));
  const local = editLocal(
    fromRemote(remote()),
    startSession(freshState(), 123456789),
  );
  const result = receiveRemote(local, saved);
  assert.equal(result.conflict, true);
  assert.deepEqual(result.local, local);
  assert.deepEqual(result.remote, saved);
});
test("a clean device adopts a newer server session", () => {
  const result = receiveRemote(
    fromRemote(remote()),
    remote(2, startSession(freshState())),
  );
  assert.equal(result.conflict, false);
  assert.equal(result.local.revision, 2);
});
test("corrupt local or remote progress is rejected rather than replaced", () => {
  assert.throws(() => readLocal("{broken"));
  assert.throws(() => readLocal(JSON.stringify({ v: 1, state: {} })));
  assert.throws(() => fromRemote(remote(1, {})));
});
