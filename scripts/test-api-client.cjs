const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

// Exercise the real client against a mocked transport and SecureStore boundary.
// Native navigation and the device SQLite sync queue need device validation.
function client(fetch, url = "http://localhost:3000/") {
  const source = readFileSync(path.join(__dirname, "../src/services/api.ts"), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  const storage = new Map();
  vm.runInNewContext(outputText, {
    exports,
    require(name) {
      assert.equal(name, "expo-secure-store");
      return {
        getItemAsync: async key => storage.get(key) || null,
        setItemAsync: async (key, value) => { storage.set(key, value); },
        deleteItemAsync: async key => { storage.delete(key); },
      };
    },
    process: { env: { EXPO_PUBLIC_API_BASE_URL: url } },
    fetch, Headers, AbortController, setTimeout, clearTimeout,
  });
  return exports;
}
const session = token => ({ token, user: { id: 1, username: "banana", email: "banana@example.test" } });
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json" },
});

test("login and registration remain compatible with main's API; logout uses the server session", async () => {
  const calls = [];
  const api = client(async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/auth/login") || url.endsWith("/auth/register")) return json(session("token"));
    if (url.endsWith("/auth/logout")) return new Response(null, { status: 204 });
    return json({ todos: [] });
  });
  await assert.rejects(api.apiRequest("/todos"), /Please sign in/);
  assert.equal(calls.length, 0);
  const login = await api.login("banana", "password");
  assert.deepEqual(JSON.parse(calls[0].options.body), { identifier: "banana", password: "password" });
  assert.equal(calls[0].options.headers.get("Authorization"), null);
  await api.saveAuthToken(login.token);
  assert.equal(await api.getAuthToken(), "token");
  await api.apiRequest("/todos");
  assert.equal(calls[1].options.headers.get("Authorization"), "Bearer token");
  assert.ok(calls[1].options.signal instanceof AbortSignal);
  await api.logout();
  assert.equal(calls[2].url, "http://localhost:3000/auth/logout");
  await api.removeAuthToken();
  assert.equal(await api.getAuthToken(), null);
  await api.register("banana", "banana@example.test", "password");
  assert.ok(calls[3].url.endsWith("/auth/register"));
});

test("public authentication errors never clear a saved token", async () => {
  const api = client(async () => json({ error: "Invalid credentials" }, 401));
  await api.saveAuthToken("existing-token");
  await assert.rejects(api.login("banana", "bad-password"), /Invalid credentials/);
  assert.equal(await api.getAuthToken(), "existing-token");
});

test("a protected 401 clears the token and notifies auth; network and other errors preserve it", async () => {
  let result = "network";
  let notifications = 0;
  const api = client(async () => {
    if (result === "network") throw new TypeError("offline");
    return json({ error: "Denied" }, result);
  });
  await api.saveAuthToken("token");
  api.subscribeToUnauthorized(() => notifications++);
  await assert.rejects(api.apiRequest("/todos"), /Network request failed/);
  assert.equal(await api.getAuthToken(), "token");
  result = 403;
  await assert.rejects(api.apiRequest("/todos"), /Denied/);
  assert.equal(await api.getAuthToken(), "token");
  result = 401;
  await assert.rejects(api.apiRequest("/todos"), /Denied/);
  assert.equal(await api.getAuthToken(), null);
  assert.equal(notifications, 1);
});

test("an old request's 401 cannot clear a newly saved login", async () => {
  let finishOldRequest;
  let fetched;
  const ready = new Promise(resolve => { fetched = resolve; });
  const api = client(async () => await new Promise(resolve => {
    finishOldRequest = resolve;
    fetched();
  }));
  await api.saveAuthToken("old-token");
  const rejected = assert.rejects(api.apiRequest("/todos"), /Expired/);
  await ready;
  await api.saveAuthToken("new-token");
  finishOldRequest(json({ error: "Expired" }, 401));
  await rejected;
  assert.equal(await api.getAuthToken(), "new-token");
});

test("missing API configuration fails before sending credentials", async () => {
  const api = client(() => { throw new Error("Fetch must not run"); }, "");
  await assert.rejects(api.login("banana", "password"), /EXPO_PUBLIC_API_BASE_URL/);
  assert.equal(await api.getAuthToken(), null);
});
