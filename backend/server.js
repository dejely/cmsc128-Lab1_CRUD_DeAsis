require("dotenv").config();

const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

require("./db");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const RESET_SCHEME = process.env.RESET_APP_SCHEME || "cmsc128lab1cruddeasis";

app.use(cors());
app.use(express.json({ limit: "100kb" }));

app.get("/", (req, res) => {
  res.json({
    message: "CMSC128 Lab 1 API",
    status: "ok",
    port: PORT,
  });
});

function createMailer() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const secure = String(process.env.SMTP_SECURE || "").toLowerCase() === "true";

  if (!host || !user || !password || !process.env.SMTP_FROM) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass: password,
    },
  });
}

async function sendResetEmail({ to, username, rawToken, expiresAt }) {
  const transporter = createMailer();

  if (!transporter) {
    throw new Error(
      "SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM.",
    );
  }

  const resetUrl = `${RESET_SCHEME}://reset-password?token=${encodeURIComponent(rawToken)}`;

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: "Reset your ToDo password",
    text:
      `Hi ${username},\n\n` +
      `Use this link to reset your password:\n${resetUrl}\n\n` +
      `The link expires at ${expiresAt} and can only be used once.\n`,
    html:
      `<p>Hi ${escapeHtml(username)},</p>` +
      `<p>Use the link below to reset your password:</p>` +
      `<p><a href="${escapeHtml(resetUrl)}">Reset password</a></p>` +
      `<p>This link expires at ${escapeHtml(expiresAt)} and can only be used once.</p>`,
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

require("./routes/auth").registerRoutes(app, { sendResetEmail });
require("./routes/todos").registerTodoRoutes(app);

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);

  return res.status(500).json({
    error: "Internal server error.",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

verifyMailer();

async function verifyMailer() {
  const transporter = createMailer();

  if (!transporter) {
    console.log("SMTP is not configured.");
    return;
  }

  try {
    await transporter.verify();
    console.log("SMTP connection successful.");
  } catch (error) {
    console.error("SMTP connection failed:", error.message);
  }
}
