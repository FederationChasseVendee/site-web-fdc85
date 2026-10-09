import assert from "node:assert/strict";
import { test } from "node:test";
import { createEditorHandler } from "../src/editor/server.ts";
import { onRequest } from "../functions/api/editor/[[path]].ts";

const repoName = "FederationChasseVendee/site-web-fdc85";
const origin = "https://editor.example";
const main = "1".repeat(40);
const initialHead = "2".repeat(40);
const initialTree = "3".repeat(40);
const requestId = "8b2ea689-a31d-4c04-baa5-438bb609694c";
const secondId = "99f00e57-742f-4c33-bf26-0d54bd1c9b83";
const sessionName = "__Host-fdc85-editor";
const oauthName = "__Host-fdc85-editor-oauth";

function response(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json", ...headers } });
}

class KV {
  values = new Map();
  ttls = new Map();
  async get(key) { return this.values.get(key) ?? null; }
  async put(key, value, options) {
    this.values.set(key, value);
    this.ttls.set(key, options.expirationTtl);
  }
  async delete(key) { this.values.delete(key); }
}

function fixturePull(number = 7) {
  return {
    number, node_id: `PR_${number}`, title: "[Editor][alice] Modifier la page", html_url: `https://github.com/${repoName}/pull/${number}`,
    state: "open", draft: true, user: { login: "alice" }, updated_at: "2026-10-08T20:00:00Z",
    head: { ref: `editor/alice/test-${number}`, sha: initialHead, repo: { full_name: repoName } },
    base: { ref: "main", repo: { full_name: repoName } },
    mergeable: true, mergeable_state: "clean",
  };
}

class FakeGitHub {
  calls = [];
  repository = { full_name: repoName, default_branch: "main", permissions: { push: true }, allow_merge_commit: true, allow_squash_merge: true, allow_rebase_merge: true };
  pulls = new Map([[7, fixturePull()]]);
  refs = new Map([["main", main], ["editor/alice/test-7", initialHead]]);
  commits = new Map([
    [main, { sha: main, message: "Main", parents: [], tree: { sha: initialTree } }],
    [initialHead, { sha: initialHead, message: "Initial request", parents: [{ sha: main }], tree: { sha: initialTree } }],
  ]);
  trees = new Map([[initialTree, [
    { path: "src", mode: "040000", type: "tree", sha: "4".repeat(40) },
    { path: "src/content", mode: "040000", type: "tree", sha: "5".repeat(40) },
    { path: "src/content/home.json", mode: "100644", type: "blob", sha: "6".repeat(40) },
    { path: "src/content/old.md", mode: "100755", type: "blob", sha: "7".repeat(40) },
  ]]]);
  blobs = new Map();
  checkRuns;
  statuses = [];
  deployments = [];
  deploymentStatuses = [];
  diffFiles = [];
  comparisons = new Map();
  listing;
  override;
  failAfterRef = false;
  failAfterPull = false;
  tokenExpiresIn = 28800;
  serial = 100;
  nextSha() { return (++this.serial).toString(16).padStart(40, "0"); }
  latestPull() { return this.pulls.get(7); }
  mutations() { return this.calls.filter((call) => ["POST", "PATCH", "PUT", "DELETE"].includes(call.method) && call.url.hostname === "api.github.com"); }

  async fetch(input, init = {}) {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    const method = init.method ?? "GET";
    const headers = new Headers(init.headers);
    const body = init.body ? JSON.parse(init.body) : undefined;
    const call = { url, method, headers, body };
    this.calls.push(call);
    if (this.override) {
      const value = await this.override(call);
      if (value !== undefined) return value;
    }
    if (url.href === "https://github.com/login/oauth/access_token") {
      this.exchange = body;
      return response({ access_token: "FAKE-GITHUB-ACCESS-TOKEN", token_type: "bearer", expires_in: this.tokenExpiresIn, refresh_token: "FAKE-REFRESH-TOKEN", refresh_token_expires_in: 15000000 });
    }
    if (url.hostname === "codeload.github.com") return new Response(new Uint8Array([80, 75, 1, 2]), { headers: { "Content-Type": "application/zip", Location: "must-not-leak" } });
    assert.equal(url.hostname, "api.github.com", `Unexpected host ${url.hostname}`);
    assert.equal(headers.get("Authorization"), "Bearer FAKE-GITHUB-ACCESS-TOKEN");
    if (url.pathname === "/user") return response({ login: "alice", avatar_url: "https://avatars.githubusercontent.com/u/1" });
    if (url.pathname === "/graphql") {
      const pull = [...this.pulls.values()].find((item) => item.node_id === body.variables.id);
      assert.ok(pull);
      pull.draft = false;
      pull.mergeable_state = "clean";
      return response({ data: { markPullRequestReadyForReview: { pullRequest: { isDraft: false, headRefOid: pull.head.sha } } } });
    }
    const prefix = `/repos/${repoName}`;
    assert.ok(url.pathname.startsWith(prefix));
    const path = url.pathname.slice(prefix.length);
    if (!path) return response(this.repository);
    if (path.startsWith("/git/ref/heads/")) {
      const branch = path.slice("/git/ref/heads/".length);
      const head = this.refs.get(branch);
      return head ? response({ object: { sha: head } }) : response({ message: "Not Found" }, 404);
    }
    if (path === "/git/refs" && method === "POST") {
      const branch = body.ref.slice("refs/heads/".length);
      if (this.refs.has(branch)) return response({}, 422);
      this.refs.set(branch, body.sha);
      return response({ object: { sha: body.sha } }, 201);
    }
    if (path.startsWith("/git/refs/heads/") && method === "PATCH") {
      assert.equal(body.force, false);
      const branch = path.slice("/git/refs/heads/".length);
      const current = this.refs.get(branch);
      const commit = this.commits.get(body.sha);
      if (commit.parents[0]?.sha !== current) return response({}, 422);
      this.refs.set(branch, body.sha);
      for (const pull of this.pulls.values()) if (pull.head.ref === branch) pull.head.sha = body.sha;
      if (this.failAfterRef) {
        this.failAfterRef = false;
        throw new Error("Connection lost after accepted ref update");
      }
      return response({ object: { sha: body.sha } });
    }
    if (path.startsWith("/git/commits/") && method === "GET") {
      const commit = this.commits.get(path.slice("/git/commits/".length));
      return commit ? response(commit) : response({}, 404);
    }
    if (path === "/git/commits" && method === "POST") {
      const sha = this.nextSha();
      const commit = { sha, message: body.message, tree: { sha: body.tree }, parents: body.parents.map((sha) => ({ sha })) };
      this.commits.set(sha, commit);
      return response(commit, 201);
    }
    if (path.startsWith("/git/trees/") && method === "GET") {
      return response({ truncated: false, tree: this.trees.get(path.slice("/git/trees/".length)) });
    }
    if (path === "/git/trees" && method === "POST") {
      const sha = this.nextSha();
      const entries = new Map((this.trees.get(body.base_tree) ?? []).map((entry) => [entry.path, entry]));
      for (const item of body.tree) {
        if (item.sha === null) entries.delete(item.path);
        else entries.set(item.path, item);
      }
      this.trees.set(sha, [...entries.values()]);
      return response({ sha }, 201);
    }
    if (path === "/git/blobs" && method === "POST") {
      const sha = this.nextSha();
      const bytes = body.encoding === "base64" ? Buffer.from(body.content, "base64") : Buffer.from(body.content);
      this.blobs.set(sha, { sha, content: bytes.toString("base64"), encoding: "base64", size: bytes.length });
      return response({ sha }, 201);
    }
    if (path.startsWith("/git/blobs/")) {
      const blob = this.blobs.get(path.slice("/git/blobs/".length));
      return blob ? response(blob) : response({}, 404);
    }
    if (path.startsWith("/contents/")) {
      const head = this.commits.get(url.searchParams.get("ref"));
      const entry = this.trees.get(head.tree.sha)?.find((item) => item.path === path.slice("/contents/".length));
      return entry ? response({ type: "file", ...this.blobs.get(entry.sha) }) : response({}, 404);
    }
    if (path === "/pulls" && method === "GET") {
      const page = Number(url.searchParams.get("page") ?? 1);
      return response(this.listing?.[page - 1] ?? [...this.pulls.values()].filter((pull) => pull.state === "open").slice((page - 1) * 100, page * 100));
    }
    if (path === "/pulls" && method === "POST") {
      if ([...this.pulls.values()].some((pull) => pull.head.ref === body.head && pull.state === "open")) return response({}, 422);
      const number = this.pulls.size + 20;
      const pull = fixturePull(number);
      Object.assign(pull, { title: body.title, draft: body.draft });
      pull.head.ref = body.head;
      pull.head.sha = this.refs.get(body.head);
      this.pulls.set(number, pull);
      if (this.failAfterPull) {
        this.failAfterPull = false;
        throw new Error("Connection lost after accepted PR creation");
      }
      return response(pull, 201);
    }
    const pullMatch = /^\/pulls\/(\d+)(\/merge)?$/.exec(path);
    if (pullMatch) {
      const pull = this.pulls.get(Number(pullMatch[1]));
      if (!pull) return response({}, 404);
      if (pullMatch[2]) {
        assert.equal(method, "PUT");
        if (body.sha !== pull.head.sha) return response({}, 409);
        pull.state = "closed";
        return response({ merged: true, sha: "f".repeat(40), message: "Merged" });
      }
      if (method === "PATCH") pull.state = body.state;
      return response(pull);
    }
    const runsMatch = /^\/commits\/([a-f0-9]{40})\/check-runs$/.exec(path);
    if (runsMatch) {
      return response({ check_runs: this.checkRuns ?? ["Editor validation", "Cloudflare Pages"].map((name, index) => ({ id: index + 1, name, status: "completed", conclusion: "success", head_sha: runsMatch[1] })) });
    }
    if (/^\/commits\/[a-f0-9]{40}\/statuses$/.test(path)) return response(this.statuses);
    if (path.startsWith("/compare/")) {
      const range = path.slice("/compare/".length);
      if (this.comparisons.has(range)) return response(this.comparisons.get(range));
      const [, head] = range.split("...");
      const commits = [];
      let commit = this.commits.get(head);
      const base = range.split("...")[0];
      while (commit && commit.sha !== base) {
        commits.push({ ...commit, commit: { message: commit.message } });
        commit = this.commits.get(commit.parents[0]?.sha);
      }
      return response({ status: head === base ? "identical" : "ahead", files: this.diffFiles, commits: commits.reverse() });
    }
    if (path === "/deployments") return response(this.deployments);
    if (/^\/deployments\/\d+\/statuses$/.test(path)) return response(this.deploymentStatuses);
    if (path.startsWith("/zipball/")) return new Response(null, { status: 302, headers: { Location: `https://codeload.github.com/${repoName}/legacy.zip/${path.slice("/zipball/".length)}?private=FAKE-SIGNED-URL` } });
    assert.fail(`Unmocked ${method} ${url.pathname}${url.search}`);
  }
}

function setup() {
  const github = new FakeGitHub();
  const kv = new KV();
  const env = {
    EDITOR_GITHUB_CLIENT_ID: "fake-client-id", EDITOR_GITHUB_CLIENT_SECRET: "fake-client-secret",
    EDITOR_ORIGIN: origin, EDITOR_SESSIONS: kv, EDITOR_SESSION_KEY: Buffer.alloc(32, 17).toString("base64"),
  };
  let clock = Date.parse("2026-10-08T20:00:00Z");
  const logs = [];
  const handle = createEditorHandler({ fetch: github.fetch.bind(github), now: () => clock, log: (message) => logs.push(message) });
  let sessionCookie = "";
  let csrf = "";
  const request = (route, options = {}) => {
    const headers = new Headers(options.headers);
    if (sessionCookie && !headers.has("Cookie")) headers.set("Cookie", sessionCookie);
    const method = options.method ?? "GET";
    if (method === "POST") {
      if (!headers.has("Origin")) headers.set("Origin", origin);
      if (!headers.has("X-CSRF-Token")) headers.set("X-CSRF-Token", csrf);
      if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    }
    return handle(new Request(`${origin}/api/editor/${route}`, { ...options, method, headers, body: options.body === undefined ? undefined : typeof options.body === "string" ? options.body : JSON.stringify(options.body) }), env);
  };
  const authenticate = async (callbackOptions = {}) => {
    const login = await request("login");
    assert.equal(login.status, 302);
    const authorize = new URL(login.headers.get("Location"));
    const oauth = login.headers.getSetCookie().find((value) => value.startsWith(`${oauthName}=`)).split(";")[0];
    const callback = await request(`callback?state=${authorize.searchParams.get("state")}&code=fake-code`, { headers: { Cookie: [oauth, sessionCookie].filter(Boolean).join("; ") }, ...callbackOptions });
    assert.equal(callback.status, 302, await callback.clone().text());
    sessionCookie = callback.headers.getSetCookie().find((value) => value.startsWith(`${sessionName}=`)).split(";")[0];
    const statusResponse = await request("status");
    assert.equal(statusResponse.status, 200);
    const status = await statusResponse.json();
    csrf = status.csrfToken;
    return { login, authorize, oauth, callback, status };
  };
  return { github, kv, env, handle, request, authenticate, logs, advance: (milliseconds) => { clock += milliseconds; }, cookie: () => sessionCookie, csrf: () => csrf };
}

const saveBody = (changes, overrides = {}) => ({ expectedSha: initialHead, changes, requestId, ...overrides });
const textChange = { path: "src/content/home.json", content: '{"title":"Vendée"}', encoding: "utf8" };

test("Pages dispatcher and configuration fail closed with actionable status", async () => {
  const result = await onRequest({ request: new Request(`${origin}/api/editor/status`), env: {} });
  assert.equal(result.status, 200);
  const status = await result.json();
  assert.equal(status.configured, false);
  assert.match(status.message, /EDITOR_GITHUB_CLIENT_ID/);
  assert.equal(status.repository.fullName, repoName);
  const app = setup();
  delete app.env.EDITOR_SESSION_KEY;
  assert.equal((await app.request("login")).status, 503);
  for (const [key, value] of [["EDITOR_ORIGIN", "http://insecure.example"], ["EDITOR_ORIGIN", `${origin}/site-web`], ["EDITOR_SESSION_KEY", "invalid"], ["EDITOR_BASE_PATH", "/../admin"], ["EDITOR_REQUIRED_CHECKS", ""], ["EDITOR_MERGE_METHOD", "bypass"]]) {
    const candidate = setup();
    candidate.env[key] = value;
    assert.equal((await (await candidate.request("status")).json()).configured, false, key);
  }
});

test("immutable preview URLs canonicalize login before assigning a host-bound OAuth cookie", async () => {
  const app = setup();
  app.env.EDITOR_BASE_PATH = "/site-web";
  const result = await app.handle(new Request("https://deployment-hash.example/site-web/api/editor/login"), app.env);
  assert.equal(result.status,302);
  assert.equal(result.headers.get("Location"),`${origin}/site-web/api/editor/login`);
  assert.equal(result.headers.getSetCookie().length,0);
  assert.equal(app.kv.values.size,0);
  assert.equal(app.github.calls.length,0);
  const canonical = await app.handle(new Request(result.headers.get("Location")),app.env);
  assert.equal(new URL(canonical.headers.get("Location")).origin,"https://github.com");
  assert.equal(app.kv.values.size,1);
  assert.equal(canonical.headers.getSetCookie().length,1);
});

test("GitHub requests do not invoke the platform fetch with the adapter as its receiver", async () => {
  const app=setup();
  await app.authenticate();
  let calls=0;
  const handle=createEditorHandler({ now:()=>Date.parse("2026-10-08T20:00:00Z"), fetch: function(input,init) {
    assert.equal(this,undefined);
    calls++;
    return app.github.fetch(input,init);
  } });
  const result=await handle(new Request(`${origin}/api/editor/status`,{headers:{Cookie:app.cookie()}}),app.env);
  assert.equal(result.status,200);
  assert.equal((await result.json()).authenticated,true);
  assert.equal(calls,2);
});

test("OAuth uses one-time state, PKCE, encrypted TTL storage and opaque rotated cookies", async () => {
  const app = setup();
  app.env.EDITOR_BASE_PATH = "/site-web";
  const auth = await app.authenticate();
  assert.equal(auth.authorize.origin, "https://github.com");
  assert.equal(auth.authorize.searchParams.get("code_challenge_method"), "S256");
  assert.equal(auth.authorize.searchParams.get("redirect_uri"), `${origin}/site-web/api/editor/callback`);
  const expectedChallenge = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(app.github.exchange.code_verifier))).toString("base64url");
  assert.equal(auth.authorize.searchParams.get("code_challenge"), expectedChallenge);
  assert.equal(auth.callback.headers.get("Location"), `${origin}/site-web/edit/`);
  assert.equal(auth.callback.headers.has("Cross-Origin-Opener-Policy"), false);
  const cookie = auth.callback.headers.getSetCookie().find((value) => value.startsWith(`${sessionName}=`));
  assert.match(cookie, /HttpOnly; Secure; SameSite=Lax/);
  assert.match(cookie, /Path=\//);
  assert.equal(auth.status.repository.defaultSha, main);
  assert.equal(auth.status.canWrite, true);
  assert.equal(auth.status.user.login, "alice");
  assert.equal(auth.status.authenticated, true);
  assert.equal(auth.status.configured, true);
  for (const value of app.kv.values.values()) {
    assert.match(value, /^v1\./);
    assert.equal(value.includes("FAKE-GITHUB-ACCESS-TOKEN"), false);
    assert.equal(value.includes("FAKE-REFRESH-TOKEN"), false);
    assert.equal(value.includes("alice"), false);
  }
  assert.ok([...app.kv.ttls.values()].every((ttl) => ttl > 0 && ttl <= 28800));
  assert.equal(JSON.stringify(auth.status).includes("TOKEN"), false);
  const replay = await app.request(`callback?state=${auth.authorize.searchParams.get("state")}&code=fake-code`, { headers: { Cookie: auth.oauth } });
  assert.equal(replay.status, 400);
  const oldCookie = app.cookie();
  await app.authenticate();
  assert.notEqual(app.cookie(), oldCookie);
  assert.equal(app.kv.values.has(`session:${oldCookie.split("=")[1]}`), false);
});

test("OAuth rejects tampered state, missing cookie and expiry before token exchange", async () => {
  for (const mode of ["state", "cookie", "expiry", "error", "code"]) {
    const app = setup();
    const login = await app.request("login");
    const authorize = new URL(login.headers.get("Location"));
    const oauth = login.headers.getSetCookie()[0].split(";")[0];
    if (mode === "expiry") app.advance(600001);
    const query = new URLSearchParams({ state: mode === "state" ? "wrong" : authorize.searchParams.get("state"), code: "fake" });
    if (mode === "error") query.set("error", "access_denied");
    if (mode === "code") query.delete("code");
    const callback = await app.request(`callback?${query}`, { headers: { Cookie: mode === "cookie" ? "" : oauth } });
    assert.equal(callback.status, 400, mode);
    assert.equal(app.github.exchange, undefined);
    assert.equal(app.kv.values.size, mode === "cookie" ? 1 : 0);
  }
});

test("authentication, session expiry and every mutation require exact Origin and CSRF", async () => {
  const app = setup();
  for (const route of ["pulls", `archive?sha=${main}`, "pulls/7", "pulls/7/checks", `deployment?sha=${main}`]) assert.equal((await app.request(route)).status, 401);
  assert.equal((await (await app.request("status")).json()).authenticated, false);
  await app.authenticate();
  for (const route of ["logout", "pulls", "pulls/7/save", "pulls/7/close", "pulls/7/merge"]) {
    for (const headers of [{ Origin: "https://attacker.example" }, { Origin: "null" }, { "X-CSRF-Token": "wrong" }, { Origin: "" }, { "X-CSRF-Token": "" }]) {
      assert.equal((await app.request(route, { method: "POST", headers, body: {} })).status, 403, route);
    }
  }
  assert.equal(app.github.mutations().length, 0);
  const logout = await app.request("logout", { method: "POST", body: {} });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get("Set-Cookie"), /Max-Age=0/);
  assert.equal((await app.request("pulls")).status, 401);
  await app.authenticate();
  app.advance(28800001);
  assert.equal((await app.request("pulls")).status, 401);
  assert.equal((await (await app.request("status")).json()).authenticated, false);
});

test("corrupt encrypted sessions fail closed and short-lived tokens require reauthentication", async () => {
  const app = setup();
  app.github.tokenExpiresIn = 60;
  await app.authenticate();
  app.advance(60001);
  assert.equal((await app.request("pulls")).status, 401);
  await app.authenticate();
  const key = `session:${app.cookie().split("=")[1]}`;
  app.kv.values.set(key, "v1.invalid");
  assert.equal((await app.request("pulls")).status, 401);
});

test("repository write permissions are refreshed for every mutation", async () => {
  const app = setup();
  await app.authenticate();
  app.github.repository.permissions.push = false;
  assert.equal((await (await app.request("status")).json()).canWrite, false);
  for (const route of ["pulls", "pulls/7/save", "pulls/7/close", "pulls/7/merge"]) {
    assert.equal((await app.request(route, { method: "POST", body: saveBody([textChange]) })).status, 403);
  }
  assert.equal(app.github.mutations().length, 0);
  app.github.repository.full_name = "attacker/repository";
  assert.equal((await app.request("pulls/7/close", { method: "POST", body: { expectedSha: initialHead } })).status, 409);
});

test("PR execution validates open state, base, same repository, branch and exact title prefix", async () => {
  const changes = [
    (pull) => { pull.state = "closed"; },
    (pull) => { pull.base.ref = "other"; },
    (pull) => { pull.base.repo.full_name = "attacker/repository"; },
    (pull) => { pull.head.repo.full_name = "attacker/repository"; },
    (pull) => { pull.head.repo = null; },
    (pull) => { pull.head.ref = "main"; },
    (pull) => { pull.title = " [Editor][alice] not exact"; },
  ];
  for (const modify of changes) {
    const app = setup();
    await app.authenticate();
    modify(app.github.latestPull());
    assert.equal((await app.request("pulls/7")).status, 409);
    assert.equal((await app.request("pulls/7/save", { method: "POST", body: saveBody([textChange]) })).status, 409);
    assert.equal((await app.request(`archive?sha=${initialHead}&pull=7`)).status, 409);
    assert.equal(app.github.mutations().length, 0);
  }
});

test("listing paginates all exact-prefix open same-repository PRs without authorizing their branches", async () => {
  const app = setup();
  await app.authenticate();
  const first = Array.from({ length: 100 }, (_, index) => fixturePull(index + 1));
  const last = fixturePull(101);
  last.head.ref = "other-branch";
  const excluded = fixturePull(102);
  excluded.head.repo.full_name = "fork/repo";
  const excludedPrefix = fixturePull(103);
  excludedPrefix.title = "[editor] wrong case";
  app.github.listing = [first, [last, excluded, excludedPrefix]];
  const result = await app.request("pulls");
  assert.equal(result.status, 200);
  assert.equal((await result.json()).length, 101);
  assert.equal(app.github.calls.filter((call) => call.url.pathname.endsWith("/pulls")).length, 2);
});

test("creation first commits metadata only, makes a draft and recovers ambiguous retries", async () => {
  for (const failure of ["none", "ref", "pull"]) {
    const app = setup();
    await app.authenticate();
    app.github.failAfterRef = failure === "ref";
    app.github.failAfterPull = failure === "pull";
    const body = { title: "Éditer l'accueil", requestId };
    const first = await app.request("pulls", { method: "POST", body });
    assert.equal(first.status, failure === "none" ? 200 : 503, await first.clone().text());
    const retried = await app.request("pulls", { method: "POST", body });
    assert.equal(retried.status, 200, await retried.clone().text());
    const pull = await retried.json();
    assert.equal(pull.title, "[Editor][alice] Éditer l'accueil");
    assert.equal(pull.draft, true);
    assert.match(pull.headRef, new RegExp(`^editor/alice/editer-l-accueil-${requestId}$`));
    const mutations = app.github.mutations();
    assert.equal(mutations.filter((call) => call.url.pathname.endsWith("/pulls") && call.method === "POST").length, 1);
    assert.equal(mutations.filter((call) => call.url.pathname.endsWith("/git/commits")).length, 1);
    const tree = mutations.find((call) => call.url.pathname.endsWith("/git/trees")).body.tree;
    assert.equal(tree.length, 1);
    assert.equal(tree[0].path, `.editor/requests/${requestId}.json`);
    const blob = mutations.find((call) => call.url.pathname.endsWith("/git/blobs")).body;
    assert.equal(blob.encoding, "utf-8");
    assert.deepEqual(JSON.parse(blob.content), { version: 1, name: "Éditer l'accueil", author: "alice", time: "2026-10-08T20:00:00.000Z" });
    assert.equal((await app.request("pulls", { method: "POST", body: { ...body, title: "Autre nom" } })).status, 409);
  }
});

test("save uses one grouped Git tree/commit and a non-force ref, preserving binary bytes and deletions", async () => {
  const app = setup();
  await app.authenticate();
  const bytes = Buffer.from([0, 255, 128, 7]);
  const changes = [textChange, { path: "public/assets/photo.webp", content: bytes.toString("base64"), encoding: "base64" }, { path: "src/content/old.md", content: null, encoding: "utf8" }];
  const result = await app.request("pulls/7/save", { method: "POST", body: saveBody(changes) });
  assert.equal(result.status, 200, await result.clone().text());
  const pull = await result.json();
  assert.notEqual(pull.headSha, initialHead);
  assert.equal(pull.savedSha, pull.headSha);
  const mutations = app.github.mutations();
  const tree = mutations.find((call) => call.url.pathname.endsWith("/git/trees")).body;
  assert.equal(tree.base_tree, initialTree);
  assert.equal(tree.tree.length, 3);
  assert.deepEqual(tree.tree[2], { path: "src/content/old.md", type: "blob", mode: "100755", sha: null });
  const commit = mutations.find((call) => call.url.pathname.endsWith("/git/commits")).body;
  assert.deepEqual(commit.parents, [initialHead]);
  assert.match(commit.message, new RegExp(`Editor-Request: save:${requestId}`));
  assert.equal(mutations.filter((call) => call.url.pathname.endsWith("/git/commits")).length, 1);
  assert.equal(mutations.find((call) => call.method === "PATCH").body.force, false);
  assert.deepEqual(mutations.find((call) => call.url.pathname.endsWith("/git/blobs") && call.body.encoding === "base64").body.content, bytes.toString("base64"));
  const again = await app.request("pulls/7/save", { method: "POST", body: saveBody(changes) });
  assert.equal(again.status, 200, await again.clone().text());
  const recovered = await again.json();
  assert.equal(recovered.headSha, pull.headSha);
  assert.equal(recovered.savedSha, pull.savedSha);
  assert.equal(app.github.mutations().filter((call) => call.url.pathname.endsWith("/git/commits")).length, 1);
  assert.equal((await app.request("pulls/7/save", { method: "POST", body: saveBody([{ ...textChange, content: "different" }]) })).status, 409);
});

test("save recovers an accepted ref after network loss, including later descendant saves", async () => {
  const app = setup();
  await app.authenticate();
  app.github.failAfterRef = true;
  const body = saveBody([textChange]);
  assert.equal((await app.request("pulls/7/save", { method: "POST", body })).status, 503);
  const savedSha = app.github.latestPull().head.sha;
  assert.notEqual(savedSha, initialHead);
  const immediateRetry = await app.request("pulls/7/save", { method: "POST", body });
  assert.equal(immediateRetry.status, 200);
  const immediate = await immediateRetry.json();
  assert.equal(immediate.headSha, savedSha);
  assert.equal(immediate.savedSha, savedSha);
  const second = await app.request("pulls/7/save", { method: "POST", body: saveBody([{ ...textChange, content: "later" }], { expectedSha: savedSha, requestId: secondId }) });
  assert.equal(second.status, 200);
  const descendant = await second.json();
  assert.equal(descendant.savedSha, descendant.headSha);
  assert.notEqual(descendant.headSha, savedSha);
  const retry = await app.request("pulls/7/save", { method: "POST", body });
  assert.equal(retry.status, 200, await retry.clone().text());
  const recovered = await retry.json();
  assert.equal(recovered.headSha, descendant.headSha);
  assert.equal(recovered.savedSha, savedSha);
  assert.notEqual(recovered.savedSha, recovered.headSha);
  assert.equal(app.github.mutations().filter((call) => call.url.pathname.endsWith("/git/commits")).length, 2);
});

test("first save success preserves our savedSha when another author advances the confirmed head", async () => {
  const app = setup();
  await app.authenticate();
  let pullReads = 0;
  let savedSha;
  let descendantSha;
  app.github.override = ({ url, method }) => {
    if (method === "GET" && url.pathname.endsWith("/pulls/7") && ++pullReads === 3) {
      savedSha = app.github.latestPull().head.sha;
      descendantSha = app.github.nextSha();
      app.github.commits.set(descendantSha, {
        sha: descendantSha, message: "Another author's update", parents: [{ sha: savedSha }],
        tree: app.github.commits.get(savedSha).tree,
      });
      app.github.refs.set("editor/alice/test-7", descendantSha);
      app.github.latestPull().head.sha = descendantSha;
    }
  };
  const result = await app.request("pulls/7/save", { method: "POST", body: saveBody([textChange]) });
  assert.equal(result.status, 200, await result.clone().text());
  const saved = await result.json();
  assert.equal(saved.savedSha, savedSha);
  assert.equal(saved.headSha, descendantSha);
  assert.notEqual(saved.savedSha, saved.headSha);
  assert.equal(saved.number, 7);
  assert.equal(saved.headRef, "editor/alice/test-7");
  const retry = await app.request("pulls/7/save", { method: "POST", body: saveBody([textChange]) });
  assert.equal(retry.status, 200);
  const recovered = await retry.json();
  assert.equal(recovered.savedSha, savedSha);
  assert.equal(recovered.headSha, descendantSha);
  assert.equal(app.github.mutations().filter((call) => call.url.pathname.endsWith("/git/commits")).length, 1);
});

test("malicious/protected paths, malformed bodies and size/count bounds never move the ref", async () => {
  const app = setup();
  await app.authenticate();
  for (const path of ["../secret", "src/content/../../package.json", "src/content\\bad.json", "/src/content/home.json", ".github/workflows/check.yml", "package.json", "src/editor/client.ts", "src/pages/edit.astro", "src/pages/edit/settings.ts", "src/pages/admin/users.ts", "src/pages/api/token.ts", "src/components/admin.ts", "src/content/site.config.ts", "src/content/.secret.json", "public/assets/.env.png", "C:/secret", "src/content/a\u0000.json"]) {
    assert.equal((await app.request("pulls/7/save", { method: "POST", body: saveBody([{ ...textChange, path }]) })).status, 400, path);
  }
  const invalidBodies = [
    saveBody([]), saveBody(Array(101).fill(textChange)), saveBody([textChange, textChange]),
    saveBody([{ ...textChange, content: 12 }]), saveBody([{ ...textChange, encoding: "hex" }]),
    saveBody([{ ...textChange, content: "abc", encoding: "base64" }]), saveBody([{ ...textChange, content: "AB==", encoding: "base64" }]),
    saveBody([textChange], { expectedSha: "main" }), saveBody([textChange], { requestId: "not-an-id" }),
    null, [], "bad JSON",
  ];
  for (const body of invalidBodies) assert.equal((await app.request("pulls/7/save", { method: "POST", body })).status, 400);
  assert.equal((await app.request("pulls/7/save", { method: "POST", headers: { "Content-Type": "text/plain" }, body: {} })).status, 400);
  assert.equal((await app.request("pulls/7/save", { method: "POST", headers: { "Content-Length": String(33 * 1024 * 1024) }, body: {} })).status, 413);
  assert.equal((await app.request("pulls/7/save", { method: "POST", body: saveBody([{ ...textChange, content: "a".repeat(16 * 1024 * 1024 + 1) }]) })).status, 413);
  assert.equal(app.github.mutations().length, 0);
});

test("save rejects symlinks, submodules, directory replacement and truncated trees", async () => {
  for (const entry of [
    { path: textChange.path, type: "blob", mode: "120000" },
    { path: "src/content", type: "commit", mode: "160000" },
    { path: "src/content", type: "blob", mode: "120000" },
    { path: textChange.path, type: "tree", mode: "040000" },
  ]) {
    const app = setup();
    await app.authenticate();
    const entries = app.github.trees.get(initialTree);
    app.github.trees.set(initialTree, [...entries.filter((item) => item.path !== entry.path), { ...entry, sha: "8".repeat(40) }]);
    assert.equal((await app.request("pulls/7/save", { method: "POST", body: saveBody([textChange]) })).status, 400);
    assert.equal(app.github.mutations().some((call) => call.method === "PATCH"), false);
  }
  const app = setup();
  await app.authenticate();
  app.github.override = ({ url }) => url.pathname.includes("/git/trees/") ? response({ tree: [], truncated: true }) : undefined;
  assert.equal((await app.request("pulls/7/save", { method: "POST", body: saveBody([textChange]) })).status, 409);
});

test("stale saves and concurrent head changes never use force or report successful persistence", async () => {
  const app = setup();
  await app.authenticate();
  assert.equal((await app.request("pulls/7/save", { method: "POST", body: saveBody([textChange], { expectedSha: main }) })).status, 409);
  let reads = 0;
  app.github.override = ({ url }) => {
    if (url.pathname.endsWith("/pulls/7") && ++reads === 2) {
      app.github.latestPull().head.sha = main;
      app.github.refs.set("editor/alice/test-7", main);
    }
  };
  assert.equal((await app.request("pulls/7/save", { method: "POST", body: saveBody([textChange]) })).status, 409);
  assert.equal(app.github.mutations().some((call) => call.method === "PATCH"), false);
});

test("required check runs and legacy statuses gate the exact head and mergeability", async () => {
  const app = setup();
  await app.authenticate();
  app.github.checkRuns = [];
  assert.equal((await (await app.request("pulls/7/checks")).json()).state, "pending");
  assert.equal((await app.request("pulls/7/merge", { method: "POST", body: { expectedSha: initialHead } })).status, 409);
  app.github.statuses = ["Editor validation", "Cloudflare Pages"].map((context, id) => ({ id, context, state: "success", sha: initialHead }));
  assert.equal((await (await app.request("pulls/7/checks")).json()).state, "success");
  app.github.statuses.push({ id: 10, context: "Editor validation", state: "pending" });
  assert.equal((await (await app.request("pulls/7/checks")).json()).state, "pending");
  app.github.statuses.push({ id: 11, context: "Editor validation", state: "failure" });
  assert.equal((await (await app.request("pulls/7/checks")).json()).state, "failure");
  app.github.statuses = [];
  app.github.checkRuns = [{ name: "Editor validation", head_sha: initialHead, status: "in_progress", conclusion: null }, { name: "Cloudflare Pages", head_sha: initialHead, status: "completed", conclusion: "success" }];
  assert.equal((await (await app.request("pulls/7/checks")).json()).state, "pending");
  app.github.checkRuns[0] = { ...app.github.checkRuns[0], status: "completed", conclusion: "failure" };
  assert.equal((await (await app.request("pulls/7/checks")).json()).state, "failure");
  app.github.checkRuns = undefined;
  app.github.latestPull().mergeable = null;
  assert.equal((await (await app.request("pulls/7/checks")).json()).state, "pending");
  app.github.latestPull().mergeable = false;
  assert.equal((await (await app.request("pulls/7/checks")).json()).state, "failure");
  app.github.latestPull().mergeable = true;
  app.github.latestPull().mergeable_state = "blocked";
  assert.equal((await (await app.request("pulls/7/checks")).json()).state, "pending");
  app.github.latestPull().mergeable_state = "clean";
  app.github.checkRuns = [{ name: "Editor validation", status: "completed", conclusion: "success", head_sha: main }];
  assert.equal((await app.request("pulls/7/checks")).status, 502);
});

test("merge requires the saved current SHA, readies drafts, respects supported methods and GitHub refusal", async () => {
  const app = setup();
  await app.authenticate();
  const saved = await (await app.request("pulls/7/save", { method: "POST", body: saveBody([textChange]) })).json();
  assert.equal((await app.request("pulls/7/merge", { method: "POST", body: { expectedSha: initialHead } })).status, 409);
  assert.equal(app.github.calls.some((call) => call.url.pathname === "/graphql"), false);
  const merged = await app.request("pulls/7/merge", { method: "POST", body: { expectedSha: saved.headSha } });
  assert.equal(merged.status, 200, await merged.clone().text());
  assert.deepEqual(await merged.json(), { merged: true, sha: "f".repeat(40), message: "La demande a été fusionnée dans main." });
  const merge = app.github.calls.find((call) => call.url.pathname.endsWith("/merge"));
  assert.deepEqual(merge.body, { sha: saved.headSha, merge_method: "squash" });
  assert.equal(app.github.calls.filter((call) => call.url.pathname === "/graphql").length, 1);
  const unsupported = setup();
  await unsupported.authenticate();
  unsupported.env.EDITOR_MERGE_METHOD = "rebase";
  unsupported.github.repository.allow_rebase_merge = false;
  assert.equal((await unsupported.request("pulls/7/merge", { method: "POST", body: { expectedSha: initialHead } })).status, 409);
  assert.equal(unsupported.github.mutations().length, 0);
  const refused = setup();
  await refused.authenticate();
  refused.github.override = ({ url }) => url.pathname.endsWith("/merge") ? response({ message: "SECRET-token-do-not-expose" }, 405) : undefined;
  const failure = await refused.request("pulls/7/merge", { method: "POST", body: { expectedSha: initialHead } });
  assert.equal(failure.status, 409);
  assert.equal((await failure.text()).includes("SECRET"), false);
});

test("merge rechecks a draft's head after ready and cannot merge concurrent unsaved edits", async () => {
  const app = setup();
  await app.authenticate();
  app.github.override = ({ url }) => {
    if (url.pathname === "/graphql") {
      app.github.latestPull().head.sha = main;
      return response({ data: { markPullRequestReadyForReview: { pullRequest: { isDraft: false, headRefOid: main } } } });
    }
  };
  assert.equal((await app.request("pulls/7/merge", { method: "POST", body: { expectedSha: initialHead } })).status, 409);
  assert.equal(app.github.calls.some((call) => call.url.pathname.endsWith("/merge")), false);
});

test("close checks the head, closes only the PR and never deletes its branch", async () => {
  const app = setup();
  await app.authenticate();
  assert.equal((await app.request("pulls/7/close", { method: "POST", body: { expectedSha: main } })).status, 409);
  assert.equal(app.github.mutations().length, 0);
  const closed = await app.request("pulls/7/close", { method: "POST", body: { expectedSha: initialHead } });
  assert.equal(closed.status, 200);
  assert.deepEqual(await closed.json(), { closed: true });
  assert.equal(app.github.latestPull().state, "closed");
  assert.equal(app.github.refs.get("editor/alice/test-7"), initialHead);
  assert.equal(app.github.calls.some((call) => call.method === "DELETE"), false);
});

test("archive verifies exact authorized SHA, streams without token or signed URL exposure", async () => {
  const app = setup();
  await app.authenticate();
  assert.equal((await app.request(`archive?sha=${initialHead}`)).status, 409);
  assert.equal((await app.request(`archive?sha=${main}&pull=7`)).status, 409);
  assert.equal((await app.request("archive?sha=main")).status, 400);
  const archive = await app.request(`archive?sha=${initialHead}&pull=7`);
  assert.equal(archive.status, 200);
  assert.deepEqual(new Uint8Array(await archive.arrayBuffer()), new Uint8Array([80, 75, 1, 2]));
  assert.equal(archive.headers.get("Content-Type"), "application/zip");
  assert.equal(archive.headers.has("Location"), false);
  assert.equal(archive.headers.has("Authorization"), false);
  assert.equal(app.github.calls.find((call) => call.url.hostname === "codeload.github.com").headers.has("Authorization"), false);
  app.github.override = ({ url }) => url.pathname.includes("/zipball/") ? new Response(null, { status: 302, headers: { Location: "https://attacker.example/archive" } }) : undefined;
  assert.equal((await app.request(`archive?sha=${main}`)).status, 502);
  assert.equal(app.github.calls.some((call) => call.url.hostname === "attacker.example"), false);
});

test("deployment reports authoritative latest production status only for the requested SHA", async () => {
  const app = setup();
  await app.authenticate();
  assert.equal((await (await app.request(`deployment?sha=${main}`)).json()).state, "pending");
  app.github.deployments = [
    { id: 1, sha: main, environment: "preview", production_environment: false, created_at: "2026-10-08T20:00:00Z" },
    { id: 2, sha: initialHead, environment: "production", created_at: "2026-10-08T20:01:00Z" },
    { id: 3, sha: main, environment: "github-pages", production_environment: true, created_at: "2026-10-08T20:02:00Z" },
  ];
  app.github.deploymentStatuses = [{ id: 10, created_at: "2026-10-08T20:00:00Z", state: "success", environment_url: "https://site.example/" }, { id: 11, created_at: "2026-10-08T20:01:00Z", state: "in_progress" }];
  assert.equal((await (await app.request(`deployment?sha=${main}`)).json()).state, "pending");
  app.github.deploymentStatuses.push({ id: 12, created_at: "2026-10-08T20:02:00Z", state: "success", environment_url: "https://site.example/" });
  const success = await (await app.request(`deployment?sha=${main}`)).json();
  assert.equal(success.state, "success");
  assert.equal(success.url, "https://site.example/");
  app.github.deploymentStatuses.push({ id: 13, created_at: "2026-10-08T20:03:00Z", state: "error" });
  assert.equal((await (await app.request(`deployment?sha=${main}`)).json()).state, "failure");
  assert.ok(app.github.calls.some((call) => call.url.pathname.endsWith("/deployments/3/statuses")));
});

test("incremental checkout uses complete blobs for text, binary, rename and delete, never patches", async () => {
  const app = setup();
  await app.authenticate();
  const textSha = "a".repeat(40);
  const binarySha = "b".repeat(40);
  app.github.blobs.set(textSha, { sha: textSha, size: Buffer.byteLength("Vendée"), encoding: "base64", content: Buffer.from("Vendée").toString("base64") });
  app.github.blobs.set(binarySha, { sha: binarySha, size: 4, encoding: "base64", content: Buffer.from([0, 255, 128, 7]).toString("base64") });
  app.github.diffFiles = [
    { filename: "src/content/title.md", status: "modified", sha: textSha, patch: "@@ truncated and incorrect @@" },
    { filename: "public/assets/new.webp", previous_filename: "public/assets/old.webp", status: "renamed", sha: binarySha },
    { filename: "src/content/deleted.md", status: "removed", sha: "c".repeat(40) },
  ];
  const result = await app.request(`pulls/7/changes?from=${main}&expectedSha=${initialHead}`);
  assert.equal(result.status, 200, await result.clone().text());
  const changes = await result.json();
  assert.deepEqual(changes.find((item) => item.path === "src/content/title.md"), { path: "src/content/title.md", content: "Vendée", encoding: "utf8" });
  assert.deepEqual(changes.find((item) => item.path === "public/assets/new.webp"), { path: "public/assets/new.webp", content: "AP+ABw==", encoding: "base64" });
  assert.equal(changes.find((item) => item.path === "public/assets/old.webp").content, null);
  assert.equal(changes.find((item) => item.path === "src/content/deleted.md").content, null);
  assert.equal(app.github.calls.some((call) => call.url.pathname.includes("/zipball/")), false);
  assert.equal(app.github.mutations().length, 0);
});

test("incremental checkout rejects stale or changing selected heads, non-ancestor caches and truncated/oversized diffs", async () => {
  const app = setup();
  await app.authenticate();
  assert.equal((await app.request(`pulls/7/changes?from=${main}`)).status, 400);
  assert.equal((await app.request(`pulls/7/changes?from=${main}&expectedSha=${main}`)).status, 409);
  const cached = "a".repeat(40);
  app.github.comparisons.set(`${cached}...${main}`, { status: "diverged", files: [] });
  let result = await app.request(`pulls/7/changes?from=${cached}&expectedSha=${initialHead}`);
  assert.equal(result.status, 409);
  assert.match((await result.json()).message, /archive complète/);
  app.github.comparisons.set(`${cached}...${main}`, { status: "ahead", files: [] });
  app.github.comparisons.set(`${cached}...${initialHead}`, { status: "diverged", files: [] });
  assert.equal((await app.request(`pulls/7/changes?from=${cached}&expectedSha=${initialHead}`)).status, 409);
  app.github.diffFiles = Array.from({ length: 300 }, (_, index) => ({ filename: `src/content/${index}.md`, status: "modified", sha: cached }));
  result = await app.request(`pulls/7/changes?from=${main}&expectedSha=${initialHead}`);
  assert.equal(result.status, 409);
  assert.match((await result.json()).message, /300 fichiers/);
  app.github.diffFiles = [{ filename: "public/assets/large.pdf", status: "added", sha: cached }];
  app.github.blobs.set(cached, { sha: cached, size: 16 * 1024 * 1024 + 1, encoding: "base64", content: "" });
  assert.equal((await app.request(`pulls/7/changes?from=${main}&expectedSha=${initialHead}`)).status, 413);
  app.github.override = ({ url }) => url.pathname.endsWith(`/git/blobs/${cached}`) ? response({}, 200, { "Content-Length": String(33 * 1024 * 1024) }) : undefined;
  const oversized = await app.request(`pulls/7/changes?from=${main}&expectedSha=${initialHead}`);
  assert.equal(oversized.status, 413);
  assert.match((await oversized.json()).message, /archive complète/);
  app.github.override = undefined;
  app.github.diffFiles = [];
  let reads = 0;
  app.github.override = ({ url }) => {
    if (url.pathname.endsWith("/pulls/7") && ++reads === 2) app.github.latestPull().head.sha = main;
  };
  assert.equal((await app.request(`pulls/7/changes?from=${main}&expectedSha=${initialHead}`)).status, 409);
});

test("GitHub/API/storage failures are not success-shaped or leaked in logs", async () => {
  const app = setup();
  await app.authenticate();
  app.github.override = ({ url }) => url.pathname.endsWith("/pulls/7") ? response({ secret: "FAKE-GITHUB-ACCESS-TOKEN" }, 500) : undefined;
  const failure = await app.request("pulls/7");
  assert.equal(failure.status, 502);
  assert.equal((await failure.text()).includes("TOKEN"), false);
  app.github.override = undefined;
  app.env.EDITOR_SESSIONS.get = async () => { throw new Error("FAKE-GITHUB-ACCESS-TOKEN"); };
  assert.equal((await app.request("pulls/7")).status, 503);
  assert.deepEqual(app.logs, ["Editor backend: unexpected server or storage failure."]);
});
