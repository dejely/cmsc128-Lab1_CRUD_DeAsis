const nodemailer = require("nodemailer");
const RESET_SCHEME = process.env.RESET_APP_SCHEME || "cmsc128lab1cruddeasis";

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


module.exports = { sendResetEmail };
