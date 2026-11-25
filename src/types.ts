export type UserRole = "paciente" | "medico" | "admin";
export type ProfessionalStatus = "pendente" | "aprovado" | "recusado";

export type ProfessionalInfo = {
  crm: string;
  crmUf: string;
  specialty: string;
  roleTitle: string;
  bio: string;
  experience: string;
  priceLabel: string;
  accent: string;
  status: ProfessionalStatus;
  rejectionReason?: string | null;
};

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  anonymousCode: string;
  birthDate?: string | null;
  acceptedTermsAt?: string | null;
  acceptedHealthDataAt?: string | null;
  professional?: ProfessionalInfo | null;
};

export type Category = {
  id: string;
  label: string;
  accent: string;
};

export type Professional = {
  id: string;
  name: string;
  role: string;
  specialty: string;
  crm: string;
  crmUf: string;
  bio: string;
  experience: string;
  price: string;
  accent: string;
  freeSlots: string[];
};

export type AvailabilitySlot = {
  id: string;
  slotLabel: string;
  startsAt: string | null;
  isActive: boolean;
  booked: boolean;
};

export type CommunityGroup = {
  id: string;
  name: string;
  description: string;
  theme: string;
  adminId: string | null;
  adminName?: string;
  adminSpecialty?: string;
  adminAccent?: string;
  members: number;
  joined: boolean;
  isTemporary: boolean;
  durationDays?: number;
  accent: string;
};

export type FeedPost = {
  id: string;
  groupId: string;
  groupName?: string;
  groupTheme?: string;
  userId: string;
  author: string;
  handle: string;
  body: string;
  time: string;
  createdAt: string;
  likes: number;
  comments: number;
  liked?: boolean;
  canDelete?: boolean;
};

export type PostComment = {
  id: string;
  postId: string;
  userId: string;
  author: string;
  handle: string;
  body: string;
  time: string;
  canDelete?: boolean;
};

export type MoodDay = {
  day: string;
  mood: number | null;
  note: string;
};

export type BookingStatus = "confirmed" | "rescheduled" | "canceled";

export type Booking = {
  id: string;
  doctorId: string;
  expertName: string;
  expertRole: string;
  specialty: string;
  price: string;
  accent: string;
  slot: string;
  preference: string;
  reason: string;
  status: BookingStatus;
  createdAt: number;
};

export type ProBooking = Booking & {
  patientId: string;
  patientName: string;
  patientEmail: string;
};

export type ConversationMessage = {
  id: number;
  sender: "me" | "them";
  text: string;
  time: string;
};

export type Conversation = {
  id: number;
  otherUserId: string;
  name: string;
  context: string;
  accent: string;
  messages: ConversationMessage[];
};

export type ProChat = Conversation & {
  patientEmail: string;
};

export type ChallengeRankEntry = {
  name: string;
  done: number;
  isYou: boolean;
};

export type BlockedUser = {
  id: string;
  name: string;
  createdAt: string;
};

export type PendingDoctorItem = {
  userId: string;
  name: string;
  email: string;
  crm: string;
  crmUf: string;
  specialty: string;
  status: ProfessionalStatus;
  rejectionReason: string | null;
  createdAt: string;
};

export type ReportTargetType = "post" | "comment" | "user" | "message";

export type ModerationReport = {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  status: "open" | "reviewed" | "dismissed";
  createdAt: string;
  reporterName: string;
  reportedUserId: string | null;
  reportedUserName: string | null;
  targetPreview: string | null;
};

export type AdminSurveyRow = {
  id: string;
  anonymousCode: string;
  instrument: "PANAS" | "SUS";
  sessionId: string;
  moment: "before" | "after" | "final";
  answers: Record<string, number>;
  scorePositive: number | null;
  scoreNegative: number | null;
  scoreTotal: number | null;
  createdAt: string;
};

export type AdminSurveySummary = {
  totalResponses: number;
  completedSessions: number;
  avgPositiveBefore: number | null;
  avgPositiveAfter: number | null;
  avgNegativeBefore: number | null;
  avgNegativeAfter: number | null;
  rows: AdminSurveyRow[];
};
