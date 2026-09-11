import { useEffect, useMemo, useState, type FormEvent } from "react";
import "./index.css";
import type { CommunityGroup, Conversation, FeedPost as CommunityFeedPost } from "./types";
import { categories, professionals } from "./data";
import {
  addGroupPostRequest,
  createGroupRequest,
  fetchChallengeDays,
  fetchConversations,
  fetchGroupPosts,
  fetchGroups,
  sendConversationMessageRequest,
  toggleChallengeDayRequest,
  toggleGroupJoinRequest,
} from "./api";
import { GroupsScreen } from "./GroupsScreen";
import { GroupDetailModal } from "./GroupDetailModal";
import { GroupCreateModal } from "./GroupCreateModal";
import { MessagesScreen } from "./MessagesScreen";
import { AuthGate, type CurrentUser } from "./AuthGate";

type Screen = "home" | "specialists" | "booking" | "groups" | "messages";

type Expert = {
  id: number;
  name: string;
  role: string;
  specialty: string;
  experience: string;
  price: string;
  availability: string;
  description: string;
  accent: string;
};

type FormState = {
  name: string;
  email: string;
  reason: string;
  preference: string;
};

type GoalGroup = {
  id: string;
  label: string;
  description: string;
  accent: string;
};

type FeedPost = {
  id: number;
  author: string;
  handle: string;
  group: string;
  body: string;
  time: string;
  likes: string;
  comments: string;
};

const experts: Expert[] = [
  {
    id: 1,
    name: "Dra. Camila Nogueira",
    role: "Psicóloga clínica",
    specialty: "Ansiedade e burnout",
    experience: "10 anos",
    price: "R$ 180",
    availability: "Hoje • 16:00",
    description: "Especialista em atendimento humanizado para adultos que precisam reorganizar o ritmo da vida e recuperar o equilíbrio emocional.",
    accent: "#7c3aed",
  },
  {
    id: 2,
    name: "Dr. João Pereira",
    role: "Psicoterapeuta",
    specialty: "Relacionamentos",
    experience: "8 anos",
    price: "R$ 160",
    availability: "Amanhã • 09:30",
    description: "Acompanha casais e indivíduos em processos de comunicação, limites, autoestima e reconexão emocional.",
    accent: "#0f766e",
  },
  {
    id: 3,
    name: "Dra. Lívia Andrade",
    role: "Neuropsicóloga",
    specialty: "Autoconhecimento",
    experience: "12 anos",
    price: "R$ 200",
    availability: "Quarta • 14:00",
    description: "Trabalha com estratégias práticas para aumentar clareza mental, foco e bem-estar no cotidiano.",
    accent: "#be123c",
  },
];

const groups: GoalGroup[] = [
  { id: "all", label: "Todos", description: "Explore tudo", accent: "#4f46e5" },
  { id: "ansiedade", label: "Ansiedade", description: "Respiração e calma", accent: "#8b5cf6" },
  { id: "autoconhecimento", label: "Autoconhecimento", description: "Entender seu ritmo", accent: "#0f766e" },
  { id: "relacionamentos", label: "Relacionamentos", description: "Límites e comunicação", accent: "#db2777" },
  { id: "sono", label: "Sono", description: "Descanso e recuperação", accent: "#f59e0b" },
];

// Cidades usadas para demonstrar a recomendação por localização sem depender
// de o navegador conceder permissão de GPS ao vivo durante a apresentação.
const demoLocations = [
  { id: "salvador", label: "Salvador, BA", lat: -12.9777, lng: -38.5016 },
  { id: "recife", label: "Recife, PE", lat: -8.0476, lng: -34.877 },
  { id: "sao-paulo", label: "São Paulo, SP", lat: -23.5505, lng: -46.6333 },
  { id: "rio-de-janeiro", label: "Rio de Janeiro, RJ", lat: -22.9068, lng: -43.1729 },
  { id: "fortaleza", label: "Fortaleza, CE", lat: -3.7319, lng: -38.5267 },
];

const feedPosts: FeedPost[] = [
  {
    id: 1,
    author: "Maya",
    handle: "@maya",
    group: "ansiedade",
    body: "Hoje eu aprendi que não preciso resolver tudo de uma vez. Um passo de cada vez já é progresso.",
    time: "10 min",
    likes: "312",
    comments: "19",
  },
  {
    id: 2,
    author: "Léo",
    handle: "@leo",
    group: "autoconhecimento",
    body: "Identificar o que me esgota tem sido mais útil do que tentar aguentar tudo em silêncio.",
    time: "25 min",
    likes: "188",
    comments: "11",
  },
  {
    id: 3,
    author: "Clara",
    handle: "@clara",
    group: "relacionamentos",
    body: "Estabelecer limites não é frieza, é cuidado. Estou aprendendo a me respeitar mais.",
    time: "1 h",
    likes: "244",
    comments: "27",
  },
  {
    id: 4,
    author: "Ravi",
    handle: "@ravi",
    group: "sono",
    body: "Minha rotina de descanso ficou bem mais leve quando reduzi telas antes de dormir.",
    time: "2 h",
    likes: "95",
    comments: "6",
  },
];

const initialExpert: Expert = experts[0] ?? experts[1] ?? experts[2];

// Gera uma distância "simulada" mas estável (o mesmo grupo sempre calcula a
// mesma distância enquanto a localização do usuário não mudar).
function simulatedDistanceKm(seed: string, lat: number, lng: number) {
  const base = `${seed}-${lat.toFixed(2)}-${lng.toFixed(2)}`;
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = (hash * 31 + base.charCodeAt(i)) >>> 0;
  }
  return Number((0.4 + (hash % 940) / 100).toFixed(1));
}

export function App() {
  const [activeScreen, setActiveScreen] = useState<Screen>("home");
  const [selectedExpert, setSelectedExpert] = useState<Expert>(initialExpert);
  const [activeGroup, setActiveGroup] = useState("all");
  const [isBooked, setIsBooked] = useState(false);
  const [formData, setFormData] = useState<FormState>({
    name: "",
    email: "",
    reason: "",
    preference: "Online",
  });

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = window.localStorage.getItem("psyconect_user");
    return stored ? (JSON.parse(stored) as CurrentUser) : null;
  });

  const handleLogin = (user: CurrentUser) => {
    window.localStorage.setItem("psyconect_user", JSON.stringify(user));
    setCurrentUser(user);
  };

  // Comunidade / grupos (carregados da API)
  const [communityGroups, setCommunityGroups] = useState<CommunityGroup[]>([]);
  const [postsByGroup, setPostsByGroup] = useState<Record<string, CommunityFeedPost[]>>({});
  const [completedDaysByGroup, setCompletedDaysByGroup] = useState<Record<string, number[]>>({});
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [groupsError, setGroupsError] = useState("");

  // Mensagens (carregadas da API)
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number>(0);

  // Recomendação por localização (demonstração controlável)
  const [selectedLocationId, setSelectedLocationId] = useState(demoLocations[0].id);
  const [useRealLocation, setUseRealLocation] = useState(false);
  const [realLocation, setRealLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "granted" | "denied">("idle");

  const handleUseRealLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus("denied");
      return;
    }
    setLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(
      position => {
        setRealLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setUseRealLocation(true);
        setLocationStatus("granted");
      },
      () => setLocationStatus("denied"),
      { timeout: 8000 },
    );
  };

  const effectiveLocation =
    useRealLocation && realLocation
      ? realLocation
      : (demoLocations.find(location => location.id === selectedLocationId) ?? demoLocations[0]);

  useEffect(() => {
    if (!currentUser) return;

    fetchGroups()
      .then(groups => {
        setCommunityGroups(groups);
        setIsLoadingGroups(false);
      })
      .catch(error => {
        setGroupsError(String(error.message ?? error));
        setIsLoadingGroups(false);
      });

    fetchConversations()
      .then(loaded => {
        setConversations(loaded);
        setActiveConversationId(loaded[0]?.id ?? 0);
      })
      .catch(() => {
        /* mensagens ficam vazias se a API falhar */
      });
  }, [currentUser]);

  const handleToggleGroupJoin = async (groupId: string) => {
    setCommunityGroups(current =>
      current.map(group =>
        group.id === groupId
          ? { ...group, joined: !group.joined, members: group.joined ? group.members - 1 : group.members + 1 }
          : group,
      ),
    );
    try {
      await toggleGroupJoinRequest(groupId);
    } catch (error) {
      // reverte se a API falhar
      setCommunityGroups(current =>
        current.map(group =>
          group.id === groupId
            ? { ...group, joined: !group.joined, members: group.joined ? group.members - 1 : group.members + 1 }
            : group,
        ),
      );
    }
  };

  const handleOpenGroupDetail = async (groupId: string) => {
    setSelectedGroupId(groupId);
    if (!postsByGroup[groupId]) {
      fetchGroupPosts(groupId)
        .then(posts => setPostsByGroup(current => ({ ...current, [groupId]: posts })))
        .catch(() => setPostsByGroup(current => ({ ...current, [groupId]: [] })));
    }
    if (!completedDaysByGroup[groupId]) {
      fetchChallengeDays(groupId)
        .then(days => setCompletedDaysByGroup(current => ({ ...current, [groupId]: days })))
        .catch(() => {});
    }
  };

  const handleToggleChallengeDay = async (groupId: string, day: number) => {
    setCompletedDaysByGroup(current => {
      const done = current[groupId] ?? [];
      const nextDone = done.includes(day) ? done.filter(existing => existing !== day) : [...done, day].sort((a, b) => a - b);
      return { ...current, [groupId]: nextDone };
    });
    try {
      const days = await toggleChallengeDayRequest(groupId, day);
      setCompletedDaysByGroup(current => ({ ...current, [groupId]: days }));
    } catch (error) {
      // mantém o estado otimista se a API falhar
    }
  };

  const handleAddGroupPost = async (groupId: string, body: string) => {
    const optimisticPost: CommunityFeedPost = {
      id: `temp-${Date.now()}`,
      author: currentUser?.name ?? "Você",
      handle: "@voce",
      group: groupId,
      body,
      time: "agora",
      likes: 0,
      comments: 0,
    };
    setPostsByGroup(current => ({ ...current, [groupId]: [optimisticPost, ...(current[groupId] ?? [])] }));
    try {
      const posts = await addGroupPostRequest(groupId, body);
      setPostsByGroup(current => ({ ...current, [groupId]: posts }));
    } catch (error) {
      // mantém o post otimista se a API falhar
    }
  };

  const handleCreateGroup = async (group: CommunityGroup) => {
    setCommunityGroups(current => [group, ...current]);
    setPostsByGroup(current => ({ ...current, [group.id]: [] }));
    setIsCreateGroupOpen(false);
    try {
      const groups = await createGroupRequest(group);
      setCommunityGroups(groups);
    } catch (error) {
      // mantém o grupo otimista se a API falhar
    }
  };

  const handleSendConversationMessage = async (conversationId: number, text: string) => {
    setConversations(current =>
      current.map(conversation =>
        conversation.id === conversationId
          ? {
              ...conversation,
              messages: [
                ...conversation.messages,
                { id: conversation.messages.length + 1, sender: "me", text, time: "agora" },
              ],
            }
          : conversation,
      ),
    );
    try {
      const updated = await sendConversationMessageRequest(conversationId, text);
      setConversations(current => current.map(conversation => (conversation.id === conversationId ? updated : conversation)));
    } catch (error) {
      // mantém a mensagem otimista se a API falhar
    }
  };

  const selectedGroup = communityGroups.find(group => group.id === selectedGroupId);

  const suggestedGroups = useMemo(() => {
    const joinedThemes = new Set(communityGroups.filter(group => group.joined).map(group => group.theme));
    return communityGroups
      .filter(group => !group.joined)
      .sort((a, b) => {
        const aMatches = joinedThemes.has(a.theme) ? 1 : 0;
        const bMatches = joinedThemes.has(b.theme) ? 1 : 0;
        return bMatches - aMatches || b.members - a.members;
      })
      .slice(0, 3);
  }, [communityGroups]);

  const nearbyGroups = useMemo(() => {
    return communityGroups
      .map(group => ({ group, distance: simulatedDistanceKm(group.id, effectiveLocation.lat, effectiveLocation.lng) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);
  }, [communityGroups, effectiveLocation]);

  const handleBooking = (expert: Expert) => {
    setSelectedExpert(expert);
    setIsBooked(false);
    setActiveScreen("booking");
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setIsBooked(true);
  };

  const visiblePosts = useMemo(() => {
    if (activeGroup === "all") return feedPosts;
    return feedPosts.filter(post => post.group === activeGroup);
  }, [activeGroup]);

  if (!currentUser) {
    return <AuthGate onLogin={handleLogin} />;
  }

  const handleLogout = () => {
    window.localStorage.removeItem("psyconect_user");
    setCurrentUser(null);
    setActiveScreen("home");
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="brand-mark">PsyConect</p>
          <span className="brand-subtitle">Saúde mental com acolhimento e clareza</span>
        </div>
        <nav className="nav-links" aria-label="Navegação principal">
          <button type="button" className={activeScreen === "home" ? "nav-link active" : "nav-link"} onClick={() => setActiveScreen("home")}>
            Início
          </button>
          <button type="button" className={activeScreen === "specialists" ? "nav-link active" : "nav-link"} onClick={() => setActiveScreen("specialists")}>
            Especialistas
          </button>
          <button type="button" className={activeScreen === "booking" ? "nav-link active" : "nav-link"} onClick={() => setActiveScreen("booking")}>
            Agendamento
          </button>
          <button type="button" className={activeScreen === "groups" ? "nav-link active" : "nav-link"} onClick={() => setActiveScreen("groups")}>
            Grupos
          </button>
          <button type="button" className={activeScreen === "messages" ? "nav-link active" : "nav-link"} onClick={() => setActiveScreen("messages")}>
            Mensagens
          </button>
        </nav>
        <div className="topbar-user">
          <span className="topbar-greeting">Olá, {currentUser.name.split(" ")[0]}</span>
          <button type="button" className="secondary-btn" onClick={handleLogout}>
            Sair
          </button>
        </div>
      </header>

      {activeScreen === "home" && (
        <main className="screen feed-layout">
          <section className="feed-main">
            <div className="composer-card">
              <div className="composer-top">
                <div className="avatar avatar-large">P</div>
                <div>
                  <h2>O que você quer cuidar hoje?</h2>
                  <p>Explore grupos de apoio e encontre uma trilha que faça sentido para você.</p>
                </div>
              </div>
              <div className="group-chips" role="tablist" aria-label="Grupos de apoio">
                {groups.map(group => (
                  <button
                    key={group.id}
                    type="button"
                    className={activeGroup === group.id ? "group-chip active" : "group-chip"}
                    onClick={() => setActiveGroup(group.id)}
                  >
                    <span className="chip-dot" style={{ backgroundColor: group.accent }} />
                    {group.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="feed-list">
              {visiblePosts.map(post => (
                <article key={post.id} className="feed-card">
                  <div className="feed-card-top">
                    <div className="avatar">{post.author.charAt(0)}</div>
                    <div>
                      <div className="feed-author-row">
                        <strong>{post.author}</strong>
                        <span>{post.handle}</span>
                        <span>•</span>
                        <span>{post.time}</span>
                      </div>
                      <p className="feed-group">{groups.find(group => group.id === post.group)?.label}</p>
                    </div>
                  </div>
                  <p className="feed-body">{post.body}</p>
                  <div className="feed-actions">
                    <span>♡ {post.likes}</span>
                    <span>💬 {post.comments}</span>
                    <button type="button" className="text-link" onClick={() => setActiveScreen("specialists")}>
                      Encontrar apoio
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="feed-sidebar">
            <div className="insight-card">
              <p className="eyebrow">Hoje</p>
              <h3>Seu foco recomendado</h3>
              <p>Respirar, reduzir excesso de estímulos e reservar espaço para o que te faz bem.</p>
              <button type="button" className="primary-btn full-width" onClick={() => setActiveScreen("booking")}>
                Agendar sessão
              </button>
            </div>
            <div className="insight-card">
              <p className="eyebrow">Comunidade</p>
              <h3>Grupos mais ativos</h3>
              <ul className="sidebar-list">
                <li>Ansiedade • 2.4k conversas</li>
                <li>Autoconhecimento • 1.8k conversas</li>
                <li>Relacionamentos • 1.2k conversas</li>
              </ul>
            </div>
            <div className="insight-card">
              <p className="eyebrow">Sugeridos pra você</p>
              <h3>Baseado nos grupos que você participa</h3>
              {suggestedGroups.length === 0 ? (
                <p>Participe de um grupo em "Grupos" para receber sugestões personalizadas.</p>
              ) : (
                <ul className="suggested-group-list">
                  {suggestedGroups.map(group => (
                    <li key={group.id}>
                      <button
                        type="button"
                        className="suggested-group-item"
                        onClick={() => {
                          setActiveScreen("groups");
                          handleOpenGroupDetail(group.id);
                        }}
                      >
                        <span className="chip-dot" style={{ backgroundColor: group.accent }} />
                        <span>
                          <strong>{group.name}</strong>
                          <span className="suggested-group-meta">
                            {categories.find(category => category.id === group.theme)?.label} · {group.members.toLocaleString("pt-BR")} participantes
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="insight-card">
              <p className="eyebrow">📍 Perto de você</p>
              <h3>Grupos recomendados pela sua localização</h3>

              <label className="location-picker">
                <span>Localização</span>
                <select
                  value={useRealLocation ? "real" : selectedLocationId}
                  onChange={event => {
                    if (event.target.value === "real") {
                      handleUseRealLocation();
                    } else {
                      setUseRealLocation(false);
                      setSelectedLocationId(event.target.value);
                    }
                  }}
                >
                  {demoLocations.map(location => (
                    <option key={location.id} value={location.id}>
                      {location.label}
                    </option>
                  ))}
                  <option value="real">Usar minha localização atual</option>
                </select>
              </label>

              {locationStatus === "loading" && <p className="location-status">Localizando você...</p>}
              {locationStatus === "denied" && (
                <p className="location-status">
                  Não foi possível acessar sua localização, mostrando resultados para{" "}
                  {demoLocations.find(location => location.id === selectedLocationId)?.label}.
                </p>
              )}

              <ul className="nearby-group-list">
                {nearbyGroups.map(({ group, distance }) => (
                  <li key={group.id} className="nearby-group-item">
                    <span className="nearby-pin" style={{ backgroundColor: group.accent }} />
                    <div>
                      <strong>{group.name}</strong>
                      <span className="nearby-distance">{distance} km de você</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </main>
      )}

      {activeScreen === "specialists" && (
        <main className="screen">
          <section className="section-heading">
            <div>
              <p className="eyebrow">Especialistas disponíveis</p>
              <h2>Escolha o profissional ideal para você.</h2>
            </div>
            <button type="button" className="secondary-btn" onClick={() => setActiveScreen("booking")}>
              Ir para agendamento
            </button>
          </section>

          <div className="expert-grid">
            {experts.map(expert => (
              <article key={expert.id} className="expert-card">
                <div className="expert-top">
                  <div className="avatar" style={{ backgroundColor: expert.accent }}>
                    {expert.name.charAt(0)}
                  </div>
                  <div>
                    <h3>{expert.name}</h3>
                    <p>{expert.role}</p>
                  </div>
                </div>
                <p className="expert-specialty">{expert.specialty}</p>
                <p className="expert-description">{expert.description}</p>
                <div className="expert-meta">
                  <span>Experiência: {expert.experience}</span>
                  <span>{expert.price}</span>
                </div>
                <div className="expert-footer">
                  <span>{expert.availability}</span>
                  <button type="button" className="primary-btn small" onClick={() => handleBooking(expert)}>
                    Agendar
                  </button>
                </div>
              </article>
            ))}
          </div>
        </main>
      )}

      {activeScreen === "booking" && (
        <main className="screen booking-layout">
          <section className="booking-summary">
            <p className="eyebrow">Agendamento</p>
            <h2>Reserve sua sessão com {selectedExpert.name}</h2>
            <p>{selectedExpert.description}</p>
            <div className="summary-card">
              <div>
                <strong>Especialidade</strong>
                <p>{selectedExpert.specialty}</p>
              </div>
              <div>
                <strong>Valor</strong>
                <p>{selectedExpert.price}</p>
              </div>
            </div>
            <div className="availability-list">
              {[
                "Hoje • 16:00",
                "Hoje • 18:30",
                "Amanhã • 09:30",
                "Quarta • 14:00",
              ].map(slot => (
                <button key={slot} type="button" className="availability-btn">
                  {slot}
                </button>
              ))}
            </div>
          </section>

          <section className="booking-form-card">
            <h3>Dados para o atendimento</h3>
            <form onSubmit={handleSubmit} className="booking-form">
              <label>
                Nome
                <input
                  type="text"
                  value={formData.name}
                  onChange={event => setFormData({ ...formData, name: event.target.value })}
                  placeholder="Seu nome"
                  required
                />
              </label>
              <label>
                E-mail
                <input
                  type="email"
                  value={formData.email}
                  onChange={event => setFormData({ ...formData, email: event.target.value })}
                  placeholder="seu@email.com"
                  required
                />
              </label>
              <label>
                Motivo da sessão
                <textarea
                  value={formData.reason}
                  onChange={event => setFormData({ ...formData, reason: event.target.value })}
                  placeholder="Conte em poucas palavras o que você gostaria de trabalhar"
                  rows={4}
                  required
                />
              </label>
              <label>
                Preferência
                <select
                  value={formData.preference}
                  onChange={event => setFormData({ ...formData, preference: event.target.value })}
                >
                  <option value="Online">Online</option>
                  <option value="Presencial">Presencial</option>
                </select>
              </label>
              <button type="submit" className="primary-btn full-width">
                Confirmar agendamento
              </button>
            </form>
            {isBooked && (
              <div className="success-box">
                <strong>Agendamento confirmado!</strong>
                <p>Você receberá um e-mail com o link da sessão e detalhes da consulta.</p>
              </div>
            )}
          </section>
        </main>
      )}

      {activeScreen === "groups" && isLoadingGroups && (
        <main className="screen">
          <p className="empty-state">Carregando grupos...</p>
        </main>
      )}

      {activeScreen === "groups" && !isLoadingGroups && groupsError && (
        <main className="screen">
          <p className="empty-state">Não foi possível carregar os grupos agora ({groupsError}).</p>
        </main>
      )}

      {activeScreen === "groups" && !isLoadingGroups && !groupsError && (
        <GroupsScreen
          groups={communityGroups}
          categories={categories}
          professionals={professionals}
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
          onToggleJoin={handleToggleGroupJoin}
          onOpenDetail={handleOpenGroupDetail}
          onOpenCreate={() => setIsCreateGroupOpen(true)}
        />
      )}

      {activeScreen === "messages" && (
        <MessagesScreen
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={setActiveConversationId}
          onSendMessage={handleSendConversationMessage}
        />
      )}

      {selectedGroup && (
        <GroupDetailModal
          group={selectedGroup}
          admin={professionals.find(professional => professional.id === selectedGroup.adminId)}
          category={categories.find(category => category.id === selectedGroup.theme)}
          posts={postsByGroup[selectedGroup.id] ?? []}
          completedDays={completedDaysByGroup[selectedGroup.id] ?? []}
          onToggleDay={handleToggleChallengeDay}
          onToggleJoin={handleToggleGroupJoin}
          onAddPost={handleAddGroupPost}
          onClose={() => setSelectedGroupId(null)}
        />
      )}

      {isCreateGroupOpen && (
        <GroupCreateModal
          categories={categories}
          professionals={professionals}
          onCreate={handleCreateGroup}
          onClose={() => setIsCreateGroupOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
