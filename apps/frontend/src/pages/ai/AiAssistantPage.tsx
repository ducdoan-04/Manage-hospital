import React, { useState, useEffect, useRef } from "react";
import {
    Activity,
    AlertCircle,
    AlertTriangle,
    Bot,
    Check,
    CheckCircle2,
    Clock,
    Copy,
    Edit2,
    FileText,
    HeartPulse,
    History,
    Info,
    MessageSquare,
    Mic,
    MicOff,
    PanelLeft,
    PanelLeftClose,
    Pill,
    Play,
    Plus,
    Printer,
    RefreshCw,
    Save,
    Send,
    ShieldAlert,
    ShieldCheck,
    ExternalLink,
    Sparkles,
    Trash2,
    UserCheck,
    Volume2,
    Wand2,
    X,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
    aiService,
    type BhytAuditResult,
    type EmrExtractedResult,
    type News2Result,
    type PatientExplanationResult,
    type PrescriptionSafetyResult,
    type SavedEmrRecord,
} from "../../services/ai";
import { aiChatHistory, type ChatMessage, type ChatSession } from "../../services/aiChatHistory";
import { FormattedMedicalMessage } from "../../components/ai/FormattedMedicalMessage";
import { carePlansService, type CarePlanResident } from "../../services/carePlans";
import { MedicalWordEditorModal } from "../../components/ai/MedicalWordEditorModal";

export default function AiAssistantPage() {
    const [activeTab, setActiveTab] = useState<"emr" | "rx" | "news2" | "bhyt" | "patient" | "chat">("emr");
    const [isLoading, setIsLoading] = useState(false);

    // ==========================================
    // TAB 1: SPEECH TO EMR (Real Web Speech API + Clinical AI)
    // ==========================================
    const CLINICAL_PRESETS = [
        {
            label: "Viêm phổi cấp",
            icon: "🫁",
            text: "Bệnh nhân sốt cao 39 độ C liên tục 2 ngày, ho có đờm vàng đặc, khó thở khi leo cầu thang, nghe phổi có ran nổ rải rác đáy phổi phải. SpO2 93% khí phòng. Đề nghị chụp X-quang phổi và làm xét nghiệm máu CRP.",
        },
        {
            label: "Loét dạ dày tá tràng",
            icon: "🩸",
            text: "Bệnh nhân đau quặn thượng vị từng cơn liên quan đến bữa ăn, ợ hơi ợ chua nóng rát sau xương ức 3 tuần nay. Đã từng test HP dương tính. Đề nghị nội soi dạ dày tá tràng và làm xét nghiệm HP.",
        },
        {
            label: "Tăng huyết áp kịch phát",
            icon: "❤️",
            text: "Bệnh nhân nam 65 tuổi chóng mặt, đau căng nửa đầu, huyết áp đo tại phòng khám 175/105 mmHg, mạch 92 lần/phút. Tiền sử tăng huyết áp đang uống Amlodipine 5mg. Đề nghị đo điện tim ECG và đánh giá cơ quan đích.",
        },
        {
            label: "Đái tháo đường týp 2",
            icon: "🍬",
            text: "Bệnh nhân mệt mỏi sụt 3kg trong 1 tháng, ăn nhiều uống nhiều nhưng khát nước và tiểu đêm 4-5 lần. Đường huyết đói test nhanh 13.5 mmol/L. Đề nghị định lượng Glucose và HbA1c.",
        },
    ];

    const [speechText, setSpeechText] = useState(CLINICAL_PRESETS[0].text);
    const [isListening, setIsListening] = useState(false);
    const [isSimulatingVoice, setIsSimulatingVoice] = useState(false);
    const [speechError, setSpeechError] = useState<string | null>(null);
    const [emrResult, setEmrResult] = useState<EmrExtractedResult | null>(null);
    const [copySuccess, setCopySuccess] = useState(false);
    const [fillSuccess, setFillSuccess] = useState(false);
    const [isSavingEmr, setIsSavingEmr] = useState(false);
    const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
    const [residents, setResidents] = useState<CarePlanResident[]>([]);
    const [selectedResidentId, setSelectedResidentId] = useState<string>("");
    const [isWordEditorOpen, setIsWordEditorOpen] = useState(false);
    const [savedEmrList, setSavedEmrList] = useState<SavedEmrRecord[]>([]);
    const [isLoadingSavedEmr, setIsLoadingSavedEmr] = useState(false);
    const [lastSavedRecordId, setLastSavedRecordId] = useState<string | null>(null);

    const loadSavedEmrs = async (residentId?: string) => {
        setIsLoadingSavedEmr(true);
        try {
            const list = await aiService.getSavedEmr(residentId || undefined);
            setSavedEmrList(list);
        } catch (err) {
            console.warn("Could not load saved EMRs:", err);
        } finally {
            setIsLoadingSavedEmr(false);
        }
    };

    useEffect(() => {
        if (selectedResidentId) {
            loadSavedEmrs(selectedResidentId);
        } else {
            loadSavedEmrs();
        }
    }, [selectedResidentId]);

    const recognitionRef = useRef<any>(null);
    const simulationTimerRef = useRef<any>(null);
    const isListeningRef = useRef(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const animFrameRef = useRef<number | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordingTimerRef = useRef<any>(null);

    const [audioVolume, setAudioVolume] = useState<number>(0);
    const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string>("");
    const [micStatusHint, setMicStatusHint] = useState<string | null>(null);
    const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
    const [recordingDuration, setRecordingDuration] = useState<number>(0);

    // Fetch residents on mount for EMR patient linkage
    useEffect(() => {
        carePlansService.getResidents()
            .then((res) => {
                if (res && res.length > 0) {
                    setResidents(res);
                    setSelectedResidentId(res[0].id);
                }
            })
            .catch((err) => console.warn("Could not fetch residents:", err));

        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
            navigator.mediaDevices.enumerateDevices().then((devices) => {
                const inputs = devices.filter((d) => d.kind === "audioinput");
                setAudioDevices(inputs);
            }).catch(() => {});
        }

        return () => {
            if (simulationTimerRef.current) clearInterval(simulationTimerRef.current);
            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
            if (recognitionRef.current) {
                try { recognitionRef.current.stop(); } catch {}
            }
            stopAudioAnalyser();
        };
    }, []);

    const stopAudioAnalyser = () => {
        if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = null;
        }
        if (audioContextRef.current) {
            try { audioContextRef.current.close(); } catch {}
            audioContextRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((track) => track.stop());
            mediaStreamRef.current = null;
        }
        setAudioVolume(0);
        setMicStatusHint(null);
    };

    const startAudioAnalyser = async (deviceId?: string) => {
        try {
            const constraints: MediaStreamConstraints = {
                audio: deviceId ? { deviceId: { exact: deviceId } } : true,
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            mediaStreamRef.current = stream;

            if (navigator.mediaDevices.enumerateDevices) {
                const devs = await navigator.mediaDevices.enumerateDevices();
                const inputs = devs.filter((d) => d.kind === "audioinput");
                setAudioDevices(inputs);
            }

            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioCtx) return;

            const ctx = new AudioCtx();
            audioContextRef.current = ctx;
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 128;
            analyserRef.current = analyser;

            const source = ctx.createMediaStreamSource(stream);
            source.connect(analyser);

            const buffer = new Uint8Array(analyser.frequencyBinCount);
            let silenceTicks = 0;

            const updateMeter = () => {
                if (!isListeningRef.current) return;
                analyser.getByteFrequencyData(buffer);
                let sum = 0;
                for (let i = 0; i < buffer.length; i++) {
                    sum += buffer[i];
                }
                const avg = sum / buffer.length;
                const vol = Math.min(100, Math.round((avg / 120) * 100));
                setAudioVolume(vol);

                if (vol < 2) {
                    silenceTicks++;
                    if (silenceTicks > 80) { // ~3.5 seconds of silence
                        setMicStatusHint(
                            "⚠️ Micro đang mở nhưng âm lượng phát hiện là 0%. Bác sĩ vui lòng kiểm tra: 1. Nút gạt bật/tắt (Mute) trên micro/tai nghe; 2. Cài đặt âm thanh đầu vào Windows (Windows Settings > Sound > Input)."
                        );
                    }
                } else {
                    silenceTicks = 0;
                    setMicStatusHint(null);
                }

                animFrameRef.current = requestAnimationFrame(updateMeter);
            };
            updateMeter();
        } catch (err: any) {
            console.warn("Audio analyser error:", err);
            if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                setSpeechError(
                    "Quyền Microphone bị chặn trên trình duyệt! Vui lòng bấm vào biểu tượng Micro/Ổ khóa trên thanh địa chỉ URL để 'Cho phép' (Allow) Microphone."
                );
            }
        }
    };

    // Real Web Speech API Dictation (Mic) with Continuous Loop and Volume Meter
    const handleSpeechDictateToggle = async () => {
        if (isListeningRef.current) {
            // STOP RECORDING
            isListeningRef.current = false;
            setIsListening(false);
            if (recognitionRef.current) {
                try { recognitionRef.current.stop(); } catch {}
            }
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
                try { mediaRecorderRef.current.stop(); } catch {}
            }
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
            }
            stopAudioAnalyser();
            return;
        }

        // START RECORDING
        setSpeechError(null);
        setMicStatusHint(null);

        const SpeechRecognition =
            (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        if (!SpeechRecognition) {
            setSpeechError(
                "Trình duyệt này không hỗ trợ Web Speech API trực tiếp. Bác sĩ vui lòng dùng Google Chrome / Microsoft Edge hoặc bấm 'Mô phỏng nói'."
            );
            return;
        }

        try {
            isListeningRef.current = true;
            setIsListening(true);

            // 1. Start audio analyser for live VU meter
            await startAudioAnalyser(selectedAudioDeviceId);

            // 2. Start hardware MediaRecorder for audio playback
            if (mediaStreamRef.current) {
                try {
                    const chunks: Blob[] = [];
                    const rec = new MediaRecorder(mediaStreamRef.current);
                    mediaRecorderRef.current = rec;
                    rec.ondataavailable = (e) => {
                        if (e.data.size > 0) chunks.push(e.data);
                    };
                    rec.onstop = () => {
                        if (chunks.length > 0) {
                            const blob = new Blob(chunks, { type: "audio/webm" });
                            setRecordedAudioUrl(URL.createObjectURL(blob));
                        }
                    };
                    rec.start(500);
                    setRecordingDuration(0);
                    recordingTimerRef.current = setInterval(() => {
                        setRecordingDuration((prev) => prev + 1);
                    }, 1000);
                } catch (recErr) {
                    console.warn("MediaRecorder error:", recErr);
                }
            }

            // 3. Start speech recognition with vi-VN
            const recognition = new SpeechRecognition();
            recognitionRef.current = recognition;
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = "vi-VN";

            recognition.onstart = () => {
                setIsListening(true);
            };

            recognition.onresult = (event: any) => {
                let sessionTranscript = "";
                for (let i = 0; i < event.results.length; ++i) {
                    sessionTranscript += event.results[i][0].transcript + " ";
                }
                if (sessionTranscript.trim()) {
                    setSpeechText(sessionTranscript.trim());
                    setMicStatusHint(null);
                }
            };

            recognition.onerror = (event: any) => {
                console.warn("Speech recognition error:", event.error);
                if (event.error === "not-allowed" || event.error === "permission-denied") {
                    setSpeechError(
                        "Quyền Microphone bị từ chối! Vui lòng bấm vào biểu tượng Micro/Ổ khóa trên thanh URL trình duyệt để Cho Phép (Allow) Micro."
                    );
                    isListeningRef.current = false;
                    setIsListening(false);
                    stopAudioAnalyser();
                } else if (event.error === "no-speech") {
                    // DO NOT STOP!
                    // This is a normal pause/silence in speech, keep listening!
                    console.log("No speech detected momentarily, maintaining listening state...");
                } else if (event.error === "network") {
                    setSpeechError(
                        "Lỗi kết nối mạng đến Google Speech Service. Bản ghi âm giọng nói vẫn được thu âm (bác sĩ có thể nghe lại bên dưới)."
                    );
                }
            };

            recognition.onend = () => {
                // If user didn't press stop, seamlessly restart
                if (isListeningRef.current) {
                    try {
                        recognition.start();
                    } catch {
                        setTimeout(() => {
                            if (isListeningRef.current) {
                                try { recognition.start(); } catch {}
                            }
                        }, 250);
                    }
                } else {
                    setIsListening(false);
                }
            };

            recognition.start();
        } catch (err: any) {
            console.error("Failed to start speech recognition:", err);
            setSpeechError("Không thể kích hoạt Micro: " + err.message + ". Vui lòng thử 'Mô phỏng nói'.");
            isListeningRef.current = false;
            setIsListening(false);
            stopAudioAnalyser();
        }
    };

    // Simulated voice typing for environments without physical mic or denied permissions
    const handleSimulateVoice = (sampleText?: string) => {
        if (isListening) {
            handleSpeechDictateToggle();
        }
        const textToStream = sampleText || CLINICAL_PRESETS[0].text;
        setIsSimulatingVoice(true);
        setSpeechError(null);
        setSpeechText("");

        const words = textToStream.split(" ");
        let currentWordIndex = 0;

        if (simulationTimerRef.current) {
            clearInterval(simulationTimerRef.current);
        }

        simulationTimerRef.current = setInterval(() => {
            if (currentWordIndex < words.length) {
                setSpeechText((prev) => (prev ? prev + " " + words[currentWordIndex] : words[currentWordIndex]));
                currentWordIndex++;
            } else {
                clearInterval(simulationTimerRef.current);
                setIsSimulatingVoice(false);
            }
        }, 90);
    };

    const handleExtractEmr = async () => {
        if (!speechText.trim()) return;
        setIsLoading(true);
        setSpeechError(null);
        setSaveSuccessMessage(null);
        try {
            const res = await aiService.extractEmr(speechText);
            setEmrResult(res);
        } catch (err: any) {
            setSpeechError("Lỗi phân tích bệnh án: " + (err.message || "Lỗi mạng"));
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyEmrSummary = () => {
        if (!emrResult) return;
        const textToCopy = `=== BỆNH ÁN ĐIỆN TỬ SỐ HÓA (EMR) ===
Triệu chứng & Lý do khám: ${emrResult.chiefComplaint}
Ghi chú lâm sàng: ${emrResult.clinicalNote}

MÃ CHẨN ĐOÁN ICD-10 ĐỀ XUẤT:
${emrResult.suggestedIcd10.map((i) => `- [${i.code}] ${i.nameVi} (Độ tin cậy: ${i.confidence}%)\n  Lý do: ${i.rationale}`).join("\n")}

CHỈ ĐỊNH CẬN LÂM SÀNG:
${emrResult.suggestedOrders.map((o) => `- [${o.priority}] ${o.name} (${o.type})`).join("\n")}

ĐƠN THUỐC KHUYẾN NGHỊ:
${emrResult.suggestedMedications.map((m) => `- ${m.drugName}: ${m.dosage}, ${m.route}, ${m.frequency} (${m.durationDays} ngày)`).join("\n")}
`;
        navigator.clipboard.writeText(textToCopy);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 3000);
    };

    const handleApplyToEmr = async () => {
        if (!emrResult) return;
        setIsSavingEmr(true);
        setSaveSuccessMessage(null);
        try {
            const res = await aiService.saveEmr({
                residentId: selectedResidentId || undefined,
                chiefComplaint: emrResult.chiefComplaint,
                clinicalNote: emrResult.clinicalNote,
                suggestedIcd10: emrResult.suggestedIcd10,
                suggestedOrders: emrResult.suggestedOrders,
                suggestedMedications: emrResult.suggestedMedications,
            });
            const residentObj = residents.find((r) => r.id === selectedResidentId);
            const patientName = residentObj ? `${residentObj.lastName} ${residentObj.firstName}` : "Bệnh nhân ngoại trú";
            setLastSavedRecordId(res.recordId);
            setSaveSuccessMessage(`Đã điền và lưu hồ sơ EMR thành công vào CSDL cho ${patientName}! (Mã phiếu: #${res.recordId || "EMR-SYNC"})`);
            setFillSuccess(true);
            await loadSavedEmrs(selectedResidentId || undefined);
            setTimeout(() => setFillSuccess(false), 5000);
        } catch (err: any) {
            alert("Lỗi lưu hồ sơ EMR: " + (err.message || "Lỗi mạng"));
        } finally {
            setIsSavingEmr(false);
        }
    };

    const handlePrintEmr = () => {
        setIsWordEditorOpen(true);
    };

    // ==========================================
    // TAB 2: VỆ SĨ ĐƠN THUỐC
    // ==========================================
    const [allergiesInput, setAllergiesInput] = useState("Penicillin, Nhóm Beta-lactam");
    const [medList, setMedList] = useState([
        { name: "Augmentin (Amoxicillin/Clavulanate)", dosage: "1000mg", frequency: "2 lần/ngày" },
        { name: "Clopidogrel (Plavix)", dosage: "75mg", frequency: "1 viên/ngày" },
        { name: "Omeprazole", dosage: "20mg", frequency: "1 viên/ngày trước ăn" },
    ]);
    const [newMedName, setNewMedName] = useState("");
    const [rxResult, setRxResult] = useState<PrescriptionSafetyResult | null>(null);

    const handleAddMed = () => {
        if (!newMedName.trim()) return;
        setMedList([...medList, { name: newMedName.trim(), dosage: "Tiêu chuẩn", frequency: "Theo chỉ định" }]);
        setNewMedName("");
    };

    const handleRemoveMed = (index: number) => {
        setMedList(medList.filter((_, i) => i !== index));
    };

    const handleCheckRx = async () => {
        setIsLoading(true);
        try {
            const allergies = allergiesInput.split(",").map((s) => s.trim()).filter(Boolean);
            const res = await aiService.checkPrescription({
                residentId: selectedResidentId ? Number(selectedResidentId) || undefined : undefined,
                medications: medList,
                allergies,
            });
            setRxResult(res);
        } catch (err: any) {
            alert("Lỗi kiểm tra đơn thuốc: " + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleApplyAlternativeDrug = (originalDrug: string, replacement: string) => {
        setMedList(prev => {
            const filtered = prev.filter(m => !m.name.toLowerCase().includes(originalDrug.toLowerCase()));
            const repName = replacement.split("(")[0].trim();
            const repDosage = replacement.includes("(") ? replacement.split("(")[1].replace(")", "").trim() : "Theo chỉ định";
            return [...filtered, { name: repName, dosage: repDosage, frequency: "Theo chỉ định AI" }];
        });
    };

    // ==========================================
    // TAB 3: NEWS2 & SEPSIS
    // ==========================================
    const [news2Inputs, setNews2Inputs] = useState({
        respiratoryRate: 26,
        spO2: 91,
        onOxygen: true,
        systolicBP: 95,
        pulseRate: 118,
        consciousness: "VOICE" as "ALERT" | "VOICE" | "PAIN" | "UNRESPONSIVE",
        temperatureCelsius: 39.2,
    });
    const [news2Result, setNews2Result] = useState<News2Result | null>(null);

    const handleCalculateNews2 = async () => {
        setIsLoading(true);
        try {
            const res = await aiService.calculateNews2({
                ...news2Inputs,
                residentId: selectedResidentId ? Number(selectedResidentId) || undefined : undefined,
            });
            setNews2Result(res);
        } catch (err: any) {
            alert("Lỗi tính điểm NEWS2: " + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // ==========================================
    // TAB 4: BHYT AUDIT
    // ==========================================
    const [bhytDiagnosis, setBhytDiagnosis] = useState("I10"); // Tăng huyết áp
    const [bhytSecondary, setBhytSecondary] = useState("K21.0"); // Trào ngược
    const [bhytMeds, setBhytMeds] = useState("Amlodipine 5mg, Atorvastatin 20mg, Nexium 40mg");
    const [bhytProcedures, setBhytProcedures] = useState("Điện tim ECG, Chụp MRI cột sống thắt lưng");
    const [bhytResult, setBhytResult] = useState<BhytAuditResult | null>(null);

    const handleAuditBhyt = async () => {
        setIsLoading(true);
        try {
            const meds = bhytMeds.split(",").map((s) => s.trim()).filter(Boolean);
            const procs = bhytProcedures.split(",").map((s) => s.trim()).filter(Boolean);
            const secs = bhytSecondary.split(",").map((s) => s.trim()).filter(Boolean);
            const res = await aiService.auditBhyt({
                residentId: selectedResidentId ? Number(selectedResidentId) || undefined : undefined,
                primaryDiagnosisIcd10: bhytDiagnosis,
                secondaryDiagnosesIcd10: secs,
                medications: meds,
                labProcedures: procs,
            });
            setBhytResult(res);
        } catch (err: any) {
            alert("Lỗi giám định BHYT: " + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // ==========================================
    // TAB 5: PATIENT EXPLANATION
    // ==========================================
    const [targetAudience, setTargetAudience] = useState<"PATIENT" | "FAMILY">("PATIENT");
    const [medicalNotesInput, setMedicalNotesInput] = useState(
        "Bệnh nhân được chẩn đoán Viêm loét dạ dày tá tràng mạn tính giai đoạn tiến triển, vi khuẩn HP dương tính. Bạch cầu tăng nhẹ, niêm mạc xung huyết rải rác hang vị. Cần điều trị phác đồ 4 thuốc có Bismuth trong 14 ngày."
    );
    const [patientResult, setPatientResult] = useState<PatientExplanationResult | null>(null);

    const handleExplainForPatient = async () => {
        setIsLoading(true);
        try {
            const res = await aiService.explainForPatient({
                medicalNotes: medicalNotesInput,
                targetAudience,
            });
            setPatientResult(res);
        } catch (err: any) {
            alert("Lỗi phiên dịch y khoa: " + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // ==========================================
    // TAB 6: CHAT COPILOT (ChatGPT Multi-Session)
    // ==========================================
    const [chatQuery, setChatQuery] = useState("");
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string>("");
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
    const [editTitleInput, setEditTitleInput] = useState("");
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const pageChatEndRef = useRef<HTMLDivElement>(null);

    // Load sessions from localStorage & sync across tabs
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
            if (fresh.length > 0) setSessions(fresh);
        });
        return unsub;
    }, []);

    const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];
    const currentMessages = activeSession?.messages || [];

    // Auto-scroll chat to bottom
    useEffect(() => {
        if (activeTab === "chat") {
            pageChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [currentMessages, isLoading, activeTab]);

    const handleNewSession = () => {
        const newSession = aiChatHistory.createNewSession("Cuộc trò chuyện mới");
        const updated = [newSession, ...sessions.filter((s) => s.id !== newSession.id)];
        setSessions(updated);
        setActiveSessionId(newSession.id);
        setChatQuery("");
    };

    const handleSelectSession = (id: string) => {
        setActiveSessionId(id);
    };

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

    const handleClearAllHistory = () => {
        if (window.confirm("Bác sĩ có chắc chắn muốn xóa toàn bộ lịch sử các phiên chat không?")) {
            aiChatHistory.clearAllSessions();
            const fresh = aiChatHistory.createNewSession("Cuộc trò chuyện mới");
            setSessions([fresh]);
            setActiveSessionId(fresh.id);
        }
    };

    const handleSendChat = async (presetText?: string) => {
        const text = (presetText || chatQuery).trim();
        if (!text || !activeSession) return;

        if (!presetText) setChatQuery("");
        const now = Date.now();
        const nowTime = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

        const userMsg: ChatMessage = {
            id: "msg_user_" + now,
            sender: "user",
            text,
            time: nowTime,
            timestamp: now,
        };

        // Auto update session title if default
        let newTitle = activeSession.title;
        if (activeSession.title === "Cuộc trò chuyện mới" || activeSession.title === "Tư vấn lâm sàng tổng quát") {
            newTitle = text.length > 36 ? text.slice(0, 36) + "..." : text;
        }

        const updatedMessages = [...activeSession.messages, userMsg];
        const updatedSession: ChatSession = {
            ...activeSession,
            title: newTitle,
            updatedAt: now,
            messages: updatedMessages,
        };

        aiChatHistory.updateSession(updatedSession);
        setSessions(aiChatHistory.getAllSessions());
        setIsLoading(true);

        try {
            const res = await aiService.chat(text);
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
            const errNow = Date.now();
            const errMsg: ChatMessage = {
                id: "msg_err_" + errNow,
                sender: "bot",
                text: "Không thể kết nối với mô hình AI: " + (err.message || "Lỗi mạng"),
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
            setIsLoading(false);
        }
    };

    const pageGrouped = aiChatHistory.groupSessionsByDate(sessions);
    const pageDateGroups = [
        { label: "Hôm nay", items: pageGrouped.today },
        { label: "Hôm qua", items: pageGrouped.yesterday },
        { label: "7 ngày trước", items: pageGrouped.last7Days },
        { label: "Trước đó", items: pageGrouped.older },
    ].filter((g) => g.items.length > 0);

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-teal-600 via-cyan-700 to-blue-800 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 flex items-center gap-1.5 backdrop-blur-sm">
                                <Sparkles size={12} className="animate-spin text-emerald-300" />
                                MedCare AI Copilot v2.6 • Chuẩn Bộ Y Tế
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-xs bg-white/10 text-white/90">
                                5 Phân hệ Trí tuệ Nhân tạo
                            </span>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                            Trung Tâm Trợ Lý Y Tế Thông Minh (Clinical AI Suite)
                        </h1>
                        <p className="text-teal-100 text-sm max-w-2xl">
                            Hệ thống AI hỗ trợ ra quyết định lâm sàng (CDSS), bóc tách bệnh án bằng giọng nói, kiểm soát an toàn đơn thuốc, cảnh báo nguy kịch NEWS2 và thanh tra BHYT thời gian thực.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md p-2 rounded-xl border border-white/15">
                        <div className="w-10 h-10 rounded-lg bg-emerald-400/20 flex items-center justify-center text-emerald-300">
                            <ShieldCheck size={24} />
                        </div>
                        <div className="text-xs">
                            <div className="font-semibold text-white">An toàn Người bệnh</div>
                            <div className="text-teal-200">Zero-error Prescription</div>
                        </div>
                    </div>
                </div>

                {/* Quick Presets */}
                <div className="mt-6 pt-4 border-t border-white/15 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-teal-200 font-medium">Tình huống thử nghiệm mẫu:</span>
                    <button
                        onClick={() => {
                            setActiveTab("emr");
                            setSpeechText("Bệnh nhân sốt cao 39.5 độ C, ho khan liên tục, khó thở nhiều, nghe phổi có ran nổ rải rác 2 phế trường, nhịp thở 28 ck/p. Nghi ngờ viêm phổi cấp.");
                        }}
                        className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        🎙️ Viêm phổi sốt cao
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab("rx");
                            setAllergiesInput("Penicillin, Amoxicillin");
                            setMedList([
                                { name: "Augmentin 1g", dosage: "1g", frequency: "2 lần/ngày" },
                                { name: "Clopidogrel 75mg", dosage: "75mg", frequency: "1 lần/ngày" },
                                { name: "Omeprazole 20mg", dosage: "20mg", frequency: "1 lần/ngày" },
                            ]);
                        }}
                        className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        💊 Dị ứng Penicillin + Kê Augmentin
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab("news2");
                            setNews2Inputs({
                                respiratoryRate: 28,
                                spO2: 90,
                                onOxygen: true,
                                systolicBP: 88,
                                pulseRate: 125,
                                consciousness: "VOICE",
                                temperatureCelsius: 39.6,
                            });
                        }}
                        className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        🚨 Cảnh báo Sốc nhiễm khuẩn (NEWS2 = 14)
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab("bhyt");
                            setBhytDiagnosis("I10");
                            setBhytSecondary("");
                            setBhytMeds("Atorvastatin 20mg, Amlodipine 5mg");
                            setBhytProcedures("Chụp MRI cột sống");
                        }}
                        className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        🏛️ Xuất toán BHYT Statin & MRI
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-gray-200 overflow-x-auto gap-2 bg-white p-2 rounded-xl shadow-sm">
                <button
                    onClick={() => setActiveTab("emr")}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                        activeTab === "emr"
                            ? "bg-teal-600 text-white shadow-md shadow-teal-500/20"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    }`}
                >
                    <Mic size={16} />
                    1. Bác sĩ nói - Điền bệnh án
                </button>
                <button
                    onClick={() => setActiveTab("rx")}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                        activeTab === "rx"
                            ? "bg-teal-600 text-white shadow-md shadow-teal-500/20"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    }`}
                >
                    <Pill size={16} />
                    2. Vệ sĩ Đơn thuốc & Dị ứng
                </button>
                <button
                    onClick={() => setActiveTab("news2")}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                        activeTab === "news2"
                            ? "bg-teal-600 text-white shadow-md shadow-teal-500/20"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    }`}
                >
                    <HeartPulse size={16} />
                    3. Cảnh báo sớm NEWS2 & Sepsis
                </button>
                <button
                    onClick={() => setActiveTab("bhyt")}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                        activeTab === "bhyt"
                            ? "bg-teal-600 text-white shadow-md shadow-teal-500/20"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    }`}
                >
                    <ShieldAlert size={16} />
                    4. Thanh tra BHYT & Viện phí
                </button>
                <button
                    onClick={() => setActiveTab("patient")}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                        activeTab === "patient"
                            ? "bg-teal-600 text-white shadow-md shadow-teal-500/20"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    }`}
                >
                    <Volume2 size={16} />
                    5. Giải thích cho Người bệnh
                </button>
                <button
                    onClick={() => setActiveTab("chat")}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                        activeTab === "chat"
                            ? "bg-teal-600 text-white shadow-md shadow-teal-500/20"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    }`}
                >
                    <Bot size={16} />
                    6. Hỏi đáp Phác đồ Bộ Y Tế
                </button>
            </div>

            {/* TAB CONTENTS */}

            {/* ----------------- TAB 1: EMR SPEECH TO TEXT ----------------- */}
            {activeTab === "emr" && (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* LEFT COLUMN: SPEECH & CLINICAL DICTATION */}
                    <div className="lg:col-span-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                            <div className="flex items-center gap-2 font-bold text-gray-800">
                                <Mic className="text-teal-600" size={20} />
                                <h3>Lời nói của Bác sĩ / Bản ghi âm lâm sàng</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleSimulateVoice()}
                                    disabled={isSimulatingVoice}
                                    title="Mô phỏng đọc giọng nói khi chưa có micro hoặc mic bị chặn"
                                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-all disabled:opacity-50"
                                >
                                    <Sparkles size={13} />
                                    {isSimulatingVoice ? "Đang mô phỏng..." : "Mô phỏng nói"}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSpeechDictateToggle}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
                                        isListening
                                            ? "bg-rose-500 text-white animate-pulse shadow-rose-500/30"
                                            : "bg-teal-600 text-white hover:bg-teal-700 shadow-teal-600/20"
                                    }`}
                                >
                                    {isListening ? <MicOff size={14} /> : <Mic size={14} />}
                                    {isListening ? "Dừng thu âm" : "Bấm nói (Micro)"}
                                </button>
                            </div>
                        </div>

                        {/* LISTENING ACTIVE WAVE ANIMATION & VU METER */}
                        {isListening && (
                            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-rose-800 text-xs animate-fadeIn">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 font-medium">
                                        <span className="relative flex h-3 w-3">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-600"></span>
                                        </span>
                                        <span>
                                            Đang thu âm tiếng Việt: <strong className="font-mono text-rose-950">{Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, "0")}</strong>
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-semibold text-rose-900">Âm lượng Micro:</span>
                                        <div className="w-20 bg-rose-200/80 h-2.5 rounded-full overflow-hidden p-0.5">
                                            <div
                                                className={`h-full rounded-full transition-all duration-75 ${
                                                    audioVolume > 15 ? "bg-emerald-500" : audioVolume > 5 ? "bg-amber-500" : "bg-rose-400"
                                                }`}
                                                style={{ width: `${Math.max(4, audioVolume)}%` }}
                                            />
                                        </div>
                                        <span className="font-mono font-bold text-[11px] w-8 text-right">{audioVolume}%</span>
                                    </div>
                                </div>

                                {/* Dynamic Sound Wave Bars */}
                                <div className="flex items-center justify-between pt-1 border-t border-rose-200/60 text-[11px] text-rose-700">
                                    <span>Bác sĩ hãy nói tự nhiên, hệ thống liên tục ghi âm và chuyển thành văn bản.</span>
                                    <div className="flex items-center gap-1 h-3">
                                        <span className="w-1 bg-rose-500 rounded-full animate-bounce h-2" />
                                        <span className="w-1 bg-rose-500 rounded-full animate-bounce h-3 delay-75" />
                                        <span className="w-1 bg-rose-500 rounded-full animate-bounce h-4 delay-150" />
                                        <span className="w-1 bg-rose-500 rounded-full animate-bounce h-2 delay-100" />
                                    </div>
                                </div>

                                {/* Device Selector if multiple mics found */}
                                {audioDevices.length > 1 && (
                                    <div className="flex items-center gap-2 pt-1 border-t border-rose-200/50">
                                        <span className="text-[10px] text-rose-900 font-semibold shrink-0">Thiết bị Micro:</span>
                                        <select
                                            value={selectedAudioDeviceId}
                                            onChange={(e) => {
                                                setSelectedAudioDeviceId(e.target.value);
                                                if (isListeningRef.current) {
                                                    stopAudioAnalyser();
                                                    startAudioAnalyser(e.target.value);
                                                }
                                            }}
                                            className="text-[11px] py-0.5 px-1.5 border border-rose-300 rounded bg-white text-gray-800 outline-none w-full max-w-[260px]"
                                        >
                                            {audioDevices.map((d, i) => (
                                                <option key={d.deviceId || i} value={d.deviceId}>
                                                    {d.label || `Microphone ${i + 1}`}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* MIC STATUS HINT (WHEN VOLUME IS 0%) */}
                        {micStatusHint && isListening && (
                            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2 animate-fadeIn">
                                <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={16} />
                                <div className="leading-relaxed">{micStatusHint}</div>
                            </div>
                        )}

                        {/* RECORDED AUDIO PLAYER (PLAYBACK) */}
                        {recordedAudioUrl && !isListening && (
                            <div className="p-3 bg-teal-50/80 border border-teal-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs animate-fadeIn">
                                <div className="flex items-center gap-2 font-semibold text-teal-900">
                                    <Volume2 size={16} className="text-teal-600" />
                                    <span>Bản ghi âm giọng nói vừa thu ({recordingDuration}s):</span>
                                </div>
                                <audio controls src={recordedAudioUrl} className="h-8 max-w-[280px]" />
                            </div>
                        )}

                        {/* SIMULATION ACTIVE BANNER */}
                        {isSimulatingVoice && (
                            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between gap-3 text-indigo-800 text-xs animate-fadeIn">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="animate-spin text-indigo-600" size={14} />
                                    <span className="font-medium">Đang mô phỏng giọng nói bác sĩ đọc diễn biến bệnh án...</span>
                                </div>
                                <span className="text-[10px] font-bold bg-indigo-200 px-2 py-0.5 rounded-full">Stream</span>
                            </div>
                        )}

                        {/* SPEECH ERROR BANNER */}
                        {speechError && (
                            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 space-y-2 animate-fadeIn">
                                <div className="flex items-start gap-2">
                                    <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={16} />
                                    <div className="flex-1 font-medium">{speechError}</div>
                                    <button
                                        type="button"
                                        onClick={() => setSpeechError(null)}
                                        className="text-amber-700 hover:text-amber-900"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                                <div className="flex items-center gap-2 pt-1 border-t border-amber-200">
                                    <button
                                        type="button"
                                        onClick={handleSpeechDictateToggle}
                                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-[11px]"
                                    >
                                        Thử lại Micro
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSimulateVoice()}
                                        className="px-2.5 py-1 bg-white border border-amber-300 hover:bg-amber-100 text-amber-800 rounded-lg font-semibold text-[11px]"
                                    >
                                        Dùng mô phỏng giọng nói
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* CLINICAL SCENARIO PRESETS */}
                        <div>
                            <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                                <span className="font-semibold text-gray-700">Mẫu diễn biến lâm sàng nhanh (1-Click):</span>
                                <button
                                    type="button"
                                    onClick={() => setSpeechText("")}
                                    className="text-gray-400 hover:text-rose-600 transition-colors flex items-center gap-1"
                                >
                                    <Trash2 size={12} />
                                    Xóa trắng
                                </button>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                {CLINICAL_PRESETS.map((preset, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => {
                                            setSpeechText(preset.text);
                                            setSpeechError(null);
                                        }}
                                        className="p-2 text-left rounded-xl border border-gray-200 hover:border-teal-500 hover:bg-teal-50/50 transition-all text-xs group"
                                    >
                                        <div className="flex items-center gap-1.5 font-semibold text-gray-800 group-hover:text-teal-700">
                                            <span>{preset.icon}</span>
                                            <span className="truncate">{preset.label}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* TEXTAREA INPUT */}
                        <div className="space-y-1">
                            <textarea
                                rows={7}
                                value={speechText}
                                onChange={(e) => setSpeechText(e.target.value)}
                                placeholder="Bác sĩ có thể nói tự nhiên qua Micro, chọn mẫu phía trên hoặc dán diễn biến khám bệnh vào đây..."
                                className="w-full p-4 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none leading-relaxed transition-all"
                            />
                            <div className="flex items-center justify-between text-[11px] text-gray-400 px-1">
                                <span>{speechText.length} ký tự • {speechText.trim() ? speechText.trim().split(/\s+/).length : 0} từ</span>
                                <span>Tiếng Việt (vi-VN)</span>
                            </div>
                        </div>

                        {/* SUBMIT BUTTON */}
                        <button
                            type="button"
                            onClick={handleExtractEmr}
                            disabled={isLoading || !speechText.trim()}
                            className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-teal-600/20 transition-all disabled:opacity-50 text-sm"
                        >
                            {isLoading ? <RefreshCw className="animate-spin" size={18} /> : <Sparkles size={18} />}
                            {isLoading ? "AI đang phân tích triệu chứng & bóc tách EMR..." : "AI Tự động Phân tích & Điền Bệnh án"}
                        </button>
                    </div>

                    {/* RIGHT COLUMN: STRUCTURED EMR RESULT */}
                    <div className="lg:col-span-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <FileText className="text-emerald-600" size={20} />
                                Cấu trúc Bệnh án Số Hóa (EMR Extracted)
                            </h3>
                            {emrResult && (
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] bg-gradient-to-r from-teal-600 to-emerald-600 text-white px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-sm">
                                        <Sparkles size={11} />
                                        {emrResult.engine || "Google MedGemma 1.5 4B"}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* PATIENT LINKAGE SELECTOR */}
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                            <label className="block text-xs font-bold text-gray-700 flex items-center gap-1.5">
                                <UserCheck size={14} className="text-teal-600" />
                                Hồ sơ Bệnh nhân liên kết (HIS/EMR):
                            </label>
                            <select
                                value={selectedResidentId}
                                onChange={(e) => setSelectedResidentId(e.target.value)}
                                className="w-full text-xs p-2 border border-gray-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-teal-500"
                            >
                                <option value="">-- Bệnh nhân ngoại trú / Tiếp nhận mới --</option>
                                {residents.map((res) => (
                                    <option key={res.id} value={res.id}>
                                        {res.lastName} {res.firstName} {res.roomNumber ? `• Phòng ${res.roomNumber}` : ""} {res.activeCareLevel?.name ? `(${res.activeCareLevel.name})` : ""}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* ACTION BUTTONS (WHEN RESULT EXISTS) */}
                        {emrResult && (
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleApplyToEmr}
                                    disabled={isSavingEmr}
                                    className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/30 transition-all disabled:opacity-50"
                                >
                                    {isSavingEmr ? <RefreshCw className="animate-spin" size={14} /> : <Save size={14} />}
                                    {isSavingEmr ? "Đang lưu..." : "Lưu vào Bệnh án EMR"}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCopyEmrSummary}
                                    className="py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                                >
                                    {copySuccess ? <Check className="text-emerald-600" size={14} /> : <Copy size={14} />}
                                    {copySuccess ? "Đã sao chép!" : "Sao chép EMR"}
                                </button>
                                <button
                                    type="button"
                                    onClick={handlePrintEmr}
                                    className="py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                                >
                                    <Printer size={14} />
                                    In phiếu
                                </button>
                            </div>
                        )}

                        {/* SUCCESS BANNERS */}
                        {saveSuccessMessage && (
                            <div className="p-3.5 bg-emerald-50 border-2 border-emerald-400 rounded-xl text-xs text-emerald-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-fadeIn">
                                <div className="flex items-start gap-2">
                                    <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={18} />
                                    <div>
                                        <div className="font-bold text-emerald-950">{saveSuccessMessage}</div>
                                        <div className="text-[11px] text-emerald-700 mt-0.5">
                                            Hồ sơ Bệnh án EMR, chẩn đoán ICD-10 và đơn thuốc đã được lưu trực tiếp vào CSDL bệnh viện.
                                        </div>
                                    </div>
                                </div>
                                {selectedResidentId && (
                                    <Link
                                        to={`/residents/${selectedResidentId}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="shrink-0 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
                                    >
                                        <span>Mở xem Hồ sơ Bệnh nhân</span>
                                        <ExternalLink size={13} />
                                    </Link>
                                )}
                            </div>
                        )}

                        {copySuccess && (
                            <div className="p-2.5 bg-teal-50 border border-teal-300 rounded-xl text-xs text-teal-900 flex items-center gap-2 animate-fadeIn">
                                <Check className="text-teal-600 shrink-0" size={14} />
                                <span className="font-semibold">Đã sao chép toàn bộ tóm tắt Bệnh án EMR vào Clipboard!</span>
                            </div>
                        )}

                        {!emrResult ? (
                            <div className="py-16 text-center text-gray-400 space-y-3">
                                <Bot size={48} className="mx-auto text-gray-300" />
                                <p className="text-sm">Bác sĩ hãy nhập hoặc bấm nói diễn biến lâm sàng, sau đó bấm nút "AI Tự động Phân tích & Điền Bệnh án".</p>
                                <button
                                    type="button"
                                    onClick={handleExtractEmr}
                                    className="px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-xl text-xs font-semibold transition-all"
                                >
                                    Phân tích nhanh với mẫu có sẵn
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4 text-sm animate-fadeIn">
                                {/* Lý do vào viện & Triệu chứng chính */}
                                <div className="bg-gradient-to-r from-teal-50/70 to-slate-50 p-3.5 rounded-xl border border-teal-200/70 shadow-xs">
                                    <div className="text-[11px] font-bold text-teal-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                        <HeartPulse size={14} className="text-teal-600" />
                                        <span>Lý do vào viện & Triệu chứng chính:</span>
                                    </div>
                                    <div className="font-bold text-slate-900 text-sm leading-snug">{emrResult.chiefComplaint}</div>
                                </div>

                                {/* Ghi chú & Phân tích lâm sàng EMR */}
                                {emrResult.clinicalNote && (
                                    <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-2">
                                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between pb-1.5 border-b border-slate-100">
                                            <div className="flex items-center gap-1.5 text-slate-700">
                                                <FileText size={14} className="text-teal-600" />
                                                <span>Ghi chú & Phân tích Lâm sàng Chi tiết</span>
                                            </div>
                                            <span className="text-[10px] font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">
                                                Google MedGemma EMR
                                            </span>
                                        </div>
                                        <div className="pt-1">
                                            <FormattedMedicalMessage
                                                content={emrResult.clinicalNote}
                                                hideHeader={true}
                                                hideFooter={true}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Mã ICD-10 */}
                                <div>
                                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                        Gợi ý Mã Chẩn đoán ICD-10 (Độ tin cậy cao):
                                    </div>
                                    <div className="space-y-2">
                                        {emrResult.suggestedIcd10.map((icd, idx) => (
                                            <div key={idx} className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="px-2 py-0.5 bg-emerald-600 text-white text-xs font-bold rounded-md">
                                                            {icd.code}
                                                        </span>
                                                        <span className="font-semibold text-emerald-950 text-sm">
                                                            {icd.nameVi}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-emerald-800/80 mt-1">{icd.rationale}</p>
                                                </div>
                                                <span className="text-xs font-bold text-emerald-700 bg-emerald-200/70 px-2 py-1 rounded-lg shrink-0">
                                                    {icd.confidence}%
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Chỉ định Cận lâm sàng */}
                                <div>
                                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                        Chỉ định Cận lâm sàng & Thủ thuật đề xuất:
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {emrResult.suggestedOrders.map((ord, idx) => (
                                            <span
                                                key={idx}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 ${
                                                    ord.priority === "STAT"
                                                        ? "bg-rose-50 text-rose-700 border-rose-200 font-semibold"
                                                        : "bg-blue-50 text-blue-700 border-blue-200"
                                                }`}
                                            >
                                                <Activity size={12} />
                                                [{ord.priority}] {ord.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Đơn thuốc */}
                                <div>
                                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                        Phác đồ Thuốc Khuyến nghị:
                                    </div>
                                    <div className="space-y-1.5">
                                        {emrResult.suggestedMedications.map((m, idx) => (
                                            <div key={idx} className="text-xs p-2.5 bg-gray-50 rounded-lg flex items-center justify-between border border-gray-200">
                                                <div>
                                                    <span className="font-bold text-gray-800">{m.drugName}</span>
                                                    <span className="text-gray-500 ml-2">({m.route})</span>
                                                </div>
                                                <span className="text-teal-700 font-medium">{m.dosage} • {m.frequency} • {m.durationDays} ngày</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ----------------- SAVED EMR RECORDS TABLE / HISTORY CARD ----------------- */}
                <div className="mt-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                        <div className="flex items-center gap-2.5">
                            <FileText className="text-teal-600" size={22} />
                            <div>
                                <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                    <span>Lịch sử Bệnh án EMR Đã Lưu Trong CSDL</span>
                                    {selectedResidentId && (
                                        <span className="text-teal-700 bg-teal-50 border border-teal-200 text-xs px-2 py-0.5 rounded-full font-bold">
                                            {residents.find((r) => r.id === selectedResidentId)?.lastName} {residents.find((r) => r.id === selectedResidentId)?.firstName}
                                        </span>
                                    )}
                                </h3>
                                <p className="text-[11px] text-gray-500">
                                    Dữ liệu bệnh án số hóa thực tế đã được lưu trữ an toàn trong CSDL hệ thống HIS/EMR của bệnh viện
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => loadSavedEmrs(selectedResidentId || undefined)}
                                disabled={isLoadingSavedEmr}
                                className="px-2.5 py-1.5 text-xs text-gray-700 hover:text-teal-700 bg-gray-50 hover:bg-teal-50 border rounded-lg flex items-center gap-1.5 transition-all"
                            >
                                <RefreshCw size={12} className={isLoadingSavedEmr ? "animate-spin" : ""} />
                                <span>Làm mới danh sách</span>
                            </button>
                            {selectedResidentId && (
                                <Link
                                    to={`/residents/${selectedResidentId}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-3 py-1.5 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-lg flex items-center gap-1.5 transition-all shadow-sm"
                                >
                                    <span>Mở Hồ sơ Bệnh nhân</span>
                                    <ExternalLink size={12} />
                                </Link>
                            )}
                        </div>
                    </div>

                    {isLoadingSavedEmr ? (
                        <div className="py-8 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                            <RefreshCw className="animate-spin text-teal-600" size={16} />
                            <span>Đang tải danh sách bệnh án đã lưu...</span>
                        </div>
                    ) : savedEmrList.length === 0 ? (
                        <div className="py-8 text-center bg-gray-50/70 rounded-xl border border-dashed border-gray-200 space-y-1.5">
                            <FileText size={32} className="mx-auto text-gray-300" />
                            <p className="text-xs font-semibold text-gray-600">Chưa có bản ghi Bệnh án EMR nào được lưu cho bệnh nhân này.</p>
                            <p className="text-[11px] text-gray-400">
                                Hãy bấm nút xanh <strong className="text-emerald-700">"Lưu vào Bệnh án EMR"</strong> ở trên sau khi trích xuất để lưu trực tiếp vào CSDL.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {savedEmrList.map((item, idx) => {
                                const isJustSaved = item.id === lastSavedRecordId || idx === 0;
                                return (
                                    <div
                                        key={item.id}
                                        className={`p-4 rounded-xl border transition-all ${
                                            isJustSaved
                                                ? "bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-400/20"
                                                : "bg-white border-gray-200 hover:border-gray-300"
                                        }`}
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${isJustSaved ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-700"}`}>
                                                    {isJustSaved ? "✓ Vừa Lưu Thành Công" : `#${item.id.slice(0, 8)}`}
                                                </span>
                                                <span className="font-bold text-xs text-gray-900">{item.residentName}</span>
                                                <span className="text-[11px] text-gray-500">
                                                    · Lưu lúc: {new Date(item.createdAt).toLocaleString("vi-VN")}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-emerald-700 bg-emerald-100 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    <CheckCircle2 size={11} /> CSDL HIS/EMR
                                                </span>
                                                {item.residentId && (
                                                    <Link
                                                        to={`/residents/${item.residentId}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-[11px] text-teal-700 hover:text-teal-900 font-bold flex items-center gap-0.5 underline ml-2"
                                                    >
                                                        Mở bệnh nhân <ExternalLink size={11} />
                                                    </Link>
                                                )}
                                            </div>
                                        </div>

                                        {item.chiefComplaint && (
                                            <div className="text-xs text-gray-800 mb-2">
                                                <strong className="text-gray-600">Lý do khám: </strong>
                                                <span>{item.chiefComplaint}</span>
                                            </div>
                                        )}

                                        {item.suggestedIcd10 && item.suggestedIcd10.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mb-2">
                                                <span className="text-[11px] font-semibold text-gray-500 self-center">ICD-10:</span>
                                                {item.suggestedIcd10.map((icd, i) => (
                                                    <span key={i} className="text-[11px] px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-md font-semibold">
                                                        {icd.code} - {icd.nameVi}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {item.clinicalNote && (
                                            <p className="text-[11px] text-gray-600 leading-relaxed bg-gray-50/80 p-2.5 rounded-lg border border-gray-100 line-clamp-3 mb-2 whitespace-pre-line">
                                                {item.clinicalNote}
                                            </p>
                                        )}

                                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-1 border-t text-gray-500">
                                            <div>
                                                {item.suggestedMedications && item.suggestedMedications.length > 0 && (
                                                    <span className="mr-3 text-emerald-700 font-medium">
                                                        💊 {item.suggestedMedications.length} thuốc đã kê
                                                    </span>
                                                )}
                                                {item.suggestedOrders && item.suggestedOrders.length > 0 && (
                                                    <span className="text-blue-700 font-medium">
                                                        🧪 {item.suggestedOrders.length} chỉ định CLS
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSpeechText(item.chiefComplaint ? `${item.chiefComplaint}. ${item.clinicalNote}` : item.clinicalNote);
                                                    window.scrollTo({ top: 0, behavior: "smooth" });
                                                }}
                                                className="text-teal-700 hover:text-teal-900 font-semibold"
                                            >
                                                Tải lại nội dung này lên khung soạn thảo ↑
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                </>
            )}

            {/* ----------------- TAB 2: VỆ SĨ ĐƠN THUỐC ----------------- */}
            {activeTab === "rx" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-5 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                        <div className="font-bold text-gray-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Pill className="text-amber-500" size={20} />
                                <h3>Đơn thuốc đang kê & Tiền sử dị ứng</h3>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                AI MedGemma
                            </span>
                        </div>

                        {/* Presets */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            <span className="text-[11px] text-gray-500 font-semibold self-center">Ca mẫu:</span>
                            <button
                                type="button"
                                onClick={() => {
                                    setAllergiesInput("Penicillin, Nhóm Beta-lactam");
                                    setMedList([
                                        { name: "Augmentin (Amoxicillin/Clavulanate)", dosage: "1000mg", frequency: "2 lần/ngày" },
                                        { name: "Clopidogrel (Plavix)", dosage: "75mg", frequency: "1 viên/ngày" },
                                        { name: "Omeprazole", dosage: "20mg", frequency: "1 viên/ngày trước ăn" },
                                    ]);
                                }}
                                className="text-[11px] px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg border border-amber-200 font-medium transition-all"
                            >
                                Dị ứng Penicillin & Tương tác CYP2C19
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setAllergiesInput("Không ghi nhận");
                                    setMedList([
                                        { name: "Warfarin (Sintrom)", dosage: "4mg", frequency: "1 viên/ngày lúc 18h" },
                                        { name: "Meloxicam (Mobic)", dosage: "15mg", frequency: "1 viên/ngày sau ăn" },
                                        { name: "Ciprofloxacin", dosage: "500mg", frequency: "2 lần/ngày" },
                                        { name: "Methylprednisolon", dosage: "16mg", frequency: "1 viên/ngày buổi sáng" },
                                    ]);
                                }}
                                className="text-[11px] px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded-lg border border-rose-200 font-medium transition-all"
                            >
                                Xuất huyết (Warfarin+NSAID)
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setAllergiesInput("Không có dị ứng");
                                    setMedList([
                                        { name: "Amlodipine", dosage: "5mg", frequency: "1 viên/ngày buổi sáng" },
                                        { name: "Metformin", dosage: "850mg", frequency: "2 lần/ngày sau ăn" },
                                        { name: "Paracetamol", dosage: "500mg", frequency: "Khi sốt > 38.5°C" },
                                    ]);
                                }}
                                className="text-[11px] px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg border border-emerald-200 font-medium transition-all"
                            >
                                Đơn an toàn chuẩn
                            </button>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                                Tiền sử dị ứng người bệnh:
                            </label>
                            <input
                                type="text"
                                value={allergiesInput}
                                onChange={(e) => setAllergiesInput(e.target.value)}
                                className="w-full p-2.5 border border-rose-200 bg-rose-50/40 rounded-xl text-sm font-semibold text-rose-900 focus:ring-2 focus:ring-rose-400 outline-none"
                                placeholder="VD: Penicillin, Sulfamid..."
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-2">
                                Danh sách thuốc trong đơn ({medList.length} thuốc):
                            </label>
                            <div className="space-y-2 mb-3 max-h-56 overflow-y-auto">
                                {medList.map((m, idx) => (
                                    <div key={idx} className="p-3 bg-gray-50 rounded-xl border flex items-center justify-between hover:bg-gray-100/80 transition-all">
                                        <div>
                                            <div className="font-bold text-sm text-gray-800">{m.name}</div>
                                            <div className="text-xs text-gray-500">{m.dosage} • {m.frequency}</div>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveMed(idx)}
                                            className="text-gray-400 hover:text-rose-600 p-1"
                                            title="Xóa thuốc"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newMedName}
                                    onChange={(e) => setNewMedName(e.target.value)}
                                    placeholder="Thêm thuốc mới (VD: Clarithromycin, Atorvastatin...)"
                                    className="flex-1 p-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-500"
                                    onKeyDown={(e) => e.key === "Enter" && handleAddMed()}
                                />
                                <button
                                    onClick={handleAddMed}
                                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl text-sm flex items-center gap-1 transition-all"
                                >
                                    <Plus size={16} /> Thêm
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={handleCheckRx}
                            disabled={isLoading}
                            className="w-full py-3 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20 transition-all disabled:opacity-50"
                        >
                            {isLoading ? <RefreshCw className="animate-spin" size={18} /> : <ShieldAlert size={18} />}
                            {isLoading ? "AI MedGemma đang quét tương tác..." : "Quét Tương Tác & Nguy Cơ Dị Ứng Với AI"}
                        </button>
                    </div>

                    <div className="lg:col-span-7 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                        <div className="flex items-center justify-between border-b pb-3">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <ShieldCheck className="text-teal-600" size={20} />
                                Kết quả Kiểm định An toàn Đơn thuốc (AI MedGemma)
                            </h3>
                            {rxResult && (
                                <span
                                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                        rxResult.safetyStatus === "DANGEROUS"
                                            ? "bg-rose-100 text-rose-800 border border-rose-300"
                                            : rxResult.safetyStatus === "WARNING"
                                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                                            : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                    }`}
                                >
                                    {rxResult.safetyStatus === "DANGEROUS"
                                        ? "🚨 Nguy hiểm cao"
                                        : rxResult.safetyStatus === "WARNING"
                                        ? "⚠️ Có cảnh báo"
                                        : "✅ Đạt chuẩn an toàn"}
                                </span>
                            )}
                        </div>

                        {!rxResult ? (
                            <div className="py-20 text-center text-gray-400 space-y-3">
                                <ShieldAlert size={48} className="mx-auto text-gray-300" />
                                <p className="text-sm">Bấm nút "Quét Tương Tác" để AI MedGemma bảo vệ an toàn y lệnh thuốc</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* AI MedGemma Analysis Summary Card */}
                                {rxResult.aiAnalysis && (
                                    <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Sparkles size={18} className="text-amber-600 animate-pulse" />
                                            <span className="font-bold text-amber-950 text-sm">Đánh giá Dược lâm sàng AI MedGemma</span>
                                            <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                                                Google MedGemma 1.5 4B
                                            </span>
                                        </div>
                                        <p className="text-xs text-amber-950 leading-relaxed whitespace-pre-line">
                                            {rxResult.aiAnalysis}
                                        </p>
                                    </div>
                                )}

                                {/* Suggested Alternatives from AI */}
                                {rxResult.suggestedAlternatives && rxResult.suggestedAlternatives.length > 0 && (
                                    <div className="p-4 bg-emerald-50/90 border border-emerald-200 rounded-2xl space-y-2.5">
                                        <div className="flex items-center gap-2 font-bold text-emerald-950 text-sm">
                                            <CheckCircle2 size={18} className="text-emerald-600" />
                                            <span>Đề xuất Thuốc Thay Thế An Toàn từ AI:</span>
                                        </div>
                                        <div className="space-y-2">
                                            {rxResult.suggestedAlternatives.map((alt, i) => (
                                                <div key={i} className="p-3 bg-white rounded-xl border border-emerald-200 text-xs flex items-center justify-between gap-3 shadow-sm">
                                                    <div className="space-y-0.5">
                                                        <div className="flex items-center gap-2 font-bold">
                                                            <span className="text-rose-600 line-through">{alt.originalDrug}</span>
                                                            <span className="text-emerald-700">➔ {alt.replacement}</span>
                                                        </div>
                                                        <p className="text-gray-500 text-[11px]">{alt.reason}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleApplyAlternativeDrug(alt.originalDrug, alt.replacement)}
                                                        className="shrink-0 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
                                                    >
                                                        + Đổi thuốc
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {rxResult.alerts.length === 0 ? (
                                    <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
                                        <CheckCircle2 size={40} className="mx-auto text-emerald-600" />
                                        <h4 className="font-bold text-emerald-900">Đơn thuốc Hoàn toàn An toàn</h4>
                                        <p className="text-xs text-emerald-700">
                                            Không phát hiện tương tác đối kháng hay dị ứng chéo theo cơ sở dữ liệu Dược thư Quốc gia Việt Nam.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {rxResult.alerts.map((alt, idx) => (
                                            <div
                                                key={idx}
                                                className={`p-4 rounded-xl border space-y-2 ${
                                                    alt.severity === "CRITICAL"
                                                        ? "bg-rose-50/80 border-rose-200"
                                                        : "bg-amber-50/80 border-amber-200"
                                                }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <AlertTriangle
                                                        size={18}
                                                        className={alt.severity === "CRITICAL" ? "text-rose-600" : "text-amber-600"}
                                                    />
                                                    <h4
                                                        className={`font-bold text-sm ${
                                                            alt.severity === "CRITICAL" ? "text-rose-950" : "text-amber-950"
                                                        }`}
                                                    >
                                                        {alt.title}
                                                    </h4>
                                                </div>

                                                <p className="text-xs text-gray-700 leading-relaxed">{alt.message}</p>

                                                <div className="p-3 bg-white/80 rounded-lg text-xs space-y-1 border">
                                                    <div className="font-bold text-gray-900">Khuyến nghị xử trí y khoa:</div>
                                                    <div className="text-gray-700">{alt.recommendation}</div>
                                                    <div className="text-gray-400 text-[11px] pt-1">Nguồn: {alt.source}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ----------------- TAB 3: NEWS2 & SEPSIS ----------------- */}
            {activeTab === "news2" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-5 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                        <div className="font-bold text-gray-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <HeartPulse className="text-rose-500" size={20} />
                                <h3>Nhập Chỉ Số Sinh Tồn (Vital Signs)</h3>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                                MedGemma ICU
                            </span>
                        </div>

                        {/* Presets */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            <span className="text-[11px] text-gray-500 font-semibold self-center">Ca lâm sàng:</span>
                            <button
                                type="button"
                                onClick={() => {
                                    setNews2Inputs({
                                        respiratoryRate: 26,
                                        spO2: 91,
                                        onOxygen: true,
                                        systolicBP: 95,
                                        pulseRate: 118,
                                        consciousness: "VOICE",
                                        temperatureCelsius: 39.2,
                                    });
                                }}
                                className="text-[11px] px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded-lg border border-rose-200 font-medium transition-all"
                            >
                                Ca Sepsis Nguy Kịch (NEWS2 = 14)
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setNews2Inputs({
                                        respiratoryRate: 23,
                                        spO2: 93,
                                        onOxygen: true,
                                        systolicBP: 108,
                                        pulseRate: 98,
                                        consciousness: "ALERT",
                                        temperatureCelsius: 38.4,
                                    });
                                }}
                                className="text-[11px] px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg border border-amber-200 font-medium transition-all"
                            >
                                Ca Cảnh Báo Sớm (NEWS2 = 6)
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setNews2Inputs({
                                        respiratoryRate: 16,
                                        spO2: 98,
                                        onOxygen: false,
                                        systolicBP: 120,
                                        pulseRate: 75,
                                        consciousness: "ALERT",
                                        temperatureCelsius: 36.8,
                                    });
                                }}
                                className="text-[11px] px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg border border-emerald-200 font-medium transition-all"
                            >
                                Ca Ổn Định (NEWS2 = 0)
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                                <label className="font-bold text-gray-600">Nhịp thở (ck/phút):</label>
                                <input
                                    type="number"
                                    value={news2Inputs.respiratoryRate}
                                    onChange={(e) => setNews2Inputs({ ...news2Inputs, respiratoryRate: +e.target.value })}
                                    className="w-full p-2 border rounded-lg mt-1 font-bold"
                                />
                            </div>
                            <div>
                                <label className="font-bold text-gray-600">Độ bão hòa Oxy (SpO2 %):</label>
                                <input
                                    type="number"
                                    value={news2Inputs.spO2}
                                    onChange={(e) => setNews2Inputs({ ...news2Inputs, spO2: +e.target.value })}
                                    className="w-full p-2 border rounded-lg mt-1 font-bold"
                                />
                            </div>
                            <div>
                                <label className="font-bold text-gray-600">Thân nhiệt (°C):</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={news2Inputs.temperatureCelsius}
                                    onChange={(e) => setNews2Inputs({ ...news2Inputs, temperatureCelsius: +e.target.value })}
                                    className="w-full p-2 border rounded-lg mt-1 font-bold"
                                />
                            </div>
                            <div>
                                <label className="font-bold text-gray-600">Huyết áp tâm thu (mmHg):</label>
                                <input
                                    type="number"
                                    value={news2Inputs.systolicBP}
                                    onChange={(e) => setNews2Inputs({ ...news2Inputs, systolicBP: +e.target.value })}
                                    className="w-full p-2 border rounded-lg mt-1 font-bold"
                                />
                            </div>
                            <div>
                                <label className="font-bold text-gray-600">Nhịp tim (lần/phút):</label>
                                <input
                                    type="number"
                                    value={news2Inputs.pulseRate}
                                    onChange={(e) => setNews2Inputs({ ...news2Inputs, pulseRate: +e.target.value })}
                                    className="w-full p-2 border rounded-lg mt-1 font-bold"
                                />
                            </div>
                            <div>
                                <label className="font-bold text-gray-600">Thở Oxy hỗ trợ:</label>
                                <select
                                    value={news2Inputs.onOxygen ? "true" : "false"}
                                    onChange={(e) => setNews2Inputs({ ...news2Inputs, onOxygen: e.target.value === "true" })}
                                    className="w-full p-2 border rounded-lg mt-1 font-bold"
                                >
                                    <option value="false">Không (Khí phòng)</option>
                                    <option value="true">Có thở Oxy</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="font-bold text-gray-600 text-xs">Mức độ ý thức (Thang AVPU):</label>
                            <select
                                value={news2Inputs.consciousness}
                                onChange={(e) => setNews2Inputs({ ...news2Inputs, consciousness: e.target.value as any })}
                                className="w-full p-2.5 border rounded-lg mt-1 text-xs font-bold"
                            >
                                <option value="ALERT">A - Alert (Tỉnh táo hoàn toàn)</option>
                                <option value="VOICE">V - Voice (Đáp ứng khi gọi hỏi)</option>
                                <option value="PAIN">P - Pain (Chỉ đáp ứng khi kích thích đau)</option>
                                <option value="UNRESPONSIVE">U - Unresponsive (Không đáp ứng/Hôn mê)</option>
                            </select>
                        </div>

                        <button
                            onClick={handleCalculateNews2}
                            disabled={isLoading}
                            className="w-full py-3 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20 transition-all disabled:opacity-50"
                        >
                            {isLoading ? <RefreshCw className="animate-spin" size={18} /> : <HeartPulse size={18} />}
                            {isLoading ? "AI MedGemma đang tính điểm & hội chẩn..." : "Tính Điểm NEWS2 & Hội Chẩn Cấp Cứu Với AI"}
                        </button>
                    </div>

                    <div className="lg:col-span-7 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                        <div className="flex items-center justify-between border-b pb-3">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <Activity className="text-rose-600" size={20} />
                                Bảng Đánh Giá Lâm Sàng Sớm (NEWS2 Score & MedGemma ICU)
                            </h3>
                            {news2Result && (
                                <span
                                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                        news2Result.riskLevel === "HIGH"
                                            ? "bg-rose-100 text-rose-800 border border-rose-300"
                                            : news2Result.riskLevel === "MEDIUM"
                                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                                            : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                    }`}
                                >
                                    Nguy cơ: {news2Result.riskLevel === "HIGH" ? "🔴 NGUY CƠ CAO" : news2Result.riskLevel === "MEDIUM" ? "🟡 CẢNH BÁO TRUNG BÌNH" : "🟢 ỔN ĐỊNH"}
                                </span>
                            )}
                        </div>

                        {!news2Result ? (
                            <div className="py-20 text-center text-gray-400 space-y-3">
                                <HeartPulse size={48} className="mx-auto text-gray-300" />
                                <p className="text-sm">Bấm nút "Tính Điểm NEWS2" để AI MedGemma hội chẩn và đề xuất gói can thiệp giờ vàng</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Score Badge */}
                                <div className="flex items-center gap-4 p-4 bg-slate-900 text-white rounded-2xl shadow-md">
                                    <div className="text-center px-4 border-r border-slate-700">
                                        <div className="text-3xl font-black text-rose-400">{news2Result.totalScore}</div>
                                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                                            Tổng điểm NEWS2
                                        </div>
                                    </div>
                                    <div className="text-xs space-y-1">
                                        <div className="font-bold text-sm text-slate-200">
                                            Tần suất theo dõi: {news2Result.monitoringFrequency}
                                        </div>
                                        <div className="text-slate-300 leading-relaxed">{news2Result.clinicalResponse}</div>
                                    </div>
                                </div>

                                {/* AI MedGemma ICU Clinical Impression Box */}
                                {news2Result.aiClinicalImpression && (
                                    <div className="p-4 bg-gradient-to-r from-rose-50 to-red-50 border border-rose-200 rounded-2xl space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Sparkles size={18} className="text-rose-600 animate-pulse" />
                                            <span className="font-bold text-rose-950 text-sm">Hội chẩn Cấp cứu AI MedGemma ICU</span>
                                            <span className="text-[10px] bg-rose-200 text-rose-900 font-bold px-2 py-0.5 rounded-full">
                                                MedGemma Acute Care
                                            </span>
                                        </div>
                                        <p className="text-xs text-rose-900 leading-relaxed whitespace-pre-line">
                                            {news2Result.aiClinicalImpression}
                                        </p>
                                    </div>
                                )}

                                {/* Sepsis Alert if any */}
                                {news2Result.sepsisRiskFlag && (
                                    <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-xl flex items-start gap-3">
                                        <AlertTriangle size={24} className="text-rose-600 shrink-0 mt-0.5" />
                                        <div className="text-xs space-y-1">
                                            <div className="font-bold text-rose-900 text-sm">
                                                🚨 BÁO ĐỘNG ĐỎ: NGUY CƠ NHIỄM TRÙNG HUYẾT (SEPSIS)
                                            </div>
                                            <p className="text-rose-800">{news2Result.sepsisWarning}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Hour-1 Emergency Bundle Protocol from AI */}
                                {news2Result.emergencyProtocol && news2Result.emergencyProtocol.length > 0 && (
                                    <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3">
                                        <div className="flex items-center gap-2 font-bold text-rose-400 text-sm">
                                            <AlertTriangle size={18} />
                                            <span>Y Lệnh Can Thiệp Cấp Cứu Giờ Vàng (Hour-1 Bundle):</span>
                                        </div>
                                        <div className="space-y-1.5">
                                            {news2Result.emergencyProtocol.map((step, i) => (
                                                <div key={i} className="text-xs text-slate-200 flex items-start gap-2 bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
                                                    <span className="text-emerald-400 font-bold shrink-0">✓</span>
                                                    <span>{step}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Parameter Breakdown */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                                    {Object.entries(news2Result.breakdown).map(([key, val]) => (
                                        <div key={key} className="p-2.5 bg-gray-50 border rounded-xl">
                                            <div className="text-gray-500 font-medium">{key}</div>
                                            <div className="font-bold text-gray-800 text-sm mt-0.5">{val.value}</div>
                                            <div className={`text-[11px] font-semibold mt-1 ${val.score > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                                                +{val.score} điểm ({val.note})
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ----------------- TAB 4: BHYT AUDIT ----------------- */}
            {activeTab === "bhyt" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-5 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                        <div className="font-bold text-gray-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ShieldAlert className="text-blue-600" size={20} />
                                <h3>Hồ sơ Đề Nghị Thanh Toán BHYT</h3>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                                MedGemma Auditor
                            </span>
                        </div>

                        {/* Presets */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            <span className="text-[11px] text-gray-500 font-semibold self-center">Mẫu giám định:</span>
                            <button
                                type="button"
                                onClick={() => {
                                    setBhytDiagnosis("I10");
                                    setBhytSecondary("K21.0");
                                    setBhytMeds("Amlodipine 5mg, Atorvastatin 20mg, Nexium 40mg, Albumin 20%");
                                    setBhytProcedures("Điện tim ECG, Chụp MRI cột sống thắt lưng, Xét nghiệm Hs-Troponin T");
                                }}
                                className="text-[11px] px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg border border-amber-200 font-medium transition-all"
                            >
                                Hồ sơ nguy cơ xuất toán (Statin, MRI, Troponin)
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setBhytDiagnosis("J18.9");
                                    setBhytSecondary("R50.9, J06.9");
                                    setBhytMeds("Cefuroxime 500mg, Paracetamol 500mg, Acetylcystein 200mg");
                                    setBhytProcedures("Chụp X-quang tim phổi thẳng, Tổng phân tích tế bào máu ngoại vi");
                                }}
                                className="text-[11px] px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg border border-emerald-200 font-medium transition-all"
                            >
                                Hồ sơ Hợp lệ 100% (Viêm phổi)
                            </button>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                                Mã Chẩn đoán chính (ICD-10):
                            </label>
                            <input
                                type="text"
                                value={bhytDiagnosis}
                                onChange={(e) => setBhytDiagnosis(e.target.value)}
                                className="w-full p-2.5 border rounded-xl font-bold text-blue-900 bg-blue-50/50"
                                placeholder="VD: I10, J18.9..."
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                                Mã Chẩn đoán phụ kèm theo (phân cách dấu phẩy):
                            </label>
                            <input
                                type="text"
                                value={bhytSecondary}
                                onChange={(e) => setBhytSecondary(e.target.value)}
                                className="w-full p-2.5 border rounded-xl text-sm font-semibold text-gray-800"
                                placeholder="VD: E78.2, K21.0, M51.1..."
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                                Thuốc kê trong đơn (phân cách dấu phẩy):
                            </label>
                            <textarea
                                rows={2}
                                value={bhytMeds}
                                onChange={(e) => setBhytMeds(e.target.value)}
                                className="w-full p-2.5 border rounded-xl text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                                Chỉ định Cận lâm sàng & Thủ thuật:
                            </label>
                            <textarea
                                rows={2}
                                value={bhytProcedures}
                                onChange={(e) => setBhytProcedures(e.target.value)}
                                className="w-full p-2.5 border rounded-xl text-sm"
                            />
                        </div>

                        <button
                            onClick={handleAuditBhyt}
                            disabled={isLoading}
                            className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50"
                        >
                            {isLoading ? <RefreshCw className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
                            {isLoading ? "AI MedGemma đang rà soát Thông tư BHYT..." : "Rà Soát Chống Xuất Toán Viện Phí Với AI"}
                        </button>
                    </div>

                    <div className="lg:col-span-7 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                        <div className="flex items-center justify-between border-b pb-3">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <FileText className="text-blue-600" size={20} />
                                Kết quả Giám định Hồ sơ BHYT (AI MedGemma)
                            </h3>
                            {bhytResult && (
                                <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                                    bhytResult.isAuditPassed
                                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                        : "bg-amber-100 text-amber-800 border-amber-300"
                                }`}>
                                    {bhytResult.auditStatus}
                                </span>
                            )}
                        </div>

                        {!bhytResult ? (
                            <div className="py-20 text-center text-gray-400 space-y-3">
                                <ShieldAlert size={48} className="mx-auto text-gray-300" />
                                <p className="text-sm">Bấm "Rà soát chống xuất toán" để đối chiếu quy định TT 20/2022/TT-BYT & BHXH</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* AI MedGemma Audit Summary Card */}
                                {bhytResult.aiAuditSummary && (
                                    <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Sparkles size={18} className="text-blue-600 animate-pulse" />
                                            <span className="font-bold text-blue-950 text-sm">Báo Cáo Giám Định Viện Phí AI MedGemma</span>
                                            <span className="text-[10px] bg-blue-200 text-blue-900 font-bold px-2 py-0.5 rounded-full">
                                                TT 20/2022/TT-BYT
                                            </span>
                                        </div>
                                        <p className="text-xs text-blue-950 leading-relaxed whitespace-pre-line">
                                            {bhytResult.aiAuditSummary}
                                        </p>
                                    </div>
                                )}

                                {/* Suggested ICD-10 Additions */}
                                {bhytResult.suggestedIcdCodesToAdd && bhytResult.suggestedIcdCodesToAdd.length > 0 && (
                                    <div className="p-4 bg-amber-50/90 border border-amber-300 rounded-2xl space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-amber-950 text-sm flex items-center gap-2">
                                                <FileText size={18} className="text-amber-600" />
                                                Gợi ý Bổ Sung Mã ICD-10 Hợp Lệ (Bấm để thêm vào chẩn đoán):
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {bhytResult.suggestedIcdCodesToAdd.map((code, i) => {
                                                const codeOnly = code.split(" - ")[0].trim();
                                                const isAlreadyAdded = bhytSecondary.includes(codeOnly);
                                                return (
                                                    <button
                                                        key={i}
                                                        type="button"
                                                        onClick={() => {
                                                            if (!isAlreadyAdded) {
                                                                setBhytSecondary((prev) => (prev ? `${prev}, ${codeOnly}` : codeOnly));
                                                            }
                                                        }}
                                                        disabled={isAlreadyAdded}
                                                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all ${
                                                            isAlreadyAdded
                                                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300 opacity-80"
                                                                : "bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 active:scale-95"
                                                        }`}
                                                    >
                                                        {isAlreadyAdded ? <Check size={14} className="text-emerald-700" /> : <Plus size={14} className="text-amber-700" />}
                                                        <span>{code}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {bhytResult.flaggedItems.length === 0 ? (
                                    <div className="p-8 text-center bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
                                        <CheckCircle2 size={44} className="mx-auto text-emerald-600" />
                                        <h4 className="font-bold text-emerald-950 text-base">Hồ sơ 100% Hợp Lệ</h4>
                                        <p className="text-xs text-emerald-800">
                                            Mọi loại thuốc và kỹ thuật cận lâm sàng đều tương thích chuẩn với danh mục mã bệnh ICD-10 đã kê khai.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="p-4 bg-amber-500/10 border border-amber-300 rounded-xl flex items-center justify-between">
                                            <div>
                                                <div className="font-bold text-amber-900 text-sm">
                                                    Phát hiện {bhytResult.totalFlagged} mục có nguy cơ bị cơ quan BHXH xuất toán!
                                                </div>
                                                <div className="text-xs text-amber-700">Cần chỉnh sửa bổ sung trước khi đẩy cổng BHYT.</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs text-gray-500 font-bold uppercase">Nguy cơ thiệt hại</div>
                                                <div className="text-lg font-black text-rose-600">
                                                    {bhytResult.totalEstimatedLossVnd.toLocaleString("vi-VN")} đ
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            {bhytResult.flaggedItems.map((item, idx) => (
                                                <div key={idx} className="p-3.5 bg-gray-50 border rounded-xl text-xs space-y-1.5 hover:bg-gray-100/70 transition-all">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-bold text-gray-900 text-sm">{item.item}</span>
                                                        <span className="text-rose-600 font-bold">
                                                            -{item.potentialLossVnd.toLocaleString("vi-VN")} đ
                                                        </span>
                                                    </div>
                                                    <p className="text-gray-600 leading-relaxed">{item.reason}</p>
                                                    <div className="p-2 bg-blue-50 text-blue-900 rounded-lg font-medium border border-blue-200">
                                                        💡 Khuyến nghị: {item.recommendation}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ----------------- TAB 5: PATIENT EXPLANATION ----------------- */}
            {activeTab === "patient" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-5 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                        <div className="font-bold text-gray-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Volume2 className="text-indigo-600" size={20} />
                                <h3>Bệnh án chuyên môn (Y lệnh hàn lâm)</h3>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                                AI MedGemma
                            </span>
                        </div>

                        {/* Audience Selector */}
                        <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-xl">
                            <button
                                type="button"
                                onClick={() => setTargetAudience("PATIENT")}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    targetAudience === "PATIENT" ? "bg-white text-indigo-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                                }`}
                            >
                                👤 Cho Người Bệnh
                            </button>
                            <button
                                type="button"
                                onClick={() => setTargetAudience("FAMILY")}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    targetAudience === "FAMILY" ? "bg-white text-indigo-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                                }`}
                            >
                                👥 Cho Thân Nhân / Người Nhà
                            </button>
                        </div>

                        {/* Presets */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            <span className="text-[11px] text-gray-500 font-semibold self-center">Bệnh án mẫu:</span>
                            <button
                                type="button"
                                onClick={() => {
                                    setMedicalNotesInput(
                                        "Bệnh nhân được chẩn đoán Viêm loét dạ dày tá tràng mạn tính giai đoạn tiến triển, vi khuẩn HP dương tính. Bạch cầu tăng nhẹ, niêm mạc xung huyết rải rác hang vị. Cần điều trị phác đồ 4 thuốc có Bismuth trong 14 ngày."
                                    );
                                }}
                                className="text-[11px] px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-lg border border-indigo-200 font-medium transition-all"
                            >
                                Viêm loét dạ dày HP(+)
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setMedicalNotesInput(
                                        "Bệnh nhân sốt cao 39°C ngày thứ 3, ho khạc đờm đặc màu rỉ sắt, đau tức ngực khi hít sâu. X-quang ghi nhận đám mờ thùy dưới phổi phải, chẩn đoán Viêm phổi thùy cấp do phế cầu khuẩn. Kê đơn kháng sinh tiêm tĩnh mạch kết hợp khí dung."
                                    );
                                }}
                                className="text-[11px] px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded-lg border border-rose-200 font-medium transition-all"
                            >
                                Viêm phổi cấp sốt cao
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setMedicalNotesInput(
                                        "Bệnh nhân nam 65 tuổi đo huyết áp phòng khám 175/105 mmHg, chóng mặt, hoa mắt, rối loạn tiền đình. Tiền sử tăng huyết áp nguyên phát 5 năm nhưng hay quên uống thuốc. Đề nghị uống Amlodipine 5mg kết hợp Losartan 50mg mỗi sáng."
                                    );
                                }}
                                className="text-[11px] px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg border border-emerald-200 font-medium transition-all"
                            >
                                Tăng huyết áp kịch phát
                            </button>
                        </div>

                        <textarea
                            rows={6}
                            value={medicalNotesInput}
                            onChange={(e) => setMedicalNotesInput(e.target.value)}
                            className="w-full p-3.5 border rounded-xl text-sm leading-relaxed focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="Nhập ghi chú chẩn đoán hoặc dán kết quả cận lâm sàng..."
                        />

                        <button
                            onClick={handleExplainForPatient}
                            disabled={isLoading}
                            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
                        >
                            {isLoading ? <RefreshCw className="animate-spin" size={18} /> : <Sparkles size={18} />}
                            {isLoading ? "AI MedGemma đang chuyển ngữ..." : `Chuyển Ngôn Ngữ Dễ Hiểu Cho ${targetAudience === "FAMILY" ? "Thân Nhân" : "Bệnh Nhân"}`}
                        </button>
                    </div>

                    <div className="lg:col-span-7 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                        <div className="flex items-center justify-between border-b pb-3">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <HeartPulse className="text-indigo-600" size={20} />
                                Lời Dặn Dò Thân Thiện Dành Cho {targetAudience === "FAMILY" ? "Thân Nhân" : "Người Bệnh"}
                            </h3>
                            {patientResult && (
                                <button
                                    onClick={() => {
                                        if ("speechSynthesis" in window) {
                                            window.speechSynthesis.cancel();
                                            const utter = new SpeechSynthesisUtterance(patientResult.friendlySummary);
                                            utter.lang = "vi-VN";
                                            utter.rate = 0.95;
                                            window.speechSynthesis.speak(utter);
                                        } else {
                                            alert("Trình duyệt không hỗ trợ tổng hợp giọng nói.");
                                        }
                                    }}
                                    className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold flex items-center gap-1.5 border border-indigo-200 transition-all active:scale-95"
                                >
                                    <Volume2 size={14} />
                                    <span>Đọc to lời dặn</span>
                                </button>
                            )}
                        </div>

                        {!patientResult ? (
                            <div className="py-20 text-center text-gray-400 space-y-3">
                                <Volume2 size={48} className="mx-auto text-gray-300" />
                                <p className="text-sm">Bấm nút để AI MedGemma biên soạn thông điệp ấm áp, dễ hiểu cho người bệnh</p>
                            </div>
                        ) : (
                            <div className="space-y-4 text-xs">
                                <div className="p-4 bg-gradient-to-r from-indigo-50/80 to-purple-50/80 border border-indigo-200 rounded-2xl text-indigo-950 text-sm leading-relaxed font-medium shadow-sm">
                                    "{patientResult.friendlySummary}"
                                </div>

                                <div className="p-4 bg-gray-50 rounded-xl border space-y-2">
                                    <div className="font-bold text-gray-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                        <span>📌</span> Điểm mấu chốt cần nhớ:
                                    </div>
                                    <ul className="list-disc list-inside space-y-1 text-gray-700">
                                        {patientResult.keyPoints.map((pt, idx) => (
                                            <li key={idx}>{pt}</li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-2">
                                    <div className="font-bold text-emerald-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                        <span>🥗</span> Chế độ dinh dưỡng & sinh hoạt tại nhà:
                                    </div>
                                    <ul className="list-disc list-inside space-y-1 text-emerald-800">
                                        {patientResult.lifestyleRecommendations.map((tip, idx) => (
                                            <li key={idx}>{tip}</li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="p-3.5 bg-rose-50 text-rose-800 rounded-xl border border-rose-200 font-semibold flex items-center gap-2">
                                    <span>⚠️</span>
                                    <span>{patientResult.emergencyNotice}</span>
                                </div>

                                {patientResult.encouragement && (
                                    <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-900 rounded-xl border border-emerald-200 font-semibold flex items-center gap-2">
                                        <span>💚</span>
                                        <span>{patientResult.encouragement}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ----------------- TAB 6: CHAT COPILOT (ChatGPT Multi-Session) ----------------- */}
            {activeTab === "chat" && (
                <div className="bg-white rounded-3xl shadow-xl border border-teal-200/80 flex h-[720px] overflow-hidden">
                    {/* ChatGPT Left Sidebar */}
                    {!isSidebarCollapsed && (
                        <div className="w-72 sm:w-80 border-r border-slate-200 bg-slate-50/90 flex flex-col flex-shrink-0 animate-in slide-in-from-left duration-200">
                            {/* New Chat Button */}
                            <div className="p-3.5 border-b border-slate-200 bg-slate-100/70 flex items-center gap-2">
                                <button
                                    onClick={handleNewSession}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3.5 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-600/20 transition-all active:scale-95"
                                >
                                    <Plus size={16} />
                                    <span>+ Cuộc trò chuyện mới</span>
                                </button>
                                <button
                                    onClick={() => setIsSidebarCollapsed(true)}
                                    className="p-2 hover:bg-slate-200 rounded-lg text-slate-500"
                                    title="Thu gọn danh sách phiên"
                                >
                                    <PanelLeftClose size={18} />
                                </button>
                            </div>

                            {/* Sessions List Grouped By Date */}
                            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                                {pageDateGroups.map((group, gIdx) => (
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
                                <div className="p-3 border-t border-slate-200 bg-slate-50 text-center">
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

                    {/* Right Main Chat Panel */}
                    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50">
                        {/* Header */}
                        <div className="p-4 border-b bg-white flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-3">
                                {isSidebarCollapsed && (
                                    <button
                                        onClick={() => setIsSidebarCollapsed(false)}
                                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 mr-1"
                                        title="Mở danh sách phiên chat"
                                    >
                                        <PanelLeft size={18} />
                                    </button>
                                )}
                                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-600 to-cyan-700 flex items-center justify-center text-white shadow-md shadow-teal-600/30">
                                    <Bot size={22} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-gray-800 text-sm">
                                            {activeSession?.title || "MedCare Clinical AI Copilot"}
                                        </h3>
                                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full border border-emerald-300">
                                            Google MedGemma 1.5 4B
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Tra cứu Dược thư Quốc gia & Hướng dẫn điều trị Bộ Y Tế
                                    </p>
                                </div>
                            </div>

                            <div className="hidden lg:flex items-center gap-2">
                                <button
                                    onClick={() => handleSendChat("Quy trình xử trí sốc phản vệ theo Thông tư 51/2017/TT-BYT")}
                                    disabled={isLoading}
                                    className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300 text-gray-700 transition-colors shadow-sm"
                                >
                                    🚑 Sốc phản vệ
                                </button>
                                <button
                                    onClick={() => handleSendChat("Liều dùng Paracetamol an toàn tối đa cho người lớn")}
                                    disabled={isLoading}
                                    className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300 text-gray-700 transition-colors shadow-sm"
                                >
                                    💊 Liều Paracetamol
                                </button>
                                <button
                                    onClick={() => handleSendChat("Xử trí cơn tăng huyết áp cấp cứu")}
                                    disabled={isLoading}
                                    className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300 text-gray-700 transition-colors shadow-sm"
                                >
                                    ❤️ Cơn tăng huyết áp
                                </button>
                            </div>
                        </div>

                        {/* Chat Messages Body */}
                        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
                            {/* Starter prompt cards if only 1 welcome bot message */}
                            {currentMessages.length <= 1 && (
                                <div className="my-6 max-w-xl mx-auto space-y-3">
                                    <div className="text-center space-y-1">
                                        <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center mx-auto shadow-md shadow-teal-600/30">
                                            <Bot size={26} />
                                        </div>
                                        <h4 className="font-extrabold text-base text-slate-800">
                                            MedCare Clinical Copilot (AI ChatGPT Y Khoa)
                                        </h4>
                                        <p className="text-xs text-slate-500">
                                            Bác sĩ có thể đặt câu hỏi lâm sàng hoặc chọn câu hỏi mẫu bên dưới:
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                        <div
                                            onClick={() => handleSendChat("Bệnh nhân nghi sốc phản vệ độ 2 cần tiêm Adrenaline như thế nào theo Thông tư 51/2017/TT-BYT?")}
                                            className="p-3 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-2xl cursor-pointer transition-all shadow-sm group text-left"
                                        >
                                            <div className="font-bold text-xs text-slate-800 group-hover:text-teal-700 flex items-center gap-1.5">
                                                <span>🚑</span> Cấp cứu phản vệ
                                            </div>
                                            <div className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                                                Phác đồ tiêm Adrenaline Thông tư 51/2017/TT-BYT
                                            </div>
                                        </div>

                                        <div
                                            onClick={() => handleSendChat("Phác đồ kháng sinh ban đầu cho viêm phổi cộng đồng CAP theo QĐ 4815/QĐ-BYT?")}
                                            className="p-3 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-2xl cursor-pointer transition-all shadow-sm group text-left"
                                        >
                                            <div className="font-bold text-xs text-slate-800 group-hover:text-teal-700 flex items-center gap-1.5">
                                                <span>🫁</span> Viêm phổi CAP
                                            </div>
                                            <div className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                                                Lựa chọn kháng sinh theo QĐ 4815/QĐ-BYT
                                            </div>
                                        </div>

                                        <div
                                            onClick={() => handleSendChat("Tương tác nguy hiểm giữa Warfarin và Ciprofloxacin/Metronidazole?")}
                                            className="p-3 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-2xl cursor-pointer transition-all shadow-sm group text-left"
                                        >
                                            <div className="font-bold text-xs text-slate-800 group-hover:text-teal-700 flex items-center gap-1.5">
                                                <span>💊</span> Tương tác Warfarin
                                            </div>
                                            <div className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                                                Nguy cơ xuất huyết & kéo dài chỉ số INR
                                            </div>
                                        </div>

                                        <div
                                            onClick={() => handleSendChat("Bệnh nhân sau phẫu thuật có nhịp thở 25 lần/phút, SpO2 92% khí phòng, huyết áp 95/60 mmHg, mạch 110 lần/phút, sốt 38.6 độ C. Tính nguy cơ NEWS2 và có cần báo động Sepsis không?")}
                                            className="p-3 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-2xl cursor-pointer transition-all shadow-sm group text-left"
                                        >
                                            <div className="font-bold text-xs text-slate-800 group-hover:text-teal-700 flex items-center gap-1.5">
                                                <span>🚨</span> Báo động Sepsis / NEWS2
                                            </div>
                                            <div className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                                                Đánh giá suy hô hấp & Sepsis 1 Giờ
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {currentMessages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                                >
                                    {msg.sender === "user" ? (
                                        <div className="max-w-2xl p-4 rounded-2xl bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-br-none text-xs sm:text-sm leading-relaxed shadow-md font-medium">
                                            {msg.text}
                                            <div className="text-[10px] mt-1.5 opacity-70 text-right font-mono">
                                                {msg.time}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="max-w-3xl w-full p-4 rounded-2xl bg-white text-gray-800 rounded-bl-none border border-slate-200/90 shadow-sm">
                                            <FormattedMedicalMessage content={msg.text} sources={msg.sources} time={msg.time} />
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Loading State */}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-white border border-teal-200 rounded-2xl rounded-tl-none shadow-sm p-4 max-w-md flex items-center gap-3 text-xs text-teal-900">
                                        <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 animate-pulse">
                                            <Sparkles size={18} className="animate-spin" />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="font-bold flex items-center gap-1.5">
                                                Google MedGemma 1.5 4B đang suy luận...
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

                            <div ref={pageChatEndRef} />
                        </div>

                        {/* Input Footer */}
                        <div className="p-4 border-t bg-white flex gap-2">
                            <input
                                type="text"
                                value={chatQuery}
                                onChange={(e) => setChatQuery(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendChat()}
                                placeholder="Đặt câu hỏi lâm sàng, liều lượng thuốc hoặc quy trình y tế..."
                                disabled={isLoading}
                                className="flex-1 p-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50/50"
                            />
                            <button
                                onClick={() => handleSendChat()}
                                disabled={isLoading || !chatQuery.trim()}
                                className="px-6 py-3 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 text-white font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-teal-600/20 disabled:opacity-50"
                            >
                                <Send size={16} /> Gửi
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* IN-WEB MICROSOFT WORD EDITOR MODAL */}
            <MedicalWordEditorModal
                isOpen={isWordEditorOpen}
                onClose={() => setIsWordEditorOpen(false)}
                emrResult={emrResult}
                clinicalSpeechText={speechText}
                selectedResident={residents.find((r) => r.id === selectedResidentId) || null}
            />
        </div>
    );
}
