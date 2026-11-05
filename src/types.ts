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
  accent: string;
};

export type CommunityGroup = {
  id: string;
  name: string;
  description: string;
  theme: string;
  adminId: string;
  members: number;
  joined: boolean;
  isTemporary: boolean;
  durationDays?: number;
  accent: string;
};

export type FeedPost = {
  id: string;
  author: string;
  handle: string;
  group: string;
  body: string;
  time: string;
  likes: number;
  comments: number;
  liked?: boolean;
};

export type ConversationMessage = {
  id: number;
  sender: string;
  text: string;
  time: string;
};

export type Conversation = {
  id: number;
  name: string;
  context: string;
  accent: string;
  messages: ConversationMessage[];
};
