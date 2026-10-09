import assert from "node:assert/strict";
import { test } from "node:test";
import { LocalWorkspace } from "../src/editor/workspace.ts";
import { completionPrompt, inspectionPrompt, systemPrompt, parseAction, replaceText, runAgent } from "../src/editor/agent.ts";
import { fileHash } from "../src/editor/policy.ts";
import { applyTarget, applyTargets, replaceReadLines, sourceTargets } from "../src/editor/edits.ts";
import { GpuResourcesError } from "../src/editor/model.ts";

const bytes = value => new TextEncoder().encode(value);
const path = "src/content/home.json";
const initial = '{"title":"Accueil"}';
const createWorkspace = () => new LocalWorkspace("a".repeat(40), new Map([[path, bytes(initial)]]));
const runtime = () => ({ writes: [], opens: 0, open: async function() { this.opens++; return "https://preview.test/"; }, write: async function(path,content) { this.writes.push({path,content}); }, validate: async()=>{}, stop(){} });
const generator = (actions) => async()=>JSON.stringify(actions.shift());
const request = (workspace, runtime, generate) => ({workspace,runtime,generate,prompt:"Change le titre",title:"Titre",route:"/",signal:new AbortController().signal,progress(){}});

test("the agent reads, makes a targeted change, validates and records one undo", async () => {
  const workspace=createWorkspace(), run=runtime();
  const reply=await runAgent(request(workspace,run,generator([{action:"read",path},{action:"edit",target:"/title",text:"Nouveau"},{action:"done",text:"Le titre a été modifié."}])));
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
  let validations = 0;
  run.validate=async()=>{ validations++; throw new Error("Build fixture failure"); };
  const actions=[{action:"read",path},{action:"edit",target:"/title",text:"Nouveau"},...Array.from({length:4},()=>({action:"done",text:"Terminé"}))];
  await assert.rejects(runAgent(request(workspace,run,generator(actions))),/Astro refuse/);
  assert.equal(workspace.text(path),initial);
  assert.equal(workspace.history.length,0);
  assert.equal(new TextDecoder().decode(run.writes.at(-1).content),initial);
  assert.equal(run.opens,1);
  assert.equal(validations,1);
});

test("batch references are applied atomically in source order with one undo and unrelated bytes preserved", async () => {
  const file = "src/styles/global.css", original = ":root {\r\n  --a: #123456;\r\n  --b: #654321;\r\n  --radius: 1rem;\r\n}\r\n";
  const workspace = new LocalWorkspace("a".repeat(40), new Map([[file, bytes(original)]])), run = runtime();
  await runAgent(request(workspace, run, generator([
    { action: "read", path: file, endLine: 5 },
    { action: "edits", changes: [{ target: "L3", text: "  --b: #987654;" }, { target: "L2", text: "  --a: #abcdef;" }] },
    { action: "done" },
  ])));
  assert.equal(workspace.text(file), original.replace("#123456", "#abcdef").replace("#654321", "#987654"));
  assert.equal(run.writes.length, 1);
  assert.equal(workspace.history.length, 1);
  workspace.undo();
  assert.equal(workspace.text(file), original);
});

test("invalid or duplicate batch references reject before any partial filesystem write", async () => {
  for (const changes of [[{ target: "/title", text: "new" }, { target: "/missing", text: "bad" }], [{ target: "/title", text: "first" }, { target: "/title", text: "second" }]]) {
    const workspace = createWorkspace(), run = runtime();
    await assert.rejects(runAgent(request(workspace, run, generator([
      { action: "read", path }, { action: "edits", changes },
      { action: "read", path }, { action: "edits", changes },
      { action: "read", path }, { action: "edits", changes },
    ]))), /référence|références/);
    assert.equal(workspace.text(path), initial);
    assert.equal(run.writes.length, 0);
  }
  assert.throws(() => parseAction('{"action":"edits","changes":[]}'), /1 à 32/);
  assert.throws(() => parseAction(JSON.stringify({ action: "edits", changes: Array.from({ length: 33 }, () => ({ target: "L1", text: "x" })) })), /1 à 32/);
  assert.throws(() => parseAction('{"action":"edits","changes":[{"target":"L1","text":false}]}'), /Chaque édition/);
});

test("batch helpers reject mixed source versions and preserve JSON escaping without shifting later references", () => {
  const original = '{"a":"first","b":"second","n":42}', targets = sourceTargets(path, original, "hash", 1, 1, "values");
  const first = targets.get("/a"), second = targets.get("/b");
  assert.equal(applyTargets(original, [{ target: first, text: 'much longer "\n' }, { target: second, text: "b" }]), '{"a":"much longer \\"\\n","b":"b","n":42}');
  assert.throws(() => applyTargets(original, []), /1 à 32/);
  assert.throws(() => applyTargets(original, [{ target: first, text: "x" }, { target: { ...second, hash: "other" }, text: "y" }]), /même lecture/);
  assert.throws(() => applyTargets(original, [{ target: first, text: "x" }, { target: { ...second, path: "other.json" }, text: "y" }]), /même lecture/);
  assert.throws(() => applyTargets(original, [{ target: first, text: "x" }, { target: { ...second, start: first.end - 1 }, text: "y" }]), /chevaucher/);
});

test("validation failures reach the model and require a fresh read and real correction before another check", async () => {
  const workspace = createWorkspace(), run = runtime(), contexts = [], prompts = [], permissions = [];
  let validations = 0;
  run.validate = async () => { if (++validations === 1) throw new Error("CSS Invalid qualified rule at line 3"); };
  const actions = [{ action: "read", path }, { action: "edit", target: "/title", text: "invalid" }, { action: "done" }, { action: "read", path }, { action: "edit", target: "/title", text: "corrected" }, { action: "done" }];
  await runAgent(request(workspace, run, async (system, _request, context, _signal, options) => {
    prompts.push(system); contexts.push(context); permissions.push(options);
    return JSON.stringify(actions.shift());
  }));
  assert.equal(prompts[3], inspectionPrompt);
  assert.equal(prompts[4], systemPrompt);
  assert.match(contexts[3], /Invalid qualified rule/);
  assert.match(contexts[4], /Invalid qualified rule/);
  assert.equal(permissions[3].hasChanges, false);
  assert.equal(permissions[4].validationFailed, true);
  assert.equal(permissions[5].validationFailed, false);
  assert.equal(validations, 2);
  assert.equal(workspace.text(path), '{"title":"corrected"}');
  assert.equal(workspace.history.length, 1);
});

test("exact replacements preserve CRLF and reject ambiguous/empty matches", () => {
  assert.equal(replaceText("titre\r\ntexte\r\n","titre\n","Nouveau\n"),"Nouveau\r\ntexte\r\n");
  assert.throws(()=>replaceText("a a","a","b"),/exactement une fois/);
  assert.throws(()=>replaceText("abc","","b"));
});

test("the model cannot edit without a prior verified read", async () => {
  const workspace=createWorkspace(), run=runtime();
  await assert.rejects(runAgent(request(workspace,run,async()=>JSON.stringify({action:"edit",target:"/title",text:"X"}))),/Lisez ce fichier/);
  assert.equal(workspace.dirty,false);
});

test("generation permissions follow successful reads and invalidate hashes after writes", async () => {
  const workspace=createWorkspace(), run=runtime();
  const hash=await fileHash(workspace.files.get(path));
  const permissions=[];
  const actions=[{action:"read",path},{action:"edit",target:"/title",text:"Nouveau"},{action:"done",text:"Titre modifié."}];
  await runAgent(request(workspace,run,async(_system,_request,_context,_signal,options)=>{
    permissions.push(options.readHashes);
    return JSON.stringify(actions.shift());
  }));
  assert.deepEqual(permissions,[[],[hash],[]]);
});

test("fatal engine failures are not retried as malformed tool responses", async () => {
  const workspace=createWorkspace(), run=runtime();
  let calls=0;
  await assert.rejects(runAgent(request(workspace,run,async()=>{calls++;throw Error("Engine failed");})),/Engine failed/);
  assert.equal(calls,1);
  assert.equal(workspace.dirty,false);
});

test("GPU loss after a local edit restores all workspace and preview bytes without validating or retrying the engine", async () => {
  const workspace = createWorkspace(), run = runtime();
  let calls = 0, validations = 0;
  run.validate = async () => { validations++; };
  const actions = [{ action: "read", path }, { action: "edit", target: "/title", text: "Nouveau" }];
  const failure = new GpuResourcesError(new Error("DXGI_ERROR_DEVICE_HUNG"));
  await assert.rejects(runAgent(request(workspace, run, async () => {
    calls++;
    if (actions.length) return JSON.stringify(actions.shift());
    throw failure;
  })), error => error === failure);
  assert.equal(calls, 3);
  assert.equal(validations, 0);
  assert.equal(workspace.text(path), initial);
  assert.equal(workspace.dirty, false);
  assert.equal(workspace.history.length, 0);
  assert.equal(new TextDecoder().decode(run.writes.at(-1).content), initial);
});

test("default reads include useful source context and remain bounded for later pages", () => {
  assert.deepEqual(parseAction(JSON.stringify({action:"read",path})),{action:"read",path,startLine:1,endLine:81,format:"values"});
  assert.deepEqual(parseAction(JSON.stringify({action:"read",path,startLine:100})),{action:"read",path,startLine:100,endLine:180,format:"values"});
  assert.throws(()=>parseAction(JSON.stringify({action:"read",path,startLine:"100"})),/81 lignes/);
});

test("source context exposes verified JSON values and failed edits require a fresh read", async () => {
  const workspace=createWorkspace(), run=runtime();
  const hash=await fileHash(workspace.files.get(path));
  const contexts=[], permissions=[];
  const actions=[{action:"read",path},{action:"edit",target:"/invented",text:"Nouveau"},{action:"read",path},{action:"done",text:"Pas de modification."}];
  await runAgent(request(workspace,run,async(_system,_request,context,_signal,options)=>{
    contexts.push(context);
    permissions.push(options.readHashes);
    assert.deepEqual(options.readablePaths,[path]);
    assert.equal(context.startsWith("{"),false);
    assert.ok(context.includes("CURRENT PAGE: /"));
    return JSON.stringify(actions.shift());
  }));
  assert.ok(contexts[1].includes('/title = "Accueil"'));
  assert.equal(contexts[1].includes('\\\\"title\\\\"'),false);
  assert.deepEqual(permissions,[[],[hash],[],[hash]]);
  assert.equal(workspace.dirty,false);
  const scalarWorkspace=new LocalWorkspace("a".repeat(40),new Map([[path,bytes('{"count":42,"flag":true,"none":null}')]]));
  let calls=0,scalarContext="";
  await runAgent(request(scalarWorkspace,runtime(),async(_system,_request,context)=>{
    if(calls++===0)return JSON.stringify({action:"read",path});
    scalarContext=context;
    return JSON.stringify({action:"done"});
  }));
  assert.ok(scalarContext.includes("/count = 42"));
  assert.ok(scalarContext.includes("/flag = true"));
  assert.ok(scalarContext.includes("/none = null"));
});

test("JSON references preserve every unrelated byte and handle escaping, arrays and scalar types", () => {
  const source='{\r\n  "a/b~c": [{"text":"a \\"quote\\""}],\r\n  "n": 42, "flag":true, "nothing":null\r\n}\r\n';
  const targets=sourceTargets(path,source,"hash",1,81,"values");
  const target=targets.get("/a~1b~0c/0/text");
  assert.equal(target.value,'a "quote"');
  assert.equal(applyTarget(source,target,'b "\\\n'),source.replace('"a \\"quote\\""',JSON.stringify('b "\\\n')));
  assert.equal(applyTarget(source,targets.get("/n"),"43"),source.replace("42","43"));
  assert.equal(applyTarget(source,targets.get("/n"),"1000000000000000123"),source.replace("42","1000000000000000123"));
  assert.equal(applyTarget(source,targets.get("/flag"),"false"),source.replace("true","false"));
  assert.equal(applyTarget(source,targets.get("/nothing"),'{"new":1}'),source.replace("null",'{"new":1}'));
  assert.throws(()=>sourceTargets(path,'{"x":{"a":"1"},"x":{"b":"2"}}',"hash",1,81,"values"),/dupliquées/);
});

test("only shown lines can be replaced and source-bound edits preserve CRLF", () => {
  const file="src/styles/global.css",source="first\r\n  --radius: 1rem;\r\nthird\r\n";
  const targets=sourceTargets(file,source,"hash",2,2,"lines");
  assert.deepEqual([...targets.keys()],["L2"]);
  assert.equal(applyTarget(source,targets.get("L2"),"  --radius: 0.5rem;"),source.replace("1rem","0.5rem"));
  assert.equal(replaceReadLines(source,file,2,2,"new\nextra","hash",targets),"first\r\nnew\r\nextra\r\nthird\r\n");
  assert.throws(()=>replaceReadLines(source,file,1,2,"new","hash",targets),/doit avoir été lue/);
  assert.throws(()=>applyTarget(source,targets.get("L2"),"new\nextra"),/qu'une ligne/);
});

test("a source-bound edit cannot bypass the real file version guard", async () => {
  const workspace=createWorkspace(),run=runtime();
  const actions=[{action:"read",path},{action:"edit",target:"/title",text:"Nouveau"}];
  let calls=0;
  await assert.rejects(runAgent(request(workspace,run,async()=>{
    if(calls++===1)workspace.files.set(path,bytes('{"title":"Concurrent"}'));
    return JSON.stringify(actions.shift()??{action:"edit",target:"/title",text:"Nouveau"});
  })),/Lisez ce fichier/);
  assert.equal(run.writes.some(write=>new TextDecoder().decode(write.content).includes("Nouveau")),false);
  assert.equal(workspace.text(path),initial);
});

test("line edits support arbitrary template code and create/delete remain read-gated", async () => {
  const file="src/pages/example.astro",source="<h1>Old</h1>\n<p>Keep</p>\n";
  const workspace=new LocalWorkspace("a".repeat(40),new Map([[file,bytes(source)]])),run=runtime();
  const actions=[
    {action:"read",path:file},
    {action:"lines",path:file,startLine:1,endLine:1,text:"<h1>New</h1>\n<p>Added</p>"},
    {action:"read",path:file},
    {action:"create",path:"src/pages/created.astro",text:"<h1>Created</h1>"},
    {action:"delete",path:file},
    {action:"done",text:"Modifications validées."},
  ];
  await runAgent(request(workspace,run,async(_system,_request,_context,_signal,options)=>{
    if(actions[0].action==="delete")assert.ok(options.readablePaths.includes("src/pages/created.astro"));
    if(actions[0].action==="done")assert.deepEqual(options.readablePaths,["src/pages/created.astro"]);
    return JSON.stringify(actions.shift());
  }));
  assert.equal(workspace.files.has(file),false);
  assert.equal(workspace.text("src/pages/created.astro"),"<h1>Created</h1>");
  assert.equal(workspace.history.length,1);
  workspace.undo();
  assert.equal(workspace.text(file),source);
  assert.equal(workspace.files.has("src/pages/created.astro"),false);
});

test("unconstrained model responses cannot create without inspecting actual sources", async () => {
  const workspace=createWorkspace(),run=runtime();
  await assert.rejects(runAgent(request(workspace,run,async()=>JSON.stringify({
    action:"create",path:"src/pages/invented.astro",text:"<h1>Invented</h1>",
  }))),/Lisez les sources/);
  assert.equal(workspace.dirty,false);
  assert.equal(run.writes.length,0);
});

test("the generator receives only inspection tools until a verified read", async () => {
  const workspace=createWorkspace(),run=runtime(),systems=[];
  const actions=[{action:"read",path},{action:"edit",target:"/title",text:"Nouveau"},{action:"done",text:"Terminé."}];
  await runAgent(request(workspace,run,async(system)=>{systems.push(system);return JSON.stringify(actions.shift());}));
  assert.deepEqual(systems,[inspectionPrompt,systemPrompt,completionPrompt]);
  assert.equal(inspectionPrompt.includes('"action":"edit"'),false);
  assert.equal(inspectionPrompt.includes('"action":"done"'),false);
});

test("a single exact JSON fence is accepted but prose, multiple blocks and invented actions are rejected", () => {
  assert.deepEqual(parseAction('```json\n{"action":"read","path":"src/content/home.json"}\n```'),{
    action:"read",path,startLine:1,endLine:81,format:"values",
  });
  assert.throws(()=>parseAction('Explanation\n```json\n{"action":"read","path":"src/content/home.json"}\n```'));
  assert.throws(()=>parseAction('```json\n{"action":"list"}\n```\n```json\n{"action":"done","text":"X"}\n```'));
  assert.throws(()=>parseAction('```json\n{"action":"merge"}\n```'));
});

test("done needs no generated prose but never bypasses real validation or undo recording", async () => {
  const workspace=createWorkspace(),run=runtime();
  let validated=0;
  run.validate=async()=>{validated++;};
  const summary=await runAgent(request(workspace,run,generator([
    {action:"read",path},{action:"edit",target:"/title",text:"Nouveau"},{action:"done"},
  ])));
  assert.equal(summary,"Terminé.");
  assert.equal(validated,1);
  assert.equal(workspace.history.length,1);
  assert.throws(()=>parseAction('{"action":"done","text":42}'),/Résumé/);
});

test("a hallucinated completion cannot finish a turn without inspecting any real source", async () => {
  const workspace=createWorkspace(),run=runtime();
  await assert.rejects(runAgent(request(workspace,run,async()=>JSON.stringify({action:"done",text:"I changed it"}))),/Aucune source consultée/);
  assert.equal(workspace.dirty,false);
  assert.equal(run.writes.length,0);
});
