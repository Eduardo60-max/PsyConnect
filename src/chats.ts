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
    auto INTEGER NOT NULL DEFAULT 1,
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

type Seed = { sender: "patient" | "pro"; text: string; time: string };

export type ChatMessageView = { id: number; sender: string; text: string; time: string };
export type ChatView = { id: number; name: string; context: string; accent: string; messages: ChatMessageView[] };
export type ProChatView = ChatView & { patientEmail: string; auto: boolean };

export type ChatRow = { id: number; patientEmail: string; patientName: string; proId: string; auto: number };
type MessageRow = { id: number; chatId: number; sender: string; text: string; time: string; createdAt: number };

// Profissionais com quem todo paciente já começa uma conversa
const PATIENT_CHAT_PROS = ["prof-1", "prof-2", "prof-5"];

const WELCOME: Record<string, Seed[]> = {
  "prof-1": [
    { sender: "pro", text: "Oi! Vi que você entrou no grupo de ansiedade, como está se sentindo essa semana?", time: "09:12" },
    { sender: "patient", text: "Oi, Dra. Camila! Andei praticando a respiração que você indicou.", time: "09:20" },
    { sender: "pro", text: "Que ótimo saber disso. Continue assim, um passo de cada vez.", time: "09:22" },
  ],
  "prof-2": [
    { sender: "pro", text: "Olá! Fico à disposição se quiser conversar sobre o grupo de relacionamentos.", time: "Ontem" },
  ],
  "prof-5": [
    { sender: "pro", text: "Bem-vinda ao desafio de reeducação alimentar! Qualquer dúvida, me chame por aqui.", time: "2 d" },
  ],
};

// Pacientes de exemplo para o painel do profissional não ficar vazio
const DEMO_PATIENTS: { email: string; name: string; proId: string; messages: Seed[] }[] = [
  {
    email: "ana.souza@exemplo.com",
    name: "Ana Souza",
    proId: "prof-1",
    messages: [
      { sender: "patient", text: "Boa tarde, doutora! Comecei a respiração 4-7-8 e já estou dormindo melhor.", time: "08:40" },
      { sender: "pro", text: "Que notícia boa, Ana! Continue praticando todas as noites.", time: "08:52" },
      { sender: "patient", text: "Obrigada! Hoje tive uma reunião tensa, posso conversar sobre isso na nossa sessão?", time: "14:05" },
    ],
  },
  {
    email: "carlos.lima@exemplo.com",
    name: "Carlos Lima",
    proId: "prof-2",
    messages: [{ sender: "patient", text: "Dr. João, tivemos outra discussão em casa e não soube como reagir.", time: "Ontem" }],
  },
  {
    email: "marina.alves@exemplo.com",
    name: "Marina Alves",
    proId: "prof-5",
    messages: [{ sender: "patient", text: "Dra. Beatriz, consegui seguir o cardápio por 3 dias seguidos!", time: "10:20" }],
  },
];

const ACCENTS = ["#7c3aed", "#0f766e", "#be123c", "#2563eb", "#16a34a", "#f59e0b"];

function colorFor(text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + (text.codePointAt(i) ?? 0)) >>> 0;
  }
  return ACCENTS[hash % ACCENTS.length] ?? "#4f46e5";
}

function insertMessage(chatId: number, sender: "patient" | "pro", text: string, time: string, createdAt = Date.now()) {
  db.prepare(
    `INSERT INTO chat_messages (chatId, sender, text, time, createdAt)
     VALUES ($chatId, $sender, $text, $time, $createdAt)`,
  ).run({ $chatId: chatId, $sender: sender, $text: text, $time: time, $createdAt: createdAt });
}

function seedChat(email: string, name: string, proId: string, auto: boolean, messages: Seed[]) {
  const result = db
    .prepare(
      `INSERT OR IGNORE INTO chats (patientEmail, patientName, proId, auto, createdAt)
       VALUES ($email, $name, $proId, $auto, $createdAt)`,
    )
    .run({ $email: email, $name: name, $proId: proId, $auto: auto ? 1 : 0, $createdAt: Date.now() });

  if (result.changes === 0) return;

  const chatId = Number(result.lastInsertRowid);
  let offset = 0;
  for (const message of messages) {
    insertMessage(chatId, message.sender, message.text, message.time, Date.now() + offset++);
  }
}

function seedDemoPatients() {
  for (const patient of DEMO_PATIENTS) {
    seedChat(patient.email, patient.name, patient.proId, false, patient.messages);
  }
}

const existing = db.query("SELECT COUNT(*) AS count FROM chats").get() as { count: number };
if (existing.count === 0) seedDemoPatients();

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

export function ensurePatientChats(email: string, name: string) {
  for (const proId of PATIENT_CHAT_PROS) {
    seedChat(email, name || "Paciente", proId, true, WELCOME[proId] ?? []);
  }
  if (name) {
    db.prepare("UPDATE chats SET patientName = $name WHERE patientEmail = $email").run({ $name: name, $email: email });
  }
}

export function listPatientChats(email: string): ChatView[] {
  const chats = db
    .query("SELECT id, patientEmail, patientName, proId, auto FROM chats WHERE patientEmail = $email ORDER BY id ASC")
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
    .query("SELECT id, patientEmail, patientName, proId, auto FROM chats WHERE proId = $proId")
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
          auto: Boolean(chat.auto),
          messages: toView(rows, "pro"),
        },
      };
    })
    .sort((a, b) => b.lastAt - a.lastAt)
    .map(item => item.view);
}

function getChat(chatId: number): ChatRow | null {
  return db
    .query("SELECT id, patientEmail, patientName, proId, auto FROM chats WHERE id = $id")
    .get({ $id: chatId }) as ChatRow | null;
}

export function addPatientMessage(email: string, chatId: number, text: string, time: string): ChatRow | null {
  const chat = getChat(chatId);
  if (!chat || chat.patientEmail !== email) return null;
  insertMessage(chatId, "patient", text, time);
  return chat;
}

// Responder manualmente NÃO desliga a resposta automática (só o botão do painel desliga)
export function addProMessage(proId: string, chatId: number, text: string, time: string): ChatRow | null {
  const chat = getChat(chatId);
  if (!chat || chat.proId !== proId) return null;
  insertMessage(chatId, "pro", text, time);
  return chat;
}

// Pacientes de exemplo respondem sozinhos; contas reais não
export function isDemoPatient(chat: ChatRow): boolean {
  return chat.patientEmail.endsWith("@exemplo.com");
}

export function lastSender(chatId: number): string | null {
  const row = db
    .query("SELECT sender FROM chat_messages WHERE chatId = $chatId ORDER BY createdAt DESC, id DESC LIMIT 1")
    .get({ $chatId: chatId }) as { sender: string } | null;
  return row?.sender ?? null;
}

export function recentPatientMessages(chatId: number, limit: number): string[] {
  const rows = db
    .query("SELECT text FROM chat_messages WHERE chatId = $chatId AND sender = 'patient' ORDER BY createdAt DESC, id DESC LIMIT $limit")
    .all({ $chatId: chatId, $limit: limit }) as { text: string }[];
  return rows.map(row => row.text);
}

export function addPatientAutoMessage(chatId: number, text: string, time: string) {
  insertMessage(chatId, "patient", text, time);
}

export function setChatAuto(proId: string, chatId: number, enabled: boolean): boolean {
  const chat = getChat(chatId);
  if (!chat || chat.proId !== proId) return false;
  db.prepare("UPDATE chats SET auto = $auto WHERE id = $id").run({ $auto: enabled ? 1 : 0, $id: chatId });
  return true;
}

export function isAutoChat(chatId: number): boolean {
  return Boolean(getChat(chatId)?.auto);
}

export function recentProReplies(chatId: number, limit: number): string[] {
  const rows = db
    .query("SELECT text FROM chat_messages WHERE chatId = $chatId AND sender = 'pro' ORDER BY createdAt DESC, id DESC LIMIT $limit")
    .all({ $chatId: chatId, $limit: limit }) as { text: string }[];
  return rows.map(row => row.text);
}

export function addAutoReply(chatId: number, text: string, time: string) {
  insertMessage(chatId, "pro", text, time);
}

// Usado pelo "Modo demonstração"
export function resetChats() {
  db.run("DELETE FROM chat_messages");
  db.run("DELETE FROM chats");
  try {
    db.run("DELETE FROM sqlite_sequence WHERE name IN ('chats', 'chat_messages')");
  } catch {
    // sem contador para reiniciar
  }
  seedDemoPatients();
}