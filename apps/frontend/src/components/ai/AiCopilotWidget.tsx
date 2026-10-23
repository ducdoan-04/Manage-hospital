 import React, { useState, useRef, useEffect } from "react";
import {
    AlertTriangle,
    Bot,
    Check,
    ChevronDown,
    Edit2,
    HeartPulse,
    History,
    Maximize2,
    MessageSquare,
    Mic,
    MicOff,
    Minimize2,
    PanelLeft,
    PanelLeftClose,
    Pill,
    Plus,
    RotateCcw,
    Send,
    Sparkles,
    Trash2,
    X,
} from "lucide-react";
import { aiService } from "../../services/ai";
import { aiChatHistory, type ChatMessage, type ChatSession } from "../../services/aiChatHistory";
import { FormattedMedicalMessage } from "./FormattedMedicalMessage";

const QUICK_SUGGESTIONS = [
    { label: "🚑 Sốc phản vệ độ 2", prompt: "Bệnh nhân nghi sốc phản vệ độ 2 cần tiêm Adrenaline như thế nào theo Thông tư 51/2017/TT-BYT?" },
    { label: "🫁 Viêm phổi CAP Bộ Y Tế", prompt: "Phác đồ kháng sinh ban đầu cho viêm phổi cộng đồng CAP theo QĐ 4815/QĐ-BYT?" },
    { label: "💊 Warfarin & Kháng sinh", prompt: "Tương tác nguy hiểm giữa Warfarin và Ciprofloxacin/Metronidazole?" },
    { label: "⚠️ Metformin & Cản quang", prompt: "Lưu ý an toàn khi dùng Metformin ở bệnh nhân chụp CT có thuốc cản quang?" },
    { label: "⏰ Giờ hệ thống", prompt: "mấy giờ rồi" },
];

export function AiCopilotWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false); // Sidebar history drawer in normal mode
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); // Sidebar collapse in expanded mode
    const [tab, setTab] = useState<"chat" | "rx" | "news2">("chat");
    const [inputMsg, setInputMsg] = useState("");
    const [loading, setLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Multi-session state (ChatGPT style)
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string>("");
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
    const [editTitleInput, setEditTitleInput] = useState("");

    // Load sessions from localStorage on init & listen to updates
    useEffect(() => {
        let loaded = aiChatHistory.getAllSessions();
        if (loaded.length === 0) {
            const initial = aiChatHistory.createNewSession("Tư vấn lâm sàng tổng quát");
            loaded = [initial];
        }
        setSessions(loaded);
        setActiveSessionId(loaded[0].id);

        const unsub = aiChatHistory.onSessionsChange(() => {
            const fresh = aiChatHistory.getAllSessions();
            if (fresh.length > 0) {
                setSessions(fresh);
            }
        });
        return unsub;
    }, []);

    // Get current active session
    const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];
    const currentMessages = activeSession?.messages || [];

    // Auto-scroll chat to bottom
    useEffect(() => {
        if (isOpen && tab === "chat") {
            chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [currentMessages, loading, isOpen, tab]);

    // Quick RX check
    const [quickMeds, setQuickMeds] = useState("Clopidogrel, Omeprazole");
    const [quickAllergies, setQuickAllergies] = useState("Penicillin");
    const [quickRxAlert, setQuickRxAlert] = useState<string | null>(null);

    // Quick NEWS2
    const [rr, setRr] = useState(24);
    const [spo2, setSpo2] = useState(92);
    const [quickNewsScore, setQuickNewsScore] = useState<number | null>(null);

    // Voice Dictation
    const [isListeningVoice, setIsListeningVoice] = useState(false);
    const widgetRecRef = useRef<any>(null);

    const handleToggleVoice = () => {
        const SpeechRecognition =
            (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        if (!SpeechRecognition) {
            alert("Trình duyệt không hỗ trợ Web Speech API. Vui lòng dùng Chrome hoặc Edge.");
            return;
        }

        if (isListeningVoice) {
            if (widgetRecRef.current) {
                try { widgetRecRef.current.stop(); } catch {}
            }
            setIsListeningVoice(false);
            return;
        }

        try {
            const rec = new SpeechRecognition();
            widgetRecRef.current = rec;
            rec.continuous = true;
            rec.interimResults = true;
            rec.lang = "vi-VN";

            rec.onstart = () => setIsListeningVoice(true);
            rec.onresult = (event: any) => {
                let text = "";
                for (let i = 0; i < event.results.length; i++) {
                    text += event.results[i][0].transcript + " ";
                }
                if (text.trim()) {
                    setInputMsg(text.trim());
                }
            };
            rec.onerror = (e: any) => {
                if (e.error !== "no-speech") {
                    console.warn("Widget speech error:", e.error);
                }
            };
            rec.onend = () => setIsListeningVoice(false);
            rec.start();
        } catch (err: any) {
            console.error("Widget mic start error:", err);
            setIsListeningVoice(false);
        }
    };

    // Create New Chat Session (+ Đoạn chat mới)
    const handleNewChat = () => {
        const newSession = aiChatHistory.createNewSession("Cuộc trò chuyện mới");
        const updated = [newSession, ...sessions.filter((s) => s.id !== newSession.id)];
        setSessions(updated);
        setActiveSessionId(newSession.id);
        setInputMsg("");
        if (!isExpanded) setIsHistoryOpen(false);
    };

    // Switch session
    const handleSelectSession = (id: string) => {
        setActiveSessionId(id);
        if (!isExpanded) setIsHistoryOpen(false);
    };

    // Inline rename session
    const handleStartRename = (e: React.MouseEvent, s: ChatSession) => {
        e.stopPropagation();
        setEditingSessionId(s.id);
        setEditTitleInput(s.title);
    };

    const handleSaveRename = (e: React.MouseEvent | React.KeyboardEvent, id: string) => {
        e.stopPropagation();
        if (editTitleInput.trim()) {
            aiChatHistory.renameSession(id, editTitleInput.trim());
            setSessions(aiChatHistory.getAllSessions());
        }
        setEditingSessionId(null);
    };

    // Delete a session
    const handleDeleteSession = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const remaining = aiChatHistory.deleteSession(id);
        if (remaining.length === 0) {
            const fresh = aiChatHistory.createNewSession("Cuộc trò chuyện mới");
            setSessions([fresh]);
            setActiveSessionId(fresh.id);
        } else {
            setSessions(remaining);
            if (activeSessionId === id) {
                setActiveSessionId(remaining[0].id);
            }
        }
    };

    // Clear all history
    const handleClearAllHistory = () => {
        if (window.confirm("Bác sĩ có chắc chắn muốn xóa toàn bộ lịch sử các phiên chat không?")) {
            aiChatHistory.clearAllSessions();
            const fresh = aiChatHistory.createNewSession("Cuộc trò chuyện mới");
            setSessions([fresh]);
            setActiveSessionId(fresh.id);
        }
    };

    // Send chat message
    const handleSendChat = async (overrideMsg?: string) => {
        const msg = (overrideMsg || inputMsg).trim();
        if (!msg || !activeSession) return;

        if (!overrideMsg) setInputMsg("");
        const now = Date.now();
        const nowTime = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

        const userMsg: ChatMessage = {
            id: "msg_user_" + now,
            sender: "user",
            text: msg,
            time: nowTime,
            timestamp: now,
        };

        // If first user message, update session title to user query (like ChatGPT)
        let newTitle = activeSession.title;
        if (activeSession.title === "Cuộc trò chuyện mới" || activeSession.title === "Tư vấn lâm sàng tổng quát") {
            newTitle = msg.length > 36 ? msg.slice(0, 36) + "..." : msg;
        }

        const updatedMessages = [...activeSession.messages, userMsg];
        const updatedSession: ChatSession = {
            ...activeSession,
            title: newTitle,
            updatedAt: now,
            messages: updatedMessages,
        };

        // Update state & localStorage
        aiChatHistory.updateSession(updatedSession);
        setSessions(aiChatHistory.getAllSessions());
        setLoading(true);

        try {
            const res = await aiService.chat(msg);
            const botNow = Date.now();
            const botMsg: ChatMessage = {
                id: "msg_bot_" + botNow,
                sender: "bot",
                text: res.reply,
                sources: res.sources,
                time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
                timestamp: botNow,
            };

            const finalSession: ChatSession = {
                ...updatedSession,
                updatedAt: botNow,
                messages: [...updatedMessages, botMsg],
            };
            aiChatHistory.updateSession(finalSession);
            setSessions(aiChatHistory.getAllSessions());
        } catch (err: any) {
            console.error("AI chat error:", err);
            const errNow = Date.now();
            const errMsg: ChatMessage = {
                id: "msg_err_" + errNow,
                sender: "bot",
                text: `Lỗi kết nối máy chủ AI: ${err.message || "Vui lòng kiểm tra lại kết nối Colab Endpoint hoặc thử lại sau."}`,
                time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
                timestamp: errNow,
            };

            const finalSession: ChatSession = {
                ...updatedSession,
                updatedAt: errNow,
                messages: [...updatedMessages, errMsg],
            };
            aiChatHistory.updateSession(finalSession);
            setSessions(aiChatHistory.getAllSessions());
        } finally {
            setLoading(false);
        }
    };

    const handleQuickRxCheck = async () => {
        setLoading(true);
        try {
            const meds = quickMeds.split(",").map((s) => ({ name: s.trim() }));
            const allergies = quickAllergies.split(",").map((s) => s.trim());
            const res = await aiService.checkPrescription({ medications: meds, allergies });
            if (res.alerts.length > 0) {
                setQuickRxAlert(`${res.alerts[0].title}: ${res.alerts[0].message}`);
            } else {
                setQuickRxAlert("Đơn thuốc an toàn! Không phát hiện tương tác nguy hiểm theo Dược thư Quốc gia.");
            }
        } catch (err: any) {
            setQuickRxAlert(`Lỗi kiểm tra: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleQuickNews2 = async () => {
        setLoading(true);
        try {
            const res = await aiService.calculateNews2({
                respiratoryRate: rr,
                spO2: spo2,
                onOxygen: true,
                systolicBP: 100,
                pulseRate: 110,
                consciousness: "ALERT",
                temperatureCelsius: 38.5,
            });
            setQuickNewsScore(res.totalScore);
        } finally {
            setLoading(false);
        }
    };

    // Date grouping for ChatGPT-style sidebar
    const grouped = aiChatHistory.groupSessionsByDate(sessions);
    const dateGroups = [
        { label: "Hôm nay", items: grouped.today },
        { label: "Hôm qua", items: grouped.yesterday },
        { label: "7 ngày trước", items: grouped.last7Days },
        { label: "Trước đó", items: grouped.older },
    ].filter((g) => g.items.length > 0);

    const isSidebarVisible = isExpanded ? !isSidebarCollapsed : isHistoryOpen;

    return (
        <>
            {/* Backdrop for Expanded Modal */}
            {isOpen && isExpanded && (
                <div
                    className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 transition-opacity animate-in fade-in duration-200"
                    onClick={() => setIsExpanded(false)}
                />
            )}

            <div className={isExpanded ? "" : "fixed bottom-6 right-6 z-50"}>
                {!isOpen ? (
                    <button
                        onClick={() => setIsOpen(true)}
                        className="flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-teal-600 via-teal-700 to-cyan-800 hover:from-teal-500 hover:to-cyan-700 text-white rounded-full shadow-2xl shadow-teal-700/40 border border-teal-300/40 transition-all transform hover:scale-105 active:scale-95 group"
                        title="Mở Trợ lý Y tế AI Copilot"
                    >
                        <div className="relative">
                            <Bot size={24} className="animate-bounce" />
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full ring-2 ring-white animate-pulse" />
                        </div>
                        <div className="text-left">
                            <div className="font-extrabold text-xs tracking-wide uppercase flex items-center gap-1.5">
                                MedCare Copilot AI
                                <Sparkles size={13} className="text-amber-300 animate-spin" />
                            </div>
                            <div className="text-[10px] text-teal-200 font-medium">Google MedGemma 1.5 4B</div>
                        </div>
                    </button>
                ) : (
                    <div
                        className={
                            isExpanded
                                ? "fixed inset-3 sm:inset-6 md:inset-8 z-50 bg-white rounded-3xl shadow-2xl border border-teal-300/90 flex flex-col overflow-hidden max-w-6xl mx-auto animate-in zoom-in-95 duration-200"
                                : "w-[480px] sm:w-[540px] md:w-[570px] h-[670px] max-h-[88vh] bg-white rounded-3xl shadow-2xl border border-teal-200/90 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200"
                        }
                    >
                        {/* Header */}
                        <div className="px-4 sm:px-5 py-3.5 bg-gradient-to-r from-teal-800 via-teal-900 to-slate-900 text-white flex items-center justify-between border-b border-teal-700/60 flex-shrink-0">
                            <div className="flex items-center gap-2.5">
                                {/* Toggle Sidebar / History Button */}
                                {isExpanded ? (
                                    <button
                                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                                        className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1.5 text-xs font-semibold"
                                        title={isSidebarCollapsed ? "Mở danh sách phiên chat" : "Thu gọn danh sách phiên chat"}
                                    >
                                        {isSidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                                        className={`p-1.5 rounded-lg text-white/80 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-semibold ${
                                            isHistoryOpen ? "bg-white/20 text-white" : "hover:bg-white/10"
                                        }`}
                                        title="Lịch sử các phiên chat (ChatGPT style)"
                                    >
                                        <History size={17} />
                                        <span className="hidden sm:inline">Lịch sử</span>
                                        <span className="px-1.5 py-0.2 bg-teal-500/40 rounded-full text-[10px]">
                                            {sessions.length}
                                        </span>
                                    </button>
                                )}

                                <div className="h-5 w-[1px] bg-white/20 mx-1 hidden sm:block" />

                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-teal-400/20 border border-teal-400/30 flex items-center justify-center text-teal-300 shadow-inner">
                                        <Bot size={18} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-xs sm:text-sm tracking-tight flex items-center gap-1.5">
                                            MedCare Copilot
                                            <span className="text-[9px] bg-emerald-500/30 text-emerald-200 px-1.5 py-0.2 rounded-full font-semibold border border-emerald-400/30">
                                                AI
                                            </span>
                                        </h4>
                                        <p className="text-[10px] text-teal-200/90 truncate max-w-[200px] sm:max-w-[280px]">
                                            {activeSession?.title || "Hỗ trợ ra quyết định lâm sàng CDSS"}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                                {/* New Chat Button (+ Đoạn chat mới) */}
                                <button
                                    onClick={handleNewChat}
                                    className="p-1.5 hover:bg-white/10 rounded-lg text-white/90 hover:text-white transition-colors flex items-center gap-1 text-xs font-bold bg-teal-600/60 hover:bg-teal-500/80 border border-teal-400/40 px-2.5 py-1"
                                    title="Tạo cuộc trò chuyện mới"
                                >
                                    <span className="hidden sm:inline"><Plus size={15} /></span>
                                </button>

                                {/* Expand / Minimize toggle button */}
                                <button
                                    onClick={() => setIsExpanded(!isExpanded)}
                                    className="p-1.5 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition-colors"
                                    title={isExpanded ? "Thu nhỏ cửa sổ" : "Mở rộng toàn màn hình"}
                                >
                                    {isExpanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
                                </button>

                                {/* Close button */}
                                <button
                                    onClick={() => {
                                        setIsExpanded(false);
                                        setIsOpen(false);
                                    }}
                                    className="p-1.5 hover:bg-white/10 rounded-lg text-white/80 hover:text-rose-300 transition-colors"
                                    title="Đóng trợ lý"
                                >
                                    <X size={19} />
                                </button>
                            </div>
                        </div>

                        {/* Quick Tabs */}
                        <div className="flex border-b text-xs bg-slate-50/90 flex-shrink-0">
                            <button
                                onClick={() => setTab("chat")}
                                className={`flex-1 py-2 font-bold text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                                    tab === "chat"
                                        ? "border-teal-600 text-teal-800 bg-white shadow-sm"
                                        : "border-transparent text-gray-500 hover:text-gray-800"
                                }`}
                            >
                                <span>💬</span>
                                <span>Hỏi đáp Phác đồ BYT</span>
                            </button>
                            <button
                                onClick={() => setTab("rx")}
                                className={`flex-1 py-2 font-bold text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                                    tab === "rx"
                                        ? "border-amber-600 text-amber-800 bg-white shadow-sm"
                                        : "border-transparent text-gray-500 hover:text-gray-800"
                                }`}
                            >
                                <span>💊</span>
                                <span>Soát Đơn Thuốc</span>
                            </button>
                            <button
                                onClick={() => setTab("news2")}
                                className={`flex-1 py-2 font-bold text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                                    tab === "news2"
                                        ? "border-rose-600 text-rose-800 bg-white shadow-sm"
                                        : "border-transparent text-gray-500 hover:text-gray-800"
                                }`}
                            >
                                <span>🚨</span>
                                <span>Tính Điểm NEWS2</span>
                            </button>
                        </div>

                        {/* Main Container: Sidebar + Chat Area */}
                        <div className="flex-1 flex overflow-hidden relative">
                            {/* SIDEBAR: ChatGPT-Style Chat History */}
                            {isSidebarVisible && (
                                <div
                                    className={`${
                                        isExpanded
                                            ? "w-72 border-r border-slate-200 bg-slate-50/90 flex flex-col flex-shrink-0"
                                            : "absolute inset-y-0 left-0 w-72 bg-white/95 backdrop-blur-md border-r border-slate-200 shadow-xl z-20 flex flex-col animate-in slide-in-from-left duration-200"
                                    }`}
                                >
                                    {/* Sidebar Header */}
                                    <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-100/60">
                                        <button
                                            onClick={handleNewChat}
                                            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                                        >
                                            <Plus size={15} />
                                            <span>Cuộc trò chuyện mới</span>
                                        </button>

                                        {!isExpanded && (
                                            <button
                                                onClick={() => setIsHistoryOpen(false)}
                                                className="p-1.5 ml-2 hover:bg-slate-200 rounded-lg text-slate-500"
                                                title="Đóng sidebar"
                                            >
                                                <X size={16} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Sessions List Grouped By Date (ChatGPT style) */}
                                    <div className="flex-1 overflow-y-auto p-2.5 space-y-3">
                                        {dateGroups.map((group, gIdx) => (
                                            <div key={gIdx} className="space-y-1">
                                                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                    {group.label}
                                                </div>

                                                {group.items.map((s) => {
                                                    const isActive = s.id === activeSessionId;
                                                    const isEditing = editingSessionId === s.id;

                                                    return (
                                                        <div
                                                            key={s.id}
                                                            onClick={() => !isEditing && handleSelectSession(s.id)}
                                                            className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs transition-all ${
                                                                isActive
                                                                    ? "bg-teal-50 border border-teal-200/90 text-teal-900 font-bold shadow-sm"
                                                                    : "hover:bg-slate-100 text-slate-700 border border-transparent"
                                                            }`}
                                                        >
                                                            {isEditing ? (
                                                                <div
                                                                    className="flex items-center gap-1.5 w-full"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <input
                                                                        type="text"
                                                                        value={editTitleInput}
                                                                        onChange={(e) => setEditTitleInput(e.target.value)}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === "Enter") handleSaveRename(e, s.id);
                                                                            if (e.key === "Escape") setEditingSessionId(null);
                                                                        }}
                                                                        autoFocus
                                                                        className="flex-1 px-2 py-1 text-xs border border-teal-400 rounded-lg outline-none bg-white text-slate-800"
                                                                    />
                                                                    <button
                                                                        onClick={(e) => handleSaveRename(e, s.id)}
                                                                        className="p-1 text-teal-600 hover:bg-teal-100 rounded"
                                                                        title="Lưu"
                                                                    >
                                                                        <Check size={13} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setEditingSessionId(null)}
                                                                        className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                                                                        title="Hủy"
                                                                    >
                                                                        <X size={13} />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div className="flex items-center gap-2 overflow-hidden flex-1 pr-1">
                                                                        <MessageSquare
                                                                            size={14}
                                                                            className={
                                                                                isActive
                                                                                    ? "text-teal-600 flex-shrink-0"
                                                                                    : "text-slate-400 flex-shrink-0"
                                                                            }
                                                                        />
                                                                        <div className="truncate text-left">
                                                                            <div className="truncate">{s.title}</div>
                                                                            <div className="text-[10px] font-normal text-slate-400 font-mono">
                                                                                {new Date(s.updatedAt).toLocaleTimeString("vi-VN", {
                                                                                    hour: "2-digit",
                                                                                    minute: "2-digit",
                                                                                })}
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                                        <button
                                                                            onClick={(e) => handleStartRename(e, s)}
                                                                            className="p-1 hover:bg-teal-100 hover:text-teal-700 rounded text-slate-400"
                                                                            title="Đổi tên đoạn chat"
                                                                        >
                                                                            <Edit2 size={12} />
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => handleDeleteSession(e, s.id)}
                                                                            className="p-1 hover:bg-rose-100 hover:text-rose-600 rounded text-slate-400"
                                                                            title="Xóa phiên này"
                                                                        >
                                                                            <Trash2 size={12} />
                                                                        </button>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Sidebar Footer */}
                                    {sessions.length > 1 && (
                                        <div className="p-2.5 border-t border-slate-200 bg-slate-50 text-center">
                                            <button
                                                onClick={handleClearAllHistory}
                                                className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold hover:underline flex items-center justify-center gap-1 w-full"
                                            >
                                                <Trash2 size={12} />
                                                <span>Xóa tất cả lịch sử</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* CHAT CONTENT AREA */}
                            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/40">
                                {/* Body */}
                                <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                                    {tab === "chat" && (
                                        <div className={`space-y-4 ${isExpanded ? "max-w-4xl mx-auto" : ""}`}>
                                            {/* Starter cards if session has no user messages */}
                                            {currentMessages.length <= 1 && (
                                                <div className="my-4 max-w-xl mx-auto space-y-3">
                                                    <div className="text-center space-y-1">
                                                        <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center mx-auto shadow-md shadow-teal-600/30">
                                                            <Bot size={22} />
                                                        </div>
                                                        <h4 className="font-extrabold text-sm text-slate-800">
                                                            MedCare Clinical Copilot (ChatGPT AI)
                                                        </h4>
                                                        <p className="text-[11px] text-slate-500">
                                                            Chọn câu hỏi mẫu bên dưới để bắt đầu phiên tư vấn:
                                                        </p>
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                                        <div
                                                            onClick={() => handleSendChat("Bệnh nhân nghi sốc phản vệ độ 2 cần tiêm Adrenaline như thế nào theo Thông tư 51/2017/TT-BYT?")}
                                                            className="p-2.5 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-xl cursor-pointer transition-all shadow-sm group text-left"
                                                        >
                                                            <div className="font-bold text-xs text-slate-800 group-hover:text-teal-700 flex items-center gap-1.5">
                                                                <span>🚑</span> Cấp cứu phản vệ
                                                            </div>
                                                            <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                                                                Phác đồ tiêm Adrenaline Thông tư 51/2017/TT-BYT
                                                            </div>
                                                        </div>

                                                        <div
                                                            onClick={() => handleSendChat("Phác đồ kháng sinh ban đầu cho viêm phổi cộng đồng CAP theo QĐ 4815/QĐ-BYT?")}
                                                            className="p-2.5 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-xl cursor-pointer transition-all shadow-sm group text-left"
                                                        >
                                                            <div className="font-bold text-xs text-slate-800 group-hover:text-teal-700 flex items-center gap-1.5">
                                                                <span>🫁</span> Viêm phổi CAP
                                                            </div>
                                                            <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                                                                Lựa chọn kháng sinh theo QĐ 4815/QĐ-BYT
                                                            </div>
                                                        </div>

                                                        <div
                                                            onClick={() => handleSendChat("Tương tác nguy hiểm giữa Warfarin và Ciprofloxacin/Metronidazole?")}
                                                            className="p-2.5 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-xl cursor-pointer transition-all shadow-sm group text-left"
                                                        >
                                                            <div className="font-bold text-xs text-slate-800 group-hover:text-teal-700 flex items-center gap-1.5">
                                                                <span>💊</span> Tương tác Warfarin
                                                            </div>
                                                            <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                                                                Nguy cơ xuất huyết & kéo dài INR
                                                            </div>
                                                        </div>

                                                        <div
                                                            onClick={() => handleSendChat("Bệnh nhân sau phẫu thuật có nhịp thở 25 lần/phút, SpO2 92% khí phòng, huyết áp 95/60 mmHg, mạch 110 lần/phút, sốt 38.6 độ C. Tính nguy cơ NEWS2 và có cần báo động Sepsis không?")}
                                                            className="p-2.5 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-xl cursor-pointer transition-all shadow-sm group text-left"
                                                        >
                                                            <div className="font-bold text-xs text-slate-800 group-hover:text-teal-700 flex items-center gap-1.5">
                                                                <span>🚨</span> Báo động Sepsis / NEWS2
                                                            </div>
                                                            <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                                                                Đánh giá suy cơ quan & Sepsis 1 Giờ
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            {currentMessages.map((log) => (
                                                <div
                                                    key={log.id}
                                                    className={`flex ${
                                                        log.sender === "user" ? "justify-end" : "justify-start"
                                                    }`}
                                                >
                                                    {log.sender === "user" ? (
                                                        <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-2xl rounded-br-none shadow-md px-4 py-2.5 max-w-[85%] text-xs sm:text-sm leading-relaxed font-medium">
                                                            {log.text}
                                                            {log.time && (
                                                                <div className="text-[10px] text-teal-200 mt-1 text-right font-mono">
                                                                    {log.time}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="bg-white border border-slate-200/90 rounded-2xl rounded-tl-none shadow-sm p-4 max-w-[95%] sm:max-w-[90%] w-full">
                                                            <FormattedMedicalMessage
                                                                content={log.text}
                                                                sources={log.sources}
                                                                time={log.time}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            ))}

                                            {/* Loading State */}
                                            {loading && (
                                                <div className="flex justify-start">
                                                    <div className="bg-white border border-teal-200 rounded-2xl rounded-tl-none shadow-sm p-3.5 max-w-[85%] flex items-center gap-3 text-xs text-teal-900">
                                                        <div className="w-7 h-7 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 animate-pulse">
                                                            <Sparkles size={16} className="animate-spin" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <div className="font-bold flex items-center gap-1.5">
                                                                Google MedGemma 1.5 4B đang phân tích...
                                                                <span className="flex gap-1">
                                                                    <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce" />
                                                                    <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                                                                    <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                                                                </span>
                                                            </div>
                                                            <div className="text-[11px] text-slate-500">
                                                                Đối chiếu phác đồ Bộ Y tế & Dược thư Quốc gia
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div ref={chatEndRef} />
                                        </div>
                                    )}

                                    {tab === "rx" && (
                                        <div className={`space-y-3.5 ${isExpanded ? "max-w-2xl mx-auto py-4" : ""}`}>
                                            <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-900 text-xs">
                                                💡 Nhập danh sách thuốc và tiền sử dị ứng để AI kiểm tra tương tác chéo, chống chỉ định theo Dược thư Quốc gia.
                                            </div>
                                            <div>
                                                <label className="font-bold text-gray-700 text-xs">Thuốc cần kiểm tra (cách nhau dấu phẩy):</label>
                                                <input
                                                    type="text"
                                                    value={quickMeds}
                                                    onChange={(e) => setQuickMeds(e.target.value)}
                                                    className="w-full p-2.5 border rounded-xl mt-1 text-xs outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                                                    placeholder="Ví dụ: Clopidogrel, Omeprazole, Warfarin..."
                                                />
                                            </div>
                                            <div>
                                                <label className="font-bold text-gray-700 text-xs">Tiền sử dị ứng thuốc:</label>
                                                <input
                                                    type="text"
                                                    value={quickAllergies}
                                                    onChange={(e) => setQuickAllergies(e.target.value)}
                                                    className="w-full p-2.5 border rounded-xl mt-1 text-xs outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                                                    placeholder="Ví dụ: Penicillin, Aspirin..."
                                                />
                                            </div>
                                            <button
                                                onClick={handleQuickRxCheck}
                                                disabled={loading}
                                                className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
                                            >
                                                {loading ? "Đang quét tương tác..." : "Kiểm tra an toàn đơn thuốc ngay"}
                                            </button>
                                            {quickRxAlert && (
                                                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 text-xs leading-relaxed font-medium">
                                                    {quickRxAlert}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {tab === "news2" && (
                                        <div className={`space-y-4 ${isExpanded ? "max-w-2xl mx-auto py-4" : ""}`}>
                                            <div className="p-3 bg-rose-50 border border-rose-200/80 rounded-xl text-rose-900 text-xs">
                                                🚨 Thang điểm NEWS2 (National Early Warning Score) chuẩn Bộ Y tế giúp phát hiện sớm suy hô hấp, nhiễm trùng huyết và nguy cơ tử vong.
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-xs font-bold text-gray-700">
                                                    <span>Nhịp thở:</span>
                                                    <span className="text-teal-700">{rr} lần/phút</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min={8}
                                                    max={35}
                                                    value={rr}
                                                    onChange={(e) => setRr(+e.target.value)}
                                                    className="w-full accent-teal-600"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-xs font-bold text-gray-700">
                                                    <span>Độ bão hòa oxy SpO2:</span>
                                                    <span className="text-teal-700">{spo2}%</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min={80}
                                                    max={100}
                                                    value={spo2}
                                                    onChange={(e) => setSpo2(+e.target.value)}
                                                    className="w-full accent-teal-600"
                                                />
                                            </div>
                                            <button
                                                onClick={handleQuickNews2}
                                                disabled={loading}
                                                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
                                            >
                                                {loading ? "Đang tính..." : "Tính điểm cảnh báo sớm NEWS2"}
                                            </button>
                                            {quickNewsScore !== null && (
                                                <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between shadow-md">
                                                    <div>
                                                        <div className="text-xs text-slate-300 font-medium">Tổng điểm cảnh báo sớm:</div>
                                                        <div className="text-xs text-rose-300">
                                                            {quickNewsScore >= 7
                                                                ? "Nguy cơ cao - Cấp cứu khẩn"
                                                                : quickNewsScore >= 5
                                                                ? "Nguy cơ trung bình - Theo dõi sát"
                                                                : "Nguy cơ thấp"}
                                                        </div>
                                                    </div>
                                                    <span className="text-2xl font-black text-rose-400">{quickNewsScore} điểm</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Footer for Chat */}
                                {tab === "chat" && (
                                    <div className="border-t border-slate-200 bg-white p-3 sm:p-3.5 space-y-2.5 flex-shrink-0">
                                        {/* Quick Prompt Suggestions */}
                                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
                                            <span className="text-slate-400 font-semibold flex-shrink-0">Gợi ý:</span>
                                            {QUICK_SUGGESTIONS.map((item, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => handleSendChat(item.prompt)}
                                                    disabled={loading}
                                                    className="flex-shrink-0 px-2.5 py-1 bg-slate-100 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300 border border-slate-200 rounded-full text-slate-700 transition-colors"
                                                >
                                                    {item.label}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Input Bar */}
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={inputMsg}
                                                onChange={(e) => setInputMsg(e.target.value)}
                                                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendChat()}
                                                placeholder={isListeningVoice ? "Đang lắng nghe giọng nói của bạn..." : "Hỏi phác đồ Bộ Y Tế, tương tác thuốc, liều dùng..."}
                                                disabled={loading}
                                                className={`flex-1 px-3.5 py-2.5 border rounded-xl text-xs sm:text-sm outline-none transition-all ${
                                                    isListeningVoice
                                                        ? "border-rose-400 bg-rose-50/40 ring-2 ring-rose-400/20"
                                                        : "border-slate-200 bg-slate-50/50 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                                }`}
                                            />
                                            <button
                                                type="button"
                                                onClick={handleToggleVoice}
                                                disabled={loading}
                                                title={isListeningVoice ? "Dừng thu âm" : "Nói bằng Micro"}
                                                className={`px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center transition-all ${
                                                    isListeningVoice
                                                        ? "bg-rose-500 text-white animate-pulse shadow-sm shadow-rose-500/30"
                                                        : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                                                }`}
                                            >
                                                {isListeningVoice ? <MicOff size={15} /> : <Mic size={15} />}
                                            </button>
                                            <button
                                                onClick={() => handleSendChat()}
                                                disabled={loading || !inputMsg.trim()}
                                                className="px-4 py-2.5 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 disabled:opacity-50 text-white rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all shadow-sm"
                                            >
                                                <Send size={14} />
                                                <span>Gửi</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
