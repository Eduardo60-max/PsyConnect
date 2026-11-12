/**
 * "Servidor" local para o modo demonstração no celular.
 *
 * Responde às mesmas rotas /api/... do src/index.ts, mas dentro do próprio app,
 * guardando tudo no localStorage do aparelho. Assim o app Android funciona sem PC,
 * sem Wi-Fi e sem API publicada.
 *
 * Só usa TypeScript puro (nada de bun:sqlite), então roda no WebView.
 */
import type { Booking, CommunityGroup, ConversationMessage, FeedPost, MoodDay, PostComment } from "./types";
import { initialGroups, initialPostsByGroup, professionals } from "./data";
import { pickReply, replyDelayMs } from "./chatbot";
import { pickPatientReply } from "./patientBot";

const STORAGE_KEY = "psyconect_local_db_v1";

const BOOKING_SLOTS = ["Hoje • 16:00", "Hoje • 18:30", "Amanhã • 09:30", "Quarta • 14:00"];
const PREFERENCES = ["Online", "Presencial"];

// Profissionais com quem todo paciente já começa uma conversa
const PATIENT_CHAT_PROS = ["prof-1", "prof-2", "prof-5"];
const PERSONA_BY_PRO: Record<string, number> = { "prof-1": 1, "prof-2": 2, "prof-5": 3 };

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------
type Sender = "patient" | "pro";
type Seed = { sender: Sender; text: string; time: string };

type PostRow = FeedPost & { createdAt: number };
type CommentRow = PostComment & { createdAt: number };
type BookingRow = Booking & { email: string; patientName: string };
type ChatRow = { id: number; patientEmail: string; patientName: string; proId: string; auto: boolean; createdAt: number };
type MessageRow = { id: number; chatId: number; sender: Sender; text: string; time: string; createdAt: number };
type MoodRow = { email: string; day: string; mood: number; note: string };

type State = {
  groups: CommunityGroup[];
  posts: PostRow[];
  comments: CommentRow[];
  challengeDays: Record<string, number[]>;
  moods: MoodRow[];
  bookings: BookingRow[];
  chats: ChatRow[];
  messages: MessageRow[];
  nextChatId: number;
  nextMessageId: number;
};

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
function fail(message: string): never {
  throw new Error(message);
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function timeLabel() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bahia" });
}

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(email)) return null;
  return email;
}

function requireEmail(value: unknown): string {
  return normalizeEmail(value) ?? fail("E-mail inválido.");
}

const ACCENTS = ["#7c3aed", "#0f766e", "#be123c", "#2563eb", "#16a34a", "#f59e0b"];

function colorFor(text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + (text.codePointAt(i) ?? 0)) >>> 0;
  }
  return ACCENTS[hash % ACCENTS.length] ?? "#4f46e5";
}

// ---------------------------------------------------------------------------
// Dados de exemplo (mesmos do servidor)
// ---------------------------------------------------------------------------
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

const DEMO_BOOKINGS = [
  { id: "demo-booking-1", email: "ana.souza@exemplo.com", patientName: "Ana Souza", expertId: 1, expertName: "Dra. Camila Nogueira", expertRole: "Psicóloga clínica", specialty: "Ansiedade e burnout", price: "R$ 180", accent: "#7c3aed", slot: "Hoje • 18:30", preference: "Online", reason: "Ansiedade antes de reuniões e dificuldade para desligar a mente à noite." },
  { id: "demo-booking-2", email: "lucas.prado@exemplo.com", patientName: "Lucas Prado", expertId: 1, expertName: "Dra. Camila Nogueira", expertRole: "Psicóloga clínica", specialty: "Ansiedade e burnout", price: "R$ 180", accent: "#7c3aed", slot: "Amanhã • 09:30", preference: "Presencial", reason: "Esgotamento no trabalho e pouca energia ao longo do dia." },
  { id: "demo-booking-3", email: "carlos.lima@exemplo.com", patientName: "Carlos Lima", expertId: 2, expertName: "Dr. João Pereira", expertRole: "Psicoterapeuta", specialty: "Relacionamentos", price: "R$ 160", accent: "#0f766e", slot: "Hoje • 16:00", preference: "Presencial", reason: "Conflitos frequentes em casa e dificuldade de comunicação." },
  { id: "demo-booking-4", email: "bia.ramos@exemplo.com", patientName: "Bia Ramos", expertId: 3, expertName: "Dra. Lívia Andrade", expertRole: "Neuropsicóloga", specialty: "Autoconhecimento", price: "R$ 200", accent: "#be123c", slot: "Quarta • 14:00", preference: "Online", reason: "Quero entender meu padrão de foco e procrastinação." },
];

function pushMessage(s: State, chatId: number, sender: Sender, text: string, time: string, createdAt = Date.now()) {
  s.messages.push({ id: s.nextMessageId++, chatId, sender, text, time, createdAt });
}

// Cria a conversa só se ainda não existir (paciente + profissional). Devolve true se criou.
function seedChat(s: State, email: string, name: string, proId: string, auto: boolean, seeds: Seed[]): boolean {
  if (s.chats.some(chat => chat.patientEmail === email && chat.proId === proId)) return false;

  const chat: ChatRow = { id: s.nextChatId++, patientEmail: email, patientName: name, proId, auto, createdAt: Date.now() };
  s.chats.push(chat);

  let offset = 0;
  for (const seed of seeds) pushMessage(s, chat.id, seed.sender, seed.text, seed.time, Date.now() + offset++);
  return true;
}

function seedDemoPatients(s: State) {
  for (const patient of DEMO_PATIENTS) seedChat(s, patient.email, patient.name, patient.proId, false, patient.messages);
}

function seedDemoBookings(s: State) {
  let offset = 0;
  for (const booking of DEMO_BOOKINGS) {
    if (s.bookings.some(item => item.id === booking.id)) continue;
    s.bookings.push({ ...booking, status: "confirmed", createdAt: Date.now() + offset++ });
  }
}

function buildSeed(): State {
  const s: State = {
    groups: initialGroups.map(group => ({ ...group })),
    posts: [],
    comments: [],
    challengeDays: {},
    moods: [],
    bookings: [],
    chats: [],
    messages: [],
    nextChatId: 1,
    nextMessageId: 1,
  };

  let offset = 0;
  for (const posts of Object.values(initialPostsByGroup)) {
    // posts de exemplo ficam "no passado" para que os novos sempre apareçam antes
    for (const post of posts) s.posts.push({ ...post, liked: false, createdAt: Date.now() - 60_000 - offset++ });
  }

  seedDemoBookings(s);
  seedDemoPatients(s);
  return s;
}

// ---------------------------------------------------------------------------
// Armazenamento (localStorage, com cópia em memória caso ele falhe)
// ---------------------------------------------------------------------------
let memoryCopy: string | null = null;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? memoryCopy;
  } catch {
    return memoryCopy;
  }
}

function writeRaw(value: string) {
  memoryCopy = value;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // sem espaço ou armazenamento bloqueado: continua só em memória
  }
}

function isState(value: unknown): value is State {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    Array.isArray(item.groups) &&
    Array.isArray(item.posts) &&
    Array.isArray(item.comments) &&
    Array.isArray(item.moods) &&
    Array.isArray(item.bookings) &&
    Array.isArray(item.chats) &&
    Array.isArray(item.messages) &&
    typeof item.challengeDays === "object" &&
    item.challengeDays !== null &&
    typeof item.nextChatId === "number" &&
    typeof item.nextMessageId === "number"
  );
}

function load(): State {
  const raw = readRaw();
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isState(parsed)) return parsed;
    } catch {
      // dados corrompidos: recomeça do zero
    }
  }
  const seed = buildSeed();
  writeRaw(JSON.stringify(seed));
  return seed;
}

function save(s: State) {
  writeRaw(JSON.stringify(s));
}

// Lê, aplica a alteração e grava. Se a alteração lançar erro, nada é gravado.
function mutate<T>(change: (s: State) => T): T {
  const s = load();
  const result = change(s);
  save(s);
  return result;
}

// ---------------------------------------------------------------------------
// Grupos, posts, comentários e desafios
// ---------------------------------------------------------------------------
function toggleGroupJoin(groupId: string) {
  return mutate(s => {
    const group = s.groups.find(item => item.id === groupId) ?? fail("Grupo não encontrado.");
    group.joined = !group.joined;
    group.members = group.joined ? group.members + 1 : group.members - 1;
    return { joined: group.joined, members: group.members };
  });
}

function listPosts(s: State, groupId: string): FeedPost[] {
  return s.posts
    .filter(post => post.group === groupId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(({ createdAt: _createdAt, ...post }) => post);
}

function togglePostLike(postId: string) {
  return mutate(s => {
    const post = s.posts.find(item => item.id === postId) ?? fail("Post não encontrado.");
    post.liked = !post.liked;
    post.likes = post.liked ? post.likes + 1 : Math.max(0, post.likes - 1);
    return { liked: Boolean(post.liked), likes: post.likes };
  });
}

function listComments(s: State, postId: string): PostComment[] {
  return s.comments
    .filter(comment => comment.postId === postId)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(({ createdAt: _createdAt, ...comment }) => comment);
}

function toggleChallengeDay(groupId: string, day: number): number[] {
  return mutate(s => {
    const current = s.challengeDays[groupId] ?? [];
    const next = current.includes(day) ? current.filter(item => item !== day) : [...current, day];
    s.challengeDays[groupId] = next.sort((a, b) => a - b);
    return s.challengeDays[groupId] ?? [];
  });
}

// ---------------------------------------------------------------------------
// Diário de humor
// ---------------------------------------------------------------------------
function dayKey(date: Date): string {
  // en-CA gera AAAA-MM-DD
  return date.toLocaleDateString("en-CA", { timeZone: "America/Bahia" });
}

function saveMood(email: string, mood: number, note: string) {
  mutate(s => {
    const day = dayKey(new Date());
    const existing = s.moods.find(entry => entry.email === email && entry.day === day);
    if (existing) {
      existing.mood = mood;
      existing.note = note;
    } else {
      s.moods.push({ email, day, mood, note });
    }
  });
}

// Últimos 7 dias (do mais antigo para hoje). Dias sem registro vêm com mood null.
function listMoodWeek(s: State, email: string): MoodDay[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) days.push(dayKey(new Date(Date.now() - i * 24 * 60 * 60 * 1000)));

  return days.map(day => {
    const entry = s.moods.find(item => item.email === email && item.day === day);
    return { day, mood: entry?.mood ?? null, note: entry?.note ?? "" };
  });
}

// ---------------------------------------------------------------------------
// Agendamentos
// ---------------------------------------------------------------------------
function sortBookings(rows: BookingRow[]): BookingRow[] {
  return [...rows].sort((a, b) => {
    const aCanceled = a.status === "canceled" ? 1 : 0;
    const bCanceled = b.status === "canceled" ? 1 : 0;
    return (
      aCanceled - bCanceled ||
      BOOKING_SLOTS.indexOf(a.slot) - BOOKING_SLOTS.indexOf(b.slot) ||
      a.createdAt - b.createdAt
    );
  });
}

function toBooking(row: BookingRow): Booking {
  const { email: _email, patientName: _patientName, ...booking } = row;
  return booking;
}

function listBookings(s: State, email: string): Booking[] {
  return sortBookings(s.bookings.filter(item => item.email === email)).map(toBooking);
}

function listBookingsForExpert(s: State, expertId: number) {
  return sortBookings(s.bookings.filter(item => item.expertId === expertId)).map(row => ({
    ...toBooking(row),
    patientName: row.patientName,
    patientEmail: row.email,
  }));
}

function hasConflict(s: State, email: string, expertId: number, slot: string, excludeId = ""): boolean {
  return s.bookings.some(
    item =>
      item.email === email &&
      item.expertId === expertId &&
      item.slot === slot &&
      item.status !== "canceled" &&
      item.id !== excludeId,
  );
}

function cancelRow(row: BookingRow | undefined) {
  if (!row) fail("Sessão não encontrada.");
  if (row.status === "canceled") fail("Esta sessão já foi cancelada.");
  row.status = "canceled";
}

function rescheduleRow(s: State, row: BookingRow | undefined, slot: string, conflictMessage: string) {
  if (!BOOKING_SLOTS.includes(slot)) fail("Horário inválido.");
  if (!row) fail("Sessão não encontrada.");
  if (row.status === "canceled") fail("Não é possível remarcar uma sessão cancelada.");
  if (row.slot === slot) fail("Escolha um horário diferente do atual.");
  if (hasConflict(s, row.email, row.expertId, slot, row.id)) fail(conflictMessage);
  row.slot = slot;
  row.status = "rescheduled";
}

// ---------------------------------------------------------------------------
// Conversas e respostas automáticas
// ---------------------------------------------------------------------------
function rawMessages(s: State, chatId: number): MessageRow[] {
  return s.messages
    .filter(message => message.chatId === chatId)
    .sort((a, b) => a.id - b.id); // o id cresce na ordem em que as mensagens foram gravadas
}

// "me" = quem está olhando; "them" = a outra pessoa
function viewMessages(s: State, chatId: number, viewer: Sender): ConversationMessage[] {
  return rawMessages(s, chatId).map(message => ({
    id: message.id,
    sender: message.sender === viewer ? "me" : "them",
    text: message.text,
    time: message.time,
  }));
}

function recentBySender(s: State, chatId: number, sender: Sender, limit: number): string[] {
  return rawMessages(s, chatId)
    .filter(message => message.sender === sender)
    .slice(-limit)
    .reverse()
    .map(message => message.text);
}

// Devolve true se algo mudou
function ensurePatientChats(s: State, email: string, name: string): boolean {
  let changed = false;
  for (const proId of PATIENT_CHAT_PROS) {
    if (seedChat(s, email, name || "Paciente", proId, true, WELCOME[proId] ?? [])) changed = true;
  }
  if (name) {
    for (const chat of s.chats) {
      if (chat.patientEmail === email && chat.patientName !== name) {
        chat.patientName = name;
        changed = true;
      }
    }
  }
  return changed;
}

function listPatientChats(s: State, email: string) {
  return s.chats
    .filter(chat => chat.patientEmail === email)
    .sort((a, b) => a.id - b.id)
    .flatMap(chat => {
      const pro = professionals.find(item => item.id === chat.proId);
      if (!pro) return [];
      return [
        {
          id: chat.id,
          name: pro.name,
          context: `${pro.role} · ${pro.specialty}`,
          accent: pro.accent,
          messages: viewMessages(s, chat.id, "patient"),
        },
      ];
    });
}

function listProChats(s: State, proId: string) {
  return s.chats
    .filter(chat => chat.proId === proId)
    .map(chat => ({
      lastAt: rawMessages(s, chat.id).at(-1)?.createdAt ?? 0,
      view: {
        id: chat.id,
        name: chat.patientName,
        context: `Paciente · ${chat.patientEmail}`,
        accent: colorFor(chat.patientEmail),
        patientEmail: chat.patientEmail,
        auto: chat.auto,
        messages: viewMessages(s, chat.id, "pro"),
      },
    }))
    .sort((a, b) => b.lastAt - a.lastAt)
    .map(item => item.view);
}

const pendingReplies = new Set<ReturnType<typeof setTimeout>>();

// O profissional (simulado) responde ao paciente depois de um tempinho
function scheduleReply(chatId: number, proId: string, text: string, delay: number) {
  const timer = setTimeout(() => {
    pendingReplies.delete(timer);
    try {
      mutate(s => {
        const chat = s.chats.find(item => item.id === chatId);
        if (!chat?.auto) return;
        // se o profissional de verdade respondeu nesse meio tempo, o bot fica quieto
        if (rawMessages(s, chatId).at(-1)?.sender === "pro") return;
        const recent = recentBySender(s, chatId, "pro", 4);
        pushMessage(s, chatId, "pro", pickReply(PERSONA_BY_PRO[proId] ?? 0, text, recent), timeLabel());
      });
    } catch (error) {
      console.error("Falha ao gravar a resposta automática:", error);
    }
  }, delay);
  pendingReplies.add(timer);
}

// O paciente de exemplo responde ao profissional
function schedulePatientReply(chatId: number, text: string, delay: number) {
  const timer = setTimeout(() => {
    pendingReplies.delete(timer);
    try {
      mutate(s => {
        const recent = recentBySender(s, chatId, "patient", 4);
        pushMessage(s, chatId, "patient", pickPatientReply(text, recent), timeLabel());
      });
    } catch (error) {
      console.error("Falha ao gravar a resposta do paciente simulado:", error);
    }
  }, delay);
  pendingReplies.add(timer);
}

function isDemoPatient(chat: ChatRow): boolean {
  return chat.patientEmail.endsWith("@exemplo.com");
}

function resolvePro(value: unknown): { proId: string; expertId: number } {
  const proId = typeof value === "string" ? value : "";
  if (!professionals.some(professional => professional.id === proId)) fail("Profissional inválido.");
  return { proId, expertId: Number(proId.replace("prof-", "")) };
}

// Restaura os dados iniciais (botão "Modo demonstração")
function resetAll() {
  for (const timer of pendingReplies) clearTimeout(timer);
  pendingReplies.clear();
  writeRaw(JSON.stringify(buildSeed()));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Rotas (espelham o src/index.ts)
// ---------------------------------------------------------------------------
type Ctx = { p: string[]; q: URLSearchParams; b: Record<string, any> };
type Route = { method: string; pattern: string; handle: (ctx: Ctx) => unknown };

function validMessageText(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) fail("A mensagem não pode estar vazia.");
  if (text.length > 1000) fail("A mensagem pode ter no máximo 1000 caracteres.");
  return text;
}

const ROUTES: Route[] = [
  // ---- Modo demonstração ----
  { method: "POST", pattern: "/api/demo/reset", handle: () => resetAll() },

  // ---- Grupos ----
  { method: "GET", pattern: "/api/groups", handle: () => load().groups },
  {
    method: "POST",
    pattern: "/api/groups",
    handle: ({ b }) => {
      if (!b.id || !b.name || !b.description || !b.theme || !b.adminId || !b.accent) {
        fail("Dados do grupo incompletos.");
      }
      return mutate(s => {
        if (s.groups.some(group => group.id === String(b.id))) fail("Este grupo já existe.");
        s.groups.push({
          id: String(b.id),
          name: String(b.name),
          description: String(b.description),
          theme: String(b.theme),
          adminId: String(b.adminId),
          members: 1,
          joined: true,
          isTemporary: Boolean(b.isTemporary),
          durationDays: b.isTemporary ? Number(b.durationDays) || undefined : undefined,
          accent: String(b.accent),
        });
        return s.groups;
      });
    },
  },
  { method: "POST", pattern: "/api/groups/:id/join", handle: ({ p }) => toggleGroupJoin(p[0] ?? "") },

  // ---- Posts ----
  { method: "GET", pattern: "/api/groups/:id/posts", handle: ({ p }) => listPosts(load(), p[0] ?? "") },
  {
    method: "POST",
    pattern: "/api/groups/:id/posts",
    handle: ({ p, b }) => {
      const groupId = p[0] ?? "";
      const body = String(b.body ?? "").trim();
      if (!body) fail("O post não pode estar vazio.");
      return mutate(s => {
        s.posts.unshift({
          id: uid("post"),
          group: groupId,
          author: String(b.author ?? "").trim() || "Você",
          handle: String(b.handle ?? "").trim() || "@voce",
          body,
          time: timeLabel(),
          likes: 0,
          comments: 0,
          liked: false,
          createdAt: Date.now(),
        });
        return listPosts(s, groupId);
      });
    },
  },
  { method: "POST", pattern: "/api/posts/:id/like", handle: ({ p }) => togglePostLike(p[0] ?? "") },

  // ---- Comentários ----
  { method: "GET", pattern: "/api/posts/:id/comments", handle: ({ p }) => listComments(load(), p[0] ?? "") },
  {
    method: "POST",
    pattern: "/api/posts/:id/comments",
    handle: ({ p, b }) => {
      const postId = p[0] ?? "";
      const text = String(b.body ?? "").trim();
      if (!text) fail("O comentário não pode estar vazio.");
      if (text.length > 500) fail("O comentário pode ter no máximo 500 caracteres.");
      return mutate(s => {
        s.comments.push({
          id: uid("comment"),
          postId,
          author: String(b.author ?? "").trim() || "Você",
          handle: String(b.handle ?? "").trim() || "@voce",
          body: text,
          time: timeLabel(),
          createdAt: Date.now(),
        });
        const post = s.posts.find(item => item.id === postId);
        if (post) post.comments += 1;
        return listComments(s, postId);
      });
    },
  },

  // ---- Desafios ----
  {
    method: "POST",
    pattern: "/api/groups/:id/challenge-days/:day",
    handle: ({ p }) => {
      const day = Number(p[1]);
      if (!Number.isInteger(day)) fail("Dia inválido.");
      return toggleChallengeDay(p[0] ?? "", day);
    },
  },
  {
    method: "GET",
    pattern: "/api/groups/:id/challenge-days",
    handle: ({ p }) => load().challengeDays[p[0] ?? ""] ?? [],
  },

  // ---- Diário de humor ----
  { method: "GET", pattern: "/api/mood", handle: ({ q }) => listMoodWeek(load(), requireEmail(q.get("email"))) },
  {
    method: "POST",
    pattern: "/api/mood",
    handle: ({ b }) => {
      const email = requireEmail(b.email);
      const mood = Number(b.mood);
      if (!Number.isInteger(mood) || mood < 1 || mood > 5) fail("Escolha um humor de 1 a 5.");
      saveMood(email, mood, String(b.note ?? "").trim().slice(0, 280));
      return listMoodWeek(load(), email);
    },
  },

  // ---- Agendamentos (paciente) ----
  { method: "GET", pattern: "/api/bookings", handle: ({ q }) => listBookings(load(), requireEmail(q.get("email"))) },
  {
    method: "POST",
    pattern: "/api/bookings",
    handle: ({ b }) => {
      const email = requireEmail(b.email);
      const expertId = Number(b.expertId);
      const expertName = cleanText(b.expertName, 80);
      const reason = cleanText(b.reason, 500);
      const slot = cleanText(b.slot, 40);
      const preference = cleanText(b.preference, 20);
      if (!Number.isInteger(expertId) || !expertName) fail("Profissional inválido.");
      if (!reason) fail("Conte o motivo da sessão.");

      return mutate(s => {
        if (!BOOKING_SLOTS.includes(slot)) fail("Horário inválido.");
        if (!PREFERENCES.includes(preference)) fail("Preferência inválida.");
        if (hasConflict(s, email, expertId, slot)) fail("Você já tem uma sessão com este profissional neste horário.");

        s.bookings.push({
          id: uid("booking"),
          email,
          patientName: cleanText(b.patientName, 80),
          expertId,
          expertName,
          expertRole: cleanText(b.expertRole, 80),
          specialty: cleanText(b.specialty, 80),
          price: cleanText(b.price, 20),
          accent: cleanText(b.accent, 20) || "#7c3aed",
          slot,
          preference,
          reason,
          status: "confirmed",
          createdAt: Date.now(),
        });
        return listBookings(s, email);
      });
    },
  },
  {
    method: "POST",
    pattern: "/api/bookings/:id/cancel",
    handle: ({ p, b }) => {
      const email = requireEmail(b.email);
      return mutate(s => {
        cancelRow(s.bookings.find(item => item.id === p[0] && item.email === email));
        return listBookings(s, email);
      });
    },
  },
  {
    method: "POST",
    pattern: "/api/bookings/:id/reschedule",
    handle: ({ p, b }) => {
      const email = requireEmail(b.email);
      return mutate(s => {
        const row = s.bookings.find(item => item.id === p[0] && item.email === email);
        rescheduleRow(s, row, cleanText(b.slot, 40), "Você já tem uma sessão com este profissional neste horário.");
        return listBookings(s, email);
      });
    },
  },

  // ---- Mensagens (paciente) ----
  {
    method: "GET",
    pattern: "/api/conversations",
    handle: ({ q }) => {
      const email = requireEmail(q.get("email"));
      const s = load();
      if (ensurePatientChats(s, email, cleanText(q.get("name"), 80))) save(s);
      return listPatientChats(s, email);
    },
  },
  {
    method: "POST",
    pattern: "/api/conversations/:id/messages",
    handle: ({ p, b }) => {
      const chatId = Number(p[0]);
      const email = requireEmail(b.email);
      const text = validMessageText(b.text);

      const chat = mutate(s => {
        const found = s.chats.find(item => item.id === chatId);
        if (!found || found.patientEmail !== email) return null;
        pushMessage(s, chatId, "patient", text, timeLabel());
        return { ...found };
      });
      if (!chat) fail("Conversa não encontrada.");

      // Só responde sozinho se o profissional não assumiu a conversa
      let delay: number | null = null;
      if (chat.auto) {
        delay = replyDelayMs(text);
        scheduleReply(chatId, chat.proId, text, delay);
      }

      const conversation = listPatientChats(load(), email).find(item => item.id === chatId);
      return { conversation, replyDelayMs: delay };
    },
  },

  // ---- Painel do profissional ----
  {
    method: "GET",
    pattern: "/api/pro/bookings",
    handle: ({ q }) => listBookingsForExpert(load(), resolvePro(q.get("proId")).expertId),
  },
  {
    method: "POST",
    pattern: "/api/pro/bookings/:id/cancel",
    handle: ({ p, b }) => {
      const { expertId } = resolvePro(b.proId);
      return mutate(s => {
        cancelRow(s.bookings.find(item => item.id === p[0] && item.expertId === expertId));
        return listBookingsForExpert(s, expertId);
      });
    },
  },
  {
    method: "POST",
    pattern: "/api/pro/bookings/:id/reschedule",
    handle: ({ p, b }) => {
      const { expertId } = resolvePro(b.proId);
      return mutate(s => {
        const row = s.bookings.find(item => item.id === p[0] && item.expertId === expertId);
        rescheduleRow(s, row, cleanText(b.slot, 40), "O paciente já tem uma sessão com você neste horário.");
        return listBookingsForExpert(s, expertId);
      });
    },
  },
  { method: "GET", pattern: "/api/pro/chats", handle: ({ q }) => listProChats(load(), resolvePro(q.get("proId")).proId) },
  {
    method: "POST",
    pattern: "/api/pro/chats/:id/messages",
    handle: ({ p, b }) => {
      const { proId } = resolvePro(b.proId);
      const text = validMessageText(b.text);
      const chatId = Number(p[0]);

      const chat = mutate(s => {
        const found = s.chats.find(item => item.id === chatId);
        if (found?.proId !== proId) return null;
        pushMessage(s, chatId, "pro", text, timeLabel());
        return { ...found };
      });
      if (!chat) fail("Conversa não encontrada.");

      // Paciente de exemplo responde sozinho
      let delay: number | null = null;
      if (isDemoPatient(chat)) {
        delay = replyDelayMs(text) + 600;
        schedulePatientReply(chat.id, text, delay);
      }

      return { chats: listProChats(load(), proId), replyDelayMs: delay };
    },
  },
  {
    method: "POST",
    pattern: "/api/pro/chats/:id/auto",
    handle: ({ p, b }) => {
      const { proId } = resolvePro(b.proId);
      return mutate(s => {
        const chat = s.chats.find(item => item.id === Number(p[0]));
        if (chat?.proId !== proId) fail("Conversa não encontrada.");
        chat.auto = Boolean(b.enabled);
        return listProChats(s, proId);
      });
    },
  },
];

function matchPattern(path: string, pattern: string): string[] | null {
  const regex = new RegExp(`^${pattern.replaceAll(/:[a-zA-Z]+/g, "([^/]+)")}$`);
  const found = regex.exec(path);
  return found ? found.slice(1).map(part => decodeURIComponent(part)) : null;
}

function parseBody(body: BodyInit | null | undefined): Record<string, any> {
  if (typeof body !== "string" || !body) return {};
  try {
    const parsed: unknown = JSON.parse(body);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, any>) : {};
  } catch {
    return {};
  }
}

// Mesma assinatura de uma chamada HTTP: o api.ts usa isto no lugar do fetch no app Android
export async function localRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const method = (options?.method ?? "GET").toUpperCase();
  const parsed = new URL(url, "http://local");
  const path = parsed.pathname.replace(/\/+$/, "");
  const body = parseBody(options?.body);

  for (const route of ROUTES) {
    if (route.method !== method) continue;
    const params = matchPattern(path, route.pattern);
    if (params) return route.handle({ p: params, q: parsed.searchParams, b: body }) as T;
  }

  throw new Error(`Rota não encontrada: ${method} ${path}`);
}