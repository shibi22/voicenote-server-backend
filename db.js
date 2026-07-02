import { createClient } from "@libsql/client";
import "dotenv/config";

// Local file DB by default (zero setup). Point TURSO_DATABASE_URL + TURSO_AUTH_TOKEN
// at a free Turso database to get a persistent, hosted DB instead.
const db = createClient(
  process.env.TURSO_DATABASE_URL
    ? {
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
      }
    : { url: "file:local.db" }
);

export async function initDb() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

export async function createNote(text) {
  const result = await db.execute({
    sql: "INSERT INTO notes (text) VALUES (?) RETURNING id, text, created_at",
    args: [text],
  });
  return result.rows[0];
}

export async function listNotes(limit = 50) {
  const result = await db.execute({
    sql: "SELECT id, text, created_at FROM notes ORDER BY id DESC LIMIT ?",
    args: [limit],
  });
  return result.rows;
}

export async function searchNotes(query, limit = 20) {
  const result = await db.execute({
    sql: "SELECT id, text, created_at FROM notes WHERE text LIKE ? ORDER BY id DESC LIMIT ?",
    args: [`%${query}%`, limit],
  });
  return result.rows;
}

export async function deleteNote(id) {
  const result = await db.execute({
    sql: "DELETE FROM notes WHERE id = ?",
    args: [id],
  });
  return result.rowsAffected > 0;
}
