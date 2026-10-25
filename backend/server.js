const { existsSync } = require("node:fs");
const path = require("node:path");
const { createApp } = require("./app");
const { openDatabase } = require("./db");

const envFile = path.join(__dirname, ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be between 1 and 65535");
}
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || Buffer.byteLength(jwtSecret) < 32) {
  throw new Error("Set JWT_SECRET to a random secret of at least 32 bytes");
}
const db = openDatabase(path.resolve(__dirname, process.env.DB_PATH || "data.sqlite"));
const { sendResetEmail } = require("./mailer");
const app = createApp({ db, jwtSecret, origins: process.env.CORS_ORIGINS, sendResetEmail });
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => server.close(() => {
    db.close();
    process.exit(0);
  }));
}
