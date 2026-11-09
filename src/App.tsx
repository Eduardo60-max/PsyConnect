import { useEffect, useMemo, useRef, useState, type ReactNode, type SyntheticEvent } from "react";
import "./index.css";
import type { Booking, CommunityGroup, Conversation, FeedPost as CommunityFeedPost } from "./types";
import { categories, professionals } from "./data";
import {
  addGroupPostRequest,
  cancelBookingRequest,
  createBookingRequest,
  createGroupRequest,
  fetchBookings,
  fetchChallengeDays,
  fetchConversations,
  fetchGroupPosts,
  fetchGroups,
  rescheduleBookingRequest,
  sendConversationMessageRequest,
  setApiUser,
  toggleChallengeDayRequest,
  toggleGroupJoinRequest,
  togglePostLikeRequest,
} from "./api";
import { GroupsScreen } from "./GroupsScreen";
import { GroupDetailModal } from "./GroupDetailModal";
import { GroupCreateModal } from "./GroupCreateModal";
import { GroupRoom } from "./GroupRoom";
import { MessagesScreen } from "./MessagesScreen";
import { MyBookings } from "./MyBookings";
import { AuthGate, type CurrentUser } from "./AuthGate";
import { CrisisNotice } from "./CrisisNotice";
import { BreathingExercise } from "./BreathingExercise";
import { MoodTracker } from "./MoodTracker";
import { DemoReset } from "./DemoReset";
import { NotificationBell } from "./NotificationBell";
import {
  addToList,
  loadNotifications,
  saveNotifications,
  type AppNotification,
  type NewNotification,
} from "./notifications";
import { computeChallengeStats, newlyUnlocked } from "./challengeStats";
import { avatarInitial } from "./utils";
import { ProApp } from "./ProApp";
import { usePolling } from "./usePolling";
import { diffBookings, newProMessages } from "./liveSync";

type Screen = "home" | "specialists" | "booking" | "bookings" | "groups" | "messages";

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

type NotificationStore = {
  email: string;
  items: AppNotification[];
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

const availabilitySlots = ["Hoje • 16:00", "Hoje • 18:30", "Amanhã • 09:30", "Quarta • 14:00"];

// Qual especialista indicar para cada tema do feed
const supportExpertByTheme: Record<string, number> = {
  ansiedade: 1,
  relacionamentos: 2,
  autoconhecimento: 3,
  sono: 1,
};

const groups: GoalGroup[] = [
  { id: "all", label: "Todos", description: "Explore tudo", accent: "#4f46e5" },
  { id: "ansiedade", label: "Ansiedade", description: "Respiração e calma", accent: "#8b5cf6" },
  { id: "autoconhecimento", label: "Autoconhecimento", description: "Entender seu ritmo", accent: "#0f766e" },
  { id: "relacionamentos", label: "Relacionamentos", description: "Limites e comunicação", accent: "#db2777" },
  { id: "sono", label: "Sono", description: "Descanso e recuperação", accent: "#f59e0b" },
];

// Cidades usadas para demonstrar a recomendação por localização sem depender
// de o navegador conceder permissão de GPS ao vivo durante a apresentação.
const defaultLocation = { id: "salvador", label: "Salvador, BA", lat: -12.9777, lng: -38.5016 };

const demoLocations = [
  defaultLocation,
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

const initialExpert = experts[0] as Expert;

function normalizeText(text: string) {
  return text.toLowerCase().normalize("NFD").replaceAll(/[\u0300-\u036f]/g, "");
}

function priceToNumber(price: string) {
  return Number(price.replaceAll(/\D/g, ""));
}

function clockLabel() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bahia" });
}

function shorten(text: string, max = 80) {
  return text.length > max ? `${text.slice(0, max).trimEnd()}...` : text;
}

// Gera uma distância "simulada" mas estável (o mesmo grupo sempre calcula a
// mesma distância enquanto a localização do usuário não mudar).
function simulatedDistanceKm(seed: string, lat: number, lng: number) {
  const base = `${seed}-${lat.toFixed(2)}-${lng.toFixed(2)}`;
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = (hash * 31 + (base.codePointAt(i) ?? 0)) >>> 0;
  }
  return Number((0.4 + (hash % 940) / 100).toFixed(1));
}

function When({ condition, children }: { condition: boolean; children: ReactNode }) {
  return condition ? children : null;
}

export function App() {
  // ---- Tema ----
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    const saved = window.localStorage.getItem("psyconect_theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("psyconect_theme", theme);
  }, [theme]);

  // ---- Navegação e agendamento ----
  const [activeScreen, setActiveScreen] = useState<Screen>("home");
  const [selectedExpert, setSelectedExpert] = useState<Expert>(initialExpert);
  const [activeGroup, setActiveGroup] = useState("all");
  const [isBooked, setIsBooked] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [slotError, setSlotError] = useState(false);
  const [expertQuery, setExpertQuery] = useState("");
  const [maxPrice, setMaxPrice] = useState("all");
  const [likedHomePosts, setLikedHomePosts] = useState<number[]>([]);
  const [formData, setFormData] = useState<FormState>({
    name: "",
    email: "",
    reason: "",
    preference: "Online",
  });

  // ---- Minhas sessões ----
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsError, setBookingsError] = useState("");
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [bookingError, setBookingError] = useState("");

  // ---- Usuário ----
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = window.localStorage.getItem("psyconect_user");
    return stored ? (JSON.parse(stored) as CurrentUser) : null;
  });

  const handleLogin = (user: CurrentUser) => {
    window.localStorage.setItem("psyconect_user", JSON.stringify(user));
    setCurrentUser(user);
  };

    // Informa à camada de API quem está logado (mensagens, posts e agendamentos usam isso)
  useEffect(() => {
    setApiUser(currentUser);
  }, [currentUser]);
  // Pré-preenche o agendamento com os dados de quem está logado
  useEffect(() => {
    if (!currentUser) return;
    setFormData(current => ({
      ...current,
      name: currentUser.name,
      email: currentUser.email,
    }));
  }, [currentUser]);

  // ---- Notificações (guardadas no navegador, por e-mail) ----
  const [notifStore, setNotifStore] = useState<NotificationStore>({ email: "", items: [] });

  useEffect(() => {
    if (!currentUser) return;
    setNotifStore({ email: currentUser.email, items: loadNotifications(currentUser.email) });
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || notifStore.email !== currentUser.email) return;
    saveNotifications(currentUser.email, notifStore.items);
  }, [notifStore, currentUser]);

  const notifications = notifStore.email === currentUser?.email ? notifStore.items : [];

  const addNotification = (input: NewNotification) => {
    const email = currentUser?.email;
    if (!email) return;
    setNotifStore(current => (current.email === email ? { email, items: addToList(current.items, input) } : current));
  };

  const handleMarkAllNotificationsRead = () => {
    setNotifStore(current => ({ ...current, items: current.items.map(item => ({ ...item, read: true })) }));
  };

  const handleClearNotifications = () => {
    setNotifStore(current => ({ ...current, items: [] }));
  };

  // ---- Comunidade / grupos (carregados da API) ----
  const [communityGroups, setCommunityGroups] = useState<CommunityGroup[]>([]);
  const [postsByGroup, setPostsByGroup] = useState<Record<string, CommunityFeedPost[]>>({});
  const [completedDaysByGroup, setCompletedDaysByGroup] = useState<Record<string, number[]>>({});
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [roomGroupId, setRoomGroupId] = useState<string | null>(null);
  const [welcomeGroupId, setWelcomeGroupId] = useState<string | null>(null);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [groupsError, setGroupsError] = useState("");

  // ---- Mensagens (carregadas da API) ----
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number>(0);
  const [typingIds, setTypingIds] = useState<number[]>([]);
  const [unreadIds, setUnreadIds] = useState<number[]>([]);

  // Guarda onde o usuário está agora, para decidir se uma resposta nova vira "não lida"
  const viewRef = useRef({ screen: activeScreen, conversationId: activeConversationId });
  useEffect(() => {
    viewRef.current = { screen: activeScreen, conversationId: activeConversationId };
  }, [activeScreen, activeConversationId]);

  // Ao abrir uma conversa, ela deixa de ser "não lida"
  useEffect(() => {
    if (activeScreen !== "messages" || !activeConversationId) return;
    setUnreadIds(current =>
      current.includes(activeConversationId) ? current.filter(id => id !== activeConversationId) : current,
    );
  }, [activeScreen, activeConversationId]);

    // ---- Atualização ao vivo: respostas reais dos profissionais e mudanças nas sessões ----
  const liveRef = useRef({ conversations, bookings, typingIds });
  useEffect(() => {
    liveRef.current = { conversations, bookings, typingIds };
  }, [conversations, bookings, typingIds]);

  usePolling(Boolean(currentUser) && currentUser?.role !== "pro", 4000, async () => {
    const email = currentUser?.email;
    if (!email) return;

    const [loadedConversations, loadedBookings] = await Promise.all([fetchConversations(), fetchBookings(email)]);
    const previous = liveRef.current;

    // conversas em "digitando..." já são tratadas pelo waitForReply
    const arrivals = newProMessages(previous.conversations, loadedConversations).filter(
      arrival => !previous.typingIds.includes(arrival.conversationId),
    );
    const view = viewRef.current;

    for (const arrival of arrivals) {
      const isViewing = view.screen === "messages" && view.conversationId === arrival.conversationId;
      if (isViewing) continue;

      setUnreadIds(current =>
        current.includes(arrival.conversationId) ? current : [...current, arrival.conversationId],
      );
      addNotification({
        kind: "message",
        key: `msg-${arrival.conversationId}-${arrival.messageCount}`,
        title: `${arrival.name} respondeu`,
        body: shorten(arrival.text),
        target: { screen: "messages", conversationId: arrival.conversationId },
      });
    }

    for (const change of diffBookings(previous.bookings, loadedBookings)) addNotification(change);

    if (JSON.stringify(previous.conversations) !== JSON.stringify(loadedConversations)) {
      setConversations(loadedConversations);
    }
    if (JSON.stringify(previous.bookings) !== JSON.stringify(loadedBookings)) {
      setBookings(loadedBookings);
    }
  });
  // ---- Localização ----
  const [selectedLocationId, setSelectedLocationId] = useState(defaultLocation.id);
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
      : (demoLocations.find(location => location.id === selectedLocationId) ?? defaultLocation);

  useEffect(() => {
       if (!currentUser || currentUser.role === "pro") return;

    fetchGroups()
      .then(loaded => {
        setCommunityGroups(loaded);
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
        // mensagens ficam vazias se a API falhar
      });

    setBookingsLoading(true);
    setBookingsError("");
    fetchBookings(currentUser.email)
      .then(setBookings)
      .catch(() => setBookingsError("Não foi possível carregar suas sessões agora."))
      .finally(() => setBookingsLoading(false));
  }, [currentUser]);

  // ---- Grupos: ações ----
  const loadGroupData = (groupId: string) => {
    if (!postsByGroup[groupId]) {
      fetchGroupPosts(groupId)
        .then(posts => setPostsByGroup(current => ({ ...current, [groupId]: posts })))
        .catch(() => setPostsByGroup(current => ({ ...current, [groupId]: [] })));
    }
    if (!completedDaysByGroup[groupId]) {
      fetchChallengeDays(groupId)
        .then(days => setCompletedDaysByGroup(current => ({ ...current, [groupId]: days })))
        .catch(() => {
          // sem dias concluídos se a API falhar
        });
    }
  };

  const handleEnterRoom = (groupId: string, welcome = false) => {
    setSelectedGroupId(null);
    setRoomGroupId(groupId);
    setWelcomeGroupId(welcome ? groupId : null);
    setActiveScreen("groups");
    loadGroupData(groupId);
  };

  const handleOpenGroupDetail = (groupId: string) => {
    const group = communityGroups.find(item => item.id === groupId);
    if (group?.joined) {
      handleEnterRoom(groupId);
      return;
    }
    setSelectedGroupId(groupId);
    loadGroupData(groupId);
  };

  const handleToggleGroupJoin = async (groupId: string) => {
    const group = communityGroups.find(item => item.id === groupId);
    const wasJoined = group?.joined ?? false;

    if (wasJoined) {
      if (roomGroupId === groupId) setRoomGroupId(null);
    } else {
      handleEnterRoom(groupId, true);

      if (group) {
        addNotification({
          kind: "group",
          title: `Você entrou em ${group.name}`,
          body: "Se apresente no mural para conhecer o grupo.",
          target: { screen: "groups", groupId },
        });

        const admin = professionals.find(professional => professional.id === group.adminId);
        if (admin) {
          window.setTimeout(() => {
            addNotification({
              kind: "group",
              title: `Boas-vindas de ${admin.name}`,
              body: `Seja bem-vindo(a) a ${group.name}! Conte um pouco sobre você no mural.`,
              target: { screen: "groups", groupId },
            });
          }, 8000);
        }
      }
    }

    const toggle = (current: CommunityGroup[]) =>
      current.map(item =>
        item.id === groupId
          ? { ...item, joined: !item.joined, members: item.joined ? item.members - 1 : item.members + 1 }
          : item,
      );

    setCommunityGroups(toggle);
    try {
      await toggleGroupJoinRequest(groupId);
    } catch {
      // reverte se a API falhar
      setCommunityGroups(toggle);
    }
  };

  // Avisa quando uma medalha nova é desbloqueada
  const notifyNewMedals = (group: CommunityGroup, previous: number[], next: number[]) => {
    if (!group.durationDays) return;
    const before = computeChallengeStats(previous, group.durationDays);
    const after = computeChallengeStats(next, group.durationDays);
    for (const medal of newlyUnlocked(before, after)) {
      addNotification({
        kind: "challenge",
        key: `medal-${group.id}-${medal.id}`,
        title: `${medal.emoji} Conquista: ${medal.title}`,
        body: `${group.name}: ${medal.description}`,
        target: { screen: "groups", groupId: group.id },
      });
    }
  };

  const handleToggleChallengeDay = async (groupId: string, day: number) => {
    const previous = completedDaysByGroup[groupId] ?? [];
    const next = previous.includes(day)
      ? previous.filter(existing => existing !== day)
      : [...previous, day].sort((a, b) => a - b);

    setCompletedDaysByGroup(current => ({ ...current, [groupId]: next }));

    const group = communityGroups.find(item => item.id === groupId);
    if (group) notifyNewMedals(group, previous, next);

    try {
      const days = await toggleChallengeDayRequest(groupId, day);
      setCompletedDaysByGroup(current => ({ ...current, [groupId]: days }));
    } catch {
      // mantém o estado otimista se a API falhar
    }
  };

  const handleAddGroupPost = async (groupId: string, body: string) => {
    const authorName = currentUser?.name ?? "Você";
    const firstName = authorName.trim().split(/\s+/)[0] ?? "voce";
    const optimisticPost: CommunityFeedPost = {
      id: `temp-${Date.now()}`,
      author: authorName,
      handle: `@${firstName.toLowerCase()}`,
      group: groupId,
      body,
      time: clockLabel(),
      likes: 0,
      comments: 0,
      liked: false,
    };
    setPostsByGroup(current => ({ ...current, [groupId]: [optimisticPost, ...(current[groupId] ?? [])] }));
    try {
      const posts = await addGroupPostRequest(groupId, body);
      setPostsByGroup(current => ({ ...current, [groupId]: posts }));
    } catch {
      // mantém o post otimista se a API falhar
    }
  };

  const handleToggleGroupPostLike = async (groupId: string, postId: string) => {
    const applyToggle = (current: Record<string, CommunityFeedPost[]>) => ({
      ...current,
      [groupId]: (current[groupId] ?? []).map(post =>
        post.id === postId
          ? { ...post, liked: !post.liked, likes: post.liked ? Math.max(0, post.likes - 1) : post.likes + 1 }
          : post,
      ),
    });

    setPostsByGroup(applyToggle);
    if (postId.startsWith("temp-")) return;

    try {
      const result = await togglePostLikeRequest(postId);
      setPostsByGroup(current => ({
        ...current,
        [groupId]: (current[groupId] ?? []).map(post =>
          post.id === postId ? { ...post, liked: result.liked, likes: result.likes } : post,
        ),
      }));
    } catch {
      // reverte se a API falhar
      setPostsByGroup(applyToggle);
    }
  };

  const handleToggleHomePostLike = (postId: number) => {
    setLikedHomePosts(current =>
      current.includes(postId) ? current.filter(id => id !== postId) : [...current, postId],
    );
  };

  const handleCreateGroup = async (group: CommunityGroup) => {
    setCommunityGroups(current => [group, ...current]);
    setPostsByGroup(current => ({ ...current, [group.id]: [] }));
    setIsCreateGroupOpen(false);
    try {
      const updated = await createGroupRequest(group);
      setCommunityGroups(updated);
    } catch {
      // mantém o grupo otimista se a API falhar
    }
  };

  // ---- Mensagens: ações ----
  const stopTyping = (conversationId: number) => {
    setTypingIds(current => current.filter(id => id !== conversationId));
  };

  // Busca a conversa até a resposta do profissional chegar (tenta algumas vezes)
  const waitForReply = (conversationId: number, knownLength: number, attempt = 0) => {
    fetchConversations()
      .then(loaded => {
        const conversation = loaded.find(item => item.id === conversationId);
        const arrived = (conversation?.messages.length ?? 0) > knownLength;

        if (!arrived && attempt < 3) {
          window.setTimeout(() => waitForReply(conversationId, knownLength, attempt + 1), 1000);
          return;
        }

        setConversations(loaded);
        stopTyping(conversationId);

        const view = viewRef.current;
        const isViewing = view.screen === "messages" && view.conversationId === conversationId;
        if (arrived && !isViewing) {
          setUnreadIds(current => (current.includes(conversationId) ? current : [...current, conversationId]));
          addNotification({
            kind: "message",
            title: `${conversation?.name ?? "Profissional"} respondeu`,
            body: shorten(conversation?.messages.at(-1)?.text ?? "Nova mensagem"),
            target: { screen: "messages", conversationId },
          });
        }
      })
      .catch(() => stopTyping(conversationId));
  };

  const handleSendConversationMessage = async (conversationId: number, text: string) => {
    setConversations(current =>
      current.map(conversation =>
        conversation.id === conversationId
          ? {
              ...conversation,
              messages: [
                ...conversation.messages,
                { id: conversation.messages.length + 1, sender: "me", text, time: clockLabel() },
              ],
            }
          : conversation,
      ),
    );
    try {
      const { conversation, replyDelayMs } = await sendConversationMessageRequest(conversationId, text);
      setConversations(current => current.map(item => (item.id === conversationId ? conversation : item)));
      if (replyDelayMs === null) return;
      setTypingIds(current => (current.includes(conversationId) ? current : [...current, conversationId]));
      window.setTimeout(() => waitForReply(conversationId, conversation.messages.length), replyDelayMs + 300);
    } catch {
      // mantém a mensagem otimista se a API falhar
    }
  };

  // ---- Derivados ----
  const selectedGroup = communityGroups.find(group => group.id === selectedGroupId);
  const roomGroup = communityGroups.find(group => group.id === roomGroupId && group.joined);
  const myGroups = communityGroups.filter(group => group.joined);
  const upcomingBookings = bookings.filter(booking => booking.status !== "canceled");
  const nextBooking = upcomingBookings[0];

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

  const filteredExperts = useMemo(() => {
    const query = normalizeText(expertQuery.trim());
    const limit = maxPrice === "all" ? Infinity : Number(maxPrice);
    return experts.filter(expert => {
      const matchesText =
        !query || normalizeText(`${expert.name} ${expert.role} ${expert.specialty}`).includes(query);
      return matchesText && priceToNumber(expert.price) <= limit;
    });
  }, [expertQuery, maxPrice]);

  const visiblePosts = useMemo(() => {
    if (activeGroup === "all") return feedPosts;
    return feedPosts.filter(post => post.group === activeGroup);
  }, [activeGroup]);

  // ---- Agendamento: ações ----
  const handleBooking = (expert: Expert) => {
    setSelectedExpert(expert);
    setSelectedSlot(availabilitySlots.includes(expert.availability) ? expert.availability : "");
    setSlotError(false);
    setBookingError("");
    setIsBooked(false);
    setActiveScreen("booking");
  };

  const handleFindSupport = (themeId: string) => {
    const expertId = supportExpertByTheme[themeId] ?? 1;
    handleBooking(experts.find(expert => expert.id === expertId) ?? initialExpert);
  };

  const handleSelectSlot = (slot: string) => {
    setSelectedSlot(slot);
    setSlotError(false);
    setBookingError("");
    setIsBooked(false);
  };

  const handleSubmit = async (event: SyntheticEvent) => {
    event.preventDefault();
    if (!selectedSlot) {
      setSlotError(true);
      return;
    }
    setSlotError(false);
    setBookingError("");
    setIsSubmittingBooking(true);
    try {
      const updated = await createBookingRequest(currentUser?.email ?? formData.email, {
        expertId: selectedExpert.id,
        expertName: selectedExpert.name,
        expertRole: selectedExpert.role,
        specialty: selectedExpert.specialty,
        price: selectedExpert.price,
        accent: selectedExpert.accent,
        slot: selectedSlot,
        preference: formData.preference,
        reason: formData.reason.trim(),
      });
      setBookings(updated);
      setIsBooked(true);
      setFormData(current => ({ ...current, reason: "" }));
      addNotification({
        kind: "booking",
        title: "Sessão confirmada",
        body: `${selectedExpert.name} • ${selectedSlot} (${formData.preference})`,
        target: { screen: "bookings" },
      });
    } catch (error) {
      setIsBooked(false);
      setBookingError(error instanceof Error ? error.message : "Não foi possível confirmar o agendamento.");
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  const handleCancelBooking = async (id: string): Promise<string | null> => {
    const booking = bookings.find(item => item.id === id);
    try {
      setBookings(await cancelBookingRequest(currentUser?.email ?? "", id));
      if (booking) {
        addNotification({
          kind: "booking",
          title: "Sessão cancelada",
          body: `${booking.expertName} • ${booking.slot}`,
          target: { screen: "bookings" },
        });
      }
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Não foi possível cancelar a sessão.";
    }
  };

  const handleRescheduleBooking = async (id: string, slot: string): Promise<string | null> => {
    const booking = bookings.find(item => item.id === id);
    try {
      setBookings(await rescheduleBookingRequest(currentUser?.email ?? "", id, slot));
      if (booking) {
        addNotification({
          kind: "booking",
          title: "Sessão remarcada",
          body: `${booking.expertName} • novo horário: ${slot}`,
          target: { screen: "bookings" },
        });
      }
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Não foi possível remarcar a sessão.";
    }
  };

  const handleOpenNotification = (notification: AppNotification) => {
    setNotifStore(current => ({
      ...current,
      items: current.items.map(item => (item.id === notification.id ? { ...item, read: true } : item)),
    }));

    const target = notification.target;
    if (!target) return;

    if (target.screen === "groups" && target.groupId) {
      handleEnterRoom(target.groupId);
      return;
    }
    if (target.screen === "groups") setRoomGroupId(null);
    if (target.screen === "messages" && target.conversationId) setActiveConversationId(target.conversationId);
    setActiveScreen(target.screen);
  };

  const handleLogout = () => {
    window.localStorage.removeItem("psyconect_user");
    setCurrentUser(null);
    setBookings([]);
    setNotifStore({ email: "", items: [] });
    setRoomGroupId(null);
    setActiveScreen("home");
  };

  // Todos os hooks ficam acima deste ponto
  if (!currentUser) {
    return <AuthGate onLogin={handleLogin} />;
  }

    if (currentUser.role === "pro") {
    return (
      <ProApp
        user={currentUser}
        theme={theme}
        onToggleTheme={() => setTheme(current => (current === "dark" ? "light" : "dark"))}
        onLogout={handleLogout}
      />
    );
  }
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
          <button type="button" className={activeScreen === "bookings" ? "nav-link active" : "nav-link"} onClick={() => setActiveScreen("bookings")}>
            Sessões
            {upcomingBookings.length > 0 && <span className="nav-badge">{upcomingBookings.length}</span>}
          </button>
          <button
            type="button"
            className={activeScreen === "groups" ? "nav-link active" : "nav-link"}
            onClick={() => {
              setRoomGroupId(null);
              setActiveScreen("groups");
            }}
          >
            Grupos
          </button>
          <button type="button" className={activeScreen === "messages" ? "nav-link active" : "nav-link"} onClick={() => setActiveScreen("messages")}>
            Mensagens
            {unreadIds.length > 0 && <span className="nav-badge">{unreadIds.length}</span>}
          </button>
        </nav>
        <div className="topbar-user">
          <span className="topbar-greeting">Olá, {currentUser.name.split(" ")[0]}</span>
          <NotificationBell
            items={notifications}
            onOpenItem={handleOpenNotification}
            onMarkAllRead={handleMarkAllNotificationsRead}
            onClear={handleClearNotifications}
          />
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme(current => (current === "dark" ? "light" : "dark"))}
            aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
            title={theme === "dark" ? "Tema claro" : "Tema escuro"}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <button type="button" className="secondary-btn" onClick={handleLogout}>
            Sair
          </button>
        </div>
      </header>

      <When condition={activeScreen === "home"}>
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
              {visiblePosts.map(post => {
                const liked = likedHomePosts.includes(post.id);
                return (
                  <article key={post.id} className="feed-card">
                    <div className="feed-card-top">
                      <div className="avatar">{avatarInitial(post.author)}</div>
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
                      <button
                        type="button"
                        className={liked ? "like-btn liked" : "like-btn"}
                        onClick={() => handleToggleHomePostLike(post.id)}
                        aria-pressed={liked}
                        aria-label={liked ? "Remover curtida" : "Curtir"}
                      >
                        {liked ? "♥" : "♡"} {Number(post.likes) + (liked ? 1 : 0)}
                      </button>
                      <span>💬 {post.comments}</span>
                      <button type="button" className="text-link" onClick={() => handleFindSupport(post.group)}>
                        Encontrar apoio
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <aside className="feed-sidebar">
            <CrisisNotice />

            {nextBooking && (
              <div className="insight-card next-booking-card">
                <p className="eyebrow">Próxima sessão</p>
                <h3>{nextBooking.expertName}</h3>
                <p>
                  🕒 {nextBooking.slot} · {nextBooking.preference === "Online" ? "💻 Online" : "📍 Presencial"}
                </p>
                <button type="button" className="secondary-btn full-width" onClick={() => setActiveScreen("bookings")}>
                  Ver minhas sessões
                </button>
              </div>
            )}

            <BreathingExercise />
            <MoodTracker email={currentUser.email} />

            {myGroups.length > 0 && (
              <div className="insight-card">
                <p className="eyebrow">Meus grupos</p>
                <h3>Continue de onde parou</h3>
                <ul className="suggested-group-list">
                  {myGroups.map(group => (
                    <li key={group.id}>
                      <button type="button" className="suggested-group-item" onClick={() => handleEnterRoom(group.id)}>
                        <span className="chip-dot" style={{ backgroundColor: group.accent }} />
                        <span>
                          <strong>{group.name}</strong>
                          <span className="suggested-group-meta">Entrar no grupo →</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

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
                          setRoomGroupId(null);
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
      </When>

      <When condition={activeScreen === "specialists"}>
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

          <div className="expert-filters">
            <input
              type="search"
              value={expertQuery}
              onChange={event => setExpertQuery(event.target.value)}
              placeholder="Buscar por nome ou especialidade"
              aria-label="Buscar especialista"
            />
            <select value={maxPrice} onChange={event => setMaxPrice(event.target.value)} aria-label="Filtrar por preço">
              <option value="all">Qualquer preço</option>
              <option value="160">Até R$ 160</option>
              <option value="180">Até R$ 180</option>
              <option value="200">Até R$ 200</option>
            </select>
          </div>

          {filteredExperts.length === 0 && (
            <p className="empty-state">Nenhum especialista encontrado com esses filtros.</p>
          )}

          <div className="expert-grid">
            {filteredExperts.map(expert => (
              <article key={expert.id} className="expert-card">
                <div className="expert-top">
                  <div className="avatar" style={{ backgroundColor: expert.accent }}>
                    {avatarInitial(expert.name)}
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
      </When>

      <When condition={activeScreen === "booking"}>
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
              {availabilitySlots.map(slot => (
                <button
                  key={slot}
                  type="button"
                  className={selectedSlot === slot ? "availability-btn active" : "availability-btn"}
                  onClick={() => handleSelectSlot(slot)}
                  aria-pressed={selectedSlot === slot}
                >
                  {slot}
                </button>
              ))}
            </div>
            {slotError && <p className="field-error">Escolha um horário para continuar.</p>}
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
                Motivo da sessão{" "}
                <textarea
                  value={formData.reason}
                  onChange={event => setFormData({ ...formData, reason: event.target.value })}
                  placeholder="Conte em poucas palavras o que você gostaria de trabalhar"
                  rows={4}
                  required
                />
              </label>
              <label>
                Preferência{" "}
                <select
                  value={formData.preference}
                  onChange={event => setFormData({ ...formData, preference: event.target.value })}
                >
                  <option value="Online">Online</option>
                  <option value="Presencial">Presencial</option>
                </select>
              </label>
              <button type="submit" className="primary-btn full-width" disabled={isSubmittingBooking}>
                {isSubmittingBooking ? "Confirmando..." : "Confirmar agendamento"}
              </button>
            </form>
            {bookingError && <p className="field-error">{bookingError}</p>}
            {isBooked && (
              <div className="success-box">
                <strong>Agendamento confirmado!</strong>
                <p>
                  {selectedExpert.name} • {selectedSlot} ({formData.preference}). Você receberá um e-mail com o link
                  da sessão e detalhes da consulta.
                </p>
                <button type="button" className="secondary-btn small" onClick={() => setActiveScreen("bookings")}>
                  Ver minhas sessões
                </button>
              </div>
            )}
          </section>
        </main>
      </When>

      <When condition={activeScreen === "bookings"}>
        <MyBookings
          bookings={bookings}
          isLoading={bookingsLoading}
          error={bookingsError}
          slots={availabilitySlots}
          onCancel={handleCancelBooking}
          onReschedule={handleRescheduleBooking}
          onNewBooking={() => setActiveScreen("specialists")}
        />
      </When>

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

      {activeScreen === "groups" && !isLoadingGroups && !groupsError && !roomGroup && (
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

      {activeScreen === "groups" && roomGroup && (
        <GroupRoom
          group={roomGroup}
          admin={professionals.find(professional => professional.id === roomGroup.adminId)}
          category={categories.find(category => category.id === roomGroup.theme)}
          posts={postsByGroup[roomGroup.id] ?? []}
          completedDays={completedDaysByGroup[roomGroup.id] ?? []}
          userName={currentUser.name}
          showWelcome={welcomeGroupId === roomGroup.id}
          onDismissWelcome={() => setWelcomeGroupId(null)}
          onToggleDay={handleToggleChallengeDay}
          onAddPost={handleAddGroupPost}
          onToggleLike={handleToggleGroupPostLike}
          onLeave={handleToggleGroupJoin}
          onBack={() => setRoomGroupId(null)}
        />
      )}

      <When condition={activeScreen === "messages"}>
        <MessagesScreen
          conversations={conversations}
          activeConversationId={activeConversationId}
          typingIds={typingIds}
          unreadIds={unreadIds}
          onSelectConversation={setActiveConversationId}
          onSendMessage={handleSendConversationMessage}
        />
      </When>

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
          onToggleLike={handleToggleGroupPostLike}
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

      <DemoReset />
    </div>
  );
}

export default App;