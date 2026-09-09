import * as SQLite from "expo-sqlite";

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
