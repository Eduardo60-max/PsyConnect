import { serve, type BunRequest } from "bun";
import index from "./index.html";
import {
  addPost,
  createGroup,
  listChallengeDays,
  listGroups,
  listPosts,
  resetDatabase,
  toggleChallengeDay,
  toggleGroupJoin,
  togglePostLike,
} from "./db";
import { addComment, listComments } from "./comments";
import { listMoodWeek, normalizeEmail, saveMood } from "./mood";
import {
  cancelBooking,
  cancelBookingAsExpert,
  createBooking,
  listBookings,
  listBookingsForExpert,
  rescheduleBooking,
  rescheduleBookingAsExpert,
  resetBookings,
} from "./bookings";
import {
  addAutoReply,
  addPatientAutoMessage,
  addPatientMessage,
  addProMessage,
  ensurePatientChats,
  isAutoChat,
  isDemoPatient,
  lastSender,
  listPatientChats,
  listProChats,
  recentPatientMessages,
  recentProReplies,
  resetChats,
  setChatAuto,
} from "./chats";
import { professionals } from "./data";
import { pickReply, replyDelayMs } from "./chatbot";
import { pickPatientReply } from "./patientBot";

const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS ?? "capacitor://localhost,https://localhost")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean),
);

function apiResponse(req: Request, body: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  const origin = req.headers.get("origin");

  if (origin && allowedOrigins.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    headers.set("Vary", "Origin");
  }

  return Response.json(body, { ...init, headers });
}

function apiPreflight(req: Request): Response {
  const headers = new Headers();
  const origin = req.headers.get("origin");

  if (origin && allowedOrigins.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    headers.set("Vary", "Origin");
  }

  return new Response(null, { status: 204, headers });
}

function currentTimeLabel(): string {
  return new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bahia",
  });
}

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

// "prof-1" -> expertId 1 (os especialistas da tela de agendamento usam os ids 1 a 3)
function resolvePro(value: unknown): { proId: string; expertId: number } | null {
  const proId = typeof value === "string" ? value : "";
  if (!professionals.some(professional => professional.id === proId)) return null;
  return { proId, expertId: Number(proId.replace("prof-", "")) };
}

// ---- Respostas automáticas dos profissionais ----
const PERSONA_BY_PRO: Record<string, number> = { "prof-1": 1, "prof-2": 2, "prof-5": 3 };
const pendingReplies = new Set<ReturnType<typeof setTimeout>>();

function scheduleReply(chatId: number, proId: string, text: string, delay: number) {
  const timer = setTimeout(() => {
    pendingReplies.delete(timer);
    try {
      if (!isAutoChat(chatId)) return;
      // se o profissional de verdade respondeu nesse meio tempo, o bot fica quieto
      if (lastSender(chatId) === "pro") return;
      const recent = recentProReplies(chatId, 4);
      addAutoReply(chatId, pickReply(PERSONA_BY_PRO[proId] ?? 0, text, recent), currentTimeLabel());
    } catch (error) {
      console.error("Falha ao gravar a resposta automática:", error);
    }
  }, delay);
  pendingReplies.add(timer);
}

function schedulePatientReply(chatId: number, text: string, delay: number) {
  const timer = setTimeout(() => {
    pendingReplies.delete(timer);
    try {
      const recent = recentPatientMessages(chatId, 4);
      addPatientAutoMessage(chatId, pickPatientReply(text, recent), currentTimeLabel());
    } catch (error) {
      console.error("Falha ao gravar a resposta do paciente simulado:", error);
    }
  }, delay);
  pendingReplies.add(timer);
}

const routes = {
  // Serve index.html for all unmatched routes.
  "/*": index,

  "/api/*": {
    OPTIONS(req: Request) {
      return apiPreflight(req);
    },
  },

  "/api/hello": {
    GET(req: Request) {
      return apiResponse(req, {
        message: "Hello, world!",
        method: "GET",
      });
    },
    PUT(req: Request) {
      return apiResponse(req, {
        message: "Hello, world!",
        method: "PUT",
      });
    },
  },

  "/api/hello/:name": (req: BunRequest<"/api/hello/:name">) => {
    const name = req.params.name;
    return apiResponse(req, {
      message: `Hello, ${name}!`,
    });
  },

  // ---- Modo demonstração ----
  "/api/demo/reset": {
    POST(req: Request) {
      if (process.env.DISABLE_DEMO_RESET === "1") {
        return apiResponse(req, { error: "A restauração de dados está desativada." }, { status: 403 });
      }
      for (const timer of pendingReplies) clearTimeout(timer);
      pendingReplies.clear();
      resetDatabase();
      resetBookings();
      resetChats();
      return apiResponse(req, { ok: true });
    },
  },

  // ---- Grupos ----
  "/api/groups": {
    GET(req: Request) {
      return apiResponse(req, listGroups());
    },
    async POST(req: Request) {
      const body = await req.json();
      if (!body?.id || !body?.name || !body?.description || !body?.theme || !body?.adminId || !body?.accent) {
        return apiResponse(req, { error: "Dados do grupo incompletos." }, { status: 400 });
      }
      createGroup({
        id: body.id,
        name: body.name,
        description: body.description,
        theme: body.theme,
        adminId: body.adminId,
        isTemporary: body.isTemporary ? 1 : 0,
        durationDays: body.isTemporary ? body.durationDays ?? null : null,
        accent: body.accent,
      });
      return apiResponse(req, listGroups(), { status: 201 });
    },
  },

  "/api/groups/:id/join": {
    POST(req: BunRequest<"/api/groups/:id/join">) {
      const result = toggleGroupJoin(req.params.id);
      if (!result) return apiResponse(req, { error: "Grupo não encontrado." }, { status: 404 });
      return apiResponse(req, result);
    },
  },

  "/api/groups/:id/posts": {
    GET(req: BunRequest<"/api/groups/:id/posts">) {
      return apiResponse(req, listPosts(req.params.id));
    },
    async POST(req: BunRequest<"/api/groups/:id/posts">) {
      const body = await req.json();
      if (!body?.body?.trim()) return apiResponse(req, { error: "O post não pode estar vazio." }, { status: 400 });
      const post = {
        id: `post-${Date.now()}`,
        groupId: req.params.id,
        author: String(body.author ?? "").trim() || "Você",
        handle: String(body.handle ?? "").trim() || "@voce",
        body: body.body.trim(),
        time: currentTimeLabel(),
        likes: 0,
        comments: 0,
      };
      addPost(post);
      return apiResponse(req, listPosts(req.params.id), { status: 201 });
    },
  },

  // ---- Curtidas ----
  "/api/posts/:id/like": {
    POST(req: BunRequest<"/api/posts/:id/like">) {
      const result = togglePostLike(req.params.id);
      if (!result) return apiResponse(req, { error: "Post não encontrado." }, { status: 404 });
      return apiResponse(req, { liked: Boolean(result.liked), likes: result.likes });
    },
  },

  // ---- Comentários ----
  "/api/posts/:id/comments": {
    GET(req: BunRequest<"/api/posts/:id/comments">) {
      return apiResponse(req, listComments(req.params.id));
    },
    async POST(req: BunRequest<"/api/posts/:id/comments">) {
      const body = await req.json();
      const text = String(body?.body ?? "").trim();
      if (!text) return apiResponse(req, { error: "O comentário não pode estar vazio." }, { status: 400 });
      if (text.length > 500) return apiResponse(req, { error: "O comentário pode ter no máximo 500 caracteres." }, { status: 400 });
      addComment({
        id: `comment-${Date.now()}`,
        postId: req.params.id,
        author: String(body?.author ?? "").trim() || "Você",
        handle: String(body?.handle ?? "").trim() || "@voce",
        body: text,
        time: currentTimeLabel(),
      });
      return apiResponse(req, listComments(req.params.id), { status: 201 });
    },
  },

  // ---- Diário de humor ----
  "/api/mood": {
    GET(req: Request) {
      const email = normalizeEmail(new URL(req.url).searchParams.get("email"));
      if (!email) return apiResponse(req, { error: "E-mail inválido." }, { status: 400 });
      return apiResponse(req, listMoodWeek(email));
    },
    async POST(req: Request) {
      const body = await req.json();
      const email = normalizeEmail(body?.email);
      if (!email) return apiResponse(req, { error: "E-mail inválido." }, { status: 400 });
      const mood = Number(body?.mood);
      if (!Number.isInteger(mood) || mood < 1 || mood > 5) {
        return apiResponse(req, { error: "Escolha um humor de 1 a 5." }, { status: 400 });
      }
      const note = String(body?.note ?? "").trim().slice(0, 280);
      saveMood(email, mood, note);
      return apiResponse(req, listMoodWeek(email), { status: 201 });
    },
  },

  // ---- Agendamentos (paciente) ----
  "/api/bookings": {
    GET(req: Request) {
      const email = normalizeEmail(new URL(req.url).searchParams.get("email"));
      if (!email) return apiResponse(req, { error: "E-mail inválido." }, { status: 400 });
      return apiResponse(req, listBookings(email));
    },
    async POST(req: Request) {
      const body = await req.json();
      const email = normalizeEmail(body?.email);
      if (!email) return apiResponse(req, { error: "E-mail inválido." }, { status: 400 });

      const expertId = Number(body?.expertId);
      const expertName = cleanText(body?.expertName, 80);
      const reason = cleanText(body?.reason, 500);
      if (!Number.isInteger(expertId) || !expertName) {
        return apiResponse(req, { error: "Profissional inválido." }, { status: 400 });
      }
      if (!reason) return apiResponse(req, { error: "Conte o motivo da sessão." }, { status: 400 });

      const failure = createBooking({
        email,
        patientName: cleanText(body?.patientName, 80),
        expertId,
        expertName,
        expertRole: cleanText(body?.expertRole, 80),
        specialty: cleanText(body?.specialty, 80),
        price: cleanText(body?.price, 20),
        accent: cleanText(body?.accent, 20) || "#7c3aed",
        slot: cleanText(body?.slot, 40),
        preference: cleanText(body?.preference, 20),
        reason,
      });
      if (failure) return apiResponse(req, { error: failure.error }, { status: failure.status });
      return apiResponse(req, listBookings(email), { status: 201 });
    },
  },

  "/api/bookings/:id/cancel": {
    async POST(req: BunRequest<"/api/bookings/:id/cancel">) {
      const body = await req.json();
      const email = normalizeEmail(body?.email);
      if (!email) return apiResponse(req, { error: "E-mail inválido." }, { status: 400 });
      const failure = cancelBooking(email, req.params.id);
      if (failure) return apiResponse(req, { error: failure.error }, { status: failure.status });
      return apiResponse(req, listBookings(email));
    },
  },

  "/api/bookings/:id/reschedule": {
    async POST(req: BunRequest<"/api/bookings/:id/reschedule">) {
      const body = await req.json();
      const email = normalizeEmail(body?.email);
      if (!email) return apiResponse(req, { error: "E-mail inválido." }, { status: 400 });
      const failure = rescheduleBooking(email, req.params.id, cleanText(body?.slot, 40));
      if (failure) return apiResponse(req, { error: failure.error }, { status: failure.status });
      return apiResponse(req, listBookings(email));
    },
  },

  "/api/groups/:id/challenge-days/:day": {
    POST(req: BunRequest<"/api/groups/:id/challenge-days/:day">) {
      const day = Number(req.params.day);
      if (!Number.isInteger(day)) return apiResponse(req, { error: "Dia inválido." }, { status: 400 });
      return apiResponse(req, toggleChallengeDay(req.params.id, day));
    },
  },

  "/api/groups/:id/challenge-days": {
    GET(req: BunRequest<"/api/groups/:id/challenge-days">) {
      return apiResponse(req, listChallengeDays(req.params.id));
    },
  },

  // ---- Mensagens (paciente) ----
  "/api/conversations": {
    GET(req: Request) {
      const params = new URL(req.url).searchParams;
      const email = normalizeEmail(params.get("email"));
      if (!email) return apiResponse(req, { error: "E-mail inválido." }, { status: 400 });
      ensurePatientChats(email, cleanText(params.get("name"), 80));
      return apiResponse(req, listPatientChats(email));
    },
  },

  "/api/conversations/:id/messages": {
    async POST(req: BunRequest<"/api/conversations/:id/messages">) {
      const chatId = Number(req.params.id);
      const body = await req.json();
      const email = normalizeEmail(body?.email);
      if (!email) return apiResponse(req, { error: "E-mail inválido." }, { status: 400 });

      const text = String(body?.text ?? "").trim();
      if (!text) return apiResponse(req, { error: "A mensagem não pode estar vazia." }, { status: 400 });
      if (text.length > 1000) return apiResponse(req, { error: "A mensagem pode ter no máximo 1000 caracteres." }, { status: 400 });

      const chat = Number.isInteger(chatId) ? addPatientMessage(email, chatId, text, currentTimeLabel()) : null;
      if (!chat) return apiResponse(req, { error: "Conversa não encontrada." }, { status: 404 });

      // Só responde sozinho se o profissional não assumiu a conversa
      let delay: number | null = null;
      if (chat.auto) {
        delay = replyDelayMs(text);
        scheduleReply(chatId, chat.proId, text, delay);
      }

      const conversation = listPatientChats(email).find(item => item.id === chatId);
      return apiResponse(req, { conversation, replyDelayMs: delay }, { status: 201 });
    },
  },

  // ---- Painel do profissional ----
  "/api/pro/bookings": {
    GET(req: Request) {
      const pro = resolvePro(new URL(req.url).searchParams.get("proId"));
      if (!pro) return apiResponse(req, { error: "Profissional inválido." }, { status: 400 });
      return apiResponse(req, listBookingsForExpert(pro.expertId));
    },
  },

  "/api/pro/bookings/:id/cancel": {
    async POST(req: BunRequest<"/api/pro/bookings/:id/cancel">) {
      const body = await req.json();
      const pro = resolvePro(body?.proId);
      if (!pro) return apiResponse(req, { error: "Profissional inválido." }, { status: 400 });
      const failure = cancelBookingAsExpert(pro.expertId, req.params.id);
      if (failure) return apiResponse(req, { error: failure.error }, { status: failure.status });
      return apiResponse(req, listBookingsForExpert(pro.expertId));
    },
  },

  "/api/pro/bookings/:id/reschedule": {
    async POST(req: BunRequest<"/api/pro/bookings/:id/reschedule">) {
      const body = await req.json();
      const pro = resolvePro(body?.proId);
      if (!pro) return apiResponse(req, { error: "Profissional inválido." }, { status: 400 });
      const failure = rescheduleBookingAsExpert(pro.expertId, req.params.id, cleanText(body?.slot, 40));
      if (failure) return apiResponse(req, { error: failure.error }, { status: failure.status });
      return apiResponse(req, listBookingsForExpert(pro.expertId));
    },
  },

  "/api/pro/chats": {
    GET(req: Request) {
      const pro = resolvePro(new URL(req.url).searchParams.get("proId"));
      if (!pro) return apiResponse(req, { error: "Profissional inválido." }, { status: 400 });
      return apiResponse(req, listProChats(pro.proId));
    },
  },

  "/api/pro/chats/:id/messages": {
    async POST(req: BunRequest<"/api/pro/chats/:id/messages">) {
      const body = await req.json();
      const pro = resolvePro(body?.proId);
      if (!pro) return apiResponse(req, { error: "Profissional inválido." }, { status: 400 });

      const text = String(body?.text ?? "").trim();
      if (!text) return apiResponse(req, { error: "A mensagem não pode estar vazia." }, { status: 400 });
      if (text.length > 1000) return apiResponse(req, { error: "A mensagem pode ter no máximo 1000 caracteres." }, { status: 400 });

            const chat = addProMessage(pro.proId, Number(req.params.id), text, currentTimeLabel());
      if (!chat) return apiResponse(req, { error: "Conversa não encontrada." }, { status: 404 });

      // Paciente de exemplo responde sozinho
      let delay: number | null = null;
      if (isDemoPatient(chat)) {
        delay = replyDelayMs(text) + 600;
        schedulePatientReply(chat.id, text, delay);
      }

      return apiResponse(req, { chats: listProChats(pro.proId), replyDelayMs: delay }, { status: 201 });
    },
  },

  "/api/pro/chats/:id/auto": {
    async POST(req: BunRequest<"/api/pro/chats/:id/auto">) {
      const body = await req.json();
      const pro = resolvePro(body?.proId);
      if (!pro) return apiResponse(req, { error: "Profissional inválido." }, { status: 400 });
      if (!setChatAuto(pro.proId, Number(req.params.id), Boolean(body?.enabled))) {
        return apiResponse(req, { error: "Conversa não encontrada." }, { status: 404 });
      }
      return apiResponse(req, listProChats(pro.proId));
    },
  },
};

const basePort = Number(process.env.PORT || 3000);
const maxPortAttempts = 10;

for (let attempt = 0; attempt < maxPortAttempts; attempt++) {
  const port = basePort + attempt;
  try {
    const server = serve({
      port,
      routes,
      development: process.env.NODE_ENV !== "production" && {
        // Enable browser hot reloading in development
        hmr: true,

        // Echo console logs from the browser to the server
        console: true,
      },
    });

    console.log(`🚀 Server running at ${server.url}`);
    break;
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code !== "EADDRINUSE") {
      throw error;
    }
    if (attempt === maxPortAttempts - 1) {
      throw error;
    }
    console.warn(`Port ${port} está em uso. Tentando ${port + 1}...`);
  }
}