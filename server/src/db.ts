// SQLite (Node'ga o'rnatilgan node:sqlite). Bitta fayl — serverga qo'yish va zaxiralash oson.
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type Db = DatabaseSync;

/** Sxema versiyalari: har biri bir marta, tartib bilan qo'llanadi (PRAGMA user_version) */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE admins (
    tg_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    added_at TEXT NOT NULL
  );
  CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    template TEXT NOT NULL DEFAULT '',
    code_length INTEGER NOT NULL DEFAULT 5,
    ttl_sec INTEGER NOT NULL DEFAULT 300,
    created_at TEXT NOT NULL
  );
  CREATE TABLE contacts (
    tg_id INTEGER PRIMARY KEY,
    phone TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL DEFAULT '',
    username TEXT,
    lang TEXT NOT NULL DEFAULT 'uz',
    blocked INTEGER NOT NULL DEFAULT 0,
    linked_at TEXT NOT NULL,
    last_code_at TEXT
  );
  CREATE TABLE deliveries (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    code TEXT NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('SEND', 'VERIFY')),
    status TEXT NOT NULL CHECK (status IN ('WAITING', 'SENT', 'EXPIRED', 'FAILED', 'USED')),
    link_token TEXT NOT NULL UNIQUE,
    attempts INTEGER NOT NULL DEFAULT 0,
    lang TEXT,
    created_at TEXT NOT NULL,
    sent_at TEXT,
    expires_at TEXT NOT NULL
  );
  CREATE INDEX deliveries_phone_status ON deliveries (phone, status);
  CREATE INDEX deliveries_project_created ON deliveries (project_id, created_at);
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE sessions (
    token TEXT PRIMARY KEY,
    tg_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE login_links (
    token TEXT PRIMARY KEY,
    tg_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL
  );
  `,
  // 2: yuborilgan xabar — muddati tugagach yoki ishlatilgach bot uni tahrirlab, kodni olib tashlaydi
  `
  ALTER TABLE deliveries ADD COLUMN tg_chat_id INTEGER;
  ALTER TABLE deliveries ADD COLUMN tg_message_id INTEGER;
  ALTER TABLE deliveries ADD COLUMN tg_closed INTEGER NOT NULL DEFAULT 0;
  CREATE INDEX deliveries_open_messages ON deliveries (tg_closed, expires_at) WHERE tg_message_id IS NOT NULL;
  `,
];

export function openDb(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  const version = Number((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version);
  for (let v = version; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  return db;
}
