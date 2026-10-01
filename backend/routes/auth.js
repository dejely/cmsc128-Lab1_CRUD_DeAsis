const bcrypt = require("bcrypt");
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { requireAuth } = require("../auth");

const USERNAME_RE = /^[A-Za-z0-9_.-]{3,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;
const RESET_TOKEN_TTL_MINUTES = 30;

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function validateCredentials(username, email, password) {
  if (!USERNAME_RE.test(username)) {
    return "Username must be 3-32 characters and may contain letters, numbers, ., _, or -.";
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return "Enter a valid email address.";
  }
  if (typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  return null;
}

function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
  };
}

function signToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured.");
  }

  return jwt.sign(
    {
      sub: String(user.id),
      username: user.username,
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
  );
}

function registerRoutes(app, { sendResetEmail }) {
  app.post("/auth/register", async (req, res, next) => {
    try {
      const username = String(req.body?.username || "").trim();
      const email = normalizeEmail(req.body?.email);
      const password = String(req.body?.password || "");

      const validationError = validateCredentials(username, email, password);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      const existingUsername = db
        .prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE")
        .get(username);
      if (existingUsername) {
        return res.status(409).json({ error: "Username is already in use." });
      }

      const existingEmail = db
        .prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE")
        .get(email);
      if (existingEmail) {
        return res.status(409).json({ error: "Email is already in use." });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const result = db
        .prepare(`
          INSERT INTO users (username, email, password_hash, created_at, updated_at)
          VALUES (?, ?, ?, datetime('now'), datetime('now'))
        `)
        .run(username, email, passwordHash);

      const user = db
        .prepare("SELECT id, username, email FROM users WHERE id = ?")
        .get(result.lastInsertRowid);

      return res.status(201).json({
        token: signToken(user),
        user: publicUser(user),
      });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/auth/login", async (req, res, next) => {
    try {
      const identifier = String(req.body?.identifier || "").trim();
      const password = String(req.body?.password || "");

      if (!identifier || !password) {
        return res.status(400).json({ error: "Username/email and password are required." });
      }

      const normalizedIdentifier = identifier.toLowerCase();
      const user = db
        .prepare(`
          SELECT id, username, email, password_hash
          FROM users
          WHERE email = ? COLLATE NOCASE
             OR username = ? COLLATE NOCASE
          LIMIT 1
        `)
        .get(normalizedIdentifier, identifier);

      if (!user) {
        return res.status(401).json({ error: "Invalid username/email or password." });
      }

      const matches = await bcrypt.compare(password, user.password_hash);
      if (!matches) {
        return res.status(401).json({ error: "Invalid username/email or password." });
      }

      return res.json({
        token: signToken(user),
        user: publicUser(user),
      });
    } catch (error) {
      return next(error);
    }
  });

  app.get("/auth/me", requireAuth, (req, res) => {
    const user = db
      .prepare("SELECT id, username, email FROM users WHERE id = ?")
      .get(req.userId);

    if (!user) {
      return res.status(401).json({ error: "User no longer exists." });
    }

    return res.json({ user: publicUser(user) });
  });

  app.patch("/auth/me", requireAuth, async (req, res, next) => {
    try {
      const currentUser = db
        .prepare("SELECT id, username, email FROM users WHERE id = ?")
        .get(req.userId);

      if (!currentUser) {
        return res.status(404).json({ error: "User not found." });
      }

      const username = req.body?.username === undefined
        ? currentUser.username
        : String(req.body.username).trim();

      const email = req.body?.email === undefined
        ? currentUser.email
        : normalizeEmail(req.body.email);

      if (!USERNAME_RE.test(username)) {
        return res.status(400).json({ error: "Invalid username." });
      }
      if (!EMAIL_RE.test(email) || email.length > 254) {
        return res.status(400).json({ error: "Invalid email address." });
      }

      const usernameOwner = db
        .prepare(`
          SELECT id FROM users
          WHERE username = ? COLLATE NOCASE AND id <> ?
        `)
        .get(username, req.userId);
      if (usernameOwner) {
        return res.status(409).json({ error: "Username is already in use." });
      }

      const emailOwner = db
        .prepare(`
          SELECT id FROM users
          WHERE email = ? COLLATE NOCASE AND id <> ?
        `)
        .get(email, req.userId);
      if (emailOwner) {
        return res.status(409).json({ error: "Email is already in use." });
      }

      const result = db
        .prepare(`
          UPDATE users
          SET username = ?, email = ?, updated_at = datetime('now')
          WHERE id = ?
        `)
        .run(username, email, req.userId);

      if (result.changes !== 1) {
        return res.status(404).json({ error: "User not found." });
      }

      const updated = db
        .prepare("SELECT id, username, email FROM users WHERE id = ?")
        .get(req.userId);

      return res.json({
        user: publicUser(updated),
      });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/auth/reset-request", async (req, res, next) => {
    try {
      const email = normalizeEmail(req.body?.email);

      // Always return the same public response so callers cannot use this
      // endpoint to enumerate registered email addresses.
      const publicResponse = {
        message: "If that email is registered, a password reset link has been sent.",
      };

      if (!EMAIL_RE.test(email)) {
        return res.json(publicResponse);
      }

      const user = db
        .prepare("SELECT id, username, email FROM users WHERE email = ? COLLATE NOCASE")
        .get(email);

      if (!user) {
        return res.json(publicResponse);
      }

      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto
        .createHash("sha256")
        .update(rawToken)
        .digest("hex");

      const expiresAt = new Date(
        Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000,
      ).toISOString();

      db.prepare(`
        UPDATE password_reset_tokens
        SET used_at = datetime('now')
        WHERE user_id = ? AND used_at IS NULL
      `).run(user.id);

      db.prepare(`
        INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
        VALUES (?, ?, ?)
      `).run(user.id, tokenHash, expiresAt);

      try {
        await sendResetEmail({
          to: user.email,
          username: user.username,
          rawToken,
          expiresAt,
        });
      } catch (error) {
        // Do not expose mail-provider failures to the caller because the
        // response must not reveal whether an email address exists. Do not
        // log the reset token.
        console.error("Password reset email could not be sent:", error.message);
      }

      return res.json(publicResponse);
    } catch (error) {
      return next(error);
    }
  });

  app.post("/auth/reset-confirm", async (req, res, next) => {
    try {
      const token = String(req.body?.token || "");
      const newPassword = String(req.body?.newPassword || "");

      if (!token || newPassword.length < PASSWORD_MIN_LENGTH) {
        return res.status(400).json({
          error: `Token and a password of at least ${PASSWORD_MIN_LENGTH} characters are required.`,
        });
      }

      const tokenHash = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

      const reset = db
        .prepare(`
          SELECT id, user_id, expires_at, used_at
          FROM password_reset_tokens
          WHERE token_hash = ?
          LIMIT 1
        `)
        .get(tokenHash);

      if (!reset || reset.used_at || new Date(reset.expires_at).getTime() <= Date.now()) {
        return res.status(400).json({ error: "Reset token is invalid or expired." });
      }

      const passwordHash = await bcrypt.hash(newPassword, 12);

      const transaction = db.transaction(() => {
        db.prepare(`
          UPDATE users
          SET password_hash = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(passwordHash, reset.user_id);

        db.prepare(`
          UPDATE password_reset_tokens
          SET used_at = datetime('now')
          WHERE id = ?
        `).run(reset.id);
      });

      transaction();

      return res.json({ message: "Password has been reset successfully." });
    } catch (error) {
      return next(error);
    }
  });
}

module.exports = { registerRoutes };
