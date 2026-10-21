const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

// Execute the real client; React's external-store hook is reduced to its snapshot
// boundary here. These tests do not simulate rendering or native navigation.
function client(fetch, url = "http://localhost:3000/") {
  const source = readFileSync(path.join(__dirname, "../src/services/api.ts"), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    require(name) {
      assert.equal(name, "react");
      return { useSyncExternalStore: (_subscribe, snapshot) => snapshot() };
    },
    process: { env: { EXPO_PUBLIC_API_BASE_URL: url } },
    fetch, AbortController, setTimeout, clearTimeout,
  });
  return exports;
}
function session(token) {
  return { token, user: { id: 1, username: "banana", email: "banana@example.test" } };
}
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json" },
});

test("login sends credentials, protected requests attach tokens, and logout clears the session", async () => {
  const calls = [];
  const api = client(async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/auth/login")) return json(session("first-token"));
    if (url.endsWith("/auth/logout")) return new Response(null, { status: 204 });
    return json({ todos: [] });
  });
  assert.equal(api.useSession(), null);
  await assert.rejects(api.request("/todos"), /Please sign in/);
  assert.equal(calls.length, 0);
  await api.signIn("banana@example.test", "password");
  assert.equal(api.useSession().user.username, "banana");
  assert.equal(calls[0].url, "http://localhost:3000/auth/login");
  assert.deepEqual(JSON.parse(calls[0].options.body), { email: "banana@example.test", password: "password" });
  assert.equal(calls[0].options.headers.Authorization, undefined);
  await api.request("/todos");
  assert.equal(calls[1].options.headers.Authorization, "Bearer first-token");
  assert.ok(calls[1].options.signal instanceof AbortSignal);
  await api.signOut();
  assert.equal(api.useSession(), null);
  assert.equal(calls[2].options.headers.Authorization, "Bearer first-token");
});

test("signup creates an authenticated session and surfaces validation errors", async () => {
  let fail = true;
  const api = client(async () => fail ? json({ error: "Email is invalid" }, 400) : json(session("signup-token"), 201));
  await assert.rejects(api.signUp("banana", "invalid", "password"), /Email is invalid/);
  assert.equal(api.useSession(), null);
  fail = false;
  await api.signUp("banana", "banana@example.test", "password");
  assert.equal(api.useSession().token, "signup-token");
});

test("a protected 401 clears the session; network errors and other statuses preserve it", async () => {
  let result = 200;
  const api = client(async url => {
    if (url.endsWith("/auth/login")) return json(session("token"));
    if (result === "network") throw new TypeError("offline");
    return json({ error: "Request denied" }, result);
  });
  await api.signIn("banana@example.test", "password");
  result = "network";
  await assert.rejects(api.request("/todos"), /Cannot reach the server/);
  assert.equal(api.useSession().token, "token");
  result = 403;
  await assert.rejects(api.request("/todos"), /Request denied/);
  assert.equal(api.useSession().token, "token");
  result = 401;
  await assert.rejects(api.request("/todos"), /Request denied/);
  assert.equal(api.useSession(), null);
});

test("an old request's 401 cannot clear a newly signed-in session", async () => {
  let finishOldRequest;
  let logins = 0;
  const api = client(async url => {
    if (url.endsWith("/auth/login")) return json(session(`token-${++logins}`));
    return await new Promise(resolve => { finishOldRequest = resolve; });
  });
  await api.signIn("banana@example.test", "password");
  const oldRequest = api.request("/todos");
  const rejected = assert.rejects(oldRequest, /Expired/);
  await api.signIn("banana@example.test", "password");
  finishOldRequest(json({ error: "Expired" }, 401));
  await rejected;
  assert.equal(api.useSession().token, "token-2");
});

test("missing API configuration fails before sending credentials", async () => {
  const api = client(() => { throw new Error("Fetch must not run"); }, "");
  await assert.rejects(api.signIn("banana@example.test", "password"), /EXPO_PUBLIC_API_BASE_URL/);
  assert.equal(api.useSession(), null);
});
