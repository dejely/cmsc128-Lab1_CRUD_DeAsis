const { test } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { randomBytes } = require("node:crypto");
const { mkdtempSync, rmSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { createApp } = require("../app");
const { openDatabase } = require("../db");

const account = { username: "banana", email: "banana@example.test", password: "a-strong-password" };
const task = { title: "Finish report", dueDate: "2026-10-25T00:00:00.000Z", priority: "High", category: "School" };

async function fixture(t, options = {}) {
  const db = openDatabase(options.filename || ":memory:");
  const secret = options.secret || randomBytes(32).toString("hex");
  const app = createApp({ db, jwtSecret: secret, authLimit: 100, ...options });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    db.close();
  }
  t.after(close);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  async function request(route, { method = "GET", token, body, raw, headers = {} } = {}) {
    const response = await fetch(baseUrl + route, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      body: raw === undefined ? body === undefined ? undefined : JSON.stringify(body) : raw,
    });
    const data = response.status === 204 ? null : await response.json();
    return { status: response.status, data, headers: response.headers };
  }
  async function signup(input = account) {
    const response = await request("/auth/signup", { method: "POST", body: input });
    assert.equal(response.status, 201);
    return response.data;
  }
  return { db, secret, request, signup, close };
}

test("signup hashes passwords, normalizes identity, and login verifies credentials", async t => {
  const { db, request, signup } = await fixture(t);
  const session = await signup({ ...account, username: " banana ", email: " BANANA@EXAMPLE.TEST " });
  assert.deepEqual(session.user, { id: 1, username: "banana", email: account.email });
  assert.equal(session.password_hash, undefined);
  const stored = db.prepare("SELECT password_hash FROM users").get().password_hash;
  assert.notEqual(stored, account.password);
  assert.ok(await bcrypt.compare(account.password, stored));
  const login = await request("/auth/login", { method: "POST", body: { email: account.email.toUpperCase(), password: account.password } });
  assert.equal(login.status, 200);
  assert.notEqual(login.data.token, session.token);
  assert.deepEqual((await request("/auth/me", { token: login.data.token })).data, { user: session.user });
  for (const email of [account.email, "missing@example.test"]) {
    const failed = await request("/auth/login", { method: "POST", body: { email, password: "incorrect" } });
    assert.equal(failed.status, 401);
    assert.equal(failed.data.error, "Invalid email or password");
  }
});

test("signup rejects empty/malformed credentials, bcrypt truncation, and duplicate identities", async t => {
  const { request, signup } = await fixture(t);
  for (const body of [
    {}, [], null, { ...account, username: " " }, { ...account, email: "" },
    { ...account, email: "bad-address" }, { ...account, password: "" },
    { ...account, password: "short" }, { ...account, password: "        " },
    { ...account, password: "é".repeat(37) }, { ...account, user_id: 99 },
  ]) {
    assert.equal((await request("/auth/signup", { method: "POST", body })).status, 400);
  }
  await signup();
  for (const duplicate of [
    { ...account, username: "another", email: " BANANA@EXAMPLE.TEST " },
    { ...account, email: "another@example.test" },
  ]) assert.equal((await request("/auth/signup", { method: "POST", body: duplicate })).status, 409);
});

test("CRUD requires authentication and isolates task reads, updates, and deletes", async t => {
  const { request, signup } = await fixture(t);
  for (const [route, method, body] of [["/todos", "GET"], ["/todos", "POST", task], ["/todos/1", "PATCH", { title: "changed" }], ["/todos/1", "DELETE"]]) {
    assert.equal((await request(route, { method, body })).status, 401);
  }
  const alice = await signup();
  const bob = await signup({ ...account, username: "bob", email: "bob@example.test" });
  const created = await request("/todos", { method: "POST", token: alice.token, body: task });
  assert.equal(created.status, 201);
  const id = created.data.todo.id;
  assert.equal(created.data.todo.completed, 0);
  assert.equal(created.data.todo.user_id, undefined);
  assert.deepEqual((await request("/todos", { token: bob.token })).data.todos, []);
  assert.equal((await request(`/todos/${id}`, { method: "PATCH", token: bob.token, body: { title: "stolen" } })).status, 404);
  assert.equal((await request(`/todos/${id}`, { method: "DELETE", token: bob.token })).status, 404);
  assert.equal((await request("/todos", { token: alice.token })).data.todos[0].title, task.title);
  const updated = await request(`/todos/${id}`, { method: "PATCH", token: alice.token, body: { title: "Submit 'report'", completed: 1, priority: "Low" } });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.todo.title, "Submit 'report'");
  assert.equal(updated.data.todo.completed, 1);
  assert.equal(updated.data.todo.dueDate, task.dueDate);
  assert.equal((await request(`/todos/${id}`, { method: "DELETE", token: alice.token })).status, 200);
  assert.deepEqual((await request("/todos", { token: alice.token })).data.todos, []);
  assert.equal((await request(`/todos/${id}`, { method: "DELETE", token: alice.token })).status, 404);
});

test("task validation rejects malformed fields and ownership injection without altering data", async t => {
  const { request, signup } = await fixture(t);
  const { token } = await signup();
  for (const body of [
    {}, [], null, { ...task, title: " " }, { ...task, title: "x".repeat(201) },
    { ...task, dueDate: "2026-02-30T00:00:00.000Z" }, { ...task, dueDate: "today" },
    { ...task, priority: "urgent" }, { ...task, category: "unknown" },
    { ...task, completed: 2 }, { ...task, completed: "0" }, { ...task, user_id: 2 },
  ]) assert.equal((await request("/todos", { method: "POST", token, body })).status, 400);
  assert.deepEqual((await request("/todos", { token })).data.todos, []);
  const id = (await request("/todos", { method: "POST", token, body: task })).data.todo.id;
  for (const body of [{}, { title: null }, { user_id: 2 }, { completed: true }]) {
    assert.equal((await request(`/todos/${id}`, { method: "PATCH", token, body })).status, 400);
  }
  for (const id of ["0", "-1", "1x", "1.2", "9007199254740992"]) {
    assert.equal((await request(`/todos/${id}`, { method: "DELETE", token })).status, 400);
  }
  assert.equal((await request("/todos", { token })).data.todos[0].title, task.title);
});

test("logout revokes only its session; tampered, expired, and unknown sessions fail", async t => {
  const { request, signup, secret } = await fixture(t);
  const { token, user } = await signup();
  const second = (await request("/auth/login", { method: "POST", body: { email: account.email, password: account.password } })).data.token;
  const claims = jwt.decode(token);
  const options = { algorithm: "HS256", subject: String(user.id), issuer: "todo-api", audience: "todo-app", jwtid: claims.jti };
  for (const badToken of [
    "invalid", jwt.sign({}, "another-secret", options),
    jwt.sign({}, secret, { ...options, expiresIn: -1 }),
    jwt.sign({}, secret, { ...options, audience: "other-app", expiresIn: 3600 }),
    jwt.sign({}, secret, { ...options, jwtid: "unknown-session", expiresIn: 3600 }),
    jwt.sign({}, secret, { ...options, subject: "1x", expiresIn: 3600 }),
  ]) assert.equal((await request("/todos", { token: badToken })).status, 401);
  assert.equal((await request("/auth/logout", { method: "POST", token })).status, 204);
  assert.equal((await request("/auth/me", { token })).status, 401);
  assert.equal((await request("/todos", { token: second })).status, 200);
});

test("rate limiting, JSON errors, body limits, and CORS return controlled responses", async t => {
  const { request } = await fixture(t, { authLimit: 2, origins: "https://app.example.test" });
  assert.equal((await request("/auth/login", { method: "POST", raw: "{" })).status, 400);
  assert.equal((await request("/auth/login", { method: "POST", body: { value: "x".repeat(103000) } })).status, 413);
  for (let i = 0; i < 2; i++) assert.equal((await request("/auth/login", { method: "POST", body: {} })).status, 400);
  const limited = await request("/auth/login", { method: "POST", body: {} });
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get("retry-after")) > 0);
  const allowed = await request("/", { headers: { Origin: "https://app.example.test" } });
  assert.equal(allowed.headers.get("access-control-allow-origin"), "https://app.example.test");
  assert.equal((await request("/", { headers: { Origin: "https://other.example.test" } })).headers.get("access-control-allow-origin"), null);
  assert.equal((await request("/missing")).status, 404);
});

test("users, tasks, constraints, and sessions survive database reopen", async t => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "todo-api-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const filename = path.join(directory, "test.sqlite");
  const first = await fixture(t, { filename });
  const { token } = await first.signup();
  await first.request("/todos", { method: "POST", token, body: task });
  await first.close();
  const second = await fixture(t, { filename, secret: first.secret });
  const result = await second.request("/todos", { token });
  assert.equal(result.status, 200);
  assert.equal(result.data.todos[0].title, task.title);
  assert.equal(second.db.pragma("user_version", { simple: true }), 2);
  assert.throws(() => second.db.prepare("INSERT INTO users (username,email,password_hash) VALUES (?,?,?)")
    .run("other", account.email, "unused"), /UNIQUE/);
  assert.throws(() => second.db.prepare("INSERT INTO users (username,email,password_hash) VALUES (?,?,?)")
    .run("other", "", "unused"), /CHECK/);
  await second.close();
});

test("application refuses a missing or weak signing secret", () => {
  for (const jwtSecret of [undefined, "", "short"]) {
    assert.throws(() => createApp({ db: null, jwtSecret }), /JWT_SECRET/);
  }
});

test("main's profile, offline sync, idempotency, and tombstones survive the merge", async t => {
  const { request, signup } = await fixture(t);
  const alice = await signup();
  const bob = await signup({ ...account, username: "bob", email: "bob@example.test" });
  assert.equal((await request("/auth/login", { method: "POST", body: { identifier: account.username, password: account.password } })).status, 200);
  const profile = await request("/auth/me", { method: "PATCH", token: alice.token, body: { username: "newname", email: "new@example.test" } });
  assert.equal(profile.status, 200);
  assert.equal((await request("/auth/me", { token: alice.token })).data.user.username, "newname");
  const operation = { operationId: "offline-create", type: "create", payload: { ...task, completed: 0, clientId: "local-1" }, updatedAt: "2026-10-25T00:00:00.000Z" };
  const sync = operations => request("/todos/sync", { method: "POST", token: alice.token, body: { operations } });
  const first = await sync([operation]);
  assert.equal(first.status, 200);
  const id = first.data.results[0].todo.id;
  const retried = await sync([operation]);
  assert.equal(retried.data.todos.length, 1);
  assert.deepEqual(retried.data.results, first.data.results);
  const foreign = await request("/todos/sync", { method: "POST", token: bob.token, body: { operations: [{ ...operation, operationId: "steal", type: "delete", serverId: id, updatedAt: "2026-10-26T00:00:00.000Z" }] } });
  assert.equal(foreign.data.results[0].gone, true);
  assert.deepEqual(foreign.data.todos, []);
  const deleted = await sync([{ operationId: "offline-delete", type: "delete", serverId: id, updatedAt: "2026-10-26T00:00:00.000Z" }]);
  assert.ok(deleted.data.todos[0].deletedAt);
  assert.deepEqual((await request("/todos", { token: alice.token })).data.todos, []);
  assert.equal((await sync(Array.from({ length: 201 }, () => operation))).status, 400);
});

test("password recovery remains single-use and revokes all previous sessions", async t => {
  let rawToken;
  const { request, signup, db } = await fixture(t, { sendResetEmail: async message => { rawToken = message.rawToken; } });
  const { token } = await signup();
  const recovery = await request("/auth/reset-request", { method: "POST", body: { email: account.email } });
  const unknown = await request("/auth/reset-request", { method: "POST", body: { email: "absent@example.test" } });
  assert.deepEqual(recovery.data, unknown.data);
  assert.ok(rawToken);
  assert.notEqual(db.prepare("SELECT token_hash FROM password_reset_tokens").get().token_hash, rawToken);
  const body = { token: rawToken, newPassword: "a-new-strong-password" };
  const results = await Promise.all([request("/auth/reset-confirm", { method: "POST", body }), request("/auth/reset-confirm", { method: "POST", body })]);
  assert.deepEqual(results.map(result => result.status).sort(), [200, 400]);
  assert.equal((await request("/auth/me", { token })).status, 401);
  assert.equal((await request("/auth/login", { method: "POST", body: { identifier: account.username, password: body.newPassword } })).status, 200);
});

test("schema migration preserves the PR's v1 accounts, tasks, and sessions", async t => {
  const Database = require("better-sqlite3");
  const directory = mkdtempSync(path.join(os.tmpdir(), "todo-v1-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const filename = path.join(directory, "test.sqlite");
  const legacy = new Database(filename);
  legacy.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE todos (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), title TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0, dueDate TEXT NOT NULL, priority TEXT NOT NULL, category TEXT NOT NULL);
    CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL);
    INSERT INTO users VALUES (1, 'banana', 'banana@example.test', 'legacy-hash', '2026-10-20T00:00:00.000Z');
    INSERT INTO todos VALUES (5, 1, 'Keep this task', 0, '2026-10-25T00:00:00.000Z', 'High', 'School');
    INSERT INTO sessions VALUES ('session-1', 1, 2000000000);
    PRAGMA user_version = 1;
  `);
  legacy.close();
  const migrated = openDatabase(filename);
  assert.equal(migrated.prepare("SELECT due_date FROM todos WHERE id=5").get().due_date, task.dueDate);
  assert.equal(migrated.prepare("SELECT title FROM todos WHERE id=5").get().title, "Keep this task");
  assert.equal(migrated.prepare("SELECT username FROM users WHERE id=1").get().username, "banana");
  assert.equal(migrated.prepare("SELECT count(*) AS count FROM sessions").get().count, 1);
  assert.equal(migrated.pragma("user_version", { simple: true }), 2);
  migrated.close();
});
