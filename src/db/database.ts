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

    const columns = await database.getAllAsync<{ name: string }>(
      "PRAGMA table_info(todos)",
    );
    for (const [name, definition] of Object.entries({
      dueDate: "TEXT",
      priority: "TEXT NOT NULL DEFAULT 'Med'",
      category: "TEXT NOT NULL DEFAULT 'Others'",
    })) {
      if (!columns.some((column) => column.name === name)) {
        await database.execAsync(`ALTER TABLE todos ADD COLUMN ${name} ${definition}`);
      }
    }

    return database;
  },
);

export async function initDatabase() {
  await databasePromise;
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
