const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const { HttpError } = require("./validation");

function createAuth(db, secret) {
  const jwtOptions = { algorithm: "HS256", issuer: "todo-api", audience: "todo-app" };
  function issue(user) {
    const id = crypto.randomUUID();
    const token = jwt.sign({}, secret, {
      ...jwtOptions, subject: String(user.id), jwtid: id, expiresIn: "1h",
    });
    const { exp } = jwt.decode(token);
    db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Math.floor(Date.now() / 1000));
    db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?,?,?)").run(id, user.id, exp);
    return { token, user: { id: user.id, username: user.username, email: user.email } };
  }
  function requireAuth(req, res, next) {
    const match = /^Bearer (\S+)$/.exec(req.headers.authorization || "");
    if (!match) return next(new HttpError(401, "Please sign in"));
    let claims;
    try {
      claims = jwt.verify(match[1], secret, {
        algorithms: ["HS256"], issuer: jwtOptions.issuer, audience: jwtOptions.audience,
      });
    } catch {
      return next(new HttpError(401, "Session expired or invalid. Please sign in again"));
    }
    if (!claims || typeof claims !== "object" || typeof claims.sub !== "string" || !/^[1-9]\d*$/.test(claims.sub) ||
        !Number.isSafeInteger(Number(claims.sub)) || typeof claims.jti !== "string" ||
        !Number.isInteger(claims.exp)) {
      return next(new HttpError(401, "Invalid session"));
    }
    const user = db.prepare(`
      SELECT users.id, users.username, users.email FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.id = ? AND users.id = ? AND sessions.expires_at > ?
    `).get(claims.jti, Number(claims.sub), Math.floor(Date.now() / 1000));
    if (!user) return next(new HttpError(401, "Session expired or revoked"));
    req.user = user;
    req.sessionId = claims.jti;
    next();
  }
  return { issue, requireAuth };
}

module.exports = { createAuth };
