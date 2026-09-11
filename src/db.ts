import { Database } from "bun:sqlite";

const db = new Database("psyconect.sqlite", { create: true });
db.exec("PRAGMA journal_mode = WAL;");

db.run(`
  CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    theme TEXT NOT NULL,
    adminId TEXT NOT NULL,
    members INTEGER NOT NULL,
    joined INTEGER NOT NULL,
    isTemporary INTEGER NOT NULL,
    durationDays INTEGER,
    accent TEXT NOT NULL
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    groupId TEXT NOT NULL,
    author TEXT NOT NULL,
    handle TEXT NOT NULL,
    body TEXT NOT NULL,
    time TEXT NOT NULL,
    likes INTEGER NOT NULL,
    comments INTEGER NOT NULL,
    createdAt INTEGER NOT NULL
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS challenge_days (
    groupId TEXT NOT NULL,
    day INTEGER NOT NULL,
    PRIMARY KEY (groupId, day)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    context TEXT NOT NULL,
    accent TEXT NOT NULL
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversationId INTEGER NOT NULL,
    sender TEXT NOT NULL,
    text TEXT NOT NULL,
    time TEXT NOT NULL,
    createdAt INTEGER NOT NULL
  )
`);

// ---- Seed (only runs once, when the tables are empty) ----
const groupCount = db.query("SELECT COUNT(*) as count FROM groups").get() as { count: number };

if (groupCount.count === 0) {
  const insertGroup = db.prepare(
    `INSERT INTO groups (id, name, description, theme, adminId, members, joined, isTemporary, durationDays, accent)
     VALUES ($id, $name, $description, $theme, $adminId, $members, $joined, $isTemporary, $durationDays, $accent)`,
  );

  const seedGroups = [
    { id: "grp-1", name: "Respirar Antes de Reagir", description: "Um espaço para trocar técnicas de respiração e regulação da ansiedade no dia a dia.", theme: "ansiedade", adminId: "prof-1", members: 2412, joined: 1, isTemporary: 0, durationDays: null, accent: "#8b5cf6" },
    { id: "grp-2", name: "Autoconhecimento em Prática", description: "Reflexões guiadas e exercícios semanais para entender seus próprios padrões.", theme: "autoconhecimento", adminId: "prof-3", members: 1834, joined: 0, isTemporary: 0, durationDays: null, accent: "#0f766e" },
    { id: "grp-3", name: "Limites com Leveza", description: "Comunicação não violenta e limites saudáveis nos relacionamentos.", theme: "relacionamentos", adminId: "prof-2", members: 1204, joined: 0, isTemporary: 0, durationDays: null, accent: "#db2777" },
    { id: "grp-4", name: "Noites Mais Leves", description: "Rotinas de sono e higiene do descanso para quem sofre com insônia.", theme: "sono", adminId: "prof-1", members: 876, joined: 0, isTemporary: 0, durationDays: null, accent: "#f59e0b" },
    { id: "grp-5", name: "Desafio 5 Dias Sem Ansiedade", description: "Um programa curto e guiado com práticas diárias para reduzir picos de ansiedade.", theme: "ansiedade", adminId: "prof-1", members: 592, joined: 1, isTemporary: 1, durationDays: 5, accent: "#7c3aed" },
    { id: "grp-6", name: "Desafio 21 Dias de Movimento", description: "Programa de exercícios progressivos para criar o hábito de se movimentar.", theme: "exercicio", adminId: "prof-4", members: 341, joined: 0, isTemporary: 1, durationDays: 21, accent: "#2563eb" },
    { id: "grp-7", name: "Reeducação Alimentar em 10 Dias", description: "Pequenas mudanças diárias para uma relação mais saudável com a comida.", theme: "emagrecimento", adminId: "prof-5", members: 268, joined: 0, isTemporary: 1, durationDays: 10, accent: "#16a34a" },
  ];

  for (const group of seedGroups)
    insertGroup.run({
      $id: group.id,
      $name: group.name,
      $description: group.description,
      $theme: group.theme,
      $adminId: group.adminId,
      $members: group.members,
      $joined: group.joined,
      $isTemporary: group.isTemporary,
      $durationDays: group.durationDays,
      $accent: group.accent,
    });

  const insertPost = db.prepare(
    `INSERT INTO posts (id, groupId, author, handle, body, time, likes, comments, createdAt)
     VALUES ($id, $groupId, $author, $handle, $body, $time, $likes, $comments, $createdAt)`,
  );

  const seedPosts = [
    { id: "post-1", groupId: "grp-1", author: "Maya", handle: "@maya", body: "Hoje eu aprendi que não preciso resolver tudo de uma vez. Um passo de cada vez já é progresso.", time: "10 min", likes: 312, comments: 19 },
    { id: "post-2", groupId: "grp-2", author: "Léo", handle: "@leo", body: "Identificar o que me esgota tem sido mais útil do que tentar aguentar tudo em silêncio.", time: "25 min", likes: 188, comments: 11 },
    { id: "post-3", groupId: "grp-3", author: "Clara", handle: "@clara", body: "Estabelecer limites não é frieza, é cuidado. Estou aprendendo a me respeitar mais.", time: "1 h", likes: 244, comments: 27 },
    { id: "post-4", groupId: "grp-4", author: "Ravi", handle: "@ravi", body: "Minha rotina de descanso ficou bem mais leve quando reduzi telas antes de dormir.", time: "2 h", likes: 95, comments: 6 },
  ];

  for (const post of seedPosts)
    insertPost.run({
      $id: post.id,
      $groupId: post.groupId,
      $author: post.author,
      $handle: post.handle,
      $body: post.body,
      $time: post.time,
      $likes: post.likes,
      $comments: post.comments,
      $createdAt: Date.now(),
    });

  const insertConversation = db.prepare(
    `INSERT INTO conversations (id, name, context, accent) VALUES ($id, $name, $context, $accent)`,
  );

  const seedConversations = [
    { id: 1, name: "Dra. Camila Nogueira", context: "Psicóloga clínica · Ansiedade e burnout", accent: "#7c3aed" },
    { id: 2, name: "Dr. João Pereira", context: "Psicoterapeuta · Relacionamentos", accent: "#0f766e" },
    { id: 3, name: "Dra. Beatriz Lima", context: "Nutricionista · Emagrecimento saudável", accent: "#16a34a" },
  ];

  for (const conversation of seedConversations)
    insertConversation.run({
      $id: conversation.id,
      $name: conversation.name,
      $context: conversation.context,
      $accent: conversation.accent,
    });

  const insertMessage = db.prepare(
    `INSERT INTO messages (conversationId, sender, text, time, createdAt) VALUES ($conversationId, $sender, $text, $time, $createdAt)`,
  );

  const seedMessages = [
    { conversationId: 1, sender: "them", text: "Oi! Vi que você entrou no grupo de ansiedade, como está se sentindo essa semana?", time: "09:12" },
    { conversationId: 1, sender: "me", text: "Oi, Dra. Camila! Andei praticando a respiração que você indicou.", time: "09:20" },
    { conversationId: 1, sender: "them", text: "Que ótimo saber disso. Continue assim, um passo de cada vez.", time: "09:22" },
    { conversationId: 2, sender: "them", text: "Olá! Fico à disposição se quiser conversar sobre o grupo de relacionamentos.", time: "Ontem" },
    { conversationId: 3, sender: "them", text: "Bem-vinda ao desafio de reeducação alimentar! Qualquer dúvida, me chame por aqui.", time: "2 d" },
  ];

  for (const message of seedMessages)
    insertMessage.run({
      $conversationId: message.conversationId,
      $sender: message.sender,
      $text: message.text,
      $time: message.time,
      $createdAt: Date.now(),
    });
}

// ---- Helpers ----
export type DbGroup = {
  id: string;
  name: string;
  description: string;
  theme: string;
  adminId: string;
  members: number;
  joined: number;
  isTemporary: number;
  durationDays: number | null;
  accent: string;
};

export type DbPost = {
  id: string;
  groupId: string;
  author: string;
  handle: string;
  body: string;
  time: string;
  likes: number;
  comments: number;
};

export type DbConversation = {
  id: number;
  name: string;
  context: string;
  accent: string;
};

export type DbMessage = {
  id: number;
  conversationId: number;
  sender: string;
  text: string;
  time: string;
};

export function listGroups(): DbGroup[] {
  return db.query("SELECT id, name, description, theme, adminId, members, joined, isTemporary, durationDays, accent FROM groups").all() as DbGroup[];
}

export function createGroup(group: Omit<DbGroup, "joined" | "members"> & { members?: number }) {
  db.prepare(
    `INSERT INTO groups (id, name, description, theme, adminId, members, joined, isTemporary, durationDays, accent)
     VALUES ($id, $name, $description, $theme, $adminId, $members, 1, $isTemporary, $durationDays, $accent)`,
  ).run({
    $id: group.id,
    $name: group.name,
    $description: group.description,
    $theme: group.theme,
    $adminId: group.adminId,
    $members: group.members ?? 1,
    $isTemporary: group.isTemporary,
    $durationDays: group.durationDays,
    $accent: group.accent,
  });
}

export function toggleGroupJoin(groupId: string) {
  const group = db.query("SELECT joined, members FROM groups WHERE id = $id").get({ $id: groupId }) as { joined: number; members: number } | null;
  if (!group) return null;
  const nextJoined = group.joined ? 0 : 1;
  const nextMembers = group.joined ? group.members - 1 : group.members + 1;
  db.prepare("UPDATE groups SET joined = $joined, members = $members WHERE id = $id").run({
    $joined: nextJoined,
    $members: nextMembers,
    $id: groupId,
  });
  return { joined: nextJoined, members: nextMembers };
}

export function listPosts(groupId: string): DbPost[] {
  return db
    .query("SELECT id, groupId, author, handle, body, time, likes, comments FROM posts WHERE groupId = $groupId ORDER BY createdAt DESC")
    .all({ $groupId: groupId }) as DbPost[];
}

export function addPost(post: DbPost) {
  db.prepare(
    `INSERT INTO posts (id, groupId, author, handle, body, time, likes, comments, createdAt)
     VALUES ($id, $groupId, $author, $handle, $body, $time, $likes, $comments, $createdAt)`,
  ).run({
    $id: post.id,
    $groupId: post.groupId,
    $author: post.author,
    $handle: post.handle,
    $body: post.body,
    $time: post.time,
    $likes: post.likes,
    $comments: post.comments,
    $createdAt: Date.now(),
  });
}

export function listChallengeDays(groupId: string): number[] {
  const rows = db.query("SELECT day FROM challenge_days WHERE groupId = $groupId ORDER BY day ASC").all({ $groupId: groupId }) as { day: number }[];
  return rows.map(row => row.day);
}

export function toggleChallengeDay(groupId: string, day: number) {
  const existing = db.query("SELECT 1 FROM challenge_days WHERE groupId = $groupId AND day = $day").get({ $groupId: groupId, $day: day });
  if (existing) {
    db.prepare("DELETE FROM challenge_days WHERE groupId = $groupId AND day = $day").run({ $groupId: groupId, $day: day });
  } else {
    db.prepare("INSERT INTO challenge_days (groupId, day) VALUES ($groupId, $day)").run({ $groupId: groupId, $day: day });
  }
  return listChallengeDays(groupId);
}

export function listConversations(): (DbConversation & { messages: DbMessage[] })[] {
  const conversations = db.query("SELECT id, name, context, accent FROM conversations").all() as DbConversation[];
  const messages = db.query("SELECT id, conversationId, sender, text, time FROM messages ORDER BY createdAt ASC").all() as DbMessage[];
  return conversations.map(conversation => ({
    ...conversation,
    messages: messages.filter(message => message.conversationId === conversation.id),
  }));
}

export function addMessage(conversationId: number, sender: string, text: string, time: string) {
  db.prepare("INSERT INTO messages (conversationId, sender, text, time, createdAt) VALUES ($conversationId, $sender, $text, $time, $createdAt)").run({
    $conversationId: conversationId,
    $sender: sender,
    $text: text,
    $time: time,
    $createdAt: Date.now(),
  });
}