export type ConsultFilterKey = "Bago" | "Sinagot" | "Lahat";

export type MessageSender = "farmer" | "officer";

export interface ConversationMessage {
  id: string;
  from: MessageSender;
  text: string;
  sentAt?: string | null;
  tag?: string | null; // e.g. "Tantiya: 100% ng sakahan ang naapektuhan"
}

export interface ConsultationItem {
  id: string;
  farmerName: string;
  phone: string; // stored phone number
  barangay: string;
  subject: string;
  hasTechnicianRequest?: boolean;
  status: "Bago" | "Sinagot";
  messages: ConversationMessage[];
  maisySuggestion?: string | null;
  rawStatus?: string;
  createdAt?: string;
}

