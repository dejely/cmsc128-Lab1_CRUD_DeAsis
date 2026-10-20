const express = require("express");
const cors = require("cors");
const { createAuth } = require("./auth");
const { HttpError } = require("./validation");

function createApp({ db, jwtSecret, origins = "", authLimit = 20, sendResetEmail = async () => { throw new Error("SMTP is not configured"); } }) {
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
  app.use(express.json({ limit: "100kb" }));
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
  app.get("/", (req, res) => res.json({ status: "ok" }));
  require("./routes/auth").registerRoutes(app, { db, issue, requireAuth, limitAuth, sendResetEmail });
  require("./routes/todos").registerTodoRoutes(app, { db, requireAuth });
  app.use((req, res, next) => next(new HttpError(404, "Route not found")));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    let status = error instanceof HttpError ? error.status : 500;
    let message = error instanceof HttpError ? error.message : "Internal server error";
    if (error.type === "entity.parse.failed") { status = 400; message = "Invalid JSON"; }
    if (error.type === "entity.too.large") { status = 413; message = "Request body too large"; }
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") { status = 409; message = "Username or email is already registered"; }
    if (status === 500) console.error("Request failed:", error.code || error.name);
    res.status(status).json({ error: message });
  });
  return app;
}

module.exports = { createApp };
