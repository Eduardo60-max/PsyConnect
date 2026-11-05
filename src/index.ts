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
  toggleChallengeDay,
  toggleGroupJoin,
  togglePostLike,
} from "./db";

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
        author: body.author ?? "Você",
        handle: body.handle ?? "@voce",
        body: body.body.trim(),
        time: "agora",
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
      if (!body?.text?.trim()) return apiResponse(req, { error: "A mensagem não pode estar vazia." }, { status: 400 });
      addMessage(conversationId, "me", body.text.trim(), currentTimeLabel());
      return apiResponse(req, listConversations().find(conversation => conversation.id === conversationId), { status: 201 });
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