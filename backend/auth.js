const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.warn("JWT_SECRET is not set. Protected routes will reject requests until it is configured.");
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);

  if (!match || !JWT_SECRET) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const payload = jwt.verify(match[1], JWT_SECRET);
    if (!payload || typeof payload !== "object" || !payload.sub) {
      return res.status(401).json({ error: "Invalid authentication token." });
    }

    req.userId = Number(payload.sub);
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired authentication token." });
  }
}

module.exports = { requireAuth };
