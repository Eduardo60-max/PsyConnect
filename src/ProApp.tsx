import { useEffect, useState } from "react";
import type { CommunityGroup, ProBooking, ProChat } from "./types";
import type { CurrentUser } from "./AuthGate";
import { professionals } from "./data";
import {
  fetchGroups,
  fetchProBookings,
  fetchProChats,
  proCancelBookingRequest,
  proRescheduleBookingRequest,
  sendProMessageRequest,
  setProAutoRequest,
} from "./api";
import { usePolling } from "./usePolling";
import { ProAgenda } from "./ProAgenda";
import { ProGroups } from "./ProGroups";
import { ProInbox } from "./ProInbox";

type ProAppProps = {
  user: CurrentUser;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onLogout: () => void;
};

type ProTab = "overview" | "agenda" | "groups" | "messages";

const SLOTS = ["Hoje • 16:00", "Hoje • 18:30", "Amanhã • 09:30", "Quarta • 14:00"];

function keepIfSame<T>(current: T, next: T): T {
  return JSON.stringify(current) === JSON.stringify(next) ? current : next;
}

function needsReply(chat: ProChat) {
  return chat.messages.at(-1)?.sender === "them";
}

export function ProApp({ user, theme, onToggleTheme, onLogout }: Readonly<ProAppProps>) {
  const proId = user.proId ?? "";
  const pro = professionals.find(item => item.id === proId);

  const [tab, setTab] = useState<ProTab>("overview");
  const [bookings, setBookings] = useState<ProBooking[]>([]);
  const [chats, setChats] = useState<ProChat[]>([]);
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [activeChatId, setActiveChatId] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [typingIds, setTypingIds] = useState<number[]>([]);

  const refresh = async () => {
    const [loadedBookings, loadedChats, loadedGroups] = await Promise.all([
      fetchProBookings(proId),
      fetchProChats(proId),
      fetchGroups(),
    ]);
    setBookings(current => keepIfSame(current, loadedBookings));
    setChats(current => keepIfSame(current, loadedChats));
    setGroups(current => keepIfSame(current, loadedGroups));
  };

  useEffect(() => {
    setLoading(true);
    refresh()
      .then(() => setError(""))
      .catch(() => setError("Não foi possível carregar o painel agora."))
      .finally(() => setLoading(false));
  }, [proId]);

  usePolling(true, 4000, refresh);

  const myGroups = groups.filter(group => group.adminId === proId);
  const upcoming = bookings.filter(booking => booking.status !== "canceled");
  const waiting = chats.filter(needsReply);
  const participants = myGroups.reduce((sum, group) => sum + group.members, 0);
  const selectedChatId = chats.some(chat => chat.id === activeChatId) ? activeChatId : (chats[0]?.id ?? 0);

  const failure = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

  const handleCancel = async (id: string): Promise<string | null> => {
    try {
      setBookings(await proCancelBookingRequest(proId, id));
      return null;
    } catch (err) {
      return failure(err, "Não foi possível cancelar a sessão.");
    }
  };

  const handleReschedule = async (id: string, slot: string): Promise<string | null> => {
    try {
      setBookings(await proRescheduleBookingRequest(proId, id, slot));
      return null;
    } catch (err) {
      return failure(err, "Não foi possível remarcar a sessão.");
    }
  };

    const handleSend = async (chatId: number, text: string): Promise<string | null> => {
    try {
      const result = await sendProMessageRequest(proId, chatId, text);
      setChats(result.chats);

      if (result.replyDelayMs !== null) {
        setTypingIds(current => (current.includes(chatId) ? current : [...current, chatId]));
        window.setTimeout(async () => {
          try {
            setChats(await fetchProChats(proId));
          } catch {
            // o próximo ciclo de atualização busca de novo
          }
          setTypingIds(current => current.filter(id => id !== chatId));
        }, result.replyDelayMs + 400);
      }
      return null;
    } catch (err) {
      return failure(err, "Não foi possível enviar a mensagem.");
    }
  };

  const handleToggleAuto = async (chatId: number, enabled: boolean): Promise<string | null> => {
    try {
      setChats(await setProAutoRequest(proId, chatId, enabled));
      return null;
    } catch (err) {
      return failure(err, "Não foi possível alterar a resposta automática.");
    }
  };

  const openChat = (chatId: number) => {
    setActiveChatId(chatId);
    setTab("messages");
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="brand-mark">PsyConect · Painel do profissional</p>
          <span className="brand-subtitle">
            {pro ? `${pro.role} · ${pro.specialty}` : "Profissional"}
          </span>
        </div>
        <nav className="nav-links" aria-label="Navegação do painel">
          <button type="button" className={tab === "overview" ? "nav-link active" : "nav-link"} onClick={() => setTab("overview")}>
            Resumo
          </button>
          <button type="button" className={tab === "agenda" ? "nav-link active" : "nav-link"} onClick={() => setTab("agenda")}>
            Agenda
            {upcoming.length > 0 && <span className="nav-badge">{upcoming.length}</span>}
          </button>
          <button type="button" className={tab === "groups" ? "nav-link active" : "nav-link"} onClick={() => setTab("groups")}>
            Grupos
          </button>
          <button type="button" className={tab === "messages" ? "nav-link active" : "nav-link"} onClick={() => setTab("messages")}>
            Mensagens
            {waiting.length > 0 && <span className="nav-badge">{waiting.length}</span>}
          </button>
        </nav>
        <div className="topbar-user">
          <span className="topbar-greeting">Olá, {user.name}</span>
          <button
            type="button"
            className="theme-toggle"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
            title={theme === "dark" ? "Tema claro" : "Tema escuro"}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <button type="button" className="secondary-btn" onClick={onLogout}>
            Sair
          </button>
        </div>
      </header>

      {loading && (
        <main className="screen">
          <p className="empty-state">Carregando o painel...</p>
        </main>
      )}

      {!loading && error && (
        <main className="screen">
          <p className="empty-state">{error}</p>
        </main>
      )}

      {!loading && !error && tab === "overview" && (
        <main className="screen pro-overview">
          <section className="section-heading">
            <div>
              <p className="eyebrow">Resumo</p>
              <h2>Bom ver você, {user.name}.</h2>
            </div>
          </section>

          <div className="stats-grid">
            <div className="stat-tile">
              <strong>{upcoming.length}</strong>
              <span>sessões marcadas</span>
            </div>
            <div className="stat-tile">
              <strong>{waiting.length}</strong>
              <span>mensagens sem resposta</span>
            </div>
            <div className="stat-tile">
              <strong>{myGroups.length}</strong>
              <span>grupos que administra</span>
            </div>
            <div className="stat-tile">
              <strong>{participants.toLocaleString("pt-BR")}</strong>
              <span>participantes nos grupos</span>
            </div>
          </div>

          <div className="pro-overview-grid">
            <div className="insight-card">
              <p className="eyebrow">Próximas sessões</p>
              {upcoming.length === 0 ? (
                <p>Nenhuma sessão marcada por enquanto.</p>
              ) : (
                <ul className="suggested-group-list">
                  {upcoming.slice(0, 4).map(booking => (
                    <li key={booking.id} className="pro-line">
                      <strong>{booking.patientName || "Paciente"}</strong>
                      <span className="suggested-group-meta">
                        🕒 {booking.slot} · {booking.preference}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className="secondary-btn full-width" onClick={() => setTab("agenda")}>
                Abrir agenda
              </button>
            </div>

            <div className="insight-card">
              <p className="eyebrow">Aguardando resposta</p>
              {waiting.length === 0 ? (
                <p>Você está em dia com as mensagens. 💜</p>
              ) : (
                <ul className="suggested-group-list">
                  {waiting.slice(0, 4).map(chat => (
                    <li key={chat.id}>
                      <button type="button" className="suggested-group-item" onClick={() => openChat(chat.id)}>
                        <span>
                          <strong>{chat.name}</strong>
                          <span className="suggested-group-meta pro-preview">{chat.messages.at(-1)?.text}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className="secondary-btn full-width" onClick={() => setTab("messages")}>
                Abrir mensagens
              </button>
            </div>

            <div className="insight-card">
              <p className="eyebrow">Meus grupos</p>
              {myGroups.length === 0 ? (
                <p>Você ainda não administra nenhum grupo.</p>
              ) : (
                <ul className="suggested-group-list">
                  {myGroups.map(group => (
                    <li key={group.id} className="pro-line">
                      <strong>{group.name}</strong>
                      <span className="suggested-group-meta">{group.members.toLocaleString("pt-BR")} participantes</span>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className="secondary-btn full-width" onClick={() => setTab("groups")}>
                Gerenciar grupos
              </button>
            </div>
          </div>
        </main>
      )}

      {!loading && !error && tab === "agenda" && (
        <ProAgenda bookings={bookings} slots={SLOTS} onCancel={handleCancel} onReschedule={handleReschedule} />
      )}

      {!loading && !error && tab === "groups" && <ProGroups groups={myGroups} proName={user.name} />}

      {!loading && !error && tab === "messages" && (
        <ProInbox
          chats={chats}
          activeChatId={selectedChatId}
          onSelect={setActiveChatId}
          onSend={handleSend}
          onToggleAuto={handleToggleAuto}
          typingIds={typingIds}
        />
      )}
    </div>
  );
}