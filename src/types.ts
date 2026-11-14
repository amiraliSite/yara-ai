export type AssistantMode = "live" | "deep" | "translate" | "general";

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  avatarColor: string;
  preferredMode: AssistantMode;
  createdAt: number;
}

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  data?: string; // base64 without data URL prefix (present during upload/send)
  previewUrl?: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  createdAt: number;
  attachments?: Attachment[];
  sources?: GroundingSource[];
  queries?: string[];
  isError?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  mode: AssistantMode;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface SavedNote {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  sources?: GroundingSource[];
}
