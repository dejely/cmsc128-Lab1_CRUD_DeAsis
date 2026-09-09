import * as SQLite from "expo-sqlite";
import { Todo } from "./todo";

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

export async function initDatabase() {
  await databasePromise;
}

export async function getTodos(): Promise<Todo[]> {
  const database = await databasePromise;

  return database.getAllAsync<Todo>(
    "SELECT id, title, completed FROM todos ORDER BY id DESC",
  );
}

export async function addTodo(title: string) {
  const database = await databasePromise;

  await database.runAsync(
    "INSERT INTO todos (title, completed) VALUES (?,?)",
    title,
    0,
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
