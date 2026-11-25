import { useEffect, useState } from "react";
import type { AvailabilitySlot, CommunityGroup, CurrentUser, ProBooking, ProChat } from "./types";
import {
  addProSlotRequest,
  fetchGroups,
  fetchProAvailability,
  fetchProBookings,
  fetchProChats,
  proCancelBookingRequest,
  proRescheduleBookingRequest,
  removeProSlotRequest,
  sendProMessageRequest,
} from "./api";
import { usePolling } from "./usePolling";
import { ProAgenda } from "./ProAgenda";
import { ProGroups } from "./ProGroups";
import { ProInbox } from "./ProInbox";
import { ProfileScreen } from "./ProfileScreen";

type ProAppProps = {
  user: CurrentUser;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onUserUpdated: (user: CurrentUser) => void;
  onLogout: () => void;
};

type ProTab = "overview" | "agenda" | "groups" | "messages" | "profile";

function keepIfSame<T>(current: T, next: T): T {
  return JSON.stringify(current) === JSON.stringify(next) ? current : next;
}

function needsReply(chat: ProChat) {
  return chat.messages.at(-1)?.sender === "them";
}

export function ProApp({ user, theme, onToggleTheme, onUserUpdated, onLogout }: Readonly<ProAppProps>) {
  const pro = user.professional;

  const [tab, setTab] = useState<ProTab>("overview");
  const [bookings, setBookings] = useState<ProBooking[]>([]);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [chats, setChats] = useState<ProChat[]>([]);
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [activeChatId, setActiveChatId] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = async () => {
    const [loadedBookings, loadedAvailability, loadedChats, loadedGroups] = await Promise.all([
      fetchProBookings(),
      fetchProAvailability(),
      fetchProChats(),
      fetchGroups(),
    ]);
    setBookings(current => keepIfSame(current, loadedBookings));
    setAvailability(current => keepIfSame(current, loadedAvailability));
    setChats(current => keepIfSame(current, loadedChats));
    setGroups(current => keepIfSame(current, loadedGroups));
  };

  const initialLoad = () => {
    setLoading(true);
    setError("");
    refresh()
      .catch(err => setError(err instanceof Error ? err.message : "Não foi possível carregar o painel agora."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    initialLoad();
  }, [user.id]);

  usePolling(true, 4000, refresh);

  const myGroups = groups.filter(group => group.adminId === user.id);
  const upcoming = bookings.filter(booking => booking.status !== "canceled");
  const waiting = chats.filter(needsReply);
  const participants = myGroups.reduce((sum, group) => sum + group.members, 0);
  const selectedChatId = chats.some(chat => chat.id === activeChatId) ? activeChatId : (chats[0]?.id ?? 0);

  const failure = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

  const handleAddSlot = async (slotLabel: string, startsAt?: string | null): Promise<string | null> => {
    try {
      setAvailability(await addProSlotRequest(slotLabel, startsAt));
      return null;
    } catch (err) {
      return failure(err, "Não foi possível abrir o horário.");
    }
  };

  const handleRemoveSlot = async (slotId: string): Promise<string | null> => {
    try {
      setAvailability(await removeProSlotRequest(slotId));
      return null;
    } catch (err) {
      return failure(err, "Não foi possível remover o horário.");
    }
  };

  const handleCancel = async (id: string): Promise<string | null> => {
    try {
      setBookings(await proCancelBookingRequest(id));
      setAvailability(await fetchProAvailability());
      return null;
    } catch (err) {
      return failure(err, "Não foi possível cancelar a sessão.");
    }
  };

  const handleReschedule = async (id: string, slot: string): Promise<string | null> => {
    try {
      setBookings(await proRescheduleBookingRequest(id, slot));
      setAvailability(await fetchProAvailability());
      return null;
    } catch (err) {
      return failure(err, "Não foi possível remarcar a sessão.");
    }
  };

  const handleSend = async (chatId: number, text: string): Promise<string | null> => {
    try {
      setChats(await sendProMessageRequest(chatId, text));
      return null;
    } catch (err) {
      return failure(err, "Não foi possível enviar a mensagem.");
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
          <p className="brand-mark">PsyConnect · Profissional</p>
          <span className="brand-subtitle">
            {pro ? `${pro.roleTitle} · ${pro.specialty}` : "Profissional"}
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
          <button type="button" className={tab === "profile" ? "nav-link active" : "nav-link"} onClick={() => setTab("profile")}>
            Perfil
          </button>
        </nav>
        <div className="topbar-user">
          <span className="topbar-greeting">Olá, {user.name.split(" ")[0]}</span>
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
          <div className="empty-state network-error-box">
            <p>{error}</p>
            <button type="button" className="primary-btn small" onClick={initialLoad}>
              Tentar de novo
            </button>
          </div>
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
              <strong>{availability.filter(s => !s.booked).length}</strong>
              <span>horários livres</span>
            </div>
            <div className="stat-tile">
              <strong>{waiting.length}</strong>
              <span>mensagens sem resposta</span>
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
        <ProAgenda
          bookings={bookings}
          availability={availability}
          onAddSlot={handleAddSlot}
          onRemoveSlot={handleRemoveSlot}
          onCancel={handleCancel}
          onReschedule={handleReschedule}
        />
      )}

      {!loading && !error && tab === "groups" && <ProGroups groups={myGroups} currentUserId={user.id} />}

      {!loading && !error && tab === "messages" && (
        <ProInbox chats={chats} activeChatId={selectedChatId} onSelect={setActiveChatId} onSend={handleSend} />
      )}

      {!loading && !error && tab === "profile" && (
        <ProfileScreen
          user={user}
          theme={theme}
          onToggleTheme={onToggleTheme}
          onUserUpdated={onUserUpdated}
          onLogout={onLogout}
        />
      )}
    </div>
  );
}
