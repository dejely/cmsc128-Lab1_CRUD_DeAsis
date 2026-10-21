const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const { createAuth } = require("./auth");
const { HttpError, credentials, todoBody, taskId } = require("./validation");

function createApp({ db, jwtSecret, origins = "", authLimit = 20 }) {
  if (typeof jwtSecret !== "string" || Buffer.byteLength(jwtSecret) < 32) {
    throw new Error("JWT_SECRET must contain at least 32 bytes");
  }
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  const allowedOrigins = origins.split(",").map(origin => origin.trim()).filter(Boolean);
  app.use(cors({ origin: allowedOrigins }));
  app.use(express.json({ limit: "32kb" }));
  const { issue, requireAuth } = createAuth(db, jwtSecret);
  const attempts = new Map();
  // Per-process protection; leave proxy trust disabled so clients cannot spoof their IP.
  function limitAuth(req, res, next) {
    const now = Date.now();
    for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
    const entry = attempts.get(req.ip) || { count: 0, until: now + 15 * 60 * 1000 };
    attempts.set(req.ip, entry);
    if (++entry.count > authLimit) {
      res.set("Retry-After", String(Math.ceil((entry.until - now) / 1000)));
      return next(new HttpError(429, "Too many authentication attempts. Try again later"));
    }
    next();
  }
  const dummyHash = bcrypt.hashSync("unused-login-password", 12);
  const columns = "id, title, completed, dueDate, priority, category";
  app.get("/", (req, res) => res.json({ status: "ok" }));
  app.post("/auth/signup", limitAuth, async (req, res) => {
    const input = credentials(req.body, true);
    const passwordHash = await bcrypt.hash(input.password, 12);
    let user;
    try {
      user = db.transaction(() => {
        const result = db.prepare("INSERT INTO users (username,email,password_hash) VALUES (?,?,?)")
          .run(input.username, input.email, passwordHash);
        return issue({ id: Number(result.lastInsertRowid), username: input.username, email: input.email });
      })();
    } catch (error) {
      if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
        throw new HttpError(409, "Username or email is already registered");
      }
      throw error;
    }
    res.status(201).json(user);
  });
  app.post("/auth/login", limitAuth, async (req, res) => {
    const input = credentials(req.body);
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(input.email);
    const valid = await bcrypt.compare(input.password, user ? user.password_hash : dummyHash);
    if (!user || !valid) throw new HttpError(401, "Invalid email or password");
    res.json(issue(user));
  });
  app.get("/auth/me", requireAuth, (req, res) => res.json({ user: req.user }));
  app.post("/auth/logout", requireAuth, (req, res) => {
    db.prepare("DELETE FROM sessions WHERE id = ? AND user_id = ?").run(req.sessionId, req.user.id);
    res.status(204).end();
  });
  app.use("/todos", requireAuth);
  app.get("/todos", (req, res) => {
    res.json({ todos: db.prepare(`SELECT ${columns} FROM todos WHERE user_id = ? ORDER BY id DESC`).all(req.user.id) });
  });
  app.post("/todos", (req, res) => {
    const task = todoBody(req.body);
    const result = db.prepare(`INSERT INTO todos (user_id,title,completed,dueDate,priority,category)
      VALUES (@user_id,@title,@completed,@dueDate,@priority,@category)`)
      .run({ user_id: req.user.id, ...task });
    res.status(201).json({ todo: db.prepare(`SELECT ${columns} FROM todos WHERE id = ? AND user_id = ?`)
      .get(result.lastInsertRowid, req.user.id) });
  });
  app.patch("/todos/:id", (req, res) => {
    const id = taskId(req.params.id);
    const patch = todoBody(req.body, true);
    // Field names are restricted by todoBody; values are bound parameters.
    const result = db.prepare(`UPDATE todos SET ${Object.keys(patch).map(key => `${key} = ?`).join(", ")}
      WHERE id = ? AND user_id = ?`).run(...Object.values(patch), id, req.user.id);
    if (!result.changes) throw new HttpError(404, "Task not found");
    res.json({ todo: db.prepare(`SELECT ${columns} FROM todos WHERE id = ? AND user_id = ?`).get(id, req.user.id) });
  });
  app.delete("/todos/:id", (req, res) => {
    const id = taskId(req.params.id);
    if (!db.prepare("DELETE FROM todos WHERE id = ? AND user_id = ?").run(id, req.user.id).changes) {
      throw new HttpError(404, "Task not found");
    }
    res.status(204).end();
  });
  app.use((req, res, next) => next(new HttpError(404, "Route not found")));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    let status = error instanceof HttpError ? error.status : 500;
    let message = error instanceof HttpError ? error.message : "Internal server error";
    if (error.type === "entity.parse.failed") { status = 400; message = "Invalid JSON"; }
    if (error.type === "entity.too.large") { status = 413; message = "Request body too large"; }
    if (status === 500) console.error("Request failed:", error.code || error.name);
    res.status(status).json({ error: message });
  });
  return app;
}

module.exports = { createApp };
