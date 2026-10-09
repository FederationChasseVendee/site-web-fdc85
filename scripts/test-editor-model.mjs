import assert from "node:assert/strict";
import { test } from "node:test";
import { actionSchema, CodeModel } from "../src/editor/model.ts";

const noReads = { readHashes: [], readablePaths: ["src/content/home.json"] };

function fixture(response) {
  const statuses = [], requests = [];
  const model = new CodeModel(status => statuses.push(status), () => {}, () => {});
  let interrupted = 0, terminated = 0;
  model.ready = true;
  model.loading = new AbortController();
  model.worker = { terminate() { terminated++; } };
  model.engine = {
    chat: { completions: { create: async request => { requests.push(request); return response; } } },
    interruptGenerate() { interrupted++; },
  };
  return { model, statuses, requests, interrupted: () => interrupted, terminated: () => terminated };
}
test("generation cancellation terminates the worker and requires reload instead of reusing an interrupted engine", async () => {
  let finish;
  const f = fixture(new Promise(resolve => { finish = resolve; }));
  const abort = new AbortController();
  const generation = f.model.complete("system", "request", "workspace", abort.signal, noReads);
  abort.abort(new DOMException("User cancellation", "AbortError"));
  await assert.rejects(generation, { name: "AbortError" });
  assert.equal(f.model.ready, false);
  assert.equal(f.terminated(), 1);
  assert.ok(f.interrupted() > 0);
  assert.match(f.statuses.at(-1), /rechargez/);
  await assert.rejects(f.model.complete("system", "request", "workspace", new AbortController().signal, noReads), /chargement/);
  finish({ choices: [{ message: { content: '{"action":"done","text":"Late response"}' } }] });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.model.ready, false);
});
test("valid replies use constrained JSON and never silently accept truncated completions", async () => {
  const f = fixture({ choices: [{ message: { content: '{"action":"read","path":"src/content/home.json"}' }, finish_reason: "stop" }] });
  const reply = await f.model.complete("system", "request", "workspace", new AbortController().signal, noReads);
  assert.match(reply, /"action":"read"/);
  assert.equal(f.requests[0].response_format.type, "json_object");
  assert.equal(f.requests[0].temperature, 0.1);
  const schema = JSON.parse(f.requests[0].response_format.schema);
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.action.enum.includes("merge"), false);
  assert.equal(schema.properties.action.enum.includes("edit"), false);
  assert.equal(schema.properties.action.enum.includes("done"), false);
  assert.equal("oldText" in schema.properties, false);
  assert.equal(actionSchema({...noReads,hasChanges:true}).properties.action.enum.includes("done"),true);
  assert.equal("endLine" in schema.properties, true);
  assert.deepEqual(schema.properties.path.enum, noReads.readablePaths);
  assert.equal("target" in schema.properties, false);
  const truncated = fixture({ choices: [{ message: { content: '{"action":"read"}' }, finish_reason: "length" }] });
  await assert.rejects(truncated.model.complete("system", "request", "workspace", new AbortController().signal, noReads), /trop longue/);
  assert.equal(truncated.model.ready, false);
});
test("write grammars expose only source references read from the real filesystem, not hashes or copied snippets", () => {
  const hash = "a".repeat(64);
  const targets = ["/title"];
  const schema = actionSchema({ ...noReads, readHashes: [hash], targets });
  assert.equal(schema.properties.action.enum.includes("edit"), true);
  assert.deepEqual(schema.properties.target.enum, targets);
  assert.equal("expectedHash" in schema.properties, false);
  assert.equal("oldText" in schema.properties, false);
});
test("engine failures propagate and terminate the corrupted engine before another generation", async () => {
  const f = fixture(Promise.reject(new Error("Grammar matcher rejected the newly sampled token.")));
  await assert.rejects(f.model.complete("system", "request", "workspace", new AbortController().signal, noReads), /Grammar matcher/);
  assert.equal(f.model.ready, false);
  assert.equal(f.terminated(), 1);
});
test("fp32 compatibility uses basic JSON grammar while independent agent guards still validate responses", async () => {
  const f = fixture({ choices: [{ message: { content: '{"action":"read","path":"src/content/home.json"}' }, finish_reason: "stop" }] });
  f.model.schema = false;
  const reply = await f.model.complete("system", "request", "workspace", new AbortController().signal, noReads);
  assert.equal(f.requests[0].response_format.type, "json_object");
  assert.equal("schema" in f.requests[0].response_format, false);
  assert.equal(reply,'{"action":"read","path":"src/content/home.json"}');
  const truncated = fixture({ choices: [{ message: { content: '{"action":"read"}' }, finish_reason: "length" }] });
  truncated.model.schema = false;
  await assert.rejects(truncated.model.complete("system", "request", "workspace", new AbortController().signal, noReads), /trop longue/);
});
