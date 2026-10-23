export interface ChatMessage {
    id: string;
    sender: "user" | "bot";
    text: string;
    sources?: string[];
    time: string;
    timestamp: number;
}

export interface ChatSession {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    messages: ChatMessage[];
}

export interface GroupedChatSessions {
    today: ChatSession[];
    yesterday: ChatSession[];
    last7Days: ChatSession[];
    older: ChatSession[];
}

const STORAGE_KEY = "medcare_copilot_chat_sessions_v2";
const EVENT_KEY = "medcare-chat-sessions-updated";

function notifyChange() {
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(EVENT_KEY));
    }
}

export const aiChatHistory = {
    getAllSessions(): ChatSession[] {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return parsed.sort((a, b) => b.updatedAt - a.updatedAt);
            }
        } catch (e) {
            console.error("Failed to parse chat sessions:", e);
        }
        return [];
    },

    saveSessions(sessions: ChatSession[]): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
            notifyChange();
        } catch (e) {
            console.error("Failed to save chat sessions:", e);
        }
    },

    createNewSession(initialTitle = "Cuộc trò chuyện mới"): ChatSession {
        const now = Date.now();
        const timeStr = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
        const newSession: ChatSession = {
            id: "session_" + now + "_" + Math.random().toString(36).substring(2, 7),
            title: initialTitle,
            createdAt: now,
            updatedAt: now,
            messages: [
                {
                    id: "msg_init_" + now,
                    sender: "bot",
                    text: "Chào Bác sĩ! Tôi là **MedCare Clinical Copilot** (sử dụng nền tảng **Google MedGemma 1.5 4B** kết hợp Cơ sở Tri thức Lâm sàng Bộ Y tế).\n\nBác sĩ có thể hỏi bất kỳ phác đồ chẩn đoán, xử trí cấp cứu, tra cứu tương tác thuốc hoặc soát an toàn đơn thuốc.",
                    sources: ["Google MedGemma 1.5 4B (Colab GPU)", "Dược thư Quốc gia Việt Nam", "Bộ Y tế"],
                    time: timeStr,
                    timestamp: now,
                },
            ],
        };
        const sessions = aiChatHistory.getAllSessions();
        sessions.unshift(newSession);
        aiChatHistory.saveSessions(sessions);
        return newSession;
    },

    getSession(sessionId: string): ChatSession | undefined {
        const sessions = aiChatHistory.getAllSessions();
        return sessions.find((s) => s.id === sessionId);
    },

    updateSession(session: ChatSession): void {
        const sessions = aiChatHistory.getAllSessions();
        const idx = sessions.findIndex((s) => s.id === session.id);
        if (idx >= 0) {
            sessions[idx] = { ...session, updatedAt: Date.now() };
        } else {
            sessions.unshift(session);
        }
        aiChatHistory.saveSessions(sessions);
    },

    deleteSession(sessionId: string): ChatSession[] {
        let sessions = aiChatHistory.getAllSessions();
        sessions = sessions.filter((s) => s.id !== sessionId);
        aiChatHistory.saveSessions(sessions);
        return sessions;
    },

    renameSession(sessionId: string, newTitle: string): void {
        const sessions = aiChatHistory.getAllSessions();
        const session = sessions.find((s) => s.id === sessionId);
        if (session) {
            session.title = newTitle.trim() || "Cuộc trò chuyện";
            session.updatedAt = Date.now();
            aiChatHistory.saveSessions(sessions);
        }
    },

    clearAllSessions(): void {
        localStorage.removeItem(STORAGE_KEY);
        notifyChange();
    },

    groupSessionsByDate(sessions: ChatSession[]): GroupedChatSessions {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
        const startOf7Days = startOfToday - 7 * 24 * 60 * 60 * 1000;

        const groups: GroupedChatSessions = {
            today: [],
            yesterday: [],
            last7Days: [],
            older: [],
        };

        for (const session of sessions) {
            const time = session.updatedAt || session.createdAt;
            if (time >= startOfToday) {
                groups.today.push(session);
            } else if (time >= startOfYesterday) {
                groups.yesterday.push(session);
            } else if (time >= startOf7Days) {
                groups.last7Days.push(session);
            } else {
                groups.older.push(session);
            }
        }

        return groups;
    },

    onSessionsChange(callback: () => void): () => void {
        if (typeof window === "undefined") return () => {};
        window.addEventListener(EVENT_KEY, callback);
        return () => window.removeEventListener(EVENT_KEY, callback);
    },
};

