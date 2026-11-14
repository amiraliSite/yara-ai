import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import {
  SCHEMA_SQL,
  type ChatMessageRow,
  type ChatSessionRow,
  type SavedNoteRow,
  type UserRow,
} from "./schema.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../../data");
const DB_PATH = path.join(DATA_DIR, "yara.db");

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    dbInstance = new DatabaseSync(DB_PATH);
    dbInstance.exec(SCHEMA_SQL);
  }
  return dbInstance;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const keyBuf = Buffer.from(keyHex, "hex");
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

const AVATAR_COLORS = ["#0F766E", "#0369A1", "#1D4ED8", "#047857", "#B45309", "#334155"];

export interface PublicUser {
  id: string;
  fullName: string;
  email: string;
  avatarColor: string;
  preferredMode: string;
  createdAt: number;
}

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    avatarColor: row.avatar_color,
    preferredMode: row.preferred_mode,
    createdAt: row.created_at,
  };
}

export function createUser(fullName: string, email: string, password: string): PublicUser {
  const db = getDb();
  const normalizedEmail = email.trim().toLowerCase();
  const existing = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(normalizedEmail) as { id: string } | undefined;

  if (existing) {
    throw new Error("EMAIL_EXISTS");
  }

  const now = Date.now();
  const id = `usr_${crypto.randomUUID()}`;
  const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  const passwordHash = hashPassword(password);

  db.prepare(
    `INSERT INTO users (id, full_name, email, password_hash, avatar_color, preferred_mode, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'live', ?, ?)`
  ).run(id, fullName.trim(), normalizedEmail, passwordHash, avatarColor, now, now);

  // Create initial empty chat session for new user
  const starterId = `chat_${now}_${crypto.randomBytes(3).toString("hex")}`;
  db.prepare(
    `INSERT INTO chat_sessions (id, user_id, title, mode, created_at, updated_at)
     VALUES (?, ?, 'گفتگوی جدید', 'live', ?, ?)`
  ).run(starterId, id, now, now);

  return {
    id,
    fullName: fullName.trim(),
    email: normalizedEmail,
    avatarColor,
    preferredMode: "live",
    createdAt: now,
  };
}

export function authenticateUser(email: string, password: string): PublicUser | null {
  const db = getDb();
  const normalizedEmail = email.trim().toLowerCase();
  const row = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(normalizedEmail) as UserRow | undefined;

  if (!row) return null;
  if (!verifyPassword(password, row.password_hash)) return null;
  return toPublicUser(row);
}

export function createAuthSession(userId: string): { token: string; expiresAt: number } {
  const db = getDb();
  const now = Date.now();
  const expiresAt = now + 30 * 24 * 60 * 60 * 1000;
  const token = crypto.randomBytes(32).toString("hex");

  db.prepare(
    `INSERT INTO auth_sessions (token, user_id, expires_at, created_at)
     VALUES (?, ?, ?, ?)`
  ).run(token, userId, expiresAt, now);

  return { token, expiresAt };
}

export function getUserBySessionToken(token: string): PublicUser | null {
  if (!token) return null;
  const db = getDb();
  const now = Date.now();
  const row = db
    .prepare(
      `SELECT u.* FROM auth_sessions s
       INNER JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`
    )
    .get(token, now) as UserRow | undefined;

  if (!row) return null;
  return toPublicUser(row);
}

export function deleteAuthSession(token: string): void {
  if (!token) return;
  const db = getDb();
  db.prepare("DELETE FROM auth_sessions WHERE token = ?").run(token);
}

export function updateUserProfile(
  userId: string,
  updates: { fullName?: string; preferredMode?: string }
): PublicUser | null {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as UserRow | undefined;
  if (!existing) return null;

  const fullName = updates.fullName?.trim() || existing.full_name;
  const preferredMode = updates.preferredMode || existing.preferred_mode;
  const now = Date.now();

  db.prepare("UPDATE users SET full_name = ?, preferred_mode = ?, updated_at = ? WHERE id = ?").run(
    fullName,
    preferredMode,
    now,
    userId
  );

  const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as unknown as UserRow;
  return toPublicUser(updated);
}

export interface StoredAttachmentMeta {
  id: string;
  name: string;
  mimeType: string;
  previewUrl?: string;
}

export interface StoredSource {
  title: string;
  uri: string;
}

export interface HydratedMessage {
  id: string;
  role: "user" | "model";
  text: string;
  createdAt: number;
  attachments?: StoredAttachmentMeta[];
  sources?: StoredSource[];
  queries?: string[];
  isError?: boolean;
}

export interface HydratedSession {
  id: string;
  title: string;
  mode: string;
  createdAt: number;
  updatedAt: number;
  messages: HydratedMessage[];
}

function safeJsonParse<T>(raw: string | null): T | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export function listUserChats(userId: string): HydratedSession[] {
  const db = getDb();
  const sessionRows = db
    .prepare("SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC")
    .all(userId) as unknown as ChatSessionRow[];

  if (sessionRows.length === 0) {
    const now = Date.now();
    const id = `chat_${now}_${crypto.randomBytes(3).toString("hex")}`;
    db.prepare(
      `INSERT INTO chat_sessions (id, user_id, title, mode, created_at, updated_at)
       VALUES (?, ?, 'گفتگوی جدید', 'live', ?, ?)`
    ).run(id, userId, now, now);
    return [
      {
        id,
        title: "گفتگوی جدید",
        mode: "live",
        createdAt: now,
        updatedAt: now,
        messages: [],
      },
    ];
  }

  const msgStmt = db.prepare(
    "SELECT * FROM chat_messages WHERE session_id = ? AND user_id = ? ORDER BY created_at ASC"
  );

  return sessionRows.map((s) => {
    const msgRows = msgStmt.all(s.id, userId) as unknown as ChatMessageRow[];
    return {
      id: s.id,
      title: s.title,
      mode: s.mode,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
      messages: msgRows.map((m) => ({
        id: m.id,
        role: m.role,
        text: m.text,
        createdAt: m.created_at,
        attachments: safeJsonParse<StoredAttachmentMeta[]>(m.attachments_json),
        sources: safeJsonParse<StoredSource[]>(m.sources_json),
        queries: safeJsonParse<string[]>(m.queries_json),
        isError: m.is_error === 1,
      })),
    };
  });
}

export function createChatSessionRecord(
  userId: string,
  title = "گفتگوی جدید",
  mode = "live",
  customId?: string
): HydratedSession {
  const db = getDb();
  const now = Date.now();
  const id = customId || `chat_${now}_${crypto.randomBytes(3).toString("hex")}`;
  db.prepare(
    `INSERT OR IGNORE INTO chat_sessions (id, user_id, title, mode, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, userId, title, mode, now, now);

  return {
    id,
    title,
    mode,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

export function updateChatSessionRecord(
  userId: string,
  sessionId: string,
  updates: { title?: string; mode?: string }
): boolean {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?")
    .get(sessionId, userId) as ChatSessionRow | undefined;
  if (!row) return false;

  const title = updates.title?.trim() || row.title;
  const mode = updates.mode || row.mode;
  const now = Date.now();

  db.prepare("UPDATE chat_sessions SET title = ?, mode = ?, updated_at = ? WHERE id = ? AND user_id = ?").run(
    title,
    mode,
    now,
    sessionId,
    userId
  );
  return true;
}

export function deleteChatSessionRecord(userId: string, sessionId: string): boolean {
  const db = getDb();
  const res = db
    .prepare("DELETE FROM chat_sessions WHERE id = ? AND user_id = ?")
    .run(sessionId, userId);
  return Number(res.changes) > 0;
}

export function saveChatMessageRecord(
  userId: string,
  sessionId: string,
  msg: {
    id: string;
    role: "user" | "model";
    text: string;
    createdAt: number;
    attachments?: StoredAttachmentMeta[];
    sources?: StoredSource[];
    queries?: string[];
    isError?: boolean;
  },
  sessionTitleIfFirst?: string,
  sessionMode?: string
): void {
  const db = getDb();

  // Ensure session exists for user
  const existingSession = db
    .prepare("SELECT id, title FROM chat_sessions WHERE id = ? AND user_id = ?")
    .get(sessionId, userId) as { id: string; title: string } | undefined;

  if (!existingSession) {
    createChatSessionRecord(userId, sessionTitleIfFirst || "گفتگوی جدید", sessionMode || "live", sessionId);
  } else if (sessionTitleIfFirst && existingSession.title === "گفتگوی جدید") {
    db.prepare("UPDATE chat_sessions SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?").run(
      sessionTitleIfFirst,
      Date.now(),
      sessionId,
      userId
    );
  } else {
    db.prepare("UPDATE chat_sessions SET updated_at = ? WHERE id = ? AND user_id = ?").run(
      Date.now(),
      sessionId,
      userId
    );
  }

  db.prepare(
    `INSERT OR REPLACE INTO chat_messages
      (id, session_id, user_id, role, text, attachments_json, sources_json, queries_json, is_error, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    msg.id,
    sessionId,
    userId,
    msg.role,
    msg.text,
    msg.attachments && msg.attachments.length > 0 ? JSON.stringify(msg.attachments) : null,
    msg.sources && msg.sources.length > 0 ? JSON.stringify(msg.sources) : null,
    msg.queries && msg.queries.length > 0 ? JSON.stringify(msg.queries) : null,
    msg.isError ? 1 : 0,
    msg.createdAt
  );
}

export function deleteChatMessageRecord(userId: string, messageId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM chat_messages WHERE id = ? AND user_id = ?").run(messageId, userId);
}

export interface HydratedNote {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  sources?: StoredSource[];
}

export function listUserNotes(userId: string): HydratedNote[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM saved_notes WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId) as unknown as SavedNoteRow[];

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    content: r.content,
    createdAt: r.created_at,
    sources: safeJsonParse<StoredSource[]>(r.sources_json),
  }));
}

export function createNoteRecord(
  userId: string,
  note: { id?: string; title: string; content: string; sources?: StoredSource[]; createdAt?: number }
): HydratedNote {
  const db = getDb();
  const now = note.createdAt || Date.now();
  const id = note.id || `note_${now}_${crypto.randomBytes(3).toString("hex")}`;

  db.prepare(
    `INSERT INTO saved_notes (id, user_id, title, content, sources_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    userId,
    note.title.slice(0, 120),
    note.content,
    note.sources && note.sources.length > 0 ? JSON.stringify(note.sources) : null,
    now
  );

  return {
    id,
    title: note.title.slice(0, 120),
    content: note.content,
    createdAt: now,
    sources: note.sources,
  };
}

export function deleteNoteRecord(userId: string, noteId: string): boolean {
  const db = getDb();
  const res = db
    .prepare("DELETE FROM saved_notes WHERE id = ? AND user_id = ?")
    .run(noteId, userId);
  return Number(res.changes) > 0;
}
