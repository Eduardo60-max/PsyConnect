import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type SyntheticEvent } from "react";
import "./index.css";
import type {
  Booking,
  ChallengeRankEntry,
  CommunityGroup,
  Conversation,
  CurrentUser,
  FeedPost,
  Professional,
} from "./types";
import { categories, SPECIALTY_BY_THEME } from "./data";
import {
  addGroupPostRequest,
  cancelBookingRequest,
  createBookingRequest,
  createGroupRequest,
  fetchBookings,
  fetchChallengeDays,
  fetchChallengeRanking,
  fetchConversations,
  fetchGroupPosts,
  fetchGroups,
  fetchHomeFeed,
  fetchProfessionals,
  rescheduleBookingRequest,
  sendConversationMessageRequest,
  toggleChallengeDayRequest,
  toggleGroupJoinRequest,
  togglePostLikeRequest,
} from "./api";
import { logoutRequest, restoreSessionUser } from "./authService";
import { loadRuntimeConfig, validateApiBaseUrl } from "./runtimeConfig";
import { subscribeAndroidBackButton, subscribeDeepLinks } from "./nativeBridge";
import { GroupsScreen } from "./GroupsScreen";
import { GroupDetailModal } from "./GroupDetailModal";
import { GroupCreateModal } from "./GroupCreateModal";
import { GroupRoom } from "./GroupRoom";
import { MessagesScreen } from "./MessagesScreen";
import { MyBookings } from "./MyBookings";
import { AuthGate } from "./AuthGate";
import { CrisisNotice } from "./CrisisNotice";
import { BreathingExercise } from "./BreathingExercise";
import { MoodTracker } from "./MoodTracker";
import { NotificationBell } from "./NotificationBell";
import { PostFeedList } from "./PostFeedList";
import { PendingDoctorScreen } from "./PendingDoctorScreen";
import { ProfileScreen } from "./ProfileScreen";
import { AdminApp } from "./AdminApp";
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
import { TestSessionCard } from "./TestSessionCard";

type Screen = "home" | "specialists" | "booking" | "bookings" | "groups" | "messages" | "profile";

type BookingFormState = {
  reason: string;
  preference: string;
};

type NotificationStore = {
  email: string;
  items: AppNotification[];
};

function normalizeText(text: string) {
  return text.toLowerCase().normalize("NFD").replaceAll(/[\u0300-\u036f]/g, "");
}

function shorten(text: string, max = 80) {
  return text.length > max ? `${text.slice(0, max).trimEnd()}...` : text;
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

  // ---- Inicialização, sessão e deep links ----
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [startupError, setStartupError] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "recovery">("login");
  const [authNotice, setAuthNotice] = useState("");
  const [authExternalError, setAuthExternalError] = useState("");

  const bootstrapSession = useCallback(async () => {
    setAuthChecking(true);
    setStartupError("");
    const apiErr = validateApiBaseUrl();
    if (apiErr) {
      setStartupError(apiErr);
      setAuthChecking(false);
      return;
    }

    try {
      await loadRuntimeConfig();
      const restored = await restoreSessionUser();
      setCurrentUser(restored);
    } catch (err) {
      setStartupError(err instanceof Error ? err.message : "Não foi possível conectar ao servidor.");
    } finally {
      setAuthChecking(false);
    }
  }, []);

  useEffect(() => {
    void bootstrapSession();
  }, [bootstrapSession]);

  useEffect(() => {
    return subscribeDeepLinks(async result => {
      if (result.error) {
        setAuthExternalError(result.error);
        setAuthMode("login");
        return;
      }
      if (result.isRecovery) {
        setAuthMode("recovery");
        setCurrentUser(null);
        return;
      }
      if (result.message) {
        setAuthNotice(result.message);
      }
      try {
        const restored = await restoreSessionUser();
        if (restored) setCurrentUser(restored);
      } catch {
        // usuário pode entrar normalmente com e-mail e senha
      }
    });
  }, []);

  // ---- Navegação e agendamento ----
  const [activeScreen, setActiveScreen] = useState<Screen>("home");
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [professionalsError, setProfessionalsError] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [activeFeedTheme, setActiveFeedTheme] = useState("all");
  const [isBooked, setIsBooked] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [slotError, setSlotError] = useState(false);
  const [expertQuery, setExpertQuery] = useState("");
  const [onlyWithSlots, setOnlyWithSlots] = useState(false);
  const [formData, setFormData] = useState<BookingFormState>({
    reason: "",
    preference: "Online",
  });

  // ---- Minhas sessões ----
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsError, setBookingsError] = useState("");
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [bookingError, setBookingError] = useState("");

  // ---- Feed e grupos ----
  const [homePosts, setHomePosts] = useState<FeedPost[]>([]);
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeError, setHomeError] = useState("");
  const [communityGroups, setCommunityGroups] = useState<CommunityGroup[]>([]);
  const [postsByGroup, setPostsByGroup] = useState<Record<string, FeedPost[]>>({});
  const [completedDaysByGroup, setCompletedDaysByGroup] = useState<Record<string, number[]>>({});
  const [rankingByGroup, setRankingByGroup] = useState<Record<string, ChallengeRankEntry[]>>({});
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [roomGroupId, setRoomGroupId] = useState<string | null>(null);
  const [welcomeGroupId, setWelcomeGroupId] = useState<string | null>(null);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [groupsError, setGroupsError] = useState("");
  const [hasActiveTestSession, setHasActiveTestSession] = useState(false);

  // ---- Notificações ----
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

  // ---- Mensagens ----
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number>(0);
  const [unreadIds, setUnreadIds] = useState<number[]>([]);

  const viewRef = useRef({ screen: activeScreen, conversationId: activeConversationId });
  useEffect(() => {
    viewRef.current = { screen: activeScreen, conversationId: activeConversationId };
  }, [activeScreen, activeConversationId]);

  useEffect(() => {
    if (activeScreen !== "messages" || !activeConversationId) return;
    setUnreadIds(current =>
      current.includes(activeConversationId) ? current.filter(id => id !== activeConversationId) : current,
    );
  }, [activeScreen, activeConversationId]);

  // Botão Voltar físico do Android
  useEffect(() => {
    return subscribeAndroidBackButton(() => {
      if (isCreateGroupOpen) {
        setIsCreateGroupOpen(false);
        return true;
      }
      if (selectedGroupId) {
        setSelectedGroupId(null);
        return true;
      }
      if (roomGroupId) {
        setRoomGroupId(null);
        return true;
      }
      if (activeScreen !== "home") {
        setActiveScreen("home");
        return true;
      }
      return false;
    });
  }, [activeScreen, isCreateGroupOpen, selectedGroupId, roomGroupId]);

  const isPatientSession = currentUser?.role === "paciente";

  // ---- Atualização ao vivo ----
  const liveRef = useRef({ conversations, bookings });
  useEffect(() => {
    liveRef.current = { conversations, bookings };
  }, [conversations, bookings]);

  usePolling(Boolean(isPatientSession), 4000, async () => {
    const [loadedConversations, loadedBookings] = await Promise.all([fetchConversations(), fetchBookings()]);
    const previous = liveRef.current;

    const arrivals = newProMessages(previous.conversations, loadedConversations);
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

  // ---- Carregamento inicial do paciente ----
  const loadPatientData = useCallback(() => {
    if (!isPatientSession) return;

    setHomeLoading(true);
    setHomeError("");
    fetchHomeFeed("all")
      .then(setHomePosts)
      .catch(err => setHomeError(err instanceof Error ? err.message : "Não foi possível carregar o mural."))
      .finally(() => setHomeLoading(false));

    setIsLoadingGroups(true);
    setGroupsError("");
    fetchGroups()
      .then(setCommunityGroups)
      .catch(error => setGroupsError(String(error.message ?? error)))
      .finally(() => setIsLoadingGroups(false));

    setProfessionalsError("");
    fetchProfessionals()
      .then(loaded => {
        setProfessionals(loaded);
        setSelectedDoctorId(curr => (curr && loaded.some(p => p.id === curr) ? curr : (loaded[0]?.id ?? "")));
      })
      .catch(err => setProfessionalsError(err instanceof Error ? err.message : "Erro ao carregar especialistas."));

    fetchConversations()
      .then(loaded => {
        setConversations(loaded);
        setActiveConversationId(loaded[0]?.id ?? 0);
      })
      .catch(() => {
        // próximo ciclo tenta novamente
      });

    setBookingsLoading(true);
    setBookingsError("");
    fetchBookings()
      .then(setBookings)
      .catch(err => setBookingsError(err instanceof Error ? err.message : "Não foi possível carregar suas sessões."))
      .finally(() => setBookingsLoading(false));
  }, [isPatientSession]);

  useEffect(() => {
    loadPatientData();
  }, [loadPatientData]);

  // ---- Grupos & posts ----
  const loadGroupData = (groupId: string) => {
    fetchGroupPosts(groupId)
      .then(posts => setPostsByGroup(current => ({ ...current, [groupId]: posts })))
      .catch(() => setPostsByGroup(current => ({ ...current, [groupId]: [] })));

    fetchChallengeDays(groupId)
      .then(days => setCompletedDaysByGroup(current => ({ ...current, [groupId]: days })))
      .catch(() => {});

    fetchChallengeRanking(groupId)
      .then(ranking => setRankingByGroup(current => ({ ...current, [groupId]: ranking })))
      .catch(() => {});
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
      }
    }

    const toggle = (current: CommunityGroup[]) =>
      current.map(item =>
        item.id === groupId
          ? { ...item, joined: !item.joined, members: Math.max(0, item.joined ? item.members - 1 : item.members + 1) }
          : item,
      );

    setCommunityGroups(toggle);
    try {
      const updated = await toggleGroupJoinRequest(groupId);
      setCommunityGroups(current =>
        current.map(item => (item.id === groupId ? { ...item, joined: updated.joined, members: updated.members } : item)),
      );
    } catch {
      setCommunityGroups(toggle);
    }
  };

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
      const ranking = await fetchChallengeRanking(groupId);
      setRankingByGroup(current => ({ ...current, [groupId]: ranking }));
    } catch {
      setCompletedDaysByGroup(current => ({ ...current, [groupId]: previous }));
    }
  };

  const handleAddGroupPost = async (groupId: string, body: string) => {
    if (!currentUser) return;
    try {
      const posts = await addGroupPostRequest(groupId, body);
      setPostsByGroup(current => ({ ...current, [groupId]: posts }));
      fetchHomeFeed("all").then(setHomePosts).catch(() => {});
    } catch {
      // mantém estado atual em erro transitório
    }
  };

  const handleTogglePostLike = async (post: FeedPost) => {
    const toggleItem = (item: FeedPost) =>
      item.id === post.id
        ? { ...item, liked: !item.liked, likes: item.liked ? Math.max(0, item.likes - 1) : item.likes + 1 }
        : item;

    setHomePosts(curr => curr.map(toggleItem));
    setPostsByGroup(curr => ({
      ...curr,
      [post.groupId]: (curr[post.groupId] ?? []).map(toggleItem),
    }));

    try {
      const result = await togglePostLikeRequest(post.id);
      const syncItem = (item: FeedPost) =>
        item.id === post.id ? { ...item, liked: result.liked, likes: result.likes } : item;
      setHomePosts(curr => curr.map(syncItem));
      setPostsByGroup(curr => ({
        ...curr,
        [post.groupId]: (curr[post.groupId] ?? []).map(syncItem),
      }));
    } catch {
      setHomePosts(curr => curr.map(toggleItem));
      setPostsByGroup(curr => ({
        ...curr,
        [post.groupId]: (curr[post.groupId] ?? []).map(toggleItem),
      }));
    }
  };

  const handleDeletePostEverywhere = (postId: string) => {
    setHomePosts(curr => curr.filter(p => p.id !== postId));
    setPostsByGroup(curr => {
      const next: Record<string, FeedPost[]> = {};
      for (const [gid, list] of Object.entries(curr)) {
        next[gid] = list.filter(p => p.id !== postId);
      }
      return next;
    });
  };

  const handleBlockedUserEverywhere = (blockedUserId: string) => {
    setHomePosts(curr => curr.filter(p => p.userId !== blockedUserId));
    setPostsByGroup(curr => {
      const next: Record<string, FeedPost[]> = {};
      for (const [gid, list] of Object.entries(curr)) {
        next[gid] = list.filter(p => p.userId !== blockedUserId);
      }
      return next;
    });
  };

  const handleCreateGroup = async (input: {
    name: string;
    description: string;
    theme: string;
    adminId?: string | null;
    isTemporary: boolean;
    durationDays?: number;
    accent: string;
  }) => {
    setIsCreateGroupOpen(false);
    const updated = await createGroupRequest(input);
    setCommunityGroups(updated);
  };

  // ---- Mensagens ----
  const handleSendConversationMessage = async (conversationId: number, text: string) => {
    try {
      const { conversation } = await sendConversationMessageRequest(conversationId, text);
      setConversations(current => current.map(item => (item.id === conversationId ? conversation : item)));
    } catch {
      fetchConversations().then(setConversations).catch(() => {});
    }
  };

  // ---- Derivados ----
  const selectedGroup = communityGroups.find(group => group.id === selectedGroupId);
  const roomGroup = communityGroups.find(group => group.id === roomGroupId && group.joined);
  const myGroups = communityGroups.filter(group => group.joined);
  const upcomingBookings = bookings.filter(booking => booking.status !== "canceled");
  const nextBooking = upcomingBookings[0];

  const selectedExpert =
    professionals.find(pro => pro.id === selectedDoctorId) ?? professionals[0] ?? null;

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

  const activeGroupsSummary = useMemo(() => {
    return [...communityGroups].sort((a, b) => b.members - a.members).slice(0, 4);
  }, [communityGroups]);

  const filteredExperts = useMemo(() => {
    const query = normalizeText(expertQuery.trim());
    return professionals.filter(expert => {
      const matchesText =
        !query || normalizeText(`${expert.name} ${expert.role} ${expert.specialty}`).includes(query);
      const matchesSlots = !onlyWithSlots || expert.freeSlots.length > 0;
      return matchesText && matchesSlots;
    });
  }, [professionals, expertQuery, onlyWithSlots]);

  const visibleHomePosts = useMemo(() => {
    if (activeFeedTheme === "all") return homePosts;
    return homePosts.filter(post => post.groupTheme === activeFeedTheme);
  }, [homePosts, activeFeedTheme]);

  // ---- Agendamento ----
  const handleBooking = (expert: Professional) => {
    setSelectedDoctorId(expert.id);
    setSelectedSlot(expert.freeSlots[0] ?? "");
    setSlotError(false);
    setBookingError("");
    setIsBooked(false);
    setActiveScreen("booking");
  };

  const handleFindSupport = (themeId: string) => {
    const targetSpecialty = SPECIALTY_BY_THEME[themeId] ?? "";
    const matching =
      professionals.find(pro => pro.specialty === targetSpecialty && pro.freeSlots.length > 0) ??
      professionals.find(pro => pro.specialty === targetSpecialty) ??
      professionals[0];
    if (matching) {
      handleBooking(matching);
    } else {
      setActiveScreen("specialists");
    }
  };

  const handleSelectSlot = (slot: string) => {
    setSelectedSlot(slot);
    setSlotError(false);
    setBookingError("");
    setIsBooked(false);
  };

  const handleSubmitBooking = async (event: SyntheticEvent) => {
    event.preventDefault();
    if (!selectedExpert) return;
    if (!selectedSlot) {
      setSlotError(true);
      return;
    }
    setSlotError(false);
    setBookingError("");
    setIsSubmittingBooking(true);
    try {
      const updated = await createBookingRequest({
        doctorId: selectedExpert.id,
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
      fetchProfessionals().then(setProfessionals).catch(() => {});
      fetchConversations().then(setConversations).catch(() => {});
    } catch (error) {
      setIsBooked(false);
      setBookingError(error instanceof Error ? error.message : "Não foi possível confirmar o agendamento.");
      fetchProfessionals().then(setProfessionals).catch(() => {});
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  const handleCancelBooking = async (id: string): Promise<string | null> => {
    const booking = bookings.find(item => item.id === id);
    try {
      setBookings(await cancelBookingRequest(id));
      fetchProfessionals().then(setProfessionals).catch(() => {});
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
      setBookings(await rescheduleBookingRequest(id, slot));
      fetchProfessionals().then(setProfessionals).catch(() => {});
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

  const handleLogout = async () => {
    if (
      hasActiveTestSession &&
      !window.confirm(
        "Você tem uma sessão de teste PANAS em andamento. Deseja sair mesmo assim? (Você pode encerrá-la antes no card de Sessão de teste.)",
      )
    ) {
      return;
    }

    await logoutRequest();
    setCurrentUser(null);
    setBookings([]);
    setConversations([]);
    setHomePosts([]);
    setCommunityGroups([]);
    setNotifStore({ email: "", items: [] });
    setRoomGroupId(null);
    setHasActiveTestSession(false);
    setAuthMode("login");
    setActiveScreen("home");
  };

  // ---- Telas de carregamento / erro / papéis ----
  if (authChecking) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <p className="brand-mark">PsyConnect</p>
          <p className="auth-subtitle">Verificando sua sessão...</p>
        </div>
      </div>
    );
  }

  if (startupError) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <p className="brand-mark">PsyConnect</p>
          <h2>Não foi possível conectar</h2>
          <p className="auth-error" role="alert">
            {startupError}
          </p>
          <button type="button" className="primary-btn full-width" onClick={bootstrapSession}>
            Tentar de novo
          </button>
          <div className="auth-crisis">
            <CrisisNotice />
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser || authMode === "recovery") {
    return (
      <AuthGate
        key={authMode}
        initialMode={authMode}
        initialNotice={authNotice}
        initialError={authExternalError}
        onClearExternalNotice={() => {
          setAuthNotice("");
          setAuthExternalError("");
        }}
        onLogin={user => {
          setAuthMode("login");
          setCurrentUser(user);
        }}
      />
    );
  }

  if (currentUser.role === "admin") {
    return (
      <AdminApp
        user={currentUser}
        theme={theme}
        onToggleTheme={() => setTheme(current => (current === "dark" ? "light" : "dark"))}
        onUserUpdated={setCurrentUser}
        onLogout={handleLogout}
      />
    );
  }

  if (currentUser.role === "medico" && currentUser.professional?.status !== "aprovado") {
    return (
      <PendingDoctorScreen
        user={currentUser}
        theme={theme}
        onToggleTheme={() => setTheme(current => (current === "dark" ? "light" : "dark"))}
        onRefreshStatus={async () => {
          const refreshed = await restoreSessionUser();
          if (refreshed) setCurrentUser(refreshed);
        }}
        onLogout={handleLogout}
      />
    );
  }

  if (currentUser.role === "medico") {
    return (
      <ProApp
        user={currentUser}
        theme={theme}
        onToggleTheme={() => setTheme(current => (current === "dark" ? "light" : "dark"))}
        onUserUpdated={setCurrentUser}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="brand-mark">PsyConnect</p>
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
          <button
            type="button"
            className={activeScreen === "profile" ? "secondary-btn small active-profile-btn" : "secondary-btn small"}
            onClick={() => setActiveScreen("profile")}
          >
            Perfil
          </button>
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
                <div className="avatar avatar-large">{avatarInitial(currentUser.name)}</div>
                <div>
                  <h2>O que você quer cuidar hoje?</h2>
                  <p>Explore publicações reais da comunidade ou participe de um grupo de apoio.</p>
                </div>
              </div>
              <div className="group-chips" role="tablist" aria-label="Filtrar mural por tema">
                {[{ id: "all", label: "Todos", accent: "#4f46e5" }, ...categories].map(group => (
                  <button
                    key={group.id}
                    type="button"
                    className={activeFeedTheme === group.id ? "group-chip active" : "group-chip"}
                    onClick={() => setActiveFeedTheme(group.id)}
                  >
                    <span className="chip-dot" style={{ backgroundColor: group.accent }} />
                    {group.label}
                  </button>
                ))}
              </div>
            </div>

            {homeLoading ? (
              <p className="empty-state">Carregando publicações...</p>
            ) : homeError ? (
              <div className="empty-state network-error-box">
                <p>{homeError}</p>
                <button type="button" className="primary-btn small" onClick={loadPatientData}>
                  Tentar de novo
                </button>
              </div>
            ) : (
              <div className="feed-list">
                <PostFeedList
                  posts={visibleHomePosts}
                  currentUserId={currentUser.id}
                  emptyMessage="Ainda não há publicações neste tema. Entre em um grupo na aba Grupos para iniciar a conversa."
                  showGroupBadge
                  onToggleLike={handleTogglePostLike}
                  onDeletedPost={handleDeletePostEverywhere}
                  onBlockedUser={handleBlockedUserEverywhere}
                  onFindSupport={handleFindSupport}
                />
              </div>
            )}
          </section>

          <aside className="feed-sidebar">
            <TestSessionCard
              user={currentUser}
              onUserUpdated={setCurrentUser}
              onActiveChange={setHasActiveTestSession}
            />
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
            <MoodTracker userId={currentUser.id} />

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
              <button type="button" className="primary-btn full-width" onClick={() => setActiveScreen("specialists")}>
                Agendar sessão
              </button>
            </div>

            {activeGroupsSummary.length > 0 && (
              <div className="insight-card">
                <p className="eyebrow">Comunidade</p>
                <h3>Grupos com mais participantes</h3>
                <ul className="sidebar-list">
                  {activeGroupsSummary.map(group => (
                    <li key={group.id}>
                      {group.name} • {group.members.toLocaleString("pt-BR")} participantes
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="insight-card">
              <p className="eyebrow">Sugeridos pra você</p>
              <h3>Baseado nos grupos que você participa</h3>
              {suggestedGroups.length === 0 ? (
                <p>Você já participa de todos os grupos disponíveis ou ainda estamos carregando.</p>
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
                            {categories.find(category => category.id === group.theme)?.label} ·{" "}
                            {group.members.toLocaleString("pt-BR")} participantes
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </main>
      </When>

      <When condition={activeScreen === "specialists"}>
        <main className="screen">
          <section className="section-heading">
            <div>
              <p className="eyebrow">Especialistas verificados</p>
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
            <label className="create-group-toggle-row slot-filter-check">
              <input
                type="checkbox"
                checked={onlyWithSlots}
                onChange={event => setOnlyWithSlots(event.target.checked)}
              />
              <span>Apenas com horários livres</span>
            </label>
          </div>

          {professionalsError ? (
            <div className="empty-state network-error-box">
              <p>{professionalsError}</p>
              <button type="button" className="primary-btn small" onClick={loadPatientData}>
                Tentar de novo
              </button>
            </div>
          ) : filteredExperts.length === 0 ? (
            <p className="empty-state">
              {professionals.length === 0
                ? "Nenhum profissional aprovado disponível no momento."
                : "Nenhum especialista encontrado com esses filtros."}
            </p>
          ) : (
            <div className="expert-grid">
              {filteredExperts.map(expert => (
                <article key={expert.id} className="expert-card">
                  <div className="expert-top">
                    <div className="avatar" style={{ backgroundColor: expert.accent }}>
                      {avatarInitial(expert.name)}
                    </div>
                    <div>
                      <h3>{expert.name}</h3>
                      <p>
                        {expert.role} · CRM/{expert.crmUf} {expert.crm}
                      </p>
                    </div>
                  </div>
                  <p className="expert-specialty">{expert.specialty}</p>
                  <p className="expert-description">{expert.bio}</p>
                  <div className="expert-meta">
                    <span>{expert.experience}</span>
                    <span>{expert.price}</span>
                  </div>
                  <div className="expert-footer">
                    <span>
                      {expert.freeSlots.length > 0
                        ? `${expert.freeSlots.length} horário(s) livre(s)`
                        : "Sem horários livres"}
                    </span>
                    <button type="button" className="primary-btn small" onClick={() => handleBooking(expert)}>
                      Agendar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>
      </When>

      <When condition={activeScreen === "booking"}>
        <main className="screen booking-layout">
          {!selectedExpert ? (
            <section className="booking-summary">
              <p className="eyebrow">Agendamento</p>
              <h2>Nenhum profissional disponível ainda</h2>
              <p className="group-detail-description">
                Assim que a equipe aprovar um profissional e ele cadastrar horários livres, você poderá agendar por aqui.
              </p>
              <button type="button" className="secondary-btn" onClick={loadPatientData}>
                Atualizar lista
              </button>
            </section>
          ) : (
            <>
              <section className="booking-summary">
                <p className="eyebrow">Agendamento</p>
                <h2>Reserve sua sessão com {selectedExpert.name}</h2>
                <p>{selectedExpert.bio}</p>
                <div className="summary-card">
                  <div>
                    <strong>Especialidade</strong>
                    <p>{selectedExpert.specialty}</p>
                  </div>
                  <div>
                    <strong>Valor nos testes</strong>
                    <p>{selectedExpert.price}</p>
                  </div>
                </div>

                {professionals.length > 1 && (
                  <label className="location-picker">
                    <span>Trocar profissional</span>
                    <select
                      value={selectedExpert.id}
                      onChange={e => {
                        const pro = professionals.find(item => item.id === e.target.value);
                        if (pro) handleBooking(pro);
                      }}
                    >
                      {professionals.map(pro => (
                        <option key={pro.id} value={pro.id}>
                          {pro.name} · {pro.specialty}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <div className="availability-list">
                  {selectedExpert.freeSlots.length === 0 ? (
                    <p className="comments-empty">
                      Este profissional não tem horários livres no momento. Escolha outro ou tente mais tarde.
                    </p>
                  ) : (
                    selectedExpert.freeSlots.map(slot => (
                      <button
                        key={slot}
                        type="button"
                        className={selectedSlot === slot ? "availability-btn active" : "availability-btn"}
                        onClick={() => handleSelectSlot(slot)}
                        aria-pressed={selectedSlot === slot}
                      >
                        {slot}
                      </button>
                    ))
                  )}
                </div>
                {slotError && <p className="field-error">Escolha um horário para continuar.</p>}
              </section>

              <section className="booking-form-card">
                <h3>Dados para o atendimento</h3>
                <div className="auth-notice payment-test-notice" role="note">
                  <strong>Sem cobrança nos testes:</strong> nenhum pagamento real é realizado no aplicativo e este
                  agendamento não gera cobrança.
                </div>

                <form onSubmit={handleSubmitBooking} className="booking-form">
                  <label>
                    Nome
                    <input type="text" value={currentUser.name} disabled />
                  </label>
                  <label>
                    E-mail
                    <input type="email" value={currentUser.email} disabled />
                  </label>
                  <label>
                    Motivo da sessão{" "}
                    <textarea
                      value={formData.reason}
                      onChange={event => setFormData({ ...formData, reason: event.target.value })}
                      placeholder="Conte em poucas palavras o que você gostaria de trabalhar"
                      rows={4}
                      maxLength={500}
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
                  <button
                    type="submit"
                    className="primary-btn full-width"
                    disabled={isSubmittingBooking || selectedExpert.freeSlots.length === 0}
                  >
                    {isSubmittingBooking ? "Confirmando..." : "Confirmar agendamento"}
                  </button>
                </form>

                {bookingError && <p className="field-error">{bookingError}</p>}
                {isBooked && (
                  <div className="success-box">
                    <strong>Agendamento confirmado!</strong>
                    <p>
                      {selectedExpert.name} • {selectedSlot} ({formData.preference}). A sessão já está em{" "}
                      <strong>Sessões</strong> e a conversa foi aberta em <strong>Mensagens</strong>.
                    </p>
                    <button type="button" className="secondary-btn small" onClick={() => setActiveScreen("bookings")}>
                      Ver minhas sessões
                    </button>
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </When>

      <When condition={activeScreen === "bookings"}>
        <MyBookings
          bookings={bookings}
          professionals={professionals}
          isLoading={bookingsLoading}
          error={bookingsError}
          onRetry={loadPatientData}
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
          <div className="empty-state network-error-box">
            <p>Não foi possível carregar os grupos agora ({groupsError}).</p>
            <button type="button" className="primary-btn small" onClick={loadPatientData}>
              Tentar de novo
            </button>
          </div>
        </main>
      )}

      {activeScreen === "groups" && !isLoadingGroups && !groupsError && !roomGroup && (
        <GroupsScreen
          groups={communityGroups}
          categories={categories}
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
          category={categories.find(category => category.id === roomGroup.theme)}
          posts={postsByGroup[roomGroup.id] ?? []}
          completedDays={completedDaysByGroup[roomGroup.id] ?? []}
          ranking={rankingByGroup[roomGroup.id] ?? []}
          currentUserId={currentUser.id}
          showWelcome={welcomeGroupId === roomGroup.id}
          onDismissWelcome={() => setWelcomeGroupId(null)}
          onToggleDay={handleToggleChallengeDay}
          onAddPost={handleAddGroupPost}
          onToggleLike={(gid, postId) => {
            const found = (postsByGroup[gid] ?? []).find(p => p.id === postId);
            if (found) void handleTogglePostLike(found);
          }}
          onDeletePost={(_gid, postId) => handleDeletePostEverywhere(postId)}
          onBlockedUser={handleBlockedUserEverywhere}
          onLeave={handleToggleGroupJoin}
          onBack={() => setRoomGroupId(null)}
        />
      )}

      <When condition={activeScreen === "messages"}>
        <MessagesScreen
          conversations={conversations}
          activeConversationId={activeConversationId}
          unreadIds={unreadIds}
          onSelectConversation={setActiveConversationId}
          onSendMessage={handleSendConversationMessage}
        />
      </When>

      <When condition={activeScreen === "profile"}>
        <ProfileScreen
          user={currentUser}
          theme={theme}
          onToggleTheme={() => setTheme(current => (current === "dark" ? "light" : "dark"))}
          onUserUpdated={setCurrentUser}
          onUnblockedUser={loadPatientData}
          onLogout={handleLogout}
        />
      </When>

      {selectedGroup && (
        <GroupDetailModal
          group={selectedGroup}
          category={categories.find(category => category.id === selectedGroup.theme)}
          posts={postsByGroup[selectedGroup.id] ?? []}
          completedDays={completedDaysByGroup[selectedGroup.id] ?? []}
          currentUserId={currentUser.id}
          onToggleDay={handleToggleChallengeDay}
          onToggleJoin={handleToggleGroupJoin}
          onAddPost={handleAddGroupPost}
          onToggleLike={(gid, postId) => {
            const found = (postsByGroup[gid] ?? []).find(p => p.id === postId);
            if (found) void handleTogglePostLike(found);
          }}
          onDeletePost={(_gid, postId) => handleDeletePostEverywhere(postId)}
          onBlockedUser={handleBlockedUserEverywhere}
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
