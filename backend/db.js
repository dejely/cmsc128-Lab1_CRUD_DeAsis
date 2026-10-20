const Database = require("better-sqlite3");

function openDatabase(filename) {
  const db = new Database(filename);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  const version = db.pragma("user_version", { simple: true });
  if (version > 1) {
    db.close();
    throw new Error("Database schema is newer than this server");
  }
  if (version === 0) {
    try {
      db.transaction(() => {
        db.exec(`
          CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            username TEXT NOT NULL UNIQUE CHECK(length(trim(username)) BETWEEN 1 AND 50),
            email TEXT NOT NULL UNIQUE CHECK(email = lower(trim(email)) AND length(email) BETWEEN 3 AND 254),
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
          );
          CREATE TABLE sessions (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            expires_at INTEGER NOT NULL
          );
          CREATE INDEX sessions_expiry ON sessions(expires_at);
          CREATE TABLE todos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200),
            completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1)),
            dueDate TEXT NOT NULL,
            priority TEXT NOT NULL CHECK(priority IN ('Low','Medium','High')),
            category TEXT NOT NULL CHECK(category IN ('School','Personal','Others'))
          );
          CREATE INDEX todos_owner ON todos(user_id, id DESC);
          PRAGMA user_version = 1;
        `);
      })();
    } catch (error) {
      db.close();
      throw error;
    }
  }
  return db;
}

module.exports = { openDatabase };
