import { serve, type BunRequest } from "bun";
import index from "./index.html";
import {
  addPost,
  blockUser,
  createGroup,
  createReport,
  deletePost,
  listBlockedUsers,
  listChallengeDays,
  listChallengeRanking,
  listGroups,
  listHomeFeed,
  listPosts,
  toggleChallengeDay,
  toggleGroupJoin,
  togglePostLike,
  unblockUser,
} from "./db";
import { addComment, deleteComment, listComments } from "./comments";
import { listMoodWeek, saveMood } from "./mood";
import {
  addDoctorSlot,
  cancelBooking,
  cancelBookingAsDoctor,
  createBooking,
  listApprovedProfessionals,
  listBookings,
  listBookingsForDoctor,
  listDoctorAvailability,
  removeDoctorSlot,
  rescheduleBooking,
  rescheduleBookingAsDoctor,
} from "./bookings";
import { addChatMessage, getConversationMessages, listPatientChats, listProChats } from "./chats";
import { buildAnonymizedSurveysCsv, listAdminSurveys, listMyPanasResponses, savePanasResponse } from "./surveys";
import {
  listDoctorsForAdmin,
  listReportsForAdmin,
  resolveReport,
  reviewDoctor,
  updateDoctorProfile,
  updateMyProfile,
} from "./admin";
import {
  authenticateRequest,
  getPublicSupabaseConfig,
  isAdmin,
  isApprovedDoctor,
  type AuthContext,
} from "./supabaseServer";
import { checkRateLimit, getClientIp } from "./rateLimit";

const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS ?? "capacitor://localhost,https://localhost")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean),
);

if (process.env.NODE_ENV !== "production") {
  allowedOrigins.add("http://localhost:3000");
  allowedOrigins.add("http://127.0.0.1:3000");
}

function applyCorsHeaders(req: Request, headers: Headers) {
  const origin = req.headers.get("origin");
  if (origin && allowedOrigins.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    headers.set("Vary", "Origin");
  }
}

function apiResponse(req: Request, body: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  applyCorsHeaders(req, headers);
  return Response.json(body, { ...init, headers });
}

function apiCsvResponse(req: Request, filename: string, csv: string): Response {
  const headers = new Headers();
  applyCorsHeaders(req, headers);
  headers.set("Content-Type", "text/csv; charset=utf-8");
  headers.set("Content-Disposition", `attachment; filename="${filename}"`);
  return new Response(`\uFEFF${csv}`, { status: 200, headers });
}

function apiPreflight(req: Request): Response {
  const headers = new Headers();
  applyCorsHeaders(req, headers);
  return new Response(null, { status: 204, headers });
}

async function readJsonBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await req.json();
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function withAuth<T extends Request>(
  req: T,
  handler: (user: AuthContext, req: T) => Promise<Response> | Response,
): Promise<Response> {
  const ip = getClientIp(req);
  const limit = checkRateLimit(`api:${ip}`, 240, 60_000);
  if (!limit.allowed) {
    return apiResponse(
      req,
      { error: "Muitas requisições em sequência. Aguarde alguns segundos." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return apiResponse(req, { error: auth.error }, { status: auth.status });
  }

  try {
    return await handler(auth.user, req);
  } catch (error) {
    console.error("[API error]", error);
    return apiResponse(req, { error: "Erro interno ao processar sua solicitação." }, { status: 500 });
  }
}

async function withDoctor<T extends Request>(
  req: T,
  handler: (user: AuthContext, req: T) => Promise<Response> | Response,
): Promise<Response> {
  return withAuth(req, (user, innerReq) => {
    if (!isApprovedDoctor(user)) {
      return apiResponse(
        innerReq,
        { error: "Acesso restrito a profissionais aprovados." },
        { status: 403 },
      );
    }
    return handler(user, innerReq);
  });
}

async function withAdmin<T extends Request>(
  req: T,
  handler: (user: AuthContext, req: T) => Promise<Response> | Response,
): Promise<Response> {
  return withAuth(req, (user, innerReq) => {
    if (!isAdmin(user)) {
      return apiResponse(innerReq, { error: "Acesso restrito à administração." }, { status: 403 });
    }
    return handler(user, innerReq);
  });
}

const routes = {
  "/*": index,

  "/api/*": {
    OPTIONS(req: Request) {
      return apiPreflight(req);
    },
  },

  "/api/public-config": {
    GET(req: Request) {
      return apiResponse(req, getPublicSupabaseConfig());
    },
  },

  "/api/auth/login-guard": {
    async POST(req: Request) {
      const ip = getClientIp(req);
      const ipLimit = checkRateLimit(`login-ip:${ip}`, 20, 10 * 60_000);
      if (!ipLimit.allowed) {
        return apiResponse(
          req,
          { error: `Muitas tentativas de login. Aguarde ${ipLimit.retryAfterSec}s e tente de novo.` },
          { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSec) } },
        );
      }

      const body = await readJsonBody(req);
      const email = cleanText(body?.email, 254).toLowerCase();
      if (email) {
        const emailLimit = checkRateLimit(`login-email:${email}`, 8, 10 * 60_000);
        if (!emailLimit.allowed) {
          return apiResponse(
            req,
            { error: `Muitas tentativas para esse e-mail. Aguarde ${emailLimit.retryAfterSec}s e tente de novo.` },
            { status: 429, headers: { "Retry-After": String(emailLimit.retryAfterSec) } },
          );
        }
      }
      return apiResponse(req, { ok: true });
    },
  },

  // ---- Perfil do usuário autenticado ----
  "/api/me": {
    GET(req: Request) {
      return withAuth(req, user => apiResponse(req, user));
    },
  },

  "/api/me/profile": {
    PUT(req: Request) {
      return withAuth(req, async user => {
        const body = await readJsonBody(req);
        if (!body) return apiResponse(req, { error: "Corpo da requisição inválido." }, { status: 400 });
        const failure = await updateMyProfile(user.id, {
          name: typeof body.name === "string" ? body.name : undefined,
          acceptedHealthDataAt:
            typeof body.acceptedHealthDataAt === "string" ? body.acceptedHealthDataAt : undefined,
        });
        if (failure.error) return apiResponse(req, { error: failure.error }, { status: failure.status ?? 400 });
        const refreshed = await authenticateRequest(req);
        return apiResponse(req, refreshed.ok ? refreshed.user : user);
      });
    },
  },

  // ---- Profissionais aprovados ----
  "/api/professionals": {
    GET(req: Request) {
      return withAuth(req, async () => apiResponse(req, await listApprovedProfessionals()));
    },
  },

  // ---- Feed geral da Home ----
  "/api/feed": {
    GET(req: Request) {
      return withAuth(req, async user => {
        const theme = new URL(req.url).searchParams.get("theme") ?? "all";
        return apiResponse(req, await listHomeFeed(user, theme));
      });
    },
  },

  // ---- Grupos ----
  "/api/groups": {
    GET(req: Request) {
      return withAuth(req, async user => apiResponse(req, await listGroups(user.id)));
    },
    POST(req: Request) {
      return withAuth(req, async user => {
        const body = await readJsonBody(req);
        if (!body) return apiResponse(req, { error: "Dados do grupo inválidos." }, { status: 400 });
        const failure = await createGroup(user, {
          name: cleanText(body.name, 80),
          description: cleanText(body.description, 400),
          theme: cleanText(body.theme, 40),
          adminId: typeof body.adminId === "string" ? body.adminId : null,
          isTemporary: Boolean(body.isTemporary),
          durationDays: body.isTemporary ? Number(body.durationDays) : null,
          accent: cleanText(body.accent, 20),
        });
        if (failure.error) return apiResponse(req, { error: failure.error }, { status: failure.status ?? 400 });
        return apiResponse(req, await listGroups(user.id), { status: 201 });
      });
    },
  },

  "/api/groups/:id/join": {
    POST(req: BunRequest<"/api/groups/:id/join">) {
      return withAuth(req, async user => {
        const result = await toggleGroupJoin(user.id, req.params.id);
        if (!result) return apiResponse(req, { error: "Grupo não encontrado." }, { status: 404 });
        return apiResponse(req, result);
      });
    },
  },

  "/api/groups/:id/posts": {
    GET(req: BunRequest<"/api/groups/:id/posts">) {
      return withAuth(req, async user => apiResponse(req, await listPosts(user, req.params.id)));
    },
    POST(req: BunRequest<"/api/groups/:id/posts">) {
      return withAuth(req, async user => {
        const body = await readJsonBody(req);
        if (!body) return apiResponse(req, { error: "Dados inválidos." }, { status: 400 });
        const failure = await addPost(user, req.params.id, cleanText(body.body, 1000));
        if (failure.error) return apiResponse(req, { error: failure.error }, { status: failure.status ?? 400 });
        return apiResponse(req, await listPosts(user, req.params.id), { status: 201 });
      });
    },
  },

  "/api/posts/:id": {
    DELETE(req: BunRequest<"/api/posts/:id">) {
      return withAuth(req, async user => {
        const failure = await deletePost(user, req.params.id);
        if (failure.error) return apiResponse(req, { error: failure.error }, { status: failure.status ?? 400 });
        return apiResponse(req, { ok: true });
      });
    },
  },

  "/api/posts/:id/like": {
    POST(req: BunRequest<"/api/posts/:id/like">) {
      return withAuth(req, async user => {
        const result = await togglePostLike(user.id, req.params.id);
        if (!result) return apiResponse(req, { error: "Post não encontrado." }, { status: 404 });
        return apiResponse(req, result);
      });
    },
  },

  "/api/posts/:id/comments": {
    GET(req: BunRequest<"/api/posts/:id/comments">) {
      return withAuth(req, async user => apiResponse(req, await listComments(user, req.params.id)));
    },
    POST(req: BunRequest<"/api/posts/:id/comments">) {
      return withAuth(req, async user => {
        const body = await readJsonBody(req);
        if (!body) return apiResponse(req, { error: "Dados inválidos." }, { status: 400 });
        const failure = await addComment(user, req.params.id, cleanText(body.body, 500));
        if (failure.error) return apiResponse(req, { error: failure.error }, { status: failure.status ?? 400 });
        return apiResponse(req, await listComments(user, req.params.id), { status: 201 });
      });
    },
  },

  "/api/comments/:id": {
    DELETE(req: BunRequest<"/api/comments/:id">) {
      return withAuth(req, async user => {
        const failure = await deleteComment(user, req.params.id);
        if (failure.error) return apiResponse(req, { error: failure.error }, { status: failure.status ?? 400 });
        return apiResponse(req, { ok: true });
      });
    },
  },

  "/api/groups/:id/challenge-days": {
    GET(req: BunRequest<"/api/groups/:id/challenge-days">) {
      return withAuth(req, async user => apiResponse(req, await listChallengeDays(user.id, req.params.id)));
    },
  },

  "/api/groups/:id/challenge-days/:day": {
    POST(req: BunRequest<"/api/groups/:id/challenge-days/:day">) {
      return withAuth(req, async user => {
        const day = Number(req.params.day);
        if (!Number.isInteger(day)) return apiResponse(req, { error: "Dia inválido." }, { status: 400 });
        const result = await toggleChallengeDay(user.id, req.params.id, day);
        if (result.error) return apiResponse(req, { error: result.error }, { status: result.status ?? 400 });
        return apiResponse(req, result.days ?? []);
      });
    },
  },

  "/api/groups/:id/challenge-ranking": {
    GET(req: BunRequest<"/api/groups/:id/challenge-ranking">) {
      return withAuth(req, async user => apiResponse(req, await listChallengeRanking(user.id, req.params.id)));
    },
  },

  // ---- Diário de humor ----
  "/api/mood": {
    GET(req: Request) {
      return withAuth(req, async user => apiResponse(req, await listMoodWeek(user.id)));
    },
    POST(req: Request) {
      return withAuth(req, async user => {
        const body = await readJsonBody(req);
        const mood = Number(body?.mood);
        if (!Number.isInteger(mood) || mood < 1 || mood > 5) {
          return apiResponse(req, { error: "Escolha um humor de 1 a 5." }, { status: 400 });
        }
        await saveMood(user.id, mood, cleanText(body?.note, 280));
        return apiResponse(req, await listMoodWeek(user.id), { status: 201 });
      });
    },
  },

  // ---- Agendamentos (paciente) ----
  "/api/bookings": {
    GET(req: Request) {
      return withAuth(req, async user => apiResponse(req, await listBookings(user.id)));
    },
    POST(req: Request) {
      return withAuth(req, async user => {
        const body = await readJsonBody(req);
        if (!body) return apiResponse(req, { error: "Dados de agendamento inválidos." }, { status: 400 });
        const failure = await createBooking(user.id, {
          doctorId: cleanText(body.doctorId, 80),
          slot: cleanText(body.slot, 60),
          preference: cleanText(body.preference, 20),
          reason: cleanText(body.reason, 500),
        });
        if (failure) return apiResponse(req, { error: failure.error }, { status: failure.status });
        return apiResponse(req, await listBookings(user.id), { status: 201 });
      });
    },
  },

  "/api/bookings/:id/cancel": {
    POST(req: BunRequest<"/api/bookings/:id/cancel">) {
      return withAuth(req, async user => {
        const failure = await cancelBooking(user.id, req.params.id);
        if (failure) return apiResponse(req, { error: failure.error }, { status: failure.status });
        return apiResponse(req, await listBookings(user.id));
      });
    },
  },

  "/api/bookings/:id/reschedule": {
    POST(req: BunRequest<"/api/bookings/:id/reschedule">) {
      return withAuth(req, async user => {
        const body = await readJsonBody(req);
        const failure = await rescheduleBooking(user.id, req.params.id, cleanText(body?.slot, 60));
        if (failure) return apiResponse(req, { error: failure.error }, { status: failure.status });
        return apiResponse(req, await listBookings(user.id));
      });
    },
  },

  // ---- Mensagens (paciente) ----
  "/api/conversations": {
    GET(req: Request) {
      return withAuth(req, async user => apiResponse(req, await listPatientChats(user.id)));
    },
  },

  "/api/conversations/:id/messages": {
    GET(req: BunRequest<"/api/conversations/:id/messages">) {
      return withAuth(req, async user => {
        const result = await getConversationMessages(user.id, Number(req.params.id));
        if (result.error) return apiResponse(req, { error: result.error }, { status: result.status ?? 403 });
        return apiResponse(req, result.messages ?? []);
      });
    },
    POST(req: BunRequest<"/api/conversations/:id/messages">) {
      return withAuth(req, async user => {
        const body = await readJsonBody(req);
        const chatId = Number(req.params.id);
        const failure = await addChatMessage(user.id, "patient", chatId, cleanText(body?.text, 1000));
        if (failure.error) return apiResponse(req, { error: failure.error }, { status: failure.status ?? 400 });
        const conversation = (await listPatientChats(user.id)).find(item => item.id === chatId);
        return apiResponse(req, { conversation }, { status: 201 });
      });
    },
  },

  // ---- Segurança comunitária: bloqueio e denúncia ----
  "/api/blocks": {
    GET(req: Request) {
      return withAuth(req, async user => apiResponse(req, await listBlockedUsers(user.id)));
    },
    POST(req: Request) {
      return withAuth(req, async user => {
        const body = await readJsonBody(req);
        const failure = await blockUser(user.id, cleanText(body?.userId, 80));
        if (failure.error) return apiResponse(req, { error: failure.error }, { status: failure.status ?? 400 });
        return apiResponse(req, await listBlockedUsers(user.id), { status: 201 });
      });
    },
  },

  "/api/blocks/:userId": {
    DELETE(req: BunRequest<"/api/blocks/:userId">) {
      return withAuth(req, async user => {
        await unblockUser(user.id, req.params.userId);
        return apiResponse(req, await listBlockedUsers(user.id));
      });
    },
  },

  "/api/reports": {
    POST(req: Request) {
      return withAuth(req, async user => {
        const body = await readJsonBody(req);
        if (!body) return apiResponse(req, { error: "Dados da denúncia inválidos." }, { status: 400 });
        const failure = await createReport(user.id, {
          targetType: cleanText(body.targetType, 20),
          targetId: cleanText(body.targetId, 80),
          reportedUserId: typeof body.reportedUserId === "string" ? body.reportedUserId : undefined,
          reason: cleanText(body.reason, 400),
        });
        if (failure.error) return apiResponse(req, { error: failure.error }, { status: failure.status ?? 400 });
        return apiResponse(req, { ok: true }, { status: 201 });
      });
    },
  },

  // ---- Métricas de IHC: PANAS ----
  "/api/surveys/panas/me": {
    GET(req: Request) {
      return withAuth(req, async user => apiResponse(req, await listMyPanasResponses(user.id)));
    },
  },

  "/api/surveys/panas": {
    POST(req: Request) {
      return withAuth(req, async user => {
        const body = await readJsonBody(req);
        if (!body) return apiResponse(req, { error: "Dados do questionário inválidos." }, { status: 400 });
        const result = await savePanasResponse(user, {
          sessionId: cleanText(body.sessionId, 80),
          moment: body.moment === "after" ? "after" : body.moment === "before" ? "before" : ("" as "before"),
          answers: body.answers,
          consentAcceptedAt: typeof body.consentAcceptedAt === "string" ? body.consentAcceptedAt : undefined,
        });
        if (result.error) return apiResponse(req, { error: result.error }, { status: result.status ?? 400 });
        return apiResponse(req, { record: result.record, records: await listMyPanasResponses(user.id) }, { status: 201 });
      });
    },
  },

  // ---- Painel do profissional (apenas médicos aprovados) ----
  "/api/pro/profile": {
    PUT(req: Request) {
      return withDoctor(req, async user => {
        const body = await readJsonBody(req);
        if (!body) return apiResponse(req, { error: "Dados inválidos." }, { status: 400 });
        const failure = await updateDoctorProfile(user.id, {
          roleTitle: typeof body.roleTitle === "string" ? body.roleTitle : undefined,
          specialty: typeof body.specialty === "string" ? body.specialty : undefined,
          bio: typeof body.bio === "string" ? body.bio : undefined,
          experience: typeof body.experience === "string" ? body.experience : undefined,
          priceLabel: typeof body.priceLabel === "string" ? body.priceLabel : undefined,
        });
        if (failure.error) return apiResponse(req, { error: failure.error }, { status: failure.status ?? 400 });
        const refreshed = await authenticateRequest(req);
        return apiResponse(req, refreshed.ok ? refreshed.user : user);
      });
    },
  },

  "/api/pro/availability": {
    GET(req: Request) {
      return withDoctor(req, async user => apiResponse(req, await listDoctorAvailability(user.id)));
    },
    POST(req: Request) {
      return withDoctor(req, async user => {
        const body = await readJsonBody(req);
        const failure = await addDoctorSlot(
          user.id,
          cleanText(body?.slotLabel, 60),
          typeof body?.startsAt === "string" ? body.startsAt : null,
        );
        if (failure) return apiResponse(req, { error: failure.error }, { status: failure.status });
        return apiResponse(req, await listDoctorAvailability(user.id), { status: 201 });
      });
    },
  },

  "/api/pro/availability/:id": {
    DELETE(req: BunRequest<"/api/pro/availability/:id">) {
      return withDoctor(req, async user => {
        const failure = await removeDoctorSlot(user.id, req.params.id);
        if (failure) return apiResponse(req, { error: failure.error }, { status: failure.status });
        return apiResponse(req, await listDoctorAvailability(user.id));
      });
    },
  },

  "/api/pro/bookings": {
    GET(req: Request) {
      return withDoctor(req, async user => apiResponse(req, await listBookingsForDoctor(user.id)));
    },
  },

  "/api/pro/bookings/:id/cancel": {
    POST(req: BunRequest<"/api/pro/bookings/:id/cancel">) {
      return withDoctor(req, async user => {
        const failure = await cancelBookingAsDoctor(user.id, req.params.id);
        if (failure) return apiResponse(req, { error: failure.error }, { status: failure.status });
        return apiResponse(req, await listBookingsForDoctor(user.id));
      });
    },
  },

  "/api/pro/bookings/:id/reschedule": {
    POST(req: BunRequest<"/api/pro/bookings/:id/reschedule">) {
      return withDoctor(req, async user => {
        const body = await readJsonBody(req);
        const failure = await rescheduleBookingAsDoctor(user.id, req.params.id, cleanText(body?.slot, 60));
        if (failure) return apiResponse(req, { error: failure.error }, { status: failure.status });
        return apiResponse(req, await listBookingsForDoctor(user.id));
      });
    },
  },

  "/api/pro/chats": {
    GET(req: Request) {
      return withDoctor(req, async user => apiResponse(req, await listProChats(user.id)));
    },
  },

  "/api/pro/chats/:id/messages": {
    POST(req: BunRequest<"/api/pro/chats/:id/messages">) {
      return withDoctor(req, async user => {
        const body = await readJsonBody(req);
        const failure = await addChatMessage(user.id, "doctor", Number(req.params.id), cleanText(body?.text, 1000));
        if (failure.error) return apiResponse(req, { error: failure.error }, { status: failure.status ?? 400 });
        return apiResponse(req, await listProChats(user.id), { status: 201 });
      });
    },
  },

  // ---- Painel Admin ----
  "/api/admin/doctors": {
    GET(req: Request) {
      return withAdmin(req, async () => {
        const statusFilter = new URL(req.url).searchParams.get("status") ?? undefined;
        return apiResponse(req, await listDoctorsForAdmin(statusFilter));
      });
    },
  },

  "/api/admin/doctors/:id/review": {
    POST(req: BunRequest<"/api/admin/doctors/:id/review">) {
      return withAdmin(req, async admin => {
        const body = await readJsonBody(req);
        const decision = body?.decision === "aprovado" ? "aprovado" : body?.decision === "recusado" ? "recusado" : null;
        if (!decision) return apiResponse(req, { error: "Decisão inválida." }, { status: 400 });
        const failure = await reviewDoctor(
          admin,
          req.params.id,
          decision,
          typeof body?.rejectionReason === "string" ? body.rejectionReason : undefined,
        );
        if (failure.error) return apiResponse(req, { error: failure.error }, { status: failure.status ?? 400 });
        return apiResponse(req, await listDoctorsForAdmin());
      });
    },
  },

  "/api/admin/reports": {
    GET(req: Request) {
      return withAdmin(req, async () => apiResponse(req, await listReportsForAdmin()));
    },
  },

  "/api/admin/reports/:id/resolve": {
    POST(req: BunRequest<"/api/admin/reports/:id/resolve">) {
      return withAdmin(req, async admin => {
        const body = await readJsonBody(req);
        const action =
          body?.action === "remove_content" ? "remove_content" : body?.action === "dismiss" ? "dismiss" : null;
        if (!action) return apiResponse(req, { error: "Ação inválida." }, { status: 400 });
        const failure = await resolveReport(admin, req.params.id, action);
        if (failure.error) return apiResponse(req, { error: failure.error }, { status: failure.status ?? 400 });
        return apiResponse(req, await listReportsForAdmin());
      });
    },
  },

  "/api/admin/surveys": {
    GET(req: Request) {
      return withAdmin(req, async () => apiResponse(req, await listAdminSurveys()));
    },
  },

  "/api/admin/surveys/csv": {
    GET(req: Request) {
      return withAdmin(req, async () => {
        const summary = await listAdminSurveys();
        const csv = buildAnonymizedSurveysCsv(summary.rows);
        return apiCsvResponse(req, `psyconnect-panas-anonimo-${new Date().toISOString().slice(0, 10)}.csv`, csv);
      });
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
        hmr: true,
        console: true,
      },
    });

    console.log(`🚀 Server running at ${server.url}`);
    break;
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code !== "EADDRINUSE" || attempt === maxPortAttempts - 1) {
      throw error;
    }
    console.warn(`Port ${port} está em uso. Tentando ${port + 1}...`);
  }
}
