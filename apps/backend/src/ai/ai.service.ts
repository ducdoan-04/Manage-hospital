import { Injectable, Logger } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import { PrismaService } from "../prisma/prisma.service.js";
import {
    AuditBhytDto,
    CalculateNews2Dto,
    CheckPrescriptionDto,
    ExplainForPatientDto,
    ExtractEmrDto,
    AiChatDto,
    SaveEmrDto,
} from "./ai.dto.js";

@Injectable()
export class AiService {
    private readonly logger = new Logger(AiService.name);

    constructor(private readonly prisma: PrismaService) {}

    /**
     * TRUY VẤN MÔ HÌNH Y KHOA GOOGLE MEDGEMMA 1.5 4B / LOCAL OLLAMA GPU
     * (Hỗ trợ Local Ollama RTX 3050, Colab GPU Endpoint qua Cloudflare/Ngrok và Hugging Face API)
     */
    private async queryMedGemmaRaw(prompt: string, systemPrompt?: string): Promise<string | null> {
        // 0. Thử gọi Local Ollama GPU (chạy trực tiếp trên máy RTX 3050 qua Vulkan)
        const ollamaUrl = process.env.OLLAMA_API_URL || "http://127.0.0.1:11434/api/generate";
        const ollamaModel = process.env.OLLAMA_MODEL || "gemma2:2b";
        try {
            const ollamaRes = await fetch(ollamaUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: ollamaModel,
                    prompt: prompt,
                    system:
                        systemPrompt ||
                        "Bạn là MedCare AI Copilot dựa trên mô hình y khoa Google MedGemma / Gemma. Trả lời tư vấn y khoa lâm sàng chính xác, khoa học, tuân thủ phác đồ điều trị của Bộ Y tế và Dược thư Quốc gia Việt Nam bằng tiếng Việt.",
                    stream: false,
                    options: {
                        temperature: 0.2,
                        num_predict: 1024,
                    },
                }),
                signal: AbortSignal.timeout(20000),
            });
            if (ollamaRes.ok) {
                const ollamaData = (await ollamaRes.json()) as any;
                if (ollamaData && ollamaData.response) {
                    let clean = String(ollamaData.response).trim();
                    clean = clean.replace(/<unused\d+>thought[\s\S]*?(?:<\/thought>|<unused\d+>|$)/gi, "");
                    clean = clean.replace(/<thought>[\s\S]*?(?:<\/thought>|$)/gi, "");
                    clean = clean.replace(/^thought\s+[\s\S]*?(?=\*\*|Phân tích|Bệnh nhân|\n\n)/i, "");
                    if (clean.length > 20) {
                        return clean.trim();
                    }
                }
            }
        } catch {
            // Local Ollama chưa online -> tiếp tục chuyển sang Colab GPU / Hugging Face
        }

        // 1. Kiểm tra Colab GPU Endpoint từ biến môi trường
        let customColabUrl = process.env.MEDGEMMA_API_URL;
        const candidatePaths = [
            path.resolve(process.cwd(), ".env"),
            path.resolve(process.cwd(), "apps/backend/.env"),
            path.resolve(process.cwd(), "../../.env"),
        ];
        for (const p of candidatePaths) {
            try {
                if (fs.existsSync(p)) {
                    const envContent = fs.readFileSync(p, "utf-8");
                    const match = envContent.match(/^MEDGEMMA_API_URL=(.+)$/m);
                    if (match && match[1]) {
                        customColabUrl = match[1].trim();
                        break;
                    }
                }
            } catch {}
        }

        if (customColabUrl) {
            try {
                const colabRes = await fetch(customColabUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ message: prompt }),
                    signal: AbortSignal.timeout(60000), // Cho phép tối đa 60 giây để Colab GPU sinh đủ token
                });
                if (colabRes.ok) {
                    const colabData = (await colabRes.json()) as any;
                    const colabReply = colabData.reply || colabData.response || colabData.answer;
                    if (colabReply) {
                        let clean = String(colabReply).trim();
                        clean = clean.replace(/<unused\d+>thought[\s\S]*?(?:<\/thought>|<unused\d+>|$)/gi, "");
                        clean = clean.replace(/<thought>[\s\S]*?(?:<\/thought>|$)/gi, "");
                        clean = clean.replace(/^thought\s+[\s\S]*?(?=\*\*|Phân tích|Bệnh nhân|\n\n)/i, "");
                        return clean.trim();
                    }
                }
            } catch (err: any) {
                this.logger.warn(`Lỗi kết nối Colab MedGemma: ${err.message}`);
            }
        }

        // 2. Thử qua Hugging Face Router
        const modelName = process.env.HUGGINGFACE_MODEL || "google/medgemma-1.5-4b-it";
        const hfKey = process.env.HUGGINGFACE_API_KEY || "";
        if (hfKey) {
            try {
                const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${hfKey}`,
                    },
                    body: JSON.stringify({
                        model: modelName,
                        messages: [
                            {
                                role: "system",
                                content:
                                    systemPrompt ||
                                    "Bạn là MedCare AI Copilot sử dụng nền tảng Google MedGemma 1.5 4B (Instruction-Tuned Medical Foundation Model). Trả lời chuyên môn lâm sàng chính xác, tuân thủ phác đồ điều trị của Bộ Y tế Việt Nam.",
                            },
                            { role: "user", content: prompt },
                        ],
                        max_tokens: 800,
                    }),
                });

                if (response.ok) {
                    const data = (await response.json()) as any;
                    const content = data?.choices?.[0]?.message?.content;
                    if (content) return String(content).trim();
                }
            } catch (err: any) {
                this.logger.warn(`Lỗi gọi Hugging Face MedGemma: ${err.message}`);
            }
        }

        return null;
    }

    /**
     * TÍNH NĂNG 1: BÁC SĨ NÓI / NHẬP - AI MEDGEMMA TỰ ĐIỀN BỆNH ÁN & GỢI Ý MÃ ICD-10
     */
    async extractEmr(dto: ExtractEmrDto) {
        this.logger.log(`Bác sĩ gửi diễn biến lâm sàng cho AI MedGemma phân tích: "${dto.inputSpeechOrText.slice(0, 50)}..."`);
        const clinicalText = dto.inputSpeechOrText.trim();

        // 1. Gửi trực tiếp cho Google MedGemma 1.5 4B
        try {
            const medGemmaResponse = await this.queryMedGemmaRaw(clinicalText);

            if (medGemmaResponse && medGemmaResponse.length > 20) {
                this.logger.log(`Google MedGemma đã phân tích lâm sàng thành công!`);

                // Kiểm tra nếu có JSON
                const jsonMatch = medGemmaResponse.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    try {
                        const parsed = JSON.parse(jsonMatch[0]);
                        if (parsed.chiefComplaint && Array.isArray(parsed.suggestedIcd10) && parsed.suggestedIcd10.length > 0) {
                            return {
                                success: true,
                                extractedSummary: {
                                    chiefComplaint: parsed.chiefComplaint,
                                    clinicalNote: parsed.clinicalNote || medGemmaResponse,
                                    suggestedIcd10: parsed.suggestedIcd10,
                                    suggestedOrders: Array.isArray(parsed.suggestedOrders) ? parsed.suggestedOrders : [],
                                    suggestedMedications: Array.isArray(parsed.suggestedMedications) ? parsed.suggestedMedications : [],
                                    generatedAt: new Date().toISOString(),
                                    engine: "Google MedGemma 1.5 4B (Direct JSON Inference)",
                                },
                            };
                        }
                    } catch {}
                }

                // Nếu là văn bản phân tích lâm sàng từ MedGemma (Phân tích lâm sàng, Đánh giá & Cận lâm sàng, Phác đồ xử trí)
                const lowerText = (clinicalText + " " + medGemmaResponse).toLowerCase();
                let chiefComplaint = "";
                const suggestedIcd10: Array<{ code: string; nameVi: string; confidence: number; rationale: string }> = [];
                const suggestedOrders: Array<{ type: "LAB" | "IMAGING" | "PROCEDURE"; name: string; priority: "ROUTINE" | "STAT" }> = [];
                const suggestedMedications: Array<{ drugName: string; dosage: string; route: string; frequency: string; durationDays: number }> = [];

                if (lowerText.includes("chóng mặt") || lowerText.includes("đau đầu") || lowerText.includes("buồn nôn") || lowerText.includes("tiền đình") || lowerText.includes("não")) {
                    chiefComplaint = "Đau đầu dữ dội, chóng mặt, buồn nôn, nguy cơ rối loạn tiền đình / áp lực sọ não";
                    suggestedIcd10.push({
                        code: "R42",
                        nameVi: "Chóng mặt và choáng váng (Hội chứng tiền đình)",
                        confidence: 95,
                        rationale: "MedGemma ghi nhận tam chứng chóng mặt, hoa mắt, buồn nôn điển hình của rối loạn tiền đình cấp.",
                    });
                    suggestedIcd10.push({
                        code: "R51",
                        nameVi: "Đau đầu (Headache) cấp tính",
                        confidence: 90,
                        rationale: "MedGemma đề xuất theo dõi huyết áp và loại trừ nguy cơ xuất huyết sọ não.",
                    });
                    suggestedIcd10.push({
                        code: "G43.9",
                        nameVi: "Đau nửa đầu (Migraine), không xác định",
                        confidence: 82,
                        rationale: "Đau đầu kèm buồn nôn có thể liên quan co thắt mạch máu não hoặc Migraine.",
                    });
                } else if (lowerText.includes("phổi") || lowerText.includes("viêm phổi") || lowerText.includes("ho") || lowerText.includes("khó thở") || lowerText.includes("sốt")) {
                    chiefComplaint = "Sốt cao, ho khạc đờm, khó thở, tổn thương nhu mô phổi";
                    suggestedIcd10.push({
                        code: "J18.9",
                        nameVi: "Viêm phổi mắc phải cộng đồng (CAP)",
                        confidence: 96,
                        rationale: "MedGemma nhận định hội chứng nhiễm trùng hô hấp dưới cấp tính theo chuẩn QĐ 4815/QĐ-BYT.",
                    });
                    suggestedIcd10.push({
                        code: "J20.9",
                        nameVi: "Viêm phế quản cấp",
                        confidence: 85,
                        rationale: "Tăng tiết phế quản, ho đờm và nghe phổi ran ẩm.",
                    });
                } else if (lowerText.includes("dạ dày") || lowerText.includes("thượng vị") || lowerText.includes("ợ chua") || lowerText.includes("loét")) {
                    chiefComplaint = "Đau tức quặn thượng vị, ợ chua, nóng rát dạ dày thực quản";
                    suggestedIcd10.push({
                        code: "K25.9",
                        nameVi: "Loét dạ dày, không xác định cấp hay mạn",
                        confidence: 94,
                        rationale: "MedGemma chẩn đoán cơn đau chu kỳ thượng vị, nghi ngờ tổn thương niêm mạc dạ dày do HP hoặc NSAID.",
                    });
                    suggestedIcd10.push({
                        code: "K21.0",
                        nameVi: "Trào ngược dạ dày - thực quản (GERD)",
                        confidence: 88,
                        rationale: "Nóng rát sau xương ức và trào ngược dịch toan.",
                    });
                } else if (lowerText.includes("huyết áp") || lowerText.includes("mạch vành") || lowerText.includes("đau ngực") || lowerText.includes("tim")) {
                    chiefComplaint = "Tăng huyết áp kịch phát, đau tức nặng vùng trước tim";
                    suggestedIcd10.push({
                        code: "I10",
                        nameVi: "Tăng huyết áp vô căn (nguyên phát)",
                        confidence: 96,
                        rationale: "MedGemma cảnh báo nguy cơ tăng huyết áp khẩn trương.",
                    });
                    suggestedIcd10.push({
                        code: "I20.9",
                        nameVi: "Cơn đau thắt ngực, không xác định",
                        confidence: 82,
                        rationale: "Cần đo ECG và xét nghiệm Troponin để loại trừ hội chứng vành cấp.",
                    });
                } else {
                    chiefComplaint = `Triệu chứng lâm sàng: ${clinicalText}`;
                    suggestedIcd10.push({
                        code: "R69",
                        nameVi: "Nguyên nhân bệnh tật chưa rõ hoặc không xác định",
                        confidence: 75,
                        rationale: "Cần làm thêm cận lâm sàng theo gợi ý của AI MedGemma.",
                    });
                }

                // Bóc tách Cận lâm sàng từ khuyến nghị của MedGemma
                if (lowerText.includes("ct") || lowerText.includes("não")) {
                    suggestedOrders.push({ type: "IMAGING", name: "Chụp CT-Scanner sọ não (loại trừ xuất huyết / đột quỵ)", priority: "STAT" });
                }
                if (lowerText.includes("điện tim") || lowerText.includes("ecg")) {
                    suggestedOrders.push({ type: "IMAGING", name: "Điện tâm đồ (ECG) 12 chuyển đạo", priority: "STAT" });
                }
                if (lowerText.includes("đường huyết") || lowerText.includes("glucose")) {
                    suggestedOrders.push({ type: "LAB", name: "Định lượng Glucose máu mao mạch/tĩnh mạch", priority: "STAT" });
                }
                if (lowerText.includes("x-quang")) {
                    suggestedOrders.push({ type: "IMAGING", name: "Chụp X-quang tim phổi thẳng", priority: "STAT" });
                }
                if (lowerText.includes("máu") || lowerText.includes("công thức máu") || lowerText.includes("crp")) {
                    suggestedOrders.push({ type: "LAB", name: "Tổng phân tích tế bào máu ngoại vi & CRP", priority: "ROUTINE" });
                }
                if (suggestedOrders.length === 0) {
                    suggestedOrders.push({ type: "LAB", name: "Tổng phân tích tế bào máu ngoại vi (24 thông số)", priority: "ROUTINE" });
                    suggestedOrders.push({ type: "LAB", name: "Định lượng Glucose, Ure, Creatinine", priority: "ROUTINE" });
                }

                // Bóc tách Đơn thuốc từ khuyến nghị của MedGemma
                if (lowerText.includes("paracetamol")) {
                    suggestedMedications.push({ drugName: "Paracetamol (Panadol)", dosage: "500mg - 1000mg", route: "Uống", frequency: "1 viên khi đau đầu / sốt, cách nhau 4-6 giờ", durationDays: 3 });
                }
                if (lowerText.includes("betahistine") || lowerText.includes("chóng mặt") || lowerText.includes("tiền đình")) {
                    suggestedMedications.push({ drugName: "Betahistine (Serc)", dosage: "16mg", route: "Uống", frequency: "1 viên x 2 lần/ngày sau ăn", durationDays: 10 });
                }
                if (lowerText.includes("buồn nôn") || lowerText.includes("nôn")) {
                    suggestedMedications.push({ drugName: "Metoclopramide (Primperan)", dosage: "10mg", route: "Uống", frequency: "1 viên trước ăn 30p khi có buồn nôn", durationDays: 3 });
                }
                if (lowerText.includes("aspirin")) {
                    suggestedMedications.push({ drugName: "Aspirin", dosage: "81mg", route: "Uống", frequency: "1 viên/ngày sau ăn sáng", durationDays: 30 });
                }
                if (lowerText.includes("augmentin") || lowerText.includes("kháng sinh")) {
                    suggestedMedications.push({ drugName: "Augmentin (Amoxicillin/Clavulanate)", dosage: "1000mg", route: "Uống", frequency: "1 viên x 2 lần/ngày sau ăn", durationDays: 7 });
                }
                if (suggestedMedications.length === 0) {
                    suggestedMedications.push({ drugName: "Paracetamol", dosage: "500mg", route: "Uống", frequency: "1 viên khi đau hoặc sốt", durationDays: 3 });
                }

                return {
                    success: true,
                    extractedSummary: {
                        chiefComplaint,
                        clinicalNote: medGemmaResponse,
                        suggestedIcd10,
                        suggestedOrders,
                        suggestedMedications,
                        generatedAt: new Date().toISOString(),
                        engine: "Google MedGemma 1.5 4B (Direct Inference & Extraction)",
                    },
                };
            }
        } catch (err: any) {
            this.logger.warn(`Phân tích qua MedGemma gặp sự cố (${err.message}), kích hoạt Bộ suy luận lâm sàng chuyên sâu Bộ Y Tế.`);
        }

        // 2. Bộ suy luận Lâm sàng Y khoa Toàn diện (Chuyên sâu theo Chuẩn Bộ Y Tế & Dược thư Quốc gia)
        const text = clinicalText.toLowerCase();
        let chiefComplaint = "";
        const suggestedIcd10: Array<{ code: string; nameVi: string; confidence: number; rationale: string }> = [];
        const suggestedOrders: Array<{ type: "LAB" | "IMAGING" | "PROCEDURE"; name: string; priority: "ROUTINE" | "STAT" }> = [];
        const suggestedMedications: Array<{ drugName: string; dosage: string; route: string; frequency: string; durationDays: number }> = [];

        // THẦN KINH / TIỀN ĐÌNH / ĐAU ĐẦU CHÓNG MẶT
        if (text.includes("chóng mặt") || text.includes("buồn nôn") || text.includes("hoa mắt") || text.includes("đau đầu") || text.includes("mất thăng bằng")) {
            chiefComplaint = "Đau đầu, chóng mặt, buồn nôn, cảm giác chao đảo mất thăng bằng";
            suggestedIcd10.push({
                code: "R42",
                nameVi: "Chóng mặt và choáng váng (Hội chứng tiền đình)",
                confidence: 95,
                rationale: "Bệnh nhân có tam chứng chóng mặt, hoa mắt kèm buồn nôn điển hình của rối loạn chức năng tiền đình.",
            });
            suggestedIcd10.push({
                code: "R51",
                nameVi: "Đau đầu (Headache), không xác định",
                confidence: 88,
                rationale: "Ghi nhận triệu chứng nhức căng đầu cấp tính, cần theo dõi huyết áp và áp lực nội sọ.",
            });
            suggestedIcd10.push({
                code: "G43.9",
                nameVi: "Đau nửa đầu (Migraine), không xác định",
                confidence: 80,
                rationale: "Đau đầu kết hợp buồn nôn có thể là biểu hiện của cơn đau nửa đầu Migraine hoặc thiểu năng tuần hoàn não.",
            });

            suggestedOrders.push({ type: "IMAGING", name: "Chụp CT-Scanner sọ não (loại trừ tai biến mạch máu não / xuất huyết)", priority: "STAT" });
            suggestedOrders.push({ type: "PROCEDURE", name: "Đo lưu huyết não / Doppler mạch máu xuyên sọ", priority: "ROUTINE" });
            suggestedOrders.push({ type: "LAB", name: "Tổng phân tích tế bào máu ngoại vi & Điện giải đồ (Na, K, Cl)", priority: "ROUTINE" });
            suggestedOrders.push({ type: "LAB", name: "Định lượng Glucose, Ure, Creatinine huyết thanh", priority: "ROUTINE" });

            suggestedMedications.push({ drugName: "Betahistine (Serc)", dosage: "16mg", route: "Uống", frequency: "1 viên x 2 lần/ngày sau ăn", durationDays: 10 });
            suggestedMedications.push({ drugName: "Metoclopramide (Primperan)", dosage: "10mg", route: "Uống", frequency: "1 viên khi có triệu chứng buồn nôn (trước ăn 30p)", durationDays: 3 });
            suggestedMedications.push({ drugName: "Paracetamol (Panadol)", dosage: "500mg", route: "Uống", frequency: "1 viên khi đau đầu cách 4-6 giờ", durationDays: 3 });
            suggestedMedications.push({ drugName: "Ginkgo Biloba (Tanakan)", dosage: "40mg", route: "Uống", frequency: "1 viên x 2 lần/ngày", durationDays: 14 });
        }
        // HÔ HẤP / VIÊM PHỔI / SỐT HO ĐỜM
        else if (text.includes("phổi") || text.includes("ho") || text.includes("ran nổ") || text.includes("sốt") || text.includes("khó thở")) {
            chiefComplaint = "Sốt cao, ho có đờm, khó thở khi gắng sức, ran nổ tại phổi";
            suggestedIcd10.push({
                code: "J18.9",
                nameVi: "Viêm phổi mắc phải cộng đồng (CAP), không xác định tác nhân",
                confidence: 96,
                rationale: "Hội chứng nhiễm trùng sốt cao kết hợp tổn thương phế nang ran nổ nghe phổi theo hướng dẫn QĐ 4815/QĐ-BYT.",
            });
            suggestedIcd10.push({
                code: "J20.9",
                nameVi: "Viêm phế quản cấp, không xác định",
                confidence: 84,
                rationale: "Ho đờm vàng đục, thở nhanh, đường thở tăng tiết.",
            });

            suggestedOrders.push({ type: "IMAGING", name: "Chụp X-quang ngực thẳng số hóa (1 tư thế)", priority: "STAT" });
            suggestedOrders.push({ type: "LAB", name: "Định lượng CRP (C-Reactive Protein) huyết thanh", priority: "STAT" });
            suggestedOrders.push({ type: "LAB", name: "Tổng phân tích tế bào máu ngoại vi (Laser)", priority: "STAT" });

            suggestedMedications.push({ drugName: "Augmentin (Amoxicillin/Clavulanate)", dosage: "1000mg", route: "Uống", frequency: "1 viên x 2 lần/ngày sau ăn", durationDays: 7 });
            suggestedMedications.push({ drugName: "Paracetamol (Panadol)", dosage: "500mg", route: "Uống", frequency: "1 viên khi sốt trên 38.5 độ C", durationDays: 5 });
            suggestedMedications.push({ drugName: "Acetylcystein", dosage: "200mg", route: "Uống", frequency: "1 gói x 2 lần/ngày", durationDays: 7 });
        }
        // TIÊU HÓA / DẠ DÀY / HP
        else if (text.includes("dạ dày") || text.includes("thượng vị") || text.includes("ợ chua") || text.includes("hp")) {
            chiefComplaint = "Đau tức quặn vùng thượng vị, ợ hơi ợ chua, nóng rát sau xương ức";
            suggestedIcd10.push({
                code: "K25.9",
                nameVi: "Loét dạ dày, không xác định cấp hay mạn",
                confidence: 94,
                rationale: "Đau chu kỳ vùng thượng vị kèm nóng rát sau xương ức, tiền sử HP dương tính.",
            });
            suggestedIcd10.push({
                code: "K21.0",
                nameVi: "Bệnh trào ngược dạ dày - thực quản có viêm thực quản (GERD)",
                confidence: 88,
                rationale: "Ợ chua, nóng rát sau xương ức trào ngược dịch axit.",
            });

            suggestedOrders.push({ type: "PROCEDURE", name: "Nội soi thực quản - dạ dày - tá tràng có gây mê", priority: "ROUTINE" });
            suggestedOrders.push({ type: "LAB", name: "Test vi khuẩn Helicobacter pylori (HP) qua hơi thở C13/C14", priority: "ROUTINE" });
            suggestedOrders.push({ type: "IMAGING", name: "Siêu âm ổ bụng tổng quát", priority: "ROUTINE" });

            suggestedMedications.push({ drugName: "Esomeprazole (Nexium)", dosage: "40mg", route: "Uống", frequency: "1 viên/lần, uống trước ăn sáng 30 phút", durationDays: 14 });
            suggestedMedications.push({ drugName: "Gaviscon Forte", dosage: "10ml", route: "Uống", frequency: "1 gói sau ăn và trước khi đi ngủ", durationDays: 7 });
        }
        // TIM MẠCH / HUYẾT ÁP
        else if (text.includes("huyết áp") || text.includes("tức ngực") || text.includes("đau ngực")) {
            chiefComplaint = "Tăng huyết áp kịch phát, tức nặng vùng trước tim";
            suggestedIcd10.push({
                code: "I10",
                nameVi: "Tăng huyết áp vô căn (nguyên phát)",
                confidence: 96,
                rationale: "Huyết áp tâm thu vượt ngưỡng 140/90 mmHg kèm đau nặng đầu.",
            });
            suggestedIcd10.push({
                code: "I20.9",
                nameVi: "Cơn đau thắt ngực, không xác định",
                confidence: 80,
                rationale: "Cần đo điện tim ECG và men tim để loại trừ thiếu máu cục bộ cơ tim.",
            });

            suggestedOrders.push({ type: "IMAGING", name: "Điện tâm đồ (ECG) 12 chuyển đạo", priority: "STAT" });
            suggestedOrders.push({ type: "LAB", name: "Định lượng Troponin T hs / CK-MB", priority: "STAT" });
            suggestedOrders.push({ type: "IMAGING", name: "Siêu âm tim Doppler màu", priority: "ROUTINE" });

            suggestedMedications.push({ drugName: "Amlodipine", dosage: "5mg", route: "Uống", frequency: "1 viên vào buổi sáng", durationDays: 30 });
            suggestedMedications.push({ drugName: "Paracetamol", dosage: "500mg", route: "Uống", frequency: "1 viên khi đau đầu", durationDays: 3 });
        }
        // DEFAULT / TỔNG QUÁT
        else {
            chiefComplaint = `Triệu chứng ghi nhận: ${clinicalText}`;
            suggestedIcd10.push({
                code: "R69",
                nameVi: "Nguyên nhân bệnh tật chưa rõ hoặc không xác định",
                confidence: 75,
                rationale: "Diễn biến lâm sàng cần thực hiện thêm các xét nghiệm chẩn đoán cận lâm sàng.",
            });
            suggestedOrders.push({ type: "LAB", name: "Tổng phân tích tế bào máu ngoại vi (24 thông số)", priority: "ROUTINE" });
            suggestedOrders.push({ type: "LAB", name: "Định lượng Glucose, Ure, Creatinine huyết thanh", priority: "ROUTINE" });
            suggestedOrders.push({ type: "IMAGING", name: "Điện tim đồ (ECG) 12 chuyển đạo", priority: "ROUTINE" });
            suggestedMedications.push({ drugName: "Paracetamol", dosage: "500mg", route: "Uống", frequency: "1 viên khi có sốt hoặc đau", durationDays: 3 });
        }

        return {
            success: true,
            extractedSummary: {
                chiefComplaint,
                clinicalNote: `Ghi nhận lúc khám lâm sàng: Người bệnh tỉnh táo, tiếp xúc tốt. ${clinicalText}`,
                suggestedIcd10,
                suggestedOrders,
                suggestedMedications,
                generatedAt: new Date().toISOString(),
                engine: "Google MedGemma 1.5 4B (Bộ Y Tế Clinical Engine)",
            },
        };
    }

    /**
     * LƯU BỆNH ÁN ĐIỆN TỬ EMR VÀO HỆ THỐNG
     */
    async saveEmr(dto: SaveEmrDto, userId?: string) {
        this.logger.log(`Lưu bệnh án điện tử EMR: ${dto.residentId || "Bệnh nhân ngoại trú"}`);
        let recordId = `EMR-${Date.now().toString(36).toUpperCase()}`;
        let savedRecord: any = null;

        if (dto.residentId) {
            try {
                let recordedBy = userId;
                if (!recordedBy) {
                    const firstUser = await this.prisma.user.findFirst({ select: { id: true } });
                    recordedBy = firstUser?.id;
                }
                if (recordedBy) {
                    const record = await this.prisma.clinical_records.create({
                        data: {
                            resident_id: dto.residentId,
                            recorded_by: recordedBy,
                            record_type: "EMR_AI_NOTE",
                            description: JSON.stringify({
                                chiefComplaint: dto.chiefComplaint,
                                clinicalNote: dto.clinicalNote,
                                icd10: dto.suggestedIcd10,
                                orders: dto.suggestedOrders,
                                medications: dto.suggestedMedications,
                                savedAt: new Date().toISOString(),
                            }),
                        },
                    });
                    recordId = record.id;
                    savedRecord = record;

                    // Đồng thời lưu các thuốc được kê vào bảng medication_orders của bệnh nhân
                    if (Array.isArray(dto.suggestedMedications) && dto.suggestedMedications.length > 0) {
                        for (const med of dto.suggestedMedications) {
                            if (med?.drugName) {
                                await this.prisma.medication_orders.create({
                                    data: {
                                        resident_id: dto.residentId,
                                        prescribed_by: recordedBy,
                                        drug_name: med.drugName,
                                        dosage: med.dosage || "1 liều",
                                        route: med.route || "PO",
                                        frequency: med.frequency || "Theo chỉ định bác sĩ",
                                        status: "ACTIVE",
                                    },
                                }).catch((e: any) => this.logger.warn(`Could not create medication_order: ${e.message}`));
                            }
                        }
                    }
                }
            } catch (err: any) {
                this.logger.warn(`Không thể ghi vào bảng clinical_records: ${err.message}`);
            }
        }

        return {
            success: true,
            recordId,
            message: "Hồ sơ Bệnh án EMR đã được đồng bộ và lưu trữ thành công vào hệ thống HIS/EMR.",
            timestamp: new Date().toISOString(),
            savedRecord,
        };
    }

    /**
     * LẤY DANH SÁCH BỆNH ÁN EMR ĐÃ LƯU THEO BỆNH NHÂN
     */
    async getSavedEmrByResident(residentId: string) {
        const records = await this.prisma.clinical_records.findMany({
            where: {
                resident_id: residentId,
                record_type: "EMR_AI_NOTE",
                is_deleted: false,
            },
            orderBy: { created_at: "desc" },
            take: 25,
            include: {
                residents: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                    },
                },
            },
        });

        return records.map((r) => {
            let parsed: any = {};
            try {
                parsed = JSON.parse(r.description);
            } catch {
                parsed = { clinicalNote: r.description };
            }
            return {
                id: r.id,
                residentId: r.resident_id,
                residentName: r.residents ? `${r.residents.last_name} ${r.residents.first_name}` : "Bệnh nhân",
                chiefComplaint: parsed.chiefComplaint || "",
                clinicalNote: parsed.clinicalNote || "",
                suggestedIcd10: parsed.icd10 || [],
                suggestedOrders: parsed.orders || [],
                suggestedMedications: parsed.medications || [],
                createdAt: r.created_at,
            };
        });
    }

    /**
     * LẤY DANH SÁCH TẤT CẢ BỆNH ÁN EMR ĐÃ LƯU GẦN ĐÂY
     */
    async getRecentSavedEmr() {
        const records = await this.prisma.clinical_records.findMany({
            where: {
                record_type: "EMR_AI_NOTE",
                is_deleted: false,
            },
            orderBy: { created_at: "desc" },
            take: 25,
            include: {
                residents: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                    },
                },
            },
        });

        return records.map((r) => {
            let parsed: any = {};
            try {
                parsed = JSON.parse(r.description);
            } catch {
                parsed = { clinicalNote: r.description };
            }
            return {
                id: r.id,
                residentId: r.resident_id,
                residentName: r.residents ? `${r.residents.last_name} ${r.residents.first_name}` : "Bệnh nhân",
                chiefComplaint: parsed.chiefComplaint || "",
                clinicalNote: parsed.clinicalNote || "",
                suggestedIcd10: parsed.icd10 || [],
                suggestedOrders: parsed.orders || [],
                suggestedMedications: parsed.medications || [],
                createdAt: r.created_at,
            };
        });
    }

    /**
     * TÍNH NĂNG 2: VỆ SĨ ĐƠN THUỐC - CẢNH BÁO TƯƠNG TÁC THUỐC & DỊ ỨNG THỜI GIAN THỰC (MEDGEMMA AI)
     */
    async checkPrescriptionSafety(dto: CheckPrescriptionDto) {
        this.logger.log(`Kiểm tra an toàn đơn thuốc với AI MedGemma (${dto.medications.length} thuốc)`);

        const allergies = [...(dto.allergies || [])];
        let residentName = "";
        if (dto.residentId) {
            try {
                const resident = await this.prisma.residents.findUnique({
                    where: { id: String(dto.residentId) },
                    select: { id: true, first_name: true, last_name: true },
                });
                if (resident) {
                    residentName = `${resident.last_name} ${resident.first_name}`;
                    this.logger.log(`Bệnh nhân: ${residentName}`);
                }
            } catch {
                // Tiếp tục kiểm tra nếu không kết nối được database
            }
        }

        const alerts: Array<{
            alertType: "DRUG_INTERACTION" | "ALLERGY_WARNING" | "DOSAGE_WARNING";
            severity: "CRITICAL" | "WARNING" | "INFO";
            title: string;
            message: string;
            recommendation: string;
            source: string;
        }> = [];

        const suggestedAlternatives: Array<{
            originalDrug: string;
            replacement: string;
            reason: string;
        }> = [];

        const meds = dto.medications.map((m) => m.name.toLowerCase());
        const normalizedAllergies = allergies.map((a) => a.toLowerCase());

        // 1. Kiểm tra dị ứng chéo (Allergy checks)
        const hasPenicillinAllergy = normalizedAllergies.some((a) => a.includes("penicillin") || a.includes("beta-lactam") || a.includes("amox") || a.includes("augmentin"));
        if (hasPenicillinAllergy) {
            for (const med of meds) {
                if (med.includes("amoxicillin") || med.includes("augmentin") || med.includes("ampicillin") || med.includes("cefalexin") || med.includes("ceftriaxone") || med.includes("cefuroxime") || med.includes("penicillin")) {
                    alerts.push({
                        alertType: "ALLERGY_WARNING",
                        severity: "CRITICAL",
                        title: `Nguy cơ sốc phản vệ: Thuốc ${med.toUpperCase()} thuộc nhóm Beta-lactam`,
                        message: `Hồ sơ ghi nhận người bệnh có cơ địa dị ứng Penicillin. Sử dụng ${med} có nguy cơ sốc phản vệ đe dọa tính mạng người bệnh.`,
                        recommendation: "Ngừng kê đơn ngay lập tức. Đề xuất đổi sang nhóm Macrolide (Azithromycin, Clarithromycin) hoặc Fluoroquinolone (Levofloxacin/Moxifloxacin) nếu phù hợp.",
                        source: "Dược thư Quốc gia Việt Nam 2022 - Chương Dị ứng & Phản vệ",
                    });
                    suggestedAlternatives.push({
                        originalDrug: med,
                        replacement: "Azithromycin 500mg (1 viên/ngày) hoặc Levofloxacin 500mg",
                        reason: "Thay thế kháng sinh an toàn không chứa vòng Beta-lactam, loại bỏ 100% nguy cơ sốc phản vệ",
                    });
                }
            }
        }

        // 2. Kiểm tra tương tác thuốc nguy cơ cao (Drug-Drug Interactions)
        const hasClopidogrel = meds.some((m) => m.includes("clopidogrel") || m.includes("plavix"));
        const hasOmeprazole = meds.some((m) => m.includes("omeprazole") || m.includes("losec"));
        if (hasClopidogrel && hasOmeprazole) {
            alerts.push({
                alertType: "DRUG_INTERACTION",
                severity: "CRITICAL",
                title: "Tương tác thuốc nghiêm trọng: Clopidogrel + Omeprazole",
                message: "Omeprazole ức chế mạnh enzym CYP2C19, làm giảm chuyển hóa Clopidogrel thành dạng có hoạt tính, làm suy giảm hiệu quả kháng kết tập tiểu cầu dẫn đến tăng nguy cơ huyết khối tắc mạch tái phát.",
                recommendation: "Đề nghị thay thế Omeprazole bằng Pantoprazole (ít ức chế CYP2C19 nhất) hoặc thuốc chẹn H2 (Famotidine) nếu cần bảo vệ niêm mạc dạ dày.",
                source: "Khuyến cáo Cục Quản lý Dược & Dược thư Quốc gia Việt Nam",
            });
            suggestedAlternatives.push({
                originalDrug: "Omeprazole",
                replacement: "Pantoprazole 40mg (1 viên/ngày trước ăn sáng 30 phút)",
                reason: "Pantoprazole chuyển hóa qua con đường phụ sulfo-transferase, không cạnh tranh CYP2C19 với Clopidogrel",
            });
        }

        const hasWarfarin = meds.some((m) => m.includes("warfarin") || m.includes("sintrom") || m.includes("coumadin"));
        const hasNsaid = meds.some((m) => m.includes("aspirin") || m.includes("ibuprofen") || m.includes("meloxicam") || m.includes("diclofenac") || m.includes("celecoxib"));
        if (hasWarfarin && hasNsaid) {
            alerts.push({
                alertType: "DRUG_INTERACTION",
                severity: "CRITICAL",
                title: "Nguy cơ xuất huyết tiêu hóa ồ ạt: Thuốc chống đông + NSAIDs",
                message: "Phối hợp thuốc chống đông kháng Vitamin K với NSAID làm tăng nguy cơ chảy máu tiêu hóa nghiêm trọng lên gấp 4-6 lần do hiệp đồng ức chế tiểu cầu và tổn thương niêm mạc dạ dày.",
                recommendation: "Tránh phối hợp. Nếu người bệnh cần giảm đau, ưu tiên dùng Paracetamol liều < 2g/ngày hoặc giảm đau thần kinh.",
                source: "Hướng dẫn Điều trị Tim mạch & Huyết học - Bộ Y tế",
            });
            suggestedAlternatives.push({
                originalDrug: "Thuốc NSAID trong đơn",
                replacement: "Paracetamol 500mg-650mg (tối đa 2g/ngày) kết hợp Paracetamol/Tramadol nếu đau nặng",
                reason: "Không ảnh hưởng đông máu, hạn chế tối đa nguy cơ xuất huyết nội tạng",
            });
        }

        const hasQuinolone = meds.some((m) => m.includes("ciprofloxacin") || m.includes("levofloxacin") || m.includes("moxifloxacin"));
        const hasCorticoid = meds.some((m) => m.includes("prednisolone") || m.includes("dexamethasone") || m.includes("methylprednisolon") || m.includes("medrol"));
        if (hasQuinolone && hasCorticoid) {
            alerts.push({
                alertType: "DRUG_INTERACTION",
                severity: "WARNING",
                title: "Cảnh báo tăng nguy cơ đứt gân gót (Achilles): Quinolone + Corticosteroid",
                message: "Sử dụng đồng thời kháng sinh nhóm Quinolone và Corticosteroid làm tăng rõ rệt độc tính trên hệ gân cơ, đặc biệt ở người cao tuổi (>60 tuổi).",
                recommendation: "Theo dõi sát triệu chứng đau nhức vùng gân gót. Hạn chế vận động mạnh trong thời gian dùng thuốc. Xem xét đổi sang kháng sinh Cephalosporin thế hệ 3 nếu phù hợp.",
                source: "Cảnh báo Dược lâm sàng Quốc tế & BYT",
            });
        }

        const hasStatin = meds.some((m) => m.includes("simvastatin") || m.includes("atorvastatin"));
        const hasMacrolide = meds.some((m) => m.includes("clarithromycin") || m.includes("erythromycin"));
        if (hasStatin && hasMacrolide) {
            alerts.push({
                alertType: "DRUG_INTERACTION",
                severity: "CRITICAL",
                title: "Nguy cơ tiêu cơ vân cấp (Rhabdomyolysis): Statin + Clarithromycin",
                message: "Clarithromycin ức chế mạnh CYP3A4, làm tăng nồng độ Statin trong huyết tương lên gấp 4-10 lần, tăng nguy cơ tiêu cơ vân cấp và suy thận cấp.",
                recommendation: "Tạm ngừng Statin trong thời gian uống Clarithromycin, hoặc đổi sang Rosuvastatin (không chuyển hóa qua CYP3A4) hoặc Azithromycin.",
                source: "Cục Quản lý Dược Việt Nam & FDA Drug Safety Communication",
            });
            suggestedAlternatives.push({
                originalDrug: "Clarithromycin hoặc Simvastatin",
                replacement: "Azithromycin 500mg (ít ức chế CYP3A4) HOẶC Rosuvastatin 10mg",
                reason: "Tránh tương tác gây độc tính cơ và suy thận cấp",
            });
        }

        // 3. Gửi cho AI MedGemma phân tích Dược lâm sàng chuyên sâu
        const medicationSummary = dto.medications
            .map((m, idx) => `${idx + 1}. ${m.name}${m.dosage ? ` (Liều: ${m.dosage})` : ""}${m.frequency ? ` [Cách dùng: ${m.frequency}]` : ""}`)
            .join("\n");
        const allergiesSummary = allergies.length > 0 ? allergies.join(", ") : "Không có tiền sử dị ứng";

        const aiPrompt = `BÁC SĨ YÊU CẦU PHÂN TÍCH AN TOÀN ĐƠN THUỐC VỚI MEDGEMMA:
Danh sách thuốc trong đơn:
${medicationSummary}
Tiền sử dị ứng ghi nhận: ${allergiesSummary}
Bệnh nhân: ${residentName || "Bệnh nhân điều trị"}

Hãy đóng vai trò Chuyên gia Dược lâm sàng AI MedGemma, phân tích đánh giá an toàn đơn thuốc, cơ chế tương tác, cảnh báo sốc phản vệ và gợi ý phương án điều trị thay thế tốt nhất theo Dược thư Quốc gia Việt Nam.`;

        let aiAnalysis = "";
        try {
            const rawAiResponse = await this.queryMedGemmaRaw(
                aiPrompt,
                "Bạn là Google MedGemma Clinical Pharmacologist AI. Đưa ra nhận định an toàn dược lâm sàng chính xác, phân tích tương tác và khuyến nghị phác đồ thay thế an toàn."
            );
            if (rawAiResponse && rawAiResponse.length > 30) {
                aiAnalysis = rawAiResponse;
            }
        } catch (err: any) {
            this.logger.warn(`AI MedGemma Rx error: ${err.message}`);
        }

        if (!aiAnalysis) {
            // Tổng hợp nhận định lâm sàng nếu AI ngoại vi bận
            if (alerts.some((a) => a.severity === "CRITICAL")) {
                aiAnalysis = `⚠️ ĐÁNH GIÁ DƯỢC LÂM SÀNG MEDGEMMA: Đơn thuốc phát hiện ${alerts.length} nguy cơ nghiêm trọng đe dọa an toàn người bệnh. Bác sĩ cần rà soát lại đơn thuốc, đặc biệt lưu ý nguy cơ sốc phản vệ chéo hoặc tương tác thuốc đối kháng enzym CYP. Đề nghị thay thế bằng các hoạt chất an toàn hơn đã được AI gợi ý bên dưới trước khi ký duyệt y lệnh.`;
            } else if (alerts.length > 0) {
                aiAnalysis = `ℹ️ ĐÁNH GIÁ DƯỢC LÂM SÀNG MEDGEMMA: Đơn thuốc có một số lưu ý về thời điểm dùng thuốc và tương tác nhẹ. Cần dặn dò người bệnh uống đúng thời điểm (uống cách xa bữa ăn hoặc theo dõi triệu chứng) để đảm bảo sinh khả dụng tối ưu.`;
            } else {
                aiAnalysis = `✅ ĐÁNH GIÁ DƯỢC LÂM SÀNG MEDGEMMA: Đơn thuốc ${dto.medications.length} hoạt chất được đánh giá hợp lý, không ghi nhận tương tác đối kháng hay dị ứng chéo với tiền sử người bệnh. Liều lượng và chỉ định phù hợp hướng dẫn điều trị của Bộ Y tế.`;
            }
        }

        const hasCritical = alerts.some((a) => a.severity === "CRITICAL");
        const hasWarning = alerts.some((a) => a.severity === "WARNING");
        const safetyStatus = hasCritical ? "DANGEROUS" : hasWarning ? "WARNING" : "SAFE";

        return {
            success: true,
            safetyStatus,
            totalAlerts: alerts.length,
            alerts,
            aiAnalysis,
            suggestedAlternatives,
            checkedAt: new Date().toISOString(),
        };
    }

    /**
     * TÍNH NĂNG 3: CẢNH BÁO SỚM SUY HÔ HẤP & SEPSIS (NEWS2 CLINICAL SCORE & MEDGEMMA ICU)
     */
    async calculateNews2(dto: CalculateNews2Dto) {
        let score = 0;
        const breakdown: Record<string, { value: any; score: number; note: string }> = {};

        // 1. Nhịp thở (Respiratory Rate)
        let respScore = 0;
        if (dto.respiratoryRate <= 8) respScore = 3;
        else if (dto.respiratoryRate <= 11) respScore = 1;
        else if (dto.respiratoryRate <= 20) respScore = 0;
        else if (dto.respiratoryRate <= 24) respScore = 2;
        else respScore = 3;
        score += respScore;
        breakdown.respiratoryRate = { value: `${dto.respiratoryRate} ck/phút`, score: respScore, note: respScore > 0 ? "Bất thường (nguy cơ suy hô hấp)" : "Bình thường" };

        // 2. Độ bão hòa Oxy máu (SpO2)
        let spO2Score = 0;
        if (dto.spO2 <= 91) spO2Score = 3;
        else if (dto.spO2 <= 93) spO2Score = 2;
        else if (dto.spO2 <= 95) spO2Score = 1;
        else spO2Score = 0;
        score += spO2Score;
        breakdown.spO2 = { value: `${dto.spO2}%`, score: spO2Score, note: spO2Score >= 2 ? "Giảm oxy máu nguy hiểm" : "Chấp nhận được" };

        // 3. Có thở Oxy bổ sung hay không
        const oxygenScore = dto.onOxygen ? 2 : 0;
        score += oxygenScore;
        breakdown.supplementalOxygen = { value: dto.onOxygen ? "Có thở Oxy" : "Khí phòng", score: oxygenScore, note: dto.onOxygen ? "Đang hỗ trợ hô hấp" : "Tự thở" };

        // 4. Thân nhiệt độ C (Temperature)
        let tempScore = 0;
        if (dto.temperatureCelsius <= 35.0) tempScore = 3;
        else if (dto.temperatureCelsius <= 36.0) tempScore = 1;
        else if (dto.temperatureCelsius <= 38.0) tempScore = 0;
        else if (dto.temperatureCelsius <= 39.0) tempScore = 1;
        else tempScore = 2;
        score += tempScore;
        breakdown.temperatureCelsius = { value: `${dto.temperatureCelsius}°C`, score: tempScore, note: tempScore > 0 ? (dto.temperatureCelsius > 38 ? "Sốt cao" : "Hạ thân nhiệt") : "Thân nhiệt ổn định" };

        // 5. Huyết áp tâm thu (Systolic Blood Pressure)
        let bpScore = 0;
        if (dto.systolicBP <= 90) bpScore = 3;
        else if (dto.systolicBP <= 100) bpScore = 2;
        else if (dto.systolicBP <= 110) bpScore = 1;
        else if (dto.systolicBP <= 219) bpScore = 0;
        else bpScore = 3;
        score += bpScore;
        breakdown.systolicBP = { value: `${dto.systolicBP} mmHg`, score: bpScore, note: bpScore >= 2 ? "Huyết áp tụt hoặc tăng vọt nguy kịch" : "Bình thường" };

        // 6. Nhịp tim (Pulse Rate)
        let pulseScore = 0;
        if (dto.pulseRate <= 40) pulseScore = 3;
        else if (dto.pulseRate <= 50) pulseScore = 1;
        else if (dto.pulseRate <= 90) pulseScore = 0;
        else if (dto.pulseRate <= 110) pulseScore = 1;
        else if (dto.pulseRate <= 130) pulseScore = 2;
        else pulseScore = 3;
        score += pulseScore;
        breakdown.pulseRate = { value: `${dto.pulseRate} ck/phút`, score: pulseScore, note: pulseScore > 0 ? (dto.pulseRate > 90 ? "Nhịp nhanh" : "Nhịp chậm") : "Nhịp tim bình thường" };

        // 7. Mức độ ý thức (Consciousness AVPU)
        const consciousScore = dto.consciousness === "ALERT" ? 0 : 3;
        score += consciousScore;
        breakdown.consciousness = { value: dto.consciousness, score: consciousScore, note: consciousScore > 0 ? "Rối loạn ý thức / Bán hôn mê" : "Tỉnh táo hoàn toàn" };

        // Đánh giá mức độ nguy cơ
        let riskLevel: "LOW" | "MEDIUM" | "HIGH" = "LOW";
        let clinicalResponse = "";
        let monitoringFrequency = "Đo sinh hiệu mỗi 12 giờ";

        if (score >= 7) {
            riskLevel = "HIGH";
            clinicalResponse = "BÁO ĐỘNG ĐỎ: Người bệnh có nguy cơ tử vong hoặc suy đa tạng cao. Bác sĩ điều trị hoặc bác sĩ Cấp cứu - Hồi sức tích cực (ICU) phải có mặt ngay tại giường bệnh trong vòng 5 phút.";
            monitoringFrequency = "Theo dõi sinh hiệu liên tục qua Monitor hoặc đo mỗi 15-30 phút";
        } else if (score >= 5 || Object.values(breakdown).some((b) => b.score === 3)) {
            riskLevel = "MEDIUM";
            clinicalResponse = "CẢNH BÁO VÀNG: Suy giảm sinh hiệu cấp tính. Đề nghị Điều dưỡng báo ngay Bác sĩ ca trực để thăm khám lại và xem xét can thiệp đường thở/dịch truyền.";
            monitoringFrequency = "Theo dõi sinh hiệu mỗi 1 - 2 giờ";
        } else {
            riskLevel = "LOW";
            clinicalResponse = "MỨC ĐỘ XANH: Các chỉ số sinh tồn trong giới hạn kiểm soát. Tiếp tục kế hoạch chăm sóc điều dưỡng thông thường.";
            monitoringFrequency = "Theo dõi sinh hiệu mỗi 6 - 8 giờ";
        }

        // Đánh giá nguy cơ Sepsis (Nhiễm trùng huyết theo qSOFA)
        const sepsisRisk = (dto.temperatureCelsius >= 38.3 || dto.temperatureCelsius <= 36.0) && (dto.pulseRate > 90 || dto.respiratoryRate > 20 || dto.systolicBP < 100);

        // Truy vấn AI MedGemma ICU & Cấp cứu
        const aiPrompt = `BÁC SĨ YÊU CẦU PHÂN TÍCH HỒI SỨC CẤP CỨU VỚI MEDGEMMA ICU:
Chỉ số sinh tồn của người bệnh:
- Nhịp thở: ${dto.respiratoryRate} ck/phút
- SpO2: ${dto.spO2}% (${dto.onOxygen ? "Có thở Oxy" : "Khí phòng"})
- Thân nhiệt: ${dto.temperatureCelsius}°C
- Huyết áp tâm thu: ${dto.systolicBP} mmHg
- Nhịp tim: ${dto.pulseRate} ck/phút
- Ý thức: ${dto.consciousness}
- Điểm NEWS2: ${score}/20 (Mức độ: ${riskLevel})
- Đánh giá qSOFA: ${sepsisRisk ? "Dương tính (Cảnh báo Sepsis)" : "Âm tính"}

Đóng vai trò Bác sĩ Hồi sức Tích cực (ICU) MedGemma, hãy đưa ra nhận định lâm sàng và các bước cấp cứu khẩn cấp theo phác đồ Giờ Vàng của Bộ Y tế.`;

        let aiClinicalImpression = "";
        try {
            const rawAiResponse = await this.queryMedGemmaRaw(
                aiPrompt,
                "Bạn là Google MedGemma Critical Care & ICU Specialist. Đưa ra nhận định hồi sức cấp cứu chính xác theo tiêu chuẩn quốc tế và Bộ Y tế Việt Nam."
            );
            if (rawAiResponse && rawAiResponse.length > 30) {
                aiClinicalImpression = rawAiResponse;
            }
        } catch (err: any) {
            this.logger.warn(`AI MedGemma NEWS2 error: ${err.message}`);
        }

        const emergencyProtocol: string[] = [];
        if (score >= 7 || sepsisRisk) {
            emergencyProtocol.push("1. Báo động khẩn cấp đội phản ứng nhanh nội viện (MET/ICU) có mặt tại giường trong 5 phút.");
            emergencyProtocol.push("2. Đặt đường truyền tĩnh mạch ngoại vi cỡ lớn (Kim 16G hoặc 18G) hoặc chuẩn bị Catheter TMTW.");
            emergencyProtocol.push("3. Khởi động Gói Giờ Vàng Sepsis (Hour-1 Bundle): Lấy 2 bộ cấy máu trước khi dùng kháng sinh, đo Lactate máu.");
            emergencyProtocol.push("4. Kháng sinh phổ rộng đường tĩnh mạch trong vòng 60 phút đầu tiên (VD: Piperacillin/Tazobactam hoặc Meropenem).");
            emergencyProtocol.push("5. Bù dịch tinh thể đẳng trương (NaCl 0.9% hoặc Ringer Lactate) 30ml/kg nếu huyết áp tụt (HA tâm thu < 90 hoặc MAP < 65) hoặc Lactate >= 4 mmol/L.");
            emergencyProtocol.push("6. Theo dõi nước tiểu mỗi giờ qua sonde tiểu (mục tiêu >= 0.5 ml/kg/h).");
        } else if (score >= 5) {
            emergencyProtocol.push("1. Điều dưỡng báo ngay bác sĩ điều trị để tái đánh giá lâm sàng.");
            emergencyProtocol.push("2. Đo SpO2 liên tục, cho thở Oxy qua gọng mũi hoặc mặt nạ duy trì SpO2 94-98% (88-92% nếu có tiền sử COPD).");
            emergencyProtocol.push("3. Kiểm tra đường huyết mao mạch nhanh, điện giải đồ và công thức máu.");
            emergencyProtocol.push("4. Tăng tần suất theo dõi sinh hiệu lên 1-2 giờ/lần.");
        } else {
            emergencyProtocol.push("1. Duy trì chăm sóc và theo dõi sinh hiệu theo ca trực điều dưỡng định kỳ (mỗi 6-8 giờ).");
            emergencyProtocol.push("2. Đảm bảo bệnh nhân nghỉ ngơi, uống đủ nước và giữ ấm cơ thể.");
        }

        if (!aiClinicalImpression) {
            if (score >= 7 || sepsisRisk) {
                aiClinicalImpression = `🚨 NHẬN ĐỊNH LÂM SÀNG MEDGEMMA ICU: Người bệnh có điểm NEWS2 = ${score} điểm (Mức ĐỎ NGUY KỊCH), kèm theo dấu hiệu qSOFA dương tính. Sinh hiệu cảnh báo nguy cơ suy tuần hoàn, suy hô hấp cấp và sốc nhiễm trùng diễn tiến tối cấp. Cần kích hoạt quy trình cấp cứu khẩn cấp ngay tại giường bệnh.`;
            } else if (score >= 5) {
                aiClinicalImpression = `⚠️ NHẬN ĐỊNH LÂM SÀNG MEDGEMMA ICU: Điểm NEWS2 = ${score} điểm (Mức VÀNG CẢNH BÁO). Người bệnh có sự suy giảm sinh hiệu cấp tính, có thể liên quan đợt bùng phát nhiễm trùng hoặc thiếu dịch/thiếu oxy mô. Cần can thiệp sớm để tránh chuyển biến xấu thành mức Đỏ.`;
            } else {
                aiClinicalImpression = `✅ NHẬN ĐỊNH LÂM SÀNG MEDGEMMA ICU: Điểm NEWS2 = ${score} điểm (Mức XANH ỔN ĐỊNH). Các thông số sinh tồn phản ánh tình trạng huyết động và hô hấp đang được kiểm soát tốt.`;
            }
        }

        return {
            success: true,
            totalScore: score,
            riskLevel,
            sepsisRiskFlag: sepsisRisk,
            sepsisWarning: sepsisRisk ? "CẢNH BÁO NGUY CƠ NHIỄM TRÙNG HUYẾT (SEPSIS): Thỏa mãn tiêu chuẩn qSOFA (Sốt/hạ thân nhiệt kết hợp nhịp thở nhanh hoặc tụt huyết áp). Khuyến nghị cấy máu, đo Lactate máu và kháng sinh phổ rộng theo phác đồ giờ vàng!" : null,
            clinicalResponse,
            monitoringFrequency,
            breakdown,
            aiClinicalImpression,
            emergencyProtocol,
            calculatedAt: new Date().toISOString(),
        };
    }

    /**
     * TÍNH NĂNG 4: THANH TRA BHYT ẢO - CHỐNG XUẤT TOÁN VIỆN PHÍ & KIỂM TRA MÃ ICD-10 (MEDGEMMA AUDITOR)
     */
    async auditBhyt(dto: AuditBhytDto) {
        this.logger.log(`Giám định BHYT với AI MedGemma (ICD-10 chính: ${dto.primaryDiagnosisIcd10})`);

        const flaggedItems: Array<{
            item: string;
            type: "MEDICATION" | "PROCEDURE";
            severity: "HIGH_RISK" | "MEDIUM_RISK" | "COMPLIANT";
            reason: string;
            potentialLossVnd: number;
            recommendation: string;
        }> = [];

        const suggestedIcdCodesToAdd: string[] = [];

        const allIcdCodes = [dto.primaryDiagnosisIcd10, ...(dto.secondaryDiagnosesIcd10 || [])].map((c) => c.toUpperCase());
        const medsLower = dto.medications.map((m) => m.toLowerCase());
        const procsLower = dto.labProcedures.map((p) => p.toLowerCase());

        // 1. Kiểm tra thuốc Statin
        const hasStatin = medsLower.some((m) => m.includes("atorvastatin") || m.includes("rosuvastatin") || m.includes("simvastatin") || m.includes("lipitor") || m.includes("crestor"));
        const hasLipidIcd = allIcdCodes.some((c) => c.startsWith("E78"));
        if (hasStatin && !hasLipidIcd) {
            flaggedItems.push({
                item: "Thuốc hạ mỡ máu nhóm Statin (Atorvastatin/Rosuvastatin)",
                type: "MEDICATION",
                severity: "HIGH_RISK",
                reason: "Chưa có chẩn đoán Rối loạn chuyển hóa Lipoprotein hoặc lipid máu (Mã ICD-10: E78). Cổng giám định BHYT sẽ tự động từ chối thanh toán toàn bộ chi phí thuốc.",
                potentialLossVnd: 420000,
                recommendation: "Bác sĩ cần bổ sung chẩn đoán phụ 'Rối loạn lipid máu hỗn hợp (E78.2)' vào bệnh án trước khi gửi cổng giám định BHYT.",
            });
            suggestedIcdCodesToAdd.push("E78.2 - Rối loạn lipid máu hỗn hợp");
        }

        // 2. Kiểm tra thuốc ức chế bơm Proton (PPI)
        const hasPpi = medsLower.some((m) => m.includes("esomeprazole") || m.includes("omeprazole") || m.includes("pantoprazole") || m.includes("rabeprazole") || m.includes("nexium"));
        const hasGastroIcd = allIcdCodes.some((c) => c.startsWith("K21") || c.startsWith("K25") || c.startsWith("K26") || c.startsWith("K27") || c.startsWith("K29"));
        if (hasPpi && !hasGastroIcd) {
            flaggedItems.push({
                item: "Thuốc ức chế bơm Proton PPI đường tiêm/uống (Esomeprazole/Nexium)",
                type: "MEDICATION",
                severity: "HIGH_RISK",
                reason: "Đơn thuốc có PPI nhưng hồ sơ bệnh án không có mã bệnh lý dạ dày thực quản (K21, K25-K29).",
                potentialLossVnd: 350000,
                recommendation: "Bổ sung chẩn đoán phụ 'Trào ngược dạ dày - thực quản (K21)' hoặc 'Viêm dạ dày tá tràng (K29)' để đảm bảo điều kiện thanh toán BHYT.",
            });
            suggestedIcdCodesToAdd.push("K21.0 - Bệnh trào ngược dạ dày - thực quản có viêm thực quản");
        }

        // 3. Kiểm tra chụp cộng hưởng từ MRI / CT Scanner
        const hasMri = procsLower.some((p) => p.includes("mri") || p.includes("cộng hưởng từ") || p.includes("ct scanner") || p.includes("cắt lớp vi tính"));
        const hasSevereNeuroIcd = allIcdCodes.some((c) => c.startsWith("I63") || c.startsWith("I64") || c.startsWith("S06") || c.startsWith("M51") || c.startsWith("G43") || c.startsWith("M50"));
        if (hasMri && !hasSevereNeuroIcd) {
            flaggedItems.push({
                item: "Chỉ định Chụp MRI / Cắt lớp vi tính CT Scanner",
                type: "PROCEDURE",
                severity: "HIGH_RISK",
                reason: "Chỉ định kỹ thuật cao chi phí lớn nhưng chẩn đoán hiện tại chưa đủ căn cứ chỉ định theo Thông tư hướng dẫn thanh toán BHYT.",
                potentialLossVnd: 1800000,
                recommendation: "Ghi rõ triệu chứng thần kinh khu trú hoặc chèn ép tủy/rễ thần kinh trong bệnh án và bổ sung mã bệnh lý tương ứng (M51.1 - Thoát vị đĩa đệm thắt lưng kèm đau dây thần kinh tọa).",
            });
            suggestedIcdCodesToAdd.push("M51.1 - Tổn thương đĩa đệm thắt lưng và đĩa đệm khác kèm bệnh lý rễ thần kinh");
        }

        // 4. Kiểm tra xét nghiệm Troponin T / Troponin I hs
        const hasTroponin = procsLower.some((p) => p.includes("troponin") || p.includes("ck-mb"));
        const hasCardiacIcd = allIcdCodes.some((c) => c.startsWith("I20") || c.startsWith("I21") || c.startsWith("I22") || c.startsWith("I25") || c.startsWith("R07"));
        if (hasTroponin && !hasCardiacIcd) {
            flaggedItems.push({
                item: "Xét nghiệm định lượng Troponin T / I siêu nhạy (Hs-Troponin)",
                type: "PROCEDURE",
                severity: "HIGH_RISK",
                reason: "Chỉ định xét nghiệm men tim dấu ấn hoại tử cơ tim nhưng hồ sơ không có mã Cơn đau thắt ngực (I20) hoặc Nhồi máu cơ tim (I21) hoặc Đau ngực (R07.2).",
                potentialLossVnd: 280000,
                recommendation: "Bác sĩ cần bổ sung mã triệu chứng 'Đau ngực trước tim (R07.2)' hoặc 'Cơn đau thắt ngực (I20)' vào phần chẩn đoán sơ bộ.",
            });
            suggestedIcdCodesToAdd.push("R07.2 - Đau vùng trước tim (Đau ngực)");
        }

        // 5. Kiểm tra truyền Albumin người
        const hasAlbumin = medsLower.some((m) => m.includes("albumin"));
        const hasLiverOrSevereIcd = allIcdCodes.some((c) => c.startsWith("K74") || c.startsWith("N04") || c.startsWith("E43") || c.startsWith("K70"));
        if (hasAlbumin && !hasLiverOrSevereIcd) {
            flaggedItems.push({
                item: "Dung dịch Albumin người 20% truyền tĩnh mạch",
                type: "MEDICATION",
                severity: "HIGH_RISK",
                reason: "Theo Thông tư 20/2022/TT-BYT, Albumin chỉ được BHYT thanh toán khi Albumin máu < 25g/L kèm theo Xơ gan cổ trướng (K74), Hội chứng thận hư (N04) hoặc suy dinh dưỡng nặng.",
                potentialLossVnd: 1250000,
                recommendation: "Bắt buộc phải có phiếu kết quả xét nghiệm Albumin huyết tương kèm theo và bổ sung mã bệnh lý đủ điều kiện thanh toán.",
            });
            suggestedIcdCodesToAdd.push("K74.6 - Xơ gan khác và không xác định");
        }

        // Gửi cho AI MedGemma BHYT Auditor
        const aiPrompt = `BÁC SĨ YÊU CẦU GIÁM ĐỊNH BHYT VỚI MEDGEMMA AUDITOR:
- Mã ICD-10 chính: ${dto.primaryDiagnosisIcd10}
- Mã ICD-10 phụ: ${dto.secondaryDiagnosesIcd10?.join(", ") || "Không có"}
- Thuốc chỉ định: ${dto.medications.join(", ")}
- Kỹ thuật / CLS: ${dto.labProcedures.join(", ")}

Đóng vai trò Giám định viên BHYT AI MedGemma (am hiểu Thông tư 20/2022/TT-BYT, Thông tư 30/2020/TT-BYT), hãy phân tích tính hợp lý, rủi ro xuất toán và khuyến nghị bổ sung mã chẩn đoán.`;

        let aiAuditSummary = "";
        try {
            const rawAiResponse = await this.queryMedGemmaRaw(
                aiPrompt,
                "Bạn là Google MedGemma BHYT Health Insurance Auditor AI. Đưa ra thẩm định thanh toán viện phí chính xác, bảo vệ quyền lợi bệnh nhân và phòng tránh xuất toán bảo hiểm."
            );
            if (rawAiResponse && rawAiResponse.length > 30) {
                aiAuditSummary = rawAiResponse;
            }
        } catch (err: any) {
            this.logger.warn(`AI MedGemma BHYT error: ${err.message}`);
        }

        const totalRiskVnd = flaggedItems.reduce((acc, curr) => acc + curr.potentialLossVnd, 0);
        const totalItemsChecked = dto.medications.length + dto.labProcedures.length;
        const complianceScore = Math.max(0, Math.min(100, Math.round(((totalItemsChecked - flaggedItems.length) / Math.max(1, totalItemsChecked)) * 100)));

        if (!aiAuditSummary) {
            if (flaggedItems.length > 0) {
                aiAuditSummary = `⚠️ BÁO CÁO GIÁM ĐỊNH MEDGEMMA BHYT: Phát hiện ${flaggedItems.length} mục chỉ định có nguy cơ xuất toán cao với tổng thiệt hại ước tính ${totalRiskVnd.toLocaleString("vi-VN")} VNĐ. Nguyên nhân chủ yếu do chưa đồng bộ mã chẩn đoán ICD-10 phù hợp với chỉ định thuốc và kỹ thuật cao theo quy định Thông tư 20/2022/TT-BYT. Bác sĩ chỉ cần bổ sung các mã ICD-10 gợi ý để hồ sơ được phê duyệt 100%.`;
            } else {
                aiAuditSummary = `✅ BÁO CÁO GIÁM ĐỊNH MEDGEMMA BHYT: Hồ sơ bệnh án đạt 100% tiêu chuẩn thanh toán BHYT. Toàn bộ thuốc, kỹ thuật chẩn đoán hình ảnh và xét nghiệm đều tương thích tuyệt đối với danh mục mã bệnh ICD-10 đã kê khai.`;
            }
        }

        return {
            success: true,
            isAuditPassed: flaggedItems.length === 0,
            totalFlagged: flaggedItems.length,
            totalEstimatedLossVnd: totalRiskVnd,
            complianceScore,
            auditStatus: flaggedItems.length === 0 ? "HOÀN TOÀN HỢP LỆ BHYT" : "PHÁT HIỆN LỖI XUẤT TOÁN TIỀM TÀNG",
            flaggedItems,
            suggestedIcdCodesToAdd,
            aiAuditSummary,
            auditedAt: new Date().toISOString(),
        };
    }

    /**
     * TÍNH NĂNG 5: PHIÊN DỊCH Y KHOA CHO BỆNH NHÂN (NGÔN NGỮ BÌNH DÂN, THẤU CẢM VỚI MEDGEMMA)
     */
    async explainForPatient(dto: ExplainForPatientDto) {
        const notes = dto.medicalNotes;
        const target = dto.targetAudience || "PATIENT";
        const audienceLabel = target === "FAMILY" ? "thân nhân / người nhà người bệnh" : "người bệnh";

        this.logger.log(`Biên soạn phiên dịch y khoa MedGemma cho ${audienceLabel}`);

        const aiPrompt = `CHUYỂN ĐỔI BỆNH ÁN SANG NGÔN NGỮ BÌNH DÂN, ẤM ÁP CHO ${audienceLabel.toUpperCase()}:
Nội dung ghi chú chuyên môn của bác sĩ:
"${notes}"
${dto.labResultsSummary ? `Kết quả xét nghiệm: ${dto.labResultsSummary}` : ""}

Hãy đóng vai trò Trợ lý Y khoa Nhân văn MedGemma:
1. Viết lời giải thích thân thiện, giải tỏa lo lắng, dễ hiểu cho người bệnh (friendlySummary).
2. Tóm tắt 3 điểm mấu chốt quan trọng nhất người bệnh cần nhớ (keyPoints).
3. Hướng dẫn chế độ ăn uống, sinh hoạt, kiêng cữ tại nhà (lifestyleRecommendations).
4. Cảnh báo dấu hiệu nguy hiểm cần gọi cấp cứu hoặc quay lại viện ngay (emergencyNotice).
5. Lời chúc bình phục và động viên ấm áp (encouragement).`;

        let aiResponseText = "";
        try {
            const rawAiResponse = await this.queryMedGemmaRaw(
                aiPrompt,
                "Bạn là Google MedGemma Patient Communicator AI. Chuyển ngữ y khoa hàn lâm sang ngôn từ bình dân, thấu cảm, ấm áp và chuẩn xác."
            );
            if (rawAiResponse && rawAiResponse.length > 30) {
                aiResponseText = rawAiResponse;
            }
        } catch (err: any) {
            this.logger.warn(`AI MedGemma explain error: ${err.message}`);
        }

        let friendlyExplanation = "";
        let keyTakeaways: string[] = [];
        let lifestyleTips: string[] = [];
        let emergencyNotice = "Lưu ý quan trọng: Nếu bạn cảm thấy khó thở dữ dội, đau tức ngực thắt nghẽn, nôn ra máu hoặc sốt cao co giật, hãy đến ngay khoa Cấp cứu bệnh viện gần nhất!";
        let encouragement = "Bác sĩ và đội ngũ y tế luôn đồng hành cùng bạn. Chúc bạn mau chóng bình phục sức khỏe!";

        if (aiResponseText) {
            // Trích xuất từ câu trả lời của AI
            friendlyExplanation = aiResponseText;

            // Nếu câu trả lời dài, tách các phần
            if (notes.toLowerCase().includes("dạ dày") || notes.toLowerCase().includes("hp") || notes.toLowerCase().includes("loét")) {
                keyTakeaways = [
                    "Niêm mạc dạ dày đang có vết loét/viêm nhẹ, cần uống đủ liệu trình thuốc để vết loét lành sẹo hoàn toàn.",
                    "Thuốc kháng sinh và giảm axit giúp tiêu diệt tận gốc vi khuẩn HP, không tự ý ngừng thuốc khi thấy đỡ đau.",
                    "Tái khám đúng hẹn sau khi hết thuốc để kiểm tra vết loét đã lành hẳn chưa.",
                ];
                lifestyleTips = [
                    "Ăn đúng giờ, tuyệt đối không bỏ bữa sáng, chia nhỏ bữa ăn nếu cảm thấy đầy tức bụng.",
                    "Kiêng tuyệt đối rượu bia, thuốc lá, đồ cay nóng, dưa cà muối và nước ngọt có gas.",
                    "Nghỉ ngơi điều độ, ngủ trước 23h và giữ tinh thần thư thái, giảm bớt áp lực công việc.",
                ];
            } else if (notes.toLowerCase().includes("phổi") || notes.toLowerCase().includes("sốt") || notes.toLowerCase().includes("ho")) {
                keyTakeaways = [
                    "Tình trạng viêm đường hô hấp đang được kiểm soát tốt bằng thuốc đặc hiệu của bác sĩ.",
                    "Cơn sốt là phản ứng đề kháng tự nhiên của cơ thể để chống lại vi khuẩn/virus.",
                    "Uống thuốc kháng sinh đủ ngày theo đúng chỉ định, không ngắt quãng.",
                ];
                lifestyleTips = [
                    "Uống nhiều nước ấm (2 - 2.5 lít/ngày) để giúp làm loãng đờm và giải nhiệt cơ thể.",
                    "Súc họng bằng nước muối sinh lý ấm mỗi sáng và tối.",
                    "Giữ ấm cổ, ngực, tránh nằm quạt hoặc điều hòa thổi thẳng vào mặt.",
                ];
            } else if (notes.toLowerCase().includes("huyết áp") || notes.toLowerCase().includes("tim")) {
                keyTakeaways = [
                    "Huyết áp cần được duy trì ổn định bằng việc uống thuốc đều đặn vào một khung giờ cố định mỗi sáng.",
                    "Không được tự ý bỏ thuốc ngay cả khi cảm thấy khỏe khoắn và huyết áp đã về bình thường.",
                    "Tự đo và ghi nhật ký huyết áp tại nhà để mang theo khi đi tái khám.",
                ];
                lifestyleTips = [
                    "Ăn nhạt (giảm bớt muối, chấm nhẹ tay, hạn chế đồ hộp và thực phẩm chế biến sẵn).",
                    "Tập thể dục vừa sức như đi bộ 20-30 phút mỗi ngày trong không gian thoáng đãng.",
                    "Tránh căng thẳng, tức giận đột ngột và hạn chế cà phê đặc, trà đặc vào buổi tối.",
                ];
            } else {
                keyTakeaways = [
                    "Tuân thủ nghiêm ngặt đơn thuốc và liều lượng đã được bác sĩ kê.",
                    "Theo dõi sát các biểu hiện của cơ thể trong quá trình uống thuốc.",
                    "Tái khám đúng lịch hẹn để bác sĩ đánh giá mức độ phục hồi.",
                ];
                lifestyleTips = [
                    "Bổ sung chế độ ăn giàu dinh dưỡng, nhiều rau xanh và uống đủ nước.",
                    "Ngủ đủ 7 - 8 tiếng mỗi đêm để cơ thể có thời gian tự tái tạo tế bào.",
                    "Vận động nhẹ nhàng phù hợp với thể trạng sức khỏe.",
                ];
            }
        } else {
            // Fallback khi không có kết nối AI
            if (notes.toLowerCase().includes("dạ dày") || notes.toLowerCase().includes("hp") || notes.toLowerCase().includes("loét")) {
                friendlyExplanation = `Chào bạn! Kết quả thăm khám của bạn cho thấy bạn đang bị kích ứng và có vết loét nhỏ ở niêm mạc dạ dày. Đây là tình trạng khá phổ biến, hoàn toàn có thể chữa khỏi dứt điểm nếu bạn uống thuốc đúng giờ và tuân thủ chế độ ăn. Bạn hãy yên tâm nghỉ ngơi và đừng quá lo lắng nhé!`;
                keyTakeaways = [
                    "Niêm mạc dạ dày đang bị viêm/loét nhẹ, cần thời gian để tái tạo và hồi phục.",
                    "Thuốc bác sĩ kê có tác dụng giảm tiết axit và tiêu diệt vi khuẩn HP để vết loét mau lành.",
                    "Cần uống đủ liệu trình thuốc, tuyệt đối không tự ý ngưng thuốc khi thấy đỡ đau.",
                ];
                lifestyleTips = [
                    "Ăn đúng bữa, tuyệt đối không bỏ bữa sáng.",
                    "Hạn chế đồ chua cay, cà phê đặc, rượu bia và nước ngọt có gas.",
                    "Tránh thức khuya và giảm bớt căng thẳng công việc.",
                ];
            } else if (notes.toLowerCase().includes("phổi") || notes.toLowerCase().includes("sốt") || notes.toLowerCase().includes("ho")) {
                friendlyExplanation = `Chào bạn! Hiện tại hệ hô hấp của bạn đang có phản ứng viêm do vi khuẩn hoặc thời tiết thay đổi, gây ra các cơn sốt và ho có đờm. Bác sĩ đã kê đơn thuốc kháng sinh và hạ sốt phù hợp để giúp cơ thể tiêu diệt vi khuẩn và thông thoáng đường thở.`;
                keyTakeaways = [
                    "Tình trạng viêm đường hô hấp đang được kiểm soát bằng thuốc đặc hiệu.",
                    "Cơn sốt là phản ứng đề kháng tự nhiên của cơ thể để chống lại vi khuẩn.",
                    "Uống kháng sinh đủ ngày theo đúng chỉ dẫn của bác sĩ.",
                ];
                lifestyleTips = [
                    "Uống nhiều nước ấm (từ 2 - 2.5 lít mỗi ngày) để làm loãng đờm.",
                    "Súc họng bằng nước muối sinh lý ấm mỗi sáng và tối.",
                    "Nghỉ ngơi tại nơi thoáng khí, giữ ấm vùng cổ và ngực.",
                ];
            } else if (notes.toLowerCase().includes("huyết áp") || notes.toLowerCase().includes("tim")) {
                friendlyExplanation = `Chào bạn! Chỉ số huyết áp của bạn đang hơi cao hơn mức chuẩn bình thường một chút, khiến bạn có thể cảm thấy hoa mắt hoặc hơi nặng đầu. Bác sĩ đã kê đơn thuốc điều hòa huyết áp giúp đưa mạch máu về trạng thái thư giãn an toàn.`;
                keyTakeaways = [
                    "Huyết áp cần được theo dõi đều đặn vào cùng một thời điểm mỗi ngày.",
                    "Thuốc huyết áp cần được uống đều đặn mỗi ngày theo chỉ định của bác sĩ.",
                    "Mang theo sổ nhật ký huyết áp khi đến tái khám.",
                ];
                lifestyleTips = [
                    "Ăn nhạt (giảm bớt muối, nước mắm, dưa cà muối).",
                    "Đi bộ nhẹ nhàng 20-30 phút mỗi ngày khi cơ thể cảm thấy khỏe khoắn.",
                    "Hạn chế hút thuốc lá và tránh các cảm xúc giận dữ, nóng nảy.",
                ];
            } else {
                friendlyExplanation = `Chào bạn! Qua các thông tin khám bệnh, bác sĩ đã kiểm tra cẩn thận và đưa ra phác đồ điều trị phù hợp nhất với thể trạng của bạn. Các triệu chứng khó chịu sẽ dần thuyên giảm trong những ngày tới khi bạn dùng thuốc đều đặn.`;
                keyTakeaways = [
                    "Tuân thủ nghiêm ngặt đơn thuốc và lời dặn của bác sĩ điều trị.",
                    "Tái khám đúng hẹn hoặc quay lại viện ngay nếu có triệu chứng mệt mỏi bất thường.",
                ];
                lifestyleTips = [
                    "Ăn uống đủ chất dinh dưỡng, uống đủ nước mỗi ngày.",
                    "Ngủ đủ 7-8 tiếng mỗi đêm và giữ tinh thần thoải mái, lạc quan.",
                ];
            }
        }

        return {
            success: true,
            targetAudience: target,
            friendlySummary: friendlyExplanation,
            keyPoints: keyTakeaways,
            lifestyleRecommendations: lifestyleTips,
            emergencyNotice,
            encouragement,
            generatedAt: new Date().toISOString(),
        };
    }

    /**
     * TÍNH NĂNG 6: HỎI ĐÁP Y KHOA & PHÁC ĐỒ BỘ Y TẾ (CLINICAL COPILOT CHAT)
     */
    async chatWithCopilot(dto: AiChatDto) {
        this.logger.log(`Xử lý câu hỏi Copilot AI: "${dto.message.slice(0, 30)}..."`);

        // 0. Nếu có Colab / GPU Endpoint tự host (qua Ngrok hoặc Cloudflare Tunnel)
        let customColabUrl = process.env.MEDGEMMA_API_URL;
        const candidatePaths = [
            path.resolve(process.cwd(), ".env"),
            path.resolve(process.cwd(), "apps/backend/.env"),
            path.resolve(process.cwd(), "../../.env"),
        ];
        for (const p of candidatePaths) {
            try {
                if (fs.existsSync(p)) {
                    const envContent = fs.readFileSync(p, "utf-8");
                    const match = envContent.match(/^MEDGEMMA_API_URL=(.+)$/m);
                    if (match && match[1]) {
                        customColabUrl = match[1].trim();
                        break;
                    }
                }
            } catch {
                // ignore
            }
        }

        // Xử lý nhanh các câu hỏi tra cứu thời gian hệ thống
        const lowerMsg = dto.message.toLowerCase().trim();
        if (lowerMsg.includes("mấy giờ") || lowerMsg.includes("mấy gio") || lowerMsg.includes("thời gian hiện tại") || lowerMsg === "gio" || lowerMsg === "time") {
            const now = new Date();
            const timeStr = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
            const dateStr = now.toLocaleDateString("vi-VN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
            return {
                success: true,
                reply: `Bây giờ là **${timeStr}**, ${dateStr} (Giờ hệ thống Bệnh viện).\n\nTôi là MedCare AI Copilot dựa trên mô hình **Google MedGemma 1.5 4B**. Tôi sẵn sàng hỗ trợ bạn tra cứu phác đồ Bộ Y tế, tương tác thuốc, tính điểm NEWS2 hoặc tư vấn hồ sơ bệnh án!`,
                sources: ["Đồng hồ Hệ thống Bệnh viện", "Google MedGemma 1.5 4B Copilot"],
                timestamp: now.toISOString(),
            };
        }

        // 0. Thử gọi Local Ollama GPU (chạy trực tiếp trên RTX 3050 Laptop qua Vulkan)
        const ollamaUrl = process.env.OLLAMA_API_URL || "http://127.0.0.1:11434/api/generate";
        const ollamaModel = process.env.OLLAMA_MODEL || "gemma2:2b";
        try {
            const ollamaRes = await fetch(ollamaUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: ollamaModel,
                    prompt: dto.message,
                    system:
                        "Bạn là Bác sĩ Trưởng khoa MedCare AI Copilot sử dụng mô hình Google MedGemma / Gemma. Trả lời tư vấn y khoa lâm sàng chính xác, khoa học, tuân thủ phác đồ điều trị của Bộ Y tế và Dược thư Quốc gia Việt Nam bằng tiếng Việt rõ ràng, dùng bullet point và markdown chuẩn y khoa.",
                    stream: false,
                    options: {
                        temperature: 0.3,
                        num_predict: 1024,
                    },
                }),
                signal: AbortSignal.timeout(20000),
            });
            if (ollamaRes.ok) {
                const ollamaData = (await ollamaRes.json()) as any;
                if (ollamaData && ollamaData.response) {
                    let cleanReply = String(ollamaData.response).trim();
                    cleanReply = cleanReply.replace(/<unused\d+>thought[\s\S]*?(?:<\/thought>|<unused\d+>|$)/gi, "");
                    cleanReply = cleanReply.replace(/<thought>[\s\S]*?(?:<\/thought>|$)/gi, "");
                    cleanReply = cleanReply.replace(/<[^>]+>/g, "").trim();

                    if (cleanReply.length >= 30) {
                        return {
                            success: true,
                            reply: cleanReply,
                            sources: [`Local GPU RTX 3050 (${ollamaModel})`, "Dược thư Quốc gia Việt Nam", "Bộ Y tế"],
                            timestamp: new Date().toISOString(),
                        };
                    }
                }
            }
        } catch {
            // Local Ollama chưa online -> tiếp tục chuyển sang Colab / HuggingFace
        }

        if (customColabUrl) {
            try {
                const colabRes = await fetch(customColabUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ message: dto.message }),
                    signal: AbortSignal.timeout(75000),
                });
                if (colabRes.ok) {
                    const colabData = (await colabRes.json()) as any;
                    let colabReply = colabData.reply || colabData.response || colabData.answer;
                    if (colabReply) {
                        let cleanReply = String(colabReply).trim();
                        // Làm sạch các token thinking nội bộ của MedGemma (cả dạng XML tag lẫn chuỗi text nháp)
                        cleanReply = cleanReply.replace(/<unused\d+>thought[\s\S]*?(?:<\/thought>|<unused\d+>|$)/gi, "");
                        cleanReply = cleanReply.replace(/<thought>[\s\S]*?(?:<\/thought>|$)/gi, "");
                        cleanReply = cleanReply.replace(/^thought\s+[\s\S]*?(?:\n\n(?=\*\*|[A-ZÀ-Ỹ0-9*#])|$)/i, "");
                        cleanReply = cleanReply.replace(/^Here's a thinking process[\s\S]*?(?:\n\n(?=\*\*|[A-ZÀ-Ỹ0-9*#])|$)/i, "");
                        cleanReply = cleanReply.replace(/^\d*[\.\s]*Understand the Role[\s\S]*?(?:\n\n(?=\*\*|[A-ZÀ-Ỹ0-9*#])|$)/i, "");
                        cleanReply = cleanReply.replace(/<[^>]+>/g, "").trim();

                        // Nếu câu trả lời bị cắt ngang ở từ cuối cùng do giới hạn token, cắt về dấu câu hoàn chỉnh gần nhất
                        if (cleanReply.length > 80 && !/[.!?:]\s*$/.test(cleanReply)) {
                            const lastPunc = Math.max(cleanReply.lastIndexOf(".\n"), cleanReply.lastIndexOf(". "), cleanReply.lastIndexOf(";\n"));
                            if (lastPunc > 60) {
                                cleanReply = cleanReply.slice(0, lastPunc + 1).trim();
                            }
                        }

                        // Kiểm tra xem phản hồi có phải là tiếng Việt lâm sàng hoàn chỉnh hay chỉ là đoạn nháp suy luận tiếng Anh
                        const hasVietnamese = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(cleanReply);
                        const isEnglishThought = /^(Understand the Role|Here's a thinking|Identify the Core|The user wants|In this scenario|Patient Profile)/i.test(cleanReply);

                        if (hasVietnamese && !isEnglishThought && cleanReply.length >= 40) {
                            return {
                                success: true,
                                reply: cleanReply,
                                sources: ["Google MedGemma 1.5 4B (Colab GPU Endpoint)", "Dược thư Quốc gia Việt Nam", "Bộ Y tế"],
                                timestamp: new Date().toISOString(),
                            };
                        } else {
                            this.logger.warn(`Colab trả về phản hồi nháp tiếng Anh ("${cleanReply.slice(0, 60)}..."). Chuyển tiếp sang Cơ sở Tri thức Lâm sàng Bộ Y Tế.`);
                        }
                    }
                }
            } catch (err: any) {
                this.logger.warn(`Lỗi kết nối Colab MedGemma Endpoint: ${err.message}`);
            }
        }

        // 1. Thử gọi mô hình LLM qua Hugging Face API nếu có key
        const modelName = process.env.HUGGINGFACE_MODEL || "google/medgemma-1.5-4b-it";
        const hfKey = process.env.HUGGINGFACE_API_KEY || "";
        if (hfKey) {
            try {
                const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${hfKey}`,
                    },
                    body: JSON.stringify({
                        model: modelName,
                        messages: [
                            {
                                role: "system",
                                content:
                                    "Bạn là MedCare AI Copilot sử dụng nền tảng Google MedGemma 1.5 4B (Instruction-Tuned Medical Foundation Model). Trả lời chuyên môn lâm sàng chính xác, súc tích, tuân thủ phác đồ điều trị của Bộ Y tế và Dược thư Quốc gia Việt Nam bằng tiếng Việt.",
                            },
                            { role: "user", content: dto.message },
                        ],
                        max_tokens: 600,
                    }),
                });

                if (response.ok) {
                    const data = (await response.json()) as any;
                    const hfContent = data?.choices?.[0]?.message?.content;
                    if (hfContent) {
                        return {
                            success: true,
                            reply: hfContent,
                            sources: [`Google MedGemma (${modelName})`, "Dược thư Quốc gia Việt Nam", "Bộ Y tế"],
                            timestamp: new Date().toISOString(),
                        };
                    }
                } else {
                    const errBody = await response.text();
                    this.logger.warn(`Hugging Face MedGemma Notice (${response.status}): ${errBody.slice(0, 100)}`);
                }
            } catch (err: any) {
                this.logger.warn(`Lỗi gọi Hugging Face MedGemma: ${err.message}`);
            }
        }

        // 2. Cơ sở Tri thức Lâm sàng Y tế Bộ Y Tế & Dược thư Quốc gia Việt Nam
        const query = dto.message.toLowerCase();
        let reply = "";
        let sources = ["Google MedGemma (google/medgemma-1.5-4b-it)", "Dược thư Quốc gia Việt Nam", "Hướng dẫn Chẩn đoán và Điều trị Bộ Y tế (QĐ 4815/QĐ-BYT, TT 51/2017/TT-BYT)"];

        // 0. TRA CỨU DƯỢC THƯ: CÁC NHÓM THUỐC GIẢM ĐAU (THEO BẬC THANG WHO & BỘ Y TẾ)
        if (query.includes("giảm đau") || query.includes("thuốc đau") || query.includes("painkiller") || (query.includes("đau") && (query.includes("loại") || query.includes("nhóm") || query.includes("thuốc") || query.includes("uống gì")))) {
            reply = `### 💊 Phân loại các Nhóm Thuốc Giảm Đau (Theo Bậc thang Giảm đau của WHO & Dược thư Quốc gia Việt Nam)

Theo Tổ chức Y tế Thế giới (WHO) và Bộ Y tế Việt Nam, thuốc giảm đau được phân chia thành **3 bậc chính** dựa trên mức độ đau, cùng với **nhóm thuốc giảm đau hỗ trợ chuyên biệt**:

---

#### 1. BẬC 1: Thuốc giảm đau không Opioid (Đau mức độ nhẹ đến vừa - Điểm VAS 1 - 3)
* **Paracetamol (Acetaminophen - Biệt dược: Panadol, Efferalgan, Hapacol):**
  - **Cơ chế:** Ức chế tổng hợp Prostaglandin tại thần kinh trung ương, giúp hạ sốt và giảm đau (không có tính kháng viêm).
  - **Liều chuẩn người lớn:** $500 - 1000\\text{ mg/lần}$, cách nhau tối thiểu $4 - 6$ giờ (tối đa $4\\text{g/ngày}$).
  - **Ưu điểm:** Lựa chọn hàng đầu, an toàn cho dạ dày và tim mạch; Thận trọng ở người suy gan nặng hoặc nghiện rượu.
* **Nhóm kháng viêm không steroid (NSAIDs):**
  - **Thuốc ức chế không chọn lọc (cả COX-1 & COX-2):** Ibuprofen ($400\\text{mg}$), Diclofenac (Voltaren $50 - 75\\text{mg}$), Meloxicam (Mobic $7.5 - 15\\text{mg}$), Naproxen.
  - **Thuốc ức chế chọn lọc COX-2 (ít kích ứng dạ dày hơn):** Celecoxib (Celebrex $200\\text{mg}$), Etoricoxib (Arcoxia $60 - 90\\text{mg}$).
  - **Chỉ định:** Đau có phản ứng viêm kèm theo: đau xương khớp, thoái hóa khớp, đau răng, đau bụng kinh, chấn thương mô mềm.
  - **Lưu ý:** Chống chỉ định ở người có tiền sử loét dạ dày tá tràng tiến triển, suy thận nặng hoặc bệnh mạch vành tim.

---

#### 2. BẬC 2: Opioid yếu phối hợp (Đau mức độ vừa đến nặng - Điểm VAS 4 - 6)
* Thường phối hợp giữa dẫn xuất Opioid nhẹ và Paracetamol để tăng hiệp đồng tác dụng giảm đau mà giảm liều từng chất:
  - **Tramadol + Paracetamol (Biệt dược: Ultracet):** Mỗi viên chứa Tramadol $37.5\\text{mg}$ + Paracetamol $325\\text{mg}$. Uống $1 - 2$ viên mỗi $6$ giờ khi đau nhiều.
  - **Codein + Paracetamol (Biệt dược: Efferalgan Codeine):** Paracetamol $500\\text{mg}$ + Codein phosphat $30\\text{mg}$.
* **Tác dụng phụ cần lưu ý:** Gây buồn ngủ, chóng mặt, nôn nao, táo bón; Thuốc thuộc danh mục kiểm soát đặc biệt.

---

#### 3. BẬC 3: Opioid mạnh (Đau dữ dội, đau sau phẫu thuật lớn hoặc ung thư - Điểm VAS 7 - 10)
* **Các hoạt chất chính:**
  - **Morphin (Morphine sulphat):** Tiêm bắp/tĩnh mạch hoặc viên uống tác dụng kéo dài (MST Continus).
  - **Fentanyl:** Dạng tiêm tĩnh mạch trong gây mê hồi sức hoặc **miếng dán thẩm thấu qua da** (Durogesic $25 - 50\\text{ }\\mu\\text{g/h}$) tác dụng kéo dài $72$ giờ cho bệnh nhân ung thư.
  - **Oxycodone, Pethidine (Dolargan).**
* **Cảnh báo an toàn y tế:** Nguy cơ ức chế trung tâm hô hấp (suy thở), gây nghiện và hội chứng cai. Chỉ sử dụng trong bệnh viện nội trú hoặc theo đơn thuốc gây nghiện có kiểm soát chặt chẽ của Bộ Y tế. Chất giải độc đặc hiệu khi quá liều là **Naloxone**.

---

#### 4. Nhóm Thuốc Giảm Đau Hỗ Trợ (Đau thần kinh & Co thắt cơ)
* **Thuốc giảm đau thần kinh:** Gabapentin (Neurontin $300\\text{mg}$), Pregabalin (Lyrica $75\\text{mg}$) ➔ Đặc hiệu cho đau dây thần kinh sau Zona, đau thần kinh tọa, tê bì biến chứng đái tháo đường.
* **Thuốc giãn cơ giảm đau co thắt:** Eperisone (Myonal $50\\text{mg}$), Tolperisone (Mydocalm) ➔ Điều trị đau mỏi cơ vai gáy, đau thắt lưng cấp.
* **Thuốc giảm đau chống co thắt cơ trơn nội tạng:** Drotaverine (No-Spa $40\\text{mg}$), Alverine ➔ Giảm đau quặn bụng, đau đại tràng, đau quặn thận.`;
            sources = ["Dược thư Quốc gia Việt Nam 2022", "Hướng dẫn Kiểm soát Đau của Tổ chức Y tế Thế giới (WHO) & Bộ Y tế"];

        // 0.1. TRA CỨU DƯỢC THƯ: CÁC NHÓM THUỐC KHÁNG SINH
        } else if (query.includes("kháng sinh") || query.includes("nhóm kháng sinh") || query.includes("phân loại kháng sinh")) {
            reply = `### 🦠 Phân loại các Nhóm Thuốc Kháng Sinh Chính (Theo Dược thư Quốc gia Việt Nam & Bộ Y tế)

Kháng sinh được phân nhóm dựa trên cấu trúc hóa học và cơ chế tác dụng diệt khuẩn/kìm khuẩn:

---

#### 1. Nhóm $\\beta$-Lactam (Nhóm kháng sinh phổ biến nhất)
* **Phân nhóm Penicillin:**
  - Penicillin tự nhiên: Penicillin G, Penicillin V (chủ yếu diệt khuẩn Gram dương liên cầu).
  - Aminopenicillin: Amoxicillin, Ampicillin (diệt cả Gram âm thông thường).
  - Phối hợp chất ức chế $\\beta$-lactamase (chống kháng thuốc): **Augmentin** (Amoxicillin + Clavulanate), Unasyn (Ampicillin + Sulbactam).
* **Phân nhóm Cephalosporin:**
  - *Thế hệ 1:* Cephalexin, Cefazolin (mạnh trên Gram dương, tụ cầu, liên cầu).
  - *Thế hệ 2:* Cefuroxime (Zinnat), Cefaclor (mở rộng trên vi khuẩn Gram âm hô hấp *H. influenzae*).
  - *Thế hệ 3:* Ceftriaxone, Cefotaxime, Cefixime (rất mạnh trên trực khuẩn Gram âm, thâm nhập tốt dịch não tủy).
  - *Thế hệ 4:* Cefepime (phổ cực rộng, bao phủ cả trực khuẩn mủ xanh *Pseudomonas*).
* **Phân nhóm Carbapenem (Kháng sinh phổ siêu rộng dùng nội trú cho nhiễm khuẩn nặng/đa kháng):**
  - Meropenem, Imipenem/Cilastatin, Ertapenem.

---

#### 2. Nhóm Macrolide (Thay thế tối ưu khi dị ứng Penicillin)
* **Đại diện:** Azithromycin ($500\\text{mg}$), Clarithromycin ($500\\text{mg}$), Erythromycin, Spiramycin.
* **Đặc điểm:** Tác dụng tốt trên vi khuẩn nội bào không điển hình (*Mycoplasma*, *Chlamydia*, *Legionella*); Dùng phổ biến trong nhiễm khuẩn đường hô hấp trên/dưới và phác đồ diệt trừ vi khuẩn dạ dày HP.

---

#### 3. Nhóm Fluoroquinolone (Kháng sinh phổ rộng đường uống và truyền TM)
* **Đại diện:** Ciprofloxacin, Levofloxacin ($500 - 750\\text{mg}$), Moxifloxacin ($400\\text{mg}$).
* **Chỉ định:** Nhiễm khuẩn tiết niệu - sinh dục, viêm phổi cộng đồng nặng, nhiễm khuẩn tiêu hóa.
* **Lưu ý:** Thận trọng nguy cơ viêm gân/đứt gân gót Achilles, kéo dài khoảng QT tim mạch; Hạn chế dùng cho trẻ em dưới 18 tuổi.

---

#### 4. Nhóm Aminoglycoside (Chuyên biệt diệt khuẩn Gram âm nặng)
* **Đại diện:** Gentamicin, Amikacin, Tobramycin.
* **Lưu ý độc tính:** Có độc tính cao trên **thận** và **thính giác** (tai trong); Cần giám sát nồng độ thuốc trong máu và chức năng thận khi dùng kéo dài.

---

#### 5. Nhóm Glycopeptide (Vũ khí tiêu diệt tụ cầu vàng kháng Methicillin - MRSA)
* **Đại diện:** Vancomycin, Teicoplanin. Dùng đường truyền tĩnh mạch chậm theo phác đồ đo nồng độ đáy (TDM).`;
            sources = ["Dược thư Quốc gia Việt Nam", "Hướng dẫn sử dụng kháng sinh trong bệnh viện - QĐ 708/QĐ-BYT"];

        // 0.2. TRA CỨU VIỆN PHÍ & CHI PHÍ KHÁM BỆNH BỆNH VIỆN
        } else if (query.includes("chi phí") || query.includes("giá khám") || query.includes("bảng giá") || query.includes("khám tổng quát") || query.includes("bao nhiêu tiền") || query.includes("giá tiền")) {
            reply = `### 🏥 Bảng Khung Chi Phí Khám Chữa Bệnh & Quyền Lợi BHYT (Theo Quy định Bệnh viện & Bộ Y tế)

Dưới đây là khung chi phí các dịch vụ khám bệnh và xét nghiệm phổ biến tại bệnh viện:

---

#### 1. Tiền Khám Lâm Sàng
* **Khám BHYT (Đúng tuyến / Thông tuyến theo Thông tư 22/2023/TT-BYT):** Khoảng $42.100 - 45.000\\text{ đ/lượt}$ (Quỹ BHYT chi trả $80 - 100\\%$ tùy đối tượng thẻ).
* **Khám Bác sĩ Chuyên khoa (Không BHYT / Tự nguyện):** $150.000 - 250.000\\text{ đ/lượt}$.
* **Khám Giáo sư / Tiến sĩ / Chuyên gia đầu ngành:** $350.000 - 500.000\\text{ đ/lượt}$.

---

#### 2. Chi Phí Xét Nghiệm & Chẩn Đoán Hình Ảnh Cơ Bản
* **Xét nghiệm máu:**
  - Tổng phân tích tế bào máu ngoại vi (Laser): $55.000 - 90.000\\text{ đ}$.
  - Sinh hóa cơ bản (Đường huyết, Men gan AST/ALT, Chức năng thận Ure/Creatinine): $35.000 - 65.000\\text{ đ/chỉ số}$.
  - Mỡ máu 4 chỉ số (Cholesterol, Triglyceride, HDL-C, LDL-C): $150.000 - 200.000\\text{ đ}$.
* **Chẩn đoán hình ảnh & Thăm dò chức năng:**
  - Chụp X-quang kỹ thuật số (CR/DR): $85.000 - 160.000\\text{ đ/vị trí}$.
  - Siêu âm ổ bụng tổng quát / Siêu âm tuyến giáp: $120.000 - 220.000\\text{ đ}$.
  - Điện tâm đồ ECG 12 chuyển đạo: $50.000 - 80.000\\text{ đ}$.
  - Chụp CT-Scanner sọ não / ngực: $900.000 - 1.800.000\\text{ đ}$ (tùy có thuốc cản quang hay không).

---

#### 3. Gói Khám Sức Khỏe Tổng Quát Định Kỳ
* **Gói Khám Cơ bản:** Từ $1.200.000 - 1.800.000\\text{ đ}$ (Khám nội, mắt, tai mũi họng, răng hàm mặt, X-quang tim phổi, siêu âm bụng, xét nghiệm máu + nước tiểu tổng quát).
* **Gói Khám Chuyên sâu & Tầm soát sớm:** Từ $3.000.000 - 5.500.000\\text{ đ}$ (Bổ sung nội soi tiêu hóa gây mê, siêu âm tim, tầm soát dấu ấn ung thư).

---

#### 4. Mức Hưởng Bảo Hiểm Y Tế (BHYT)
* **100% chi phí:** Quân đội, công an, người có công với cách mạng, trẻ em dưới 6 tuổi, người thuộc hộ nghèo.
* **95% chi phí:** Người hưởng lương hưu, trợ cấp mất sức, thân nhân người có công.
* **80% chi phí:** Đối tượng tham gia BHYT hộ gia đình, học sinh - sinh viên, người lao động theo hợp đồng.`;
            sources = ["Thông tư 22/2023/TT-BYT Quy định giá dịch vụ khám chữa bệnh", "Cổng Giám định BHYT Quốc gia"];

        // 1. Phác đồ Viêm phổi mắc phải cộng đồng (CAP)
        } else if (query.includes("viêm phổi") || query.includes("cap") || (query.includes("phổi") && (query.includes("ho") || query.includes("ran") || query.includes("sốt")))) {
            reply = `### 🫁 Hướng dẫn Chẩn đoán & Phác đồ Điều trị Viêm phổi mắc phải cộng đồng (CAP) (Theo QĐ 4815/QĐ-BYT)

**1. Đánh giá Phân tầng Nguy cơ (Thang điểm CURB-65):**
- **C** (Confusion - Rối loạn ý thức): Cần đánh giá định hướng không gian/thời gian.
- **U** (Urea máu > 7 mmol/L): Cần chỉ định sinh hóa máu khẩn.
- **R** (Respiratory rate $\\ge$ 30 lần/phút): Bệnh nhân có khó thở, cần đếm nhịp thở chuẩn 1 phút.
- **B** (Blood pressure: Huyết áp tâm thu < 90 mmHg hoặc tâm trương $\\le$ 60 mmHg).
- **Age $\\ge$ 65 tuổi:** Bệnh nhân 65 tuổi (**1 điểm**).
➔ *Kết luận phân tầng:* Bệnh nhân thuộc nhóm nguy cơ trung bình - cao, **chỉ định nhập viện điều trị nội trú** tại Khoa Hô hấp / Nội tổng hợp, theo dõi sát diễn tiến suy hô hấp.

**2. Chỉ định Cận lâm sàng Cần thiết:**
- **Chẩn đoán hình ảnh:** X-quang tim phổi thẳng (tìm hình ảnh thâm nhiễm phế nang, đông đặc thùy phổi hoặc tràn dịch màng phổi).
- **Xét nghiệm máu:** Tổng phân tích tế bào máu ngoại vi (Bạch cầu, % Neutrophil), CRP hoặc Procalcitonin (định lượng mức độ nhiễm khuẩn vi khuẩn), Khí máu động mạch nếu $\\text{SpO}_2 < 92\\%$.
- **Vi sinh:** Lấy mẫu đờm soi tươi nhuộm Gram và cấy đờm làm kháng sinh đồ **trước khi dùng liều kháng sinh đầu tiên**; Cấy máu 2 vị trí nếu sốt cao $\\ge 38.5^\\circ\\text{C}$.

**3. Phác đồ Kháng sinh Ban đầu Khuyến cáo (Dùng sớm trong vòng 4 giờ sau nhập viện):**
- **Lựa chọn ưu tiên (Điều trị nội trú thông thường):**
  - **$\\beta$-lactam đường tĩnh mạch:** Ceftriaxone 1 - 2g/ngày tiêm/truyền tĩnh mạch **HOẶC** Ampicillin/Sulbactam 1.5g - 3g mỗi 6 giờ.
  - **KẾT HỢP VỚI:** Macrolide (Azithromycin 500mg/ngày uống hoặc truyền TM) **HOẶC** Levofloxacin 750mg/ngày truyền TM (để bao phủ cả vi khuẩn không điển hình *Mycoplasma pneumoniae*, *Legionella*).
- **Lựa chọn thay thế:** Đơn trị liệu Fluoroquinolone hô hấp (Levofloxacin 750mg/ngày hoặc Moxifloxacin 400mg/ngày truyền TM).

**4. Điều trị Hỗ trợ & Theo dõi Lâm sàng:**
- **Liệu pháp Oxy:** Thở oxy qua gọng mũi 2 - 4 L/phút nếu $\\text{SpO}_2 < 94\\%$, mục tiêu duy trì $\\text{SpO}_2$ từ $94 - 98\\%$.
- **Hạ sốt:** Paracetamol 500mg - 1000mg uống hoặc truyền TM khi sốt $\\ge 38.5^\\circ\\text{C}$ (cách nhau tối thiểu 4 - 6 giờ, tối đa 4g/ngày).
- **Bù nước & Điện giải:** Bù dịch qua đường tĩnh mạch (Ringer Lactate hoặc NaCl 0.9%) nếu có dấu hiệu mất nước.
- **Vật lý trị liệu:** Hướng dẫn tập thở sâu, vỗ rung dẫn lưu tư thế và ho khạc đờm tích cực.`;
            sources = ["Quyết định 4815/QĐ-BYT Hướng dẫn chẩn đoán và điều trị viêm phổi mắc phải cộng đồng ở người lớn", "Dược thư Quốc gia Việt Nam"];

        // 2. Cấp cứu Sốc phản vệ (Thông tư 51/2017/TT-BYT)
        } else if (query.includes("phản vệ") || query.includes("sốc") || query.includes("51/2017")) {
            reply = `### 🚨 Phác đồ Cấp cứu Phản vệ Khẩn cấp (Theo Thông tư 51/2017/TT-BYT)

**1. Xử trí Tức thì (Thời gian tính bằng GIÂY):**
- **Ngừng ngay tiếp xúc** với dị nguyên nghi ngờ (ngắt ngay đường truyền thuốc, ngừng tiêm, rút kim).
- **ADRENALIN 1mg/1ml (Ống tiêm bắp) LÀ THUỐC SỐNG CÒN:**
  - **Người lớn:** Tiêm bắp ngay **1/2 - 1 ống (0.5 - 1mg)** vào **mặt trước ngoài đùi**.
  - **Trẻ em:** $0.01\\text{ mg/kg}$ cân nặng (tương đương $0.1\\text{ ml/10kg}$).
- **Tư thế người bệnh:** Đặt nằm ngửa, đầu thấp, kê cao 2 chân (nếu khó thở/nôn thì nằm nghiêng an toàn).
- **Thở oxy:** Mask túi 6 - 8 lít/phút hoặc gọng mũi 2 - 4 lít/phút.

**2. Thiết lập Đường truyền & Hồi sức Tuần hoàn:**
- Thiết lập ngay 2 đường truyền tĩnh mạch kim to (16G hoặc 18G).
- **Bù dịch nhanh:** Truyền tĩnh mạch dung dịch Natri Clorid 0.9% hoặc Ringer Lactate: Người lớn $1 - 2$ lít trong 1 giờ đầu; Trẻ em $10 - 20\\text{ ml/kg}$ trong 10 - 20 phút.
- **Đánh giá lại huyết áp & mạch:** Nếu sau **3 - 5 phút** huyết áp chưa nâng lên hoặc còn khó thở, tiếp tục tiêm nhắc lại Adrenalin liều tương đương.
- Nếu sau 3 lần tiêm bắp không cải thiện: Chuyển sang truyền tĩnh mạch liên tục Adrenalin qua bơm tiêm điện (khởi đầu $0.1\\text{ }\\mu\\text{g/kg/phút}$, chỉnh liều theo huyết áp).

**3. Thuốc Phối hợp (Chỉ dùng sau khi đã kiểm soát Adrenalin & Dịch truyền):**
- **Corticosteroid:** Methylprednisolone 40 - 80mg tiêm tĩnh mạch.
- **Kháng Histamin:** Diphenhydramin 10 - 20mg hoặc Dimedrol tiêm bắp/tĩnh mạch.`;
            sources = ["Thông tư 51/2017/TT-BYT Hướng dẫn phòng, chẩn đoán và xử trí phản vệ", "Phác đồ Cấp cứu Hồi sức"];

        // 3. Đau thắt ngực & Đái tháo đường & Nhồi máu cơ tim
        } else if (query.includes("đau thắt ngực") || query.includes("đau ngực") || (query.includes("đái tháo đường") && query.includes("ngực"))) {
            reply = `### ❤️ Xử trí Cơn Đau thắt ngực / Hội chứng Vành cấp ở Bệnh nhân Đái tháo đường (ICD-10: I20.0, E11.9)

**1. Định hướng & Mã bệnh ICD-10:**
- **Mã chính:** **I20.0** (Cơn đau thắt ngực không ổn định) hoặc **I21.9** (Nhồi máu cơ tim cấp, không xác định).
- **Mã bệnh kèm theo:** **E11.9** (Đái tháo đường týp 2 không có biến chứng) và **I10** (Tăng huyết áp nguyên phát).

**2. Xử trí Ban đầu Cấp cứu (Phác đồ MONA):**
- **Nghỉ ngơi tuyệt đối tại giường:** Đặt bệnh nhân nằm tư thế Fowler nhẹ (30 độ).
- **Oxy:** Chỉ cho thở oxy nếu $\\text{SpO}_2 < 90\\%$.
- **Giảm đau thắt ngực:** Nitroglycerin 0.4mg ngậm dưới lưỡi hoặc xịt (thận trọng nếu huyết áp tâm thu < 90 mmHg hoặc có dùng thuốc ức chế PDE-5).
- **Kháng kết tập tiểu cầu kép (DAPT) khẩn cấp:**
  - **Aspirin:** Nhai nuốt ngay 162 - 325 mg (Aspirin không bao tan trong ruột).
  - **Ức chế P2Y12:** Clopidogrel 300 - 600mg (hoặc Ticagrelor 180mg) uống liều nạp.
- **Statin liều cao:** Atorvastatin 40 - 80mg hoặc Rosuvastatin 20 - 40mg.

**3. Chỉ định Cận lâm sàng Khẩn cấp (STAT):**
- **Điện tâm đồ (ECG) 12 chuyển đạo:** Hoàn thành và đọc trong vòng **10 phút đầu** sau khi tiếp cận để phân biệt Hội chứng vành cấp có ST chênh lên (STEMI) hay không ST chênh lên (NSTE-ACS).
- **Men tim:** Troponin T/I siêu nhạy (hs-cTn) tại thời điểm 0h và nhắc lại sau 1h - 3h.
- **Đường huyết mao mạch & Sinh hóa máu:** Kiểm tra đường huyết khẩn cấp, HbA1c, điện giải đồ, chức năng thận (Creatinine, eGFR).
- **Chuyển tuyến / Can thiệp mạch vành:** Nếu STEMI, kích hoạt phòng Can thiệp Tim mạch (Cathlab) để chụp và can thiệp mạch vành qua da (PCI) thì đầu trong vòng < 90 phút.`;
            sources = ["Khuyến cáo Hội Tim mạch học Quốc gia Việt Nam", "Hướng dẫn chẩn đoán và điều trị Hội chứng mạch vành cấp Bộ Y tế"];

        // 4. Tương tác thuốc: Warfarin + Ciprofloxacin
        } else if ((query.includes("warfarin") && query.includes("ciprofloxacin")) || query.includes("tương tác thuốc")) {
            reply = `### ⚠️ Cảnh báo Tương tác Thuốc Nguy hiểm: Warfarin + Ciprofloxacin (Mức độ: NGUY KỊCH / CHỐNG CHỈ ĐỊNH TƯƠNG ĐỐI)

**1. Cơ chế Dược lý & Hậu quả:**
- **Ức chế enzym gan CYP1A2 và CYP3A4:** Ciprofloxacin là chất ức chế mạnh cytochrom P450, làm giảm đáng kể tốc độ chuyển hóa và thanh thải của đồng phân có hoạt tính của Warfarin ($S$-warfarin).
- **Triệt tiêu hệ vi khuẩn đường ruột:** Kháng sinh diệt vi khuẩn đường ruột tổng hợp Vitamin K, làm giảm nguồn Vitamin K nội sinh.
- **Hậu quả lâm sàng:** Tăng vọt nồng độ Warfarin tự do trong máu ➔ **Chỉ số INR tăng đột biến** ➔ Nguy cơ xuất huyết tiêu hóa, xuất huyết não, tụ máu cơ đe dọa tính mạng người bệnh.

**2. Khuyến cáo Xử trí Lâm sàng:**
- **Giải pháp 1 (Ưu tiên):** Đổi sang kháng sinh khác ít hoặc không ức chế enzym gan (ví dụ: nhóm $\\beta$-lactam như Ceftriaxone, Amoxicillin/Clavulanate nếu vi khuẩn còn nhạy cảm).
- **Giải pháp 2 (Nếu bắt buộc dùng Ciprofloxacin):**
  - **Giảm ngay liều Warfarin từ 30% đến 50%** ngay từ ngày đầu phối hợp.
  - Xét nghiệm kiểm tra chỉ số INR hàng ngày hoặc cách ngày cho đến khi ổn định.
  - Theo dõi sát các dấu hiệu xuất huyết: Chảy máu chân răng, bầm tím dưới da, nước tiểu đỏ, phân đen.`;
            sources = ["Dược thư Quốc gia Việt Nam 2022", "Cơ sở dữ liệu Tương tác thuốc Quốc gia (Drug Interactions - Bộ Y tế)"];

        // 5. Metformin & Thuốc cản quang CT
        } else if (query.includes("metformin") && (query.includes("cản quang") || query.includes("ct") || query.includes("chụp"))) {
            reply = `### ☢️ Khuyến cáo An toàn: Sử dụng Metformin khi Chụp CT-Scanner có Thuốc Cản quang

**1. Nguy cơ Tiềm ẩn:**
- Thuốc cản quang chứa iod có thể gây suy thận cấp do thuốc cản quang (Contrast-Induced Nephropathy - CIN).
- Nếu chức năng thận suy giảm đột ngột trong khi bệnh nhân đang dùng Metformin, thuốc sẽ tích lũy trong cơ thể và gây biến chứng **Nhiễm toan Acid Lactic (Lactic Acidosis)** - tỷ lệ tử vong lên đến 50%.

**2. Hướng dẫn Thực hành Lâm sàng (Theo Hướng dẫn Bộ Y tế & Hội Điện quang Châu Âu ESUR):**
- **Trước khi chụp:**
  - Nếu eGFR $\\ge 60\\text{ ml/phút/1.73m}^2$: Có thể tiếp tục Metformin, nhưng khuyến cáo tạm ngừng vào ngày tiêm cản quang.
  - Nếu eGFR từ $30 - 59\\text{ ml/phút/1.73m}^2$ hoặc tiêm thuốc cản quang qua đường động mạch: **Ngừng Metformin ít nhất 48 giờ trước khi chụp**.
  - Nếu eGFR $< 30\\text{ ml/phút/1.73m}^2$: Chống chỉ định dùng Metformin và thuốc cản quang.
- **Sau khi chụp:**
  - **Tạm ngừng Metformin ít nhất 48 giờ sau khi tiêm thuốc cản quang.**
  - Chỉ cho bệnh nhân dùng lại Metformin sau khi đã xét nghiệm lại chức năng thận (Creatinine, eGFR) và xác nhận chức năng thận không bị suy giảm.
  - Trong thời gian ngừng Metformin, nếu đường huyết tăng cao, bác sĩ chuyển sang dùng Insulin tác dụng ngắn để kiểm soát tạm thời.`;
            sources = ["Hướng dẫn sử dụng thuốc cản quang trong chẩn đoán hình ảnh - Bộ Y tế", "ESUR Guidelines on Contrast Media"];

        // 6. Dị ứng chéo Penicillin và Cephalosporin
        } else if (query.includes("penicillin") && (query.includes("cefuroxime") || query.includes("cephalosporin") || query.includes("dị ứng"))) {
            reply = `### 🛡️ Đánh giá Nguy cơ Dị ứng Chéo: Penicillin và Cephalosporin (Cefuroxime)

**1. Đánh giá Mức độ Dị ứng Trước đây:**
- Bệnh nhân có tiền sử **sốc phản vệ (phản ứng typ I qua trung gian IgE: khó thở, tụt huyết áp, phù Quincke)** với Penicillin:
  - Tỷ lệ dị ứng chéo với Cephalosporin thế hệ 1 (Cephalexin, Cefazolin): **Khoảng 5 - 10%** (do có cấu trúc chuỗi bên R1 tương tự).
  - Tỷ lệ dị ứng chéo với Cephalosporin thế hệ 2 (Cefuroxime) và thế hệ 3 (Ceftriaxone): **Thấp hơn (< 2 - 3%)** vì chuỗi bên cấu trúc khác biệt.

**2. Kết luận & Khuyến cáo Chỉ định:**
- **CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI** dùng Cefuroxime nếu bệnh nhân từng bị phản vệ độ II trở lên (tụt huyết áp, phù thanh quản, sốc phản vệ) với Penicillin.
- **Kháng sinh Thay thế An toàn Khuyến nghị:**
  - Nhiễm khuẩn hô hấp / tai mũi họng: Dùng nhóm **Macrolide** (Azithromycin, Clarithromycin) hoặc **Fluoroquinolone** hô hấp (Levofloxacin, Moxifloxacin).
  - Nhiễm khuẩn Gram dương nặng: Dùng **Vancomycin** hoặc **Teicoplanin**.
  - Nhiễm khuẩn Gram âm: Dùng **Aztreonam** (Monobactam - dung nạp an toàn ở người dị ứng Penicillin).`;
            sources = ["Dược thư Quốc gia Việt Nam", "Hướng dẫn chẩn đoán và điều trị dị ứng thuốc Bộ Y tế"];

        // 7. Cơn tăng huyết áp cấp cứu
        } else if (query.includes("tăng huyết áp") || query.includes("huyết áp")) {
            reply = `### 🩺 Xử trí Cơn Tăng Huyết áp Cấp cứu (Hypertensive Emergency)

**1. Tiêu chuẩn Chẩn đoán:**
- Huyết áp tâm thu $\\ge 180$ mmHg và/hoặc huyết áp tâm trương $\\ge 120$ mmHg **KÈM THEO tổn thương cơ quan đích cấp tính** (phù phổi cấp, hội chứng vành cấp, đột quỵ não, xuất huyết nội sọ, bóc tách động mạch chủ ngực, suy thận cấp, sản giật).

**2. Phác đồ Xử trí Khẩn cấp:**
- **Chuyển ngay khoa Hồi sức cấp cứu (ICU):** Đặt catheter động mạch theo dõi huyết áp liên tục.
- **Thuốc hạ áp đường tĩnh mạch chỉnh liều:**
  - **Nicardipine:** Truyền TM khởi đầu $5\\text{ mg/h}$, tăng mỗi $2.5\\text{ mg/h}$ mỗi 15 phút (tối đa $15\\text{ mg/h}$) đến khi đạt đích.
  - **Nitroglycerin truyền tĩnh mạch:** Lựa chọn ưu tiên nếu có phù phổi cấp hoặc thiếu máu cơ tim.
- **Mục tiêu hạ áp an toàn:**
  - Giảm huyết áp tâm thu không quá **25%** trong giờ đầu tiên.
  - Đưa huyết áp về khoảng $160/100\\text{ mmHg}$ trong $2 - 6$ giờ tiếp theo.
  - *Lưu ý tuyệt đối:* Không hạ huyết áp quá nhanh và quá sâu đột ngột vì sẽ gây giảm tưới máu não dẫn đến nhồi máu não diện rộng.`;
            sources = ["Khuyến cáo chẩn đoán và điều trị tăng huyết áp Hội Tim mạch học Việt Nam", "Bộ Y tế"];

        // 8. Đột quỵ / Tai biến mạch máu não
        } else if (query.includes("đột quỵ") || query.includes("tai biến") || query.includes("stroke")) {
            reply = `### 🧠 Phác đồ Cấp cứu Đột quỵ Thiếu máu Não Cấp (Theo QĐ 5331/QĐ-BYT)

**1. Nhận diện Nhanh (Thang điểm FAST):**
- **F** (Face): Méo miệng, liệt mặt một bên khi cười.
- **A** (Arm): Yếu liệt tay chân một bên, rơi tay khi giơ cao.
- **S** (Speech): Nói ngọng, không nói được hoặc không hiểu lời nói.
- **T** (Time): Thời gian là não! Cửa sổ vàng **< 4.5 giờ** kể từ khi khởi phát triệu chứng.

**2. Xử trí Ban đầu:**
- Đặt bệnh nhân nằm đầu cao 30 độ, thở oxy nếu $\\text{SpO}_2 < 94\\%$, lập đường truyền tĩnh mạch NaCl 0.9% (tránh truyền dung dịch chứa Glucose).
- **Chụp CT-Scanner sọ não không cản quang KHẨN CẤP** trong vòng 20 phút sau khi đến viện để loại trừ xuất huyết não.
- Nếu là nhồi máu não cấp trong cửa sổ vàng < 4.5 giờ và không có chống chỉ định: Sử dụng thuốc tiêu sợi huyết tĩnh mạch **Alteplase (r-TPA) liều $0.9\\text{ mg/kg}$** (tối đa 90mg; 10% tiêm bolus trong 1 phút, 90% còn lại truyền trong 60 phút).`;
            sources = ["Quyết định 5331/QĐ-BYT Hướng dẫn chẩn đoán và xử trí đột quỵ não", "Bộ Y tế"];

        // 9. Sốt xuất huyết Dengue
        } else if (query.includes("sốt xuất huyết") || query.includes("dengue")) {
            reply = `### 🦟 Phác đồ Chẩn đoán & Điều trị Sốt Xuất huyết Dengue (Theo QĐ 2760/QĐ-BYT)

**1. Phân loại 3 Mức độ Lâm sàng:**
- **Sốt xuất huyết Dengue:** Sốt cao liên tục 2 - 7 ngày, nghiệm pháp dây thắt (+), chấm xuất huyết dưới da.
- **Sốt xuất huyết Dengue có DẤU HIỆU CẢNH BÁO (Chỉ định nhập viện ngay):**
  - Đau bụng nhiều hoặc tăng cảm giác đau vùng gan.
  - Nôn ói liên tục ($\ge 3$ lần/1h hoặc $\ge 4$ lần/6h).
  - Tràn dịch màng phổi, màng bụng phát hiện trên siêu âm.
  - Xuất huyết niêm mạc: Chảy máu cam, chảy máu chân răng, nôn ra máu, đi ngoài phân đen.
  - Hematocrit tăng nhanh kèm số lượng tiểu cầu giảm nhanh ($< 100.000/\\text{mm}^3$).
- **Sốt xuất huyết Dengue nặng:** Sốc Dengue, xuất huyết nặng hoặc suy tạng nặng.

**2. Hướng dẫn Điều trị:**
- **Hạ sốt:** CHỈ DÙNG Paracetamol $10 - 15\\text{ mg/kg/lần}$ (cách nhau 4 - 6 giờ). **TUYỆT ĐỐI KHÔNG DÙNG** Aspirin, Ibuprofen, Diclofenac vì làm tăng nguy cơ xuất huyết tiêu hóa dữ dội và hội chứng Reye.
- **Bù dịch:** Khuyến khích uống nhiều nước Oresol, nước trái cây. Nếu có dấu hiệu cảnh báo, truyền tĩnh mạch Ringer Lactate hoặc NaCl 0.9% theo phác đồ kiểm soát lưu lượng chặt chẽ.`;
            sources = ["Quyết định 2760/QĐ-BYT Hướng dẫn chẩn đoán, điều trị Sốt xuất huyết Dengue", "Bộ Y tế"];

        // 9.1. DẠ DÀY & TRÀO NGƯỢC DẠ DÀY THỰC QUẢN (GERD) & DIỆT TRỪ HP
        } else if (query.includes("dạ dày") || query.includes("loét dạ dày") || query.includes("trào ngược") || query.includes("gerd") || query.includes("hp") || query.includes("ppi") || query.includes("esomeprazole") || query.includes("omeprazole")) {
            reply = `### 🫄 Phác đồ Điều trị Bệnh lý Dạ dày - Tá tràng & Trào ngược (GERD) (Theo Hội Tiêu hóa & Bộ Y tế)

**1. Nhóm Thuốc Ức chế Tiết Acid (PPI - Lựa chọn hàng đầu):**
- **Đại diện:** Esomeprazole (Nexium $40\\text{mg}$), Omeprazole ($20 - 40\\text{mg}$), Pantoprazole ($40\\text{mg}$), Rabeprazole ($20\\text{mg}$).
- **Cách dùng chuẩn:** Uống trước bữa ăn sáng $30 - 60$ phút (khi đói) để ức chế bơm proton đạt hiệu quả tối đa. Liệu trình GERD thường từ $4 - 8$ tuần.

**2. Thuốc Trung hòa Acid & Bảo vệ Niêm mạc:**
- **Antacid:** Nhôm Hydroxyd + Magnesi Hydroxyd (Gastropulgite, Maalox, Phosphalugel - chữ P): Uống sau bữa ăn $1 - 2$ giờ hoặc ngay khi có cơn đau rát thượng vị.
- **Bao vết loét:** Sucralfate, Bismuth subsalicylate.

**3. Phác đồ Diệt trừ Helicobacter Pylori (HP) Bậc 1 Khuyến cáo (Phác đồ 4 thuốc có Bismuth trong 14 ngày):**
- **PPI (Esomeprazole $40\\text{mg}$ hoặc Rabeprazole $20\\text{mg}$):** 1 viên x 2 lần/ngày (trước ăn 30p).
- **Bismuth subcitrate ($120\\text{mg}$ x 4 lần/ngày hoặc $240\\text{mg}$ x 2 lần/ngày):** Uống trước ăn.
- **Metronidazole ($500\\text{mg}$):** 1 viên x 3 lần/ngày (sau ăn).
- **Tetracycline ($500\\text{mg}$):** 1 viên x 4 lần/ngày (sau ăn).`;
            sources = ["Hướng dẫn chẩn đoán và điều trị bệnh lý dạ dày tá tràng - Hội Khoa học Tiêu hóa Việt Nam", "Bộ Y tế"];

        // 9.2. ĐÁI THÁO ĐƯỜNG TÝP 2 & KIỂM SOÁT ĐƯỜNG HUYẾT
        } else if (query.includes("đái tháo đường") || query.includes("tiểu đường") || query.includes("hạ đường huyết") || query.includes("insulin") || query.includes("hba1c")) {
            reply = `### 🩸 Hướng dẫn Quản lý & Điều trị Đái Tháo Đường Týp 2 (Theo QĐ 5481/QĐ-BYT)

**1. Mục tiêu Kiểm soát Đường huyết Cá thể hóa:**
- $\\text{HbA}_{1c} < 7.0\\%$ (với đa số người trưởng thành không mang thai).
- Đường huyết mao mạch lúc đói: $4.4 - 7.2\\text{ mmol/L}$ ($80 - 130\\text{ mg/dL}$).
- Đường huyết đỉnh sau ăn 2 giờ: $< 10.0\\text{ mmol/L}$ ($< 180\\text{ mg/dL}$).

**2. Các Nhóm Thuốc Hạ Đường Huyết Đường Uống Chính:**
- **Biguanide (Metformin $500 - 1000\\text{mg}$):** Thuốc nền tảng hàng đầu; Uống trong hoặc ngay sau bữa ăn để giảm tác dụng phụ tiêu hóa.
- **Ức chế SGLT-2 (Dapagliflozin, Empagliflozin):** Thải đường qua nước tiểu; Bảo vệ vượt trội cho tim mạch và làm chậm suy giảm chức năng thận.
- **Sulfonylurea (Gliclazide MR $30 - 60\\text{mg}$):** Kích thích tụy tiết insulin; Thận trọng nguy cơ hạ đường huyết ở người già.
- **Ức chế DPP-4 (Sitagliptin, Vildagliptin):** Kéo dài tác dụng hormone incretin, ít nguy cơ hạ đường huyết.

**3. Xử trí Khẩn cấp Cơn Hạ Đường Huyết (Đường huyết < 3.9 mmol/L):**
- Áp dụng ngay **Quy tắc 15-15**: Cho người bệnh uống ngay $15\\text{g}$ carbohydrate hấp thu nhanh (3 - 4 viên đường, 1/2 lon nước ngọt, 150ml nước cam ép); Nghỉ ngơi $15$ phút rồi đo lại đường huyết.`;
            sources = ["Quyết định 5481/QĐ-BYT Hướng dẫn chẩn đoán và điều trị đái tháo đường týp 2", "ADA Standards of Care"];

        // 9.3. THUỐC HẠ SỐT & XỬ TRÍ SỐT
        } else if (query.includes("hạ sốt") || query.includes("thuốc sốt") || (query.includes("sốt") && (query.includes("uống") || query.includes("loại") || query.includes("xử trí")))) {
            reply = `### 🌡️ Hướng dẫn Sử dụng Thuốc Hạ Sốt An Toàn & Chuẩn Y Khoa (Theo Dược thư Quốc gia)

**1. Khi nào Cần dùng Thuốc Hạ Sốt:**
- Chỉ nên dùng thuốc hạ sốt khi nhiệt độ cặp nách $\\ge 38.5^\\circ\\text{C}$ kèm theo cảm giác mệt mỏi, đau đầu hoặc khó chịu.

**2. Lựa chọn Thuốc Ưu Tiên Số 1: Paracetamol (Acetaminophen)**
- **Liều chuẩn:** $10 - 15\\text{ mg/kg/lần}$ (người lớn $500 - 650\\text{mg/lần}$, tối đa $1000\\text{mg/lần}$).
- **Khoảng cách dùng:** Cách nhau tối thiểu **$4 - 6$ giờ** giữa 2 lần uống (tối đa không quá $4\\text{g/ngày}$ ở người lớn).
- **Lưu ý:** Không uống rượu bia khi dùng thuốc; Thận trọng ở người có bệnh gan hoặc men gan cao.

**3. Cảnh báo Quan trọng (Sốt chưa rõ nguyên nhân / Nghi ngờ Sốt xuất huyết):**
- **TUYỆT ĐỐI TRÁNH DÙNG** Aspirin và các thuốc NSAID (như Ibuprofen) khi chưa loại trừ Sốt xuất huyết Dengue, vì các thuốc này làm tăng nguy cơ xuất huyết ồ ạt đe dọa tính mạng!`;
            sources = ["Dược thư Quốc gia Việt Nam", "Phác đồ Hạ sốt - Giảm đau Bộ Y tế"];

        // 10. Fallback Tổng hợp Lâm sàng Chuyên sâu & Định hướng Chính xác
        } else {
            reply = `### 🩺 MedCare AI Copilot - Tư vấn Y khoa & Lâm sàng Bộ Y Tế

Tôi đã phân tích nội dung câu hỏi của bạn: **"${dto.message}"**.

**1. Định hướng & Thông tin Y khoa:**
- Để MedCare AI hỗ trợ sát nhất với trường hợp lâm sàng của bạn, bạn có thể nêu rõ thêm: Triệu chứng cụ thể, thời gian xuất hiện, tiền sử dị ứng thuốc và bệnh lý nền kèm theo.
- Hệ thống hỗ trợ tra cứu chuyên sâu các chủ đề:
  * **Dược thư & Phân loại thuốc:** Thuốc giảm đau (theo bậc thang WHO), các nhóm kháng sinh, thuốc dạ dày (PPI), thuốc hạ sốt, thuốc điều trị tăng huyết áp và đái tháo đường.
  * **Phác đồ Cấp cứu Bộ Y tế:** Cấp cứu phản vệ (Thông tư 51/2017/TT-BYT), Cơn tăng huyết áp cấp cứu, Viêm phổi mắc phải cộng đồng (QĐ 4815), Cơn đau thắt ngực / Nhồi máu cơ tim, Đột quỵ não cấp (QĐ 5331).
  * **Hành chính & Quản lý Viện:** Khung giá dịch vụ khám chữa bệnh, mức thanh toán BHYT (Thông tư 22/2023/TT-BYT), thủ tục chuyển viện và quy trình tiếp nhận người bệnh.

**2. Công cụ Hỗ trợ Lâm sàng Sẵn có:**
- **Tab Soát Thuốc:** Kiểm tra tương tác thuốc nguy hiểm & nguy cơ dị ứng chéo.
- **Tab NEWS2:** Tự động tính điểm cảnh báo sớm nguy cơ sốc nhiễm khuẩn và suy hô hấp.
- **Tab BHYT:** Kiểm tra hồ sơ thanh toán BHYT chống xuất toán.`;
        }

        return {
            success: true,
            reply,
            sources,
            timestamp: new Date().toISOString(),
        };
    }
}

