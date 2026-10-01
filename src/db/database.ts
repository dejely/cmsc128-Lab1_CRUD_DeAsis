import * as SQLite from "expo-sqlite";
import { Storage } from "expo-sqlite/kv-store";
import type { Todo } from "./todo";

export type SignedInUser = {
  id: number;
  username: string;
  email: string;
};

export type SyncOperation = {
  operationId: string;
  type: "create" | "update" | "delete";
  localId: number;
  serverId: number | null;
  payload: {
    clientId?: string;
    title?: string;
    completed?: number;
    dueDate?: string | null;
    priority?: Todo["priority"];
    category?: Todo["category"];
  };
  updatedAt: string;
};

type LocalTodoRow = {
  id: number;
  title: string;
  completed: number;
  dueDate: string | null;
  priority: Todo["priority"] | "Med";
  category: Todo["category"];
  server_id: number | null;
  owner_key: string | null;
  created_at: string;
  updated_at: string;
  version: number;
  deleted_at: string | null;
  sync_state: "pending" | "synced" | "error";
  last_sync_error: string | null;
};

const signedInUserKey = "signed-in-user";
const activeAccountKey = "active-account-key";

const databasePromise = SQLite.openDatabaseAsync("tasks.db").then(
  async (database) => {
    await database.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        title TEXT NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0
      );
    `);

    return database;
  },
);

function newOperationId(localId: number) {
  return `${Date.now()}-${localId}-${Math.random().toString(36).slice(2)}`;
}

function accountKey(userId: number) {
  return `backend-user:${userId}`;
}

async function getDatabase() {
  return databasePromise;
}

async function getTodoColumns(database: SQLite.SQLiteDatabase) {
  return database.getAllAsync<{ name: string }>(
    "PRAGMA table_info(todos)",
  );
}

async function addTodoColumnIfMissing(
  database: SQLite.SQLiteDatabase,
  name: string,
  definition: string,
) {
  const columns = await getTodoColumns(database);
  if (!columns.some((column) => column.name === name)) {
    await database.execAsync(`ALTER TABLE todos ADD COLUMN ${name} ${definition}`);
  }
}

async function migrateTodoSchema(database: SQLite.SQLiteDatabase) {
  // These are additive migrations. Existing rows are never deleted or recreated.
  await addTodoColumnIfMissing(database, "dueDate", "TEXT");
  await addTodoColumnIfMissing(
    database,
    "priority",
    "TEXT NOT NULL DEFAULT 'Medium'",
  );
  await addTodoColumnIfMissing(
    database,
    "category",
    "TEXT NOT NULL DEFAULT 'Others'",
  );

  await addTodoColumnIfMissing(database, "server_id", "INTEGER");
  await addTodoColumnIfMissing(database, "owner_key", "TEXT");
  await addTodoColumnIfMissing(database, "created_at", "TEXT");
  await addTodoColumnIfMissing(database, "updated_at", "TEXT");
  await addTodoColumnIfMissing(
    database,
    "version",
    "INTEGER NOT NULL DEFAULT 0",
  );
  await addTodoColumnIfMissing(database, "deleted_at", "TEXT");
  await addTodoColumnIfMissing(
    database,
    "sync_state",
    "TEXT NOT NULL DEFAULT 'pending'",
  );
  await addTodoColumnIfMissing(database, "last_sync_error", "TEXT");

  await database.execAsync(`
    UPDATE todos
    SET
      created_at = COALESCE(created_at, datetime('now')),
      updated_at = COALESCE(updated_at, created_at, datetime('now')),
      version = COALESCE(version, 0),
      sync_state = COALESCE(sync_state, 'pending'),
      priority = COALESCE(priority, 'Medium'),
      category = COALESCE(category, 'Others');

    CREATE INDEX IF NOT EXISTS idx_todos_owner
      ON todos(owner_key, deleted_at);

    CREATE INDEX IF NOT EXISTS idx_todos_server_id
      ON todos(server_id);

    CREATE TABLE IF NOT EXISTS todo_sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      owner_key TEXT NOT NULL,
      local_todo_id INTEGER NOT NULL,
      operation TEXT NOT NULL,
      operation_id TEXT NOT NULL UNIQUE,
      server_id INTEGER,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_todo_sync_owner
      ON todo_sync_queue(owner_key, id);
  `);
}

export async function initDatabase() {
  const database = await getDatabase();
  await migrateTodoSchema(database);

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      email TEXT NOT NULL CHECK (email = LOWER(email)) UNIQUE
    );
  `);

  const userColumns = await database.getAllAsync<{ name: string }>(
    "PRAGMA table_info(users)",
  );

  if (!userColumns.some((column) => column.name === "email")) {
    await database.execAsync(
      "ALTER TABLE users ADD COLUMN email TEXT NOT NULL DEFAULT '' CHECK (email = LOWER(email))",
    );
  }
}

export async function getActiveAccountKey(): Promise<string | null> {
  return Storage.getItem(activeAccountKey);
}

export async function setActiveAccount(userId: number) {
  await Storage.setItem(activeAccountKey, accountKey(userId));
}

export async function clearActiveAccount() {
  await Storage.removeItem(activeAccountKey);
}

export async function claimExistingTodosForAccount(userId: number) {
  const database = await getDatabase();
  await initDatabase();

  const key = accountKey(userId);
  const oldTodos = await database.getAllAsync<{ id: number; deleted_at: string | null }>(
    `SELECT id, deleted_at FROM todos WHERE owner_key IS NULL`,
  );

  for (const todo of oldTodos) {
    await database.runAsync(
      "UPDATE todos SET owner_key = ?, sync_state = 'pending', last_sync_error = NULL WHERE id = ? AND owner_key IS NULL",
      key,
      todo.id,
    );

    if (!todo.deleted_at) {
      const full = await database.getFirstAsync<LocalTodoRow>(
        `SELECT * FROM todos WHERE id = ?`,
        todo.id,
      );
      if (full) {
        await enqueueOperationForTodo(database, full, "create");
      }
    }
  }
}

function rowToTodo(row: Pick<LocalTodoRow, "id" | "title" | "completed" | "dueDate" | "priority" | "category">): Todo {
  return {
    id: row.id,
    title: row.title,
    completed: Number(row.completed),
    dueDate: row.dueDate,
    // The original local schema used "Med"; keep the stored row intact but
    // normalize the value at the application boundary for the current type.
    priority: row.priority === "Med" ? "Medium" : row.priority,
    category: row.category,
  };
}

async function getCurrentAccountOrThrow() {
  const key = await getActiveAccountKey();
  if (!key) {
    throw new Error("No authenticated account is active on this device.");
  }
  return key;
}

export async function getTodos(): Promise<Todo[]> {
  const database = await getDatabase();
  await initDatabase();
  const key = await getActiveAccountKey();

  if (!key) return [];

  const rows = await database.getAllAsync<LocalTodoRow>(
    `
      SELECT
        id, title, completed, dueDate, priority, category,
        server_id, owner_key, created_at, updated_at, version,
        deleted_at, sync_state, last_sync_error
      FROM todos
      WHERE owner_key = ? AND deleted_at IS NULL
      ORDER BY id DESC
    `,
    key,
  );

  return rows.map(rowToTodo);
}

async function enqueueOperationForTodo(
  database: SQLite.SQLiteDatabase,
  todo: LocalTodoRow,
  forcedType?: "create" | "update" | "delete",
) {
  if (!todo.owner_key) return;

  const type =
    forcedType ||
    (todo.deleted_at
      ? "delete"
      : todo.server_id === null
        ? "create"
        : "update");

  if (type === "delete" && todo.server_id === null) {
    await database.runAsync(
      "DELETE FROM todo_sync_queue WHERE owner_key = ? AND local_todo_id = ?",
      todo.owner_key,
      todo.id,
    );
    return;
  }

  const payload = {
    clientId: `${todo.owner_key}:${todo.id}`,
    title: todo.title,
    completed: Number(todo.completed),
    dueDate: todo.dueDate ?? null,
    priority: todo.priority === "Med" ? "Medium" : todo.priority,
    category: todo.category,
  };

  await database.runAsync(
    "DELETE FROM todo_sync_queue WHERE owner_key = ? AND local_todo_id = ?",
    todo.owner_key,
    todo.id,
  );

  await database.runAsync(
    `
      INSERT INTO todo_sync_queue (
        owner_key,
        local_todo_id,
        operation,
        operation_id,
        server_id,
        payload_json,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    todo.owner_key,
    todo.id,
    type,
    newOperationId(todo.id),
    todo.server_id,
    JSON.stringify(type === "delete" ? {} : payload),
    todo.updated_at,
  );
}

export async function addTodo(
  title: string,
  dueDate: string,
  priority: Todo["priority"],
  category: Todo["category"],
) {
  const database = await getDatabase();
  const ownerKey = await getCurrentAccountOrThrow();
  const now = new Date().toISOString();

  const result = await database.runAsync(
    `
      INSERT INTO todos (
        title, completed, dueDate, priority, category,
        owner_key, created_at, updated_at, version, sync_state
      )
      VALUES (?, 0, ?, ?, ?, ?, ?, ?, 0, 'pending')
    `,
    title,
    dueDate || null,
    priority,
    category,
    ownerKey,
    now,
    now,
  );

  const id = Number(result.lastInsertRowId);
  const row = await database.getFirstAsync<LocalTodoRow>(
    "SELECT * FROM todos WHERE id = ?",
    id,
  );

  if (!row) throw new Error("Failed to load newly created todo.");
  await enqueueOperationForTodo(database, row, "create");

  return rowToTodo(row);
}

export async function deleteTodo(id: number) {
  const database = await getDatabase();
  const ownerKey = await getCurrentAccountOrThrow();
  const now = new Date().toISOString();

  await database.runAsync(
    `
      UPDATE todos
      SET deleted_at = ?, updated_at = ?, sync_state = 'pending', last_sync_error = NULL
      WHERE id = ? AND owner_key = ?
    `,
    now,
    now,
    id,
    ownerKey,
  );

  const row = await database.getFirstAsync<LocalTodoRow>(
    "SELECT * FROM todos WHERE id = ? AND owner_key = ?",
    id,
    ownerKey,
  );

  if (row) await enqueueOperationForTodo(database, row, "delete");
}

export async function restoreTodo(todo: Todo) {
  const database = await getDatabase();
  const ownerKey = await getCurrentAccountOrThrow();
  const now = new Date().toISOString();

  await database.runAsync(
    `
      UPDATE todos
      SET deleted_at = NULL, updated_at = ?, sync_state = 'pending', last_sync_error = NULL
      WHERE id = ? AND owner_key = ?
    `,
    now,
    todo.id,
    ownerKey,
  );

  const row = await database.getFirstAsync<LocalTodoRow>(
    "SELECT * FROM todos WHERE id = ? AND owner_key = ?",
    todo.id,
    ownerKey,
  );

  if (row) await enqueueOperationForTodo(database, row);
}

export async function updateTodo(id: number, title: string) {
  const database = await getDatabase();
  const ownerKey = await getCurrentAccountOrThrow();
  const now = new Date().toISOString();

  await database.runAsync(
    `
      UPDATE todos
      SET title = ?, updated_at = ?, sync_state = 'pending', last_sync_error = NULL
      WHERE id = ? AND owner_key = ?
    `,
    title,
    now,
    id,
    ownerKey,
  );

  const row = await database.getFirstAsync<LocalTodoRow>(
    "SELECT * FROM todos WHERE id = ? AND owner_key = ?",
    id,
    ownerKey,
  );

  if (row) await enqueueOperationForTodo(database, row);
}

export async function getPendingSyncOperations(): Promise<SyncOperation[]> {
  const database = await getDatabase();
  const ownerKey = await getCurrentAccountOrThrow();

  const rows = await database.getAllAsync<{
    operation_id: string;
    operation: "create" | "update" | "delete";
    local_todo_id: number;
    server_id: number | null;
    payload_json: string;
    updated_at: string;
  }>(
    `
      SELECT operation_id, operation, local_todo_id, server_id,
             payload_json, updated_at
      FROM todo_sync_queue
      WHERE owner_key = ?
      ORDER BY id ASC
    `,
    ownerKey,
  );

  return rows.map((row) => ({
    operationId: row.operation_id,
    type: row.operation,
    localId: row.local_todo_id,
    serverId: row.server_id,
    payload: JSON.parse(row.payload_json),
    updatedAt: row.updated_at,
  }));
}

export async function markSyncOperationComplete(
  operationId: string,
) {
  const database = await getDatabase();
  await database.runAsync(
    "DELETE FROM todo_sync_queue WHERE operation_id = ?",
    operationId,
  );
}

export async function markTodoSyncError(
  localId: number,
  errorMessage: string,
) {
  const database = await getDatabase();
  const ownerKey = await getActiveAccountKey();
  if (!ownerKey) return;

  await database.runAsync(
    `
      UPDATE todos
      SET sync_state = 'error', last_sync_error = ?
      WHERE id = ? AND owner_key = ?
    `,
    errorMessage,
    localId,
    ownerKey,
  );

  await database.runAsync(
    `
      UPDATE todo_sync_queue
      SET retry_count = retry_count + 1, last_error = ?
      WHERE local_todo_id = ? AND owner_key = ?
    `,
    errorMessage,
    localId,
    ownerKey,
  );
}

export async function applyServerTodo(
  remote: {
    id: number;
    title: string;
    completed: number;
    dueDate: string | null;
    priority: Todo["priority"];
    category: Todo["category"];
    clientId: string | null;
    createdAt: string;
    updatedAt: string;
    version: number;
    deletedAt: string | null;
  },
) {
  const database = await getDatabase();
  const ownerKey = await getCurrentAccountOrThrow();

  const existing = await database.getFirstAsync<LocalTodoRow>(
    "SELECT * FROM todos WHERE server_id = ? AND owner_key = ?",
    remote.id,
    ownerKey,
  );

  const remoteTime = new Date(remote.updatedAt).getTime();

  if (!existing) {
    const clientLocalId =
      remote.clientId && remote.clientId.startsWith(`${ownerKey}:`)
        ? Number(remote.clientId.split(":").at(-1))
        : null;

    if (clientLocalId) {
      await database.runAsync(
        `
          UPDATE todos
          SET server_id = ?, title = ?, completed = ?, dueDate = ?,
              priority = ?, category = ?, created_at = ?, updated_at = ?,
              version = ?, deleted_at = ?, sync_state = 'synced',
              last_sync_error = NULL
          WHERE id = ? AND owner_key = ?
        `,
        remote.id,
        remote.title,
        remote.completed,
        remote.dueDate,
        remote.priority,
        remote.category,
        remote.createdAt,
        remote.updatedAt,
        remote.version,
        remote.deletedAt,
        clientLocalId,
        ownerKey,
      );
      return;
    }

    await database.runAsync(
      `
        INSERT INTO todos (
          title, completed, dueDate, priority, category,
          server_id, owner_key, created_at, updated_at, version,
          deleted_at, sync_state
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
      `,
      remote.title,
      remote.completed,
      remote.dueDate,
      remote.priority,
      remote.category,
      remote.id,
      ownerKey,
      remote.createdAt,
      remote.updatedAt,
      remote.version,
      remote.deletedAt,
    );
    return;
  }

  const localTime = new Date(existing.updated_at).getTime();
  const hasPendingChange = existing.sync_state === "pending" || existing.sync_state === "error";

  if (hasPendingChange && localTime > remoteTime) {
    return;
  }

  if (!hasPendingChange && localTime > remoteTime) {
    return;
  }

  await database.runAsync(
    `
      UPDATE todos
      SET title = ?, completed = ?, dueDate = ?, priority = ?, category = ?,
          created_at = ?, updated_at = ?, version = ?, deleted_at = ?,
          sync_state = 'synced', last_sync_error = NULL
      WHERE id = ? AND owner_key = ?
    `,
    remote.title,
    remote.completed,
    remote.dueDate,
    remote.priority,
    remote.category,
    remote.createdAt,
    remote.updatedAt,
    remote.version,
    remote.deletedAt,
    existing.id,
    ownerKey,
  );
}

export async function markLocalTodoSynced(
  localId: number,
  serverId: number | null,
  updatedAt: string | null,
  version: number | null,
) {
  const database = await getDatabase();
  const ownerKey = await getActiveAccountKey();
  if (!ownerKey) return;

  await database.runAsync(
    `
      UPDATE todos
      SET server_id = COALESCE(?, server_id),
          updated_at = COALESCE(?, updated_at),
          version = COALESCE(?, version),
          sync_state = 'synced',
          last_sync_error = NULL
      WHERE id = ? AND owner_key = ?
    `,
    serverId,
    updatedAt,
    version,
    localId,
    ownerKey,
  );
}

export async function removePendingQueueForTodo(localId: number) {
  const database = await getDatabase();
  const ownerKey = await getActiveAccountKey();
  if (!ownerKey) return;

  await database.runAsync(
    "DELETE FROM todo_sync_queue WHERE local_todo_id = ? AND owner_key = ?",
    localId,
    ownerKey,
  );
}

export async function createUser(
  username: string,
  password_hash: string,
  email: string,
) {
  // Kept only for compatibility with the pre-backend local database.
  // New registration is performed by the Express backend.
  await initDatabase();
  const database = await getDatabase();

  await database.runAsync(
    "INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)",
    username,
    password_hash,
    email,
  );
}

export async function saveSignedInUser(user: SignedInUser) {
  await Storage.setItem(signedInUserKey, JSON.stringify(user));
}

export async function getSignedInUser(): Promise<SignedInUser | null> {
  const savedUser = await Storage.getItem(signedInUserKey);
  if (!savedUser) return null;

  try {
    const parsed = JSON.parse(savedUser) as Partial<SignedInUser>;
    if (
      typeof parsed.id !== "number" ||
      typeof parsed.username !== "string" ||
      typeof parsed.email !== "string"
    ) {
      return null;
    }
    return parsed as SignedInUser;
  } catch {
    await Storage.removeItem(signedInUserKey);
    return null;
  }
}

export async function clearSavedSignedInUser() {
  await Storage.removeItem(signedInUserKey);
}
