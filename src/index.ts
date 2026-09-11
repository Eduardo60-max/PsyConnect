import { serve } from "bun";
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
} from "./db";

const server = serve({
  port: Number(process.env.PORT || 0),
  routes: {
    // Serve index.html for all unmatched routes.
    "/*": index,

    "/api/hello": {
      async GET(req) {
        return Response.json({
          message: "Hello, world!",
          method: "GET",
        });
      },
      async PUT(req) {
        return Response.json({
          message: "Hello, world!",
          method: "PUT",
        });
      },
    },

    "/api/hello/:name": async req => {
      const name = req.params.name;
      return Response.json({
        message: `Hello, ${name}!`,
      });
    },

    // ---- Grupos ----
    "/api/groups": {
      async GET() {
        return Response.json(listGroups());
      },
      async POST(req) {
        const body = await req.json();
        if (!body?.id || !body?.name || !body?.description || !body?.theme || !body?.adminId || !body?.accent) {
          return Response.json({ error: "Dados do grupo incompletos." }, { status: 400 });
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
        return Response.json(listGroups(), { status: 201 });
      },
    },

    "/api/groups/:id/join": {
      async POST(req) {
        const result = toggleGroupJoin(req.params.id);
        if (!result) return Response.json({ error: "Grupo não encontrado." }, { status: 404 });
        return Response.json(result);
      },
    },

    "/api/groups/:id/posts": {
      async GET(req) {
        return Response.json(listPosts(req.params.id));
      },
      async POST(req) {
        const body = await req.json();
        if (!body?.body?.trim()) return Response.json({ error: "O post não pode estar vazio." }, { status: 400 });
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
        return Response.json(listPosts(req.params.id), { status: 201 });
      },
    },

    "/api/groups/:id/challenge-days/:day": {
      async POST(req) {
        const day = Number(req.params.day);
        if (!Number.isInteger(day)) return Response.json({ error: "Dia inválido." }, { status: 400 });
        return Response.json(toggleChallengeDay(req.params.id, day));
      },
    },

    "/api/groups/:id/challenge-days": {
      async GET(req) {
        return Response.json(listChallengeDays(req.params.id));
      },
    },

    // ---- Mensagens ----
    "/api/conversations": {
      async GET() {
        return Response.json(listConversations());
      },
    },

    "/api/conversations/:id/messages": {
      async POST(req) {
        const conversationId = Number(req.params.id);
        const body = await req.json();
        if (!body?.text?.trim()) return Response.json({ error: "A mensagem não pode estar vazia." }, { status: 400 });
        addMessage(conversationId, "me", body.text.trim(), "agora");
        return Response.json(listConversations().find(conversation => conversation.id === conversationId), { status: 201 });
      },
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
