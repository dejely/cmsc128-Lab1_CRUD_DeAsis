import * as SQLite from "expo-sqlite";
import { Storage } from "expo-sqlite/kv-store";
import { Todo } from "./todo";

export type SignedInUser = {
  username: string;
  email: string;
};

const signedInUserKey = "signed-in-user";

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

    const columns = await database.getAllAsync<{ name: string }>(
      "PRAGMA table_info(todos)",
    );
    for (const [name, definition] of Object.entries({
      dueDate: "TEXT",
      priority: "TEXT NOT NULL DEFAULT 'Med'",
      category: "TEXT NOT NULL DEFAULT 'Others'",
    })) {
      if (!columns.some((column) => column.name === name)) {
        await database.execAsync(
          `ALTER TABLE todos ADD COLUMN ${name} ${definition}`,
        );
      }
    }

    return database;
  },
);

export async function initDatabase() {
  const db = await databasePromise;

  await db.execAsync(`
        PRAGMA journal_mode = WAL;

        CREATE TABLE IF NOT EXISTS users (
        
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT (datetime('now', 'localtime')),
        email TEXT NOT NULL CHECK (email = LOWER(email)) UNIQUE
        );
        
        `);

  // for migration:
  const userColumns = await db.getAllAsync<{ name: string }>(
    "PRAGMA table_info(users)",
  );
  if (!userColumns.some((column) => column.name === "email")) {
    await db.execAsync(
      "ALTER TABLE users ADD COLUMN email TEXT NOT NULL DEFAULT '' CHECK (email = LOWER(email))",
    );
  }
}

export async function getTodos(): Promise<Todo[]> {
  const database = await databasePromise;

  return database.getAllAsync<Todo>(
    "SELECT id, title, completed, dueDate, priority, category FROM todos ORDER BY id DESC",
  );
}

export async function addTodo(
  title: string,
  dueDate: string,
  priority: Todo["priority"],
  category: Todo["category"],
) {
  const database = await databasePromise;

  await database.runAsync(
    "INSERT INTO todos (title, dueDate, priority, category) VALUES (?,?,?,?)",
    title,
    dueDate,
    priority,
    category,
  );
}

export async function deleteTodo(id: number) {
  const database = await databasePromise;

  await database.runAsync("DELETE FROM todos WHERE id = ?", id);
}

export async function updateTodo(id: number, title: string) {
  const database = await databasePromise;

  await database.runAsync("UPDATE todos SET title = ? WHERE id =?", title, id);
}

export async function createUser(
  username: string,
  password_hash: string,
  email: string,
) {
  await initDatabase();
  const database = await databasePromise;

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
    return JSON.parse(savedUser) as SignedInUser;
  } catch {
    await Storage.removeItem(signedInUserKey);
    return null;
  }
}

export async function loginUser(
  email: string,
  password_hash: string,
): Promise<SignedInUser | null> {
  await initDatabase();
  const database = await databasePromise;

  return database.getFirstAsync<SignedInUser>(
    "SELECT username, email FROM users WHERE email = ? AND password_hash = ?",
    email,
    password_hash,
  );
}
