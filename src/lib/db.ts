import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;

export function getDB(): SQLite.SQLiteDatabase {
  if (_db) return _db;
  _db = SQLite.openDatabaseSync('streeps_chat.db');

  // Enable WAL for better concurrent read/write performance
  _db.execSync('PRAGMA journal_mode = WAL;');

  // Create tables
  _db.execSync(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      message_type TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL,
      synced INTEGER NOT NULL DEFAULT 1
    );
  `);
  _db.execSync(`
    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at DESC);
  `);

  _db.execSync(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      group_id TEXT,
      name TEXT NOT NULL DEFAULT '',
      avatar_url TEXT,
      other_user_id TEXT,
      last_message_text TEXT,
      last_message_at TEXT,
      last_message_sender TEXT,
      unread_count INTEGER NOT NULL DEFAULT 0
    );
  `);
  _db.execSync(`
    CREATE INDEX IF NOT EXISTS idx_conv_last ON conversations(last_message_at DESC);
  `);

  _db.execSync(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL DEFAULT '',
      avatar_url TEXT
    );
  `);

  _db.execSync(`
    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  return _db;
}

// ── Messages ──

export function getMessages(
  conversationId: string,
  limit: number = 30,
  beforeCursor?: string,
): any[] {
  const db = getDB();
  let rows: any[];

  if (beforeCursor) {
    rows = db.getAllSync(
      `SELECT m.*, p.full_name AS profile_full_name, p.avatar_url AS profile_avatar_url
       FROM messages m
       LEFT JOIN profiles p ON p.id = m.user_id
       WHERE m.conversation_id = ? AND m.created_at < ?
       ORDER BY m.created_at DESC
       LIMIT ?`,
      [conversationId, beforeCursor, limit],
    );
  } else {
    rows = db.getAllSync(
      `SELECT m.*, p.full_name AS profile_full_name, p.avatar_url AS profile_avatar_url
       FROM messages m
       LEFT JOIN profiles p ON p.id = m.user_id
       WHERE m.conversation_id = ?
       ORDER BY m.created_at DESC
       LIMIT ?`,
      [conversationId, limit],
    );
  }

  return rows.map(enrichRow);
}

export function getMessageCount(conversationId: string): number {
  const db = getDB();
  const row = db.getFirstSync<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM messages WHERE conversation_id = ?',
    [conversationId],
  );
  return row?.cnt ?? 0;
}

export function insertMessages(messages: any[]): void {
  if (messages.length === 0) return;
  const db = getDB();

  const stmt = db.prepareSync(
    `INSERT OR REPLACE INTO messages (id, conversation_id, user_id, content, message_type, metadata, created_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  try {
    db.execSync('BEGIN TRANSACTION');
    for (const m of messages) {
      stmt.executeSync([
        m.id,
        m.conversation_id,
        m.user_id,
        m.content ?? '',
        m.message_type ?? null,
        m.metadata ? (typeof m.metadata === 'string' ? m.metadata : JSON.stringify(m.metadata)) : null,
        m.created_at,
        m.synced !== undefined ? m.synced : 1,
      ]);
    }
    db.execSync('COMMIT');
  } catch (e) {
    db.execSync('ROLLBACK');
    console.error('[db] insertMessages failed:', e);
  } finally {
    stmt.finalizeSync();
  }
}

export function insertOptimisticMessage(msg: any): void {
  const db = getDB();
  db.runSync(
    `INSERT OR REPLACE INTO messages (id, conversation_id, user_id, content, message_type, metadata, created_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      msg.id,
      msg.conversation_id,
      msg.user_id,
      msg.content ?? '',
      msg.message_type ?? null,
      msg.metadata ? (typeof msg.metadata === 'string' ? msg.metadata : JSON.stringify(msg.metadata)) : null,
      msg.created_at,
    ],
  );
}

export function confirmMessage(tempId: string, serverMsg: any): void {
  const db = getDB();
  try {
    db.execSync('BEGIN TRANSACTION');
    // Remove the temporary optimistic message
    db.runSync('DELETE FROM messages WHERE id = ?', [tempId]);
    // Insert the real server message
    db.runSync(
      `INSERT OR REPLACE INTO messages (id, conversation_id, user_id, content, message_type, metadata, created_at, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        serverMsg.id,
        serverMsg.conversation_id,
        serverMsg.user_id,
        serverMsg.content ?? '',
        serverMsg.message_type ?? null,
        serverMsg.metadata ? (typeof serverMsg.metadata === 'string' ? serverMsg.metadata : JSON.stringify(serverMsg.metadata)) : null,
        serverMsg.created_at,
      ],
    );
    db.execSync('COMMIT');
  } catch (e) {
    db.execSync('ROLLBACK');
    console.error('[db] confirmMessage failed:', e);
  }
}

// ── Conversations ──

export function getConversations(): any[] {
  const db = getDB();
  return db.getAllSync(
    `SELECT * FROM conversations ORDER BY last_message_at DESC`,
  );
}

export function upsertConversation(conv: any): void {
  const db = getDB();
  db.runSync(
    `INSERT OR REPLACE INTO conversations (id, type, group_id, name, avatar_url, other_user_id, last_message_text, last_message_at, last_message_sender, unread_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      conv.id,
      conv.type,
      conv.group_id ?? null,
      conv.name ?? '',
      conv.avatar_url ?? null,
      conv.other_user_id ?? null,
      conv.last_message_text ?? conv.last_message ?? null,
      conv.last_message_at ?? null,
      conv.last_message_sender ?? conv.last_message_by ?? null,
      conv.unread_count ?? conv.unread ?? 0,
    ],
  );
}

export function upsertConversations(convs: any[]): void {
  if (convs.length === 0) return;
  const db = getDB();

  const stmt = db.prepareSync(
    `INSERT OR REPLACE INTO conversations (id, type, group_id, name, avatar_url, other_user_id, last_message_text, last_message_at, last_message_sender, unread_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  try {
    db.execSync('BEGIN TRANSACTION');
    for (const conv of convs) {
      stmt.executeSync([
        conv.id,
        conv.type,
        conv.group_id ?? null,
        conv.name ?? '',
        conv.avatar_url ?? null,
        conv.other_user_id ?? null,
        conv.last_message_text ?? conv.last_message ?? null,
        conv.last_message_at ?? null,
        conv.last_message_sender ?? conv.last_message_by ?? null,
        conv.unread_count ?? conv.unread ?? 0,
      ]);
    }
    db.execSync('COMMIT');
  } catch (e) {
    db.execSync('ROLLBACK');
    console.error('[db] upsertConversations failed:', e);
  } finally {
    stmt.finalizeSync();
  }
}

export function updateConversationPreview(
  convId: string,
  text: string,
  at: string,
  sender: string | null,
): void {
  const db = getDB();
  db.runSync(
    `UPDATE conversations SET last_message_text = ?, last_message_at = ?, last_message_sender = ? WHERE id = ?`,
    [text, at, sender, convId],
  );
}

// ── Profiles ──

export function getProfile(userId: string): { id: string; full_name: string; avatar_url: string | null } | null {
  const db = getDB();
  const row = db.getFirstSync<{ id: string; full_name: string; avatar_url: string | null }>(
    'SELECT * FROM profiles WHERE id = ?',
    [userId],
  );
  return row ?? null;
}

export function upsertProfiles(profiles: { id: string; full_name: string; avatar_url?: string | null }[]): void {
  if (profiles.length === 0) return;
  const db = getDB();

  const stmt = db.prepareSync(
    `INSERT OR REPLACE INTO profiles (id, full_name, avatar_url) VALUES (?, ?, ?)`,
  );

  try {
    db.execSync('BEGIN TRANSACTION');
    for (const p of profiles) {
      stmt.executeSync([p.id, p.full_name ?? '', p.avatar_url ?? null]);
    }
    db.execSync('COMMIT');
  } catch (e) {
    db.execSync('ROLLBACK');
    console.error('[db] upsertProfiles failed:', e);
  } finally {
    stmt.finalizeSync();
  }
}

// ── Sync Meta ──

export function getSyncMeta(key: string): string | null {
  const db = getDB();
  const row = db.getFirstSync<{ value: string }>(
    'SELECT value FROM sync_meta WHERE key = ?',
    [key],
  );
  return row?.value ?? null;
}

export function setSyncMeta(key: string, value: string): void {
  const db = getDB();
  db.runSync(
    'INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)',
    [key, value],
  );
}

// ── Cleanup ──

export function clearAll(): void {
  const db = getDB();
  db.execSync('DELETE FROM messages');
  db.execSync('DELETE FROM conversations');
  db.execSync('DELETE FROM profiles');
  db.execSync('DELETE FROM sync_meta');
}

// ── Helper: enrich row with profile object ──
function enrichRow(row: any): any {
  const { profile_full_name, profile_avatar_url, metadata, ...rest } = row;
  return {
    ...rest,
    metadata: metadata ? (typeof metadata === 'string' ? tryParseJSON(metadata) : metadata) : null,
    profile: profile_full_name !== undefined
      ? { id: rest.user_id, full_name: profile_full_name ?? '', avatar_url: profile_avatar_url ?? null }
      : null,
  };
}

function tryParseJSON(str: string): any {
  try { return JSON.parse(str); } catch { return str; }
}
