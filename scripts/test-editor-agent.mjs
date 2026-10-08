import assert from "node:assert/strict";
import { test } from "node:test";
import { LocalWorkspace } from "../src/editor/workspace.ts";
import { parseAction, replaceText, runAgent } from "../src/editor/agent.ts";
import { fileHash } from "../src/editor/policy.ts";

const bytes = value => new TextEncoder().encode(value);
const path = "src/content/home.json";
const initial = '{"title":"Accueil"}';
const createWorkspace = () => new LocalWorkspace("a".repeat(40), new Map([[path, bytes(initial)]]));
const runtime = () => ({ writes: [], opens: 0, open: async function() { this.opens++; return "https://preview.test/"; }, write: async function(path,content) { this.writes.push({path,content}); }, validate: async()=>{}, stop(){} });
const generator = (actions) => async()=>JSON.stringify(actions.shift());
const request = (workspace, runtime, generate) => ({workspace,runtime,generate,prompt:"Change le titre",title:"Titre",route:"/",signal:new AbortController().signal,progress(){}});

test("the agent reads, makes a targeted change, validates and records one undo", async () => {
  const workspace=createWorkspace(), run=runtime();
  const hash=await fileHash(workspace.files.get(path));
  const reply=await runAgent(request(workspace,run,generator([{action:"read",path},{action:"edit",path,expectedHash:hash,oldText:"Accueil",newText:"Nouveau"},{action:"done",text:"Le titre a été modifié."}])));
  assert.equal(reply,"Le titre a été modifié.");
  assert.equal(workspace.text(path),'{"title":"Nouveau"}');
  assert.equal(workspace.history.length,1);
  workspace.undo();
  assert.equal(workspace.dirty,false);
});

test("unauthorized or invented actions cannot modify files", async () => {
  const workspace=createWorkspace(), run=runtime();
  await assert.rejects(runAgent(request(workspace,run,async()=>JSON.stringify({action:"merge"}))),/action valide/);
  assert.equal(workspace.dirty,false);
  assert.equal(run.writes.length,0);
  assert.throws(()=>parseAction(JSON.stringify({action:"create",path,text:"x",expectedHash:"invented"})));
});

test("failed validation rolls back all files and the live preview", async () => {
  const workspace=createWorkspace(), run=runtime();
  run.validate=async()=>{throw new Error("Build fixture failure");};
  const hash=await fileHash(workspace.files.get(path));
  const actions=[{action:"read",path},{action:"edit",path,expectedHash:hash,oldText:"Accueil",newText:"Nouveau"},...Array.from({length:4},()=>({action:"done",text:"Terminé"}))];
  await assert.rejects(runAgent(request(workspace,run,generator(actions))),/Astro refuse/);
  assert.equal(workspace.text(path),initial);
  assert.equal(workspace.history.length,0);
  assert.equal(new TextDecoder().decode(run.writes.at(-1).content),initial);
  assert.equal(run.opens,1);
});

test("exact replacements preserve CRLF and reject ambiguous/empty matches", () => {
  assert.equal(replaceText("titre\r\ntexte\r\n","titre\n","Nouveau\n"),"Nouveau\r\ntexte\r\n");
  assert.throws(()=>replaceText("a a","a","b"),/exactement une fois/);
  assert.throws(()=>replaceText("abc","","b"));
});

test("the model cannot edit without a prior verified read", async () => {
  const workspace=createWorkspace(), run=runtime();
  const hash=await fileHash(workspace.files.get(path));
  await assert.rejects(runAgent(request(workspace,run,async()=>JSON.stringify({action:"edit",path,expectedHash:hash,oldText:"Accueil",newText:"X"}))),/Lisez ce fichier/);
  assert.equal(workspace.dirty,false);
});
