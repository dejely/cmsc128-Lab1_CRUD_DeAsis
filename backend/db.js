const path = require("node:path");
const Database = require("better-sqlite3");

const dbPath = process.env.DB_PATH
  ? path.resolve(__dirname, process.env.DB_PATH)
  : path.join(__dirname, "data.sqlite");

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function columnNames(table) {
  return new Set(
    db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name),
  );
}

function addColumnIfMissing(table, column, definition) {
  const columns = columnNames(table);
  if (!columns.has(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username
      ON users(username COLLATE NOCASE);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
      ON users(email COLLATE NOCASE);

    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      due_date TEXT,
      priority TEXT NOT NULL DEFAULT 'Medium',
      category TEXT NOT NULL DEFAULT 'Others',
      client_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      version INTEGER NOT NULL DEFAULT 1,
      deleted_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_todos_user_client
      ON todos(user_id, client_id)
      WHERE client_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_todos_user_updated
      ON todos(user_id, updated_at);

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_password_reset_user
      ON password_reset_tokens(user_id);

    CREATE TABLE IF NOT EXISTS sync_operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      operation_id TEXT NOT NULL,
      result_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, operation_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Safe, additive migration support for an older backend DB.
  // No DROP, DELETE, VACUUM, or database-file replacement is performed.
  if (!columnNames("users").has("updated_at")) {
    addColumnIfMissing("users", "updated_at", "TEXT");
    db.prepare(`
      UPDATE users
      SET updated_at = COALESCE(updated_at, created_at, datetime('now'))
    `).run();
  }

  for (const [column, definition, updateSql] of [
    ["due_date", "TEXT", "UPDATE todos SET due_date = NULL WHERE due_date IS NULL"],
    [
      "priority",
      "TEXT",
      "UPDATE todos SET priority = 'Medium' WHERE priority IS NULL OR priority = ''",
    ],
    [
      "category",
      "TEXT",
      "UPDATE todos SET category = 'Others' WHERE category IS NULL OR category = ''",
    ],
    [
      "client_id",
      "TEXT",
      null,
    ],
    [
      "created_at",
      "TEXT",
      "UPDATE todos SET created_at = COALESCE(created_at, datetime('now'))",
    ],
    [
      "updated_at",
      "TEXT",
      "UPDATE todos SET updated_at = COALESCE(updated_at, created_at, datetime('now'))",
    ],
    [
      "version",
      "INTEGER NOT NULL DEFAULT 1",
      "UPDATE todos SET version = COALESCE(version, 1)",
    ],
    ["deleted_at", "TEXT", null],
  ]) {
    if (!columnNames("todos").has(column)) {
      addColumnIfMissing("todos", column, definition);
      if (updateSql) db.exec(updateSql);
    }
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_todos_user_updated
      ON todos(user_id, updated_at);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_todos_user_client
      ON todos(user_id, client_id)
      WHERE client_id IS NOT NULL;
  `);
}

initializeDatabase();

module.exports = db;
