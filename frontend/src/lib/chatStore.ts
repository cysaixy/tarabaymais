import type { RagChatSource } from "../services/ai.service";

/**
 * Local persistence for AI chat threads, scoped per crop cycle.
 *
 * The backend `/ai/chat` endpoint is stateless (no server-side sessions), so
 * conversations are cached in localStorage — the same offline-first pattern
 * used elsewhere in the app. Each crop cycle keeps its own thread so switching
 * farms/cycles shows the relevant conversation; questions asked with no cycle
 * selected go into a shared "general" thread.
 */
export interface StoredChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  sources?: RagChatSource[];
  farmContextUsed?: boolean;
}

const KEY_PREFIX = "tarabay_chat_thread:";
const GENERAL_KEY = "general";

/** Caps stored history so localStorage can't grow unbounded. */
const MAX_MESSAGES = 100;

const keyFor = (cropCycleId?: string): string =>
  `${KEY_PREFIX}${cropCycleId || GENERAL_KEY}`;

/** Loads the saved thread for a cycle (or the general thread). */
export const loadChatThread = (cropCycleId?: string): StoredChatMessage[] => {
  try {
    const raw = localStorage.getItem(keyFor(cropCycleId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredChatMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/** Saves the thread for a cycle, trimming to the most recent MAX_MESSAGES. */
export const saveChatThread = (
  cropCycleId: string | undefined,
  messages: StoredChatMessage[],
): void => {
  try {
    const trimmed = messages.slice(-MAX_MESSAGES);
    localStorage.setItem(keyFor(cropCycleId), JSON.stringify(trimmed));
  } catch {
    // Ignore quota/serialization errors — chat still works in-memory.
  }
};

/** Clears the saved thread for a cycle (used by "new conversation"). */
export const clearChatThread = (cropCycleId?: string): void => {
  try {
    localStorage.removeItem(keyFor(cropCycleId));
  } catch {
    // no-op
  }
};
