import { Database } from "bun:sqlite";
import { professionals } from "./data";

const db = new Database("psyconect.sqlite", { create: true });
db.exec("PRAGMA journal_mode = WAL;");

db.run(`
  CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patientEmail TEXT NOT NULL,
    patientName TEXT NOT NULL,
    proId TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    UNIQUE (patientEmail, proId)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chatId INTEGER NOT NULL,
    sender TEXT NOT NULL,
    text TEXT NOT NULL,
    time TEXT NOT NULL,
    createdAt INTEGER NOT NULL
  )
`);

export type ChatMessageView = { id: number; sender: string; text: string; time: string };
export type ChatView = { id: number; name: string; context: string; accent: string; messages: ChatMessageView[] };
export type ProChatView = ChatView & { patientEmail: string };

export type ChatRow = { id: number; patientEmail: string; patientName: string; proId: string };
type MessageRow = { id: number; chatId: number; sender: string; text: string; time: string; createdAt: number };

const ACCENTS = ["#7c3aed", "#0f766e", "#be123c", "#2563eb", "#16a34a", "#f59e0b"];

function colorFor(text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + (text.codePointAt(i) ?? 0)) >>> 0;
  }
  return ACCENTS[hash % ACCENTS.length] ?? "#4f46e5";
}

function insertMessage(chatId: number, sender: "patient" | "pro", text: string, time: string) {
  db.prepare(
    `INSERT INTO chat_messages (chatId, sender, text, time, createdAt)
     VALUES ($chatId, $sender, $text, $time, $createdAt)`,
  ).run({ $chatId: chatId, $sender: sender, $text: text, $time: time, $createdAt: Date.now() });
}

function loadMessages(chatIds: number[]) {
  const byChat = new Map<number, MessageRow[]>();
  if (chatIds.length === 0) return byChat;

  const marks = chatIds.map(() => "?").join(",");
  const rows = db
    .query(
      `SELECT id, chatId, sender, text, time, createdAt FROM chat_messages
       WHERE chatId IN (${marks}) ORDER BY createdAt ASC, id ASC`,
    )
    .all(...chatIds) as MessageRow[];

  for (const row of rows) {
    const list = byChat.get(row.chatId) ?? [];
    list.push(row);
    byChat.set(row.chatId, list);
  }
  return byChat;
}

// "me" = quem está olhando; "them" = a outra pessoa
function toView(rows: MessageRow[] | undefined, viewer: "patient" | "pro"): ChatMessageView[] {
  return (rows ?? []).map(row => ({
    id: row.id,
    sender: row.sender === viewer ? "me" : "them",
    text: row.text,
    time: row.time,
  }));
}

// Cria a conversa paciente <-> profissional se ainda não existir (chamada ao agendar)
export function ensureChat(email: string, name: string, proId: string) {
  db.prepare(
    `INSERT OR IGNORE INTO chats (patientEmail, patientName, proId, createdAt)
     VALUES ($email, $name, $proId, $createdAt)`,
  ).run({ $email: email, $name: name || "Paciente", $proId: proId, $createdAt: Date.now() });

  if (name) {
    db.prepare("UPDATE chats SET patientName = $name WHERE patientEmail = $email").run({ $name: name, $email: email });
  }
}

export function listPatientChats(email: string): ChatView[] {
  const chats = db
    .query("SELECT id, patientEmail, patientName, proId FROM chats WHERE patientEmail = $email ORDER BY id ASC")
    .all({ $email: email }) as ChatRow[];
  const messages = loadMessages(chats.map(chat => chat.id));

  return chats.flatMap(chat => {
    const pro = professionals.find(item => item.id === chat.proId);
    if (!pro) return [];
    return [
      {
        id: chat.id,
        name: pro.name,
        context: `${pro.role} · ${pro.specialty}`,
        accent: pro.accent,
        messages: toView(messages.get(chat.id), "patient"),
      },
    ];
  });
}

export function listProChats(proId: string): ProChatView[] {
  const chats = db
    .query("SELECT id, patientEmail, patientName, proId FROM chats WHERE proId = $proId")
    .all({ $proId: proId }) as ChatRow[];
  const messages = loadMessages(chats.map(chat => chat.id));

  return chats
    .map(chat => {
      const rows = messages.get(chat.id) ?? [];
      return {
        lastAt: rows.at(-1)?.createdAt ?? 0,
        view: {
          id: chat.id,
          name: chat.patientName,
          context: `Paciente · ${chat.patientEmail}`,
          accent: colorFor(chat.patientEmail),
          patientEmail: chat.patientEmail,
          messages: toView(rows, "pro"),
        },
      };
    })
    .sort((a, b) => b.lastAt - a.lastAt)
    .map(item => item.view);
}

function getChat(chatId: number): ChatRow | null {
  return db
    .query("SELECT id, patientEmail, patientName, proId FROM chats WHERE id = $id")
    .get({ $id: chatId }) as ChatRow | null;
}

export function addPatientMessage(email: string, chatId: number, text: string, time: string): ChatRow | null {
  const chat = getChat(chatId);
  if (!chat || chat.patientEmail !== email) return null;
  insertMessage(chatId, "patient", text, time);
  return chat;
}

export function addProMessage(proId: string, chatId: number, text: string, time: string): ChatRow | null {
  const chat = getChat(chatId);
  if (!chat || chat.proId !== proId) return null;
  insertMessage(chatId, "pro", text, time);
  return chat;
}