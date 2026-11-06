import { serve, type BunRequest } from "bun";
import index from "./index.html";
import {
  addMessage,
  addPost,
  createGroup,
  listChallengeDays,
  listConversations,
  listGroups,
  listPosts,
  listRecentReplies,
  resetDatabase,
  toggleChallengeDay,
  toggleGroupJoin,
  togglePostLike,
} from "./db";
import { addComment, listComments } from "./comments";
import { listMoodWeek, normalizeEmail, saveMood } from "./mood";
import { pickReply, replyDelayMs } from "./chatbot";

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

// ---- Respostas automáticas dos profissionais ----
const pendingReplies = new Set<ReturnType<typeof setTimeout>>();

function scheduleReply(conversationId: number, text: string, delay: number) {
  const timer = setTimeout(() => {
    pendingReplies.delete(timer);
    try {
      const recent = listRecentReplies(conversationId, 4);
      addMessage(conversationId, "them", pickReply(conversationId, text, recent), currentTimeLabel());
    } catch (error) {
      console.error("Falha ao gravar a resposta automática:", error);
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

  // ---- Mensagens ----
  "/api/conversations": {
    GET(req: Request) {
      return apiResponse(req, listConversations());
    },
  },

  "/api/conversations/:id/messages": {
    async POST(req: BunRequest<"/api/conversations/:id/messages">) {
      const conversationId = Number(req.params.id);
      const body = await req.json();
      const text = String(body?.text ?? "").trim();
      if (!text) return apiResponse(req, { error: "A mensagem não pode estar vazia." }, { status: 400 });
      if (text.length > 1000) return apiResponse(req, { error: "A mensagem pode ter no máximo 1000 caracteres." }, { status: 400 });
      if (!listConversations().some(conversation => conversation.id === conversationId)) {
        return apiResponse(req, { error: "Conversa não encontrada." }, { status: 404 });
      }

      addMessage(conversationId, "me", text, currentTimeLabel());

      const delay = replyDelayMs(text);
      scheduleReply(conversationId, text, delay);

      const conversation = listConversations().find(item => item.id === conversationId);
      return apiResponse(req, { conversation, replyDelayMs: delay }, { status: 201 });
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