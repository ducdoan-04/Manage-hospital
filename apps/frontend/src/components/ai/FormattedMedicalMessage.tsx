import React, { useState } from "react";
import {
    AlertTriangle,
    BookOpen,
    Check,
    CheckCircle2,
    ClipboardList,
    Copy,
    Info,
    Sparkles,
    Stethoscope,
} from "lucide-react";

interface FormattedMedicalMessageProps {
    content: string;
    sources?: string[];
    time?: string;
    hideHeader?: boolean;
    hideFooter?: boolean;
}

/**
 * Render inline markdown tokens: **bold**, `code`, etc.
 */
export function renderInlineTokens(text: string): React.ReactNode {
    if (!text) return null;

    // Split by bold (**bold text**)
    const parts = text.split(/(\*\*.*?\*\*)/g);

    return parts.map((part, idx) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
            const inner = part.slice(2, -2);
            return (
                <strong key={idx} className="font-bold text-slate-900">
                    {inner}
                </strong>
            );
        }

        // Handle `code` inside
        if (part.includes("`")) {
            const codeParts = part.split(/(`.*?`)/g);
            return (
                <span key={idx}>
                    {codeParts.map((cPart, cIdx) => {
                        if (cPart.startsWith("`") && cPart.endsWith("`") && cPart.length >= 2) {
                            return (
                                <code
                                    key={cIdx}
                                    className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[11px] text-teal-800 border border-slate-200"
                                >
                                    {cPart.slice(1, -1)}
                                </code>
                            );
                        }
                        return cPart;
                    })}
                </span>
            );
        }

        return part;
    });
}

/**
 * Beautiful Clinical Markdown Formatter
 */
export function FormattedMedicalMessage({ content, sources, time, hideHeader, hideFooter }: FormattedMedicalMessageProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Clean up content and remove duplicate colons
    const cleanText = content
        .replace(/<unused\d+>thought[\s\S]*?(?:<\/thought>|<unused\d+>|$)/gi, "")
        .replace(/^thought\s+Here's a thinking process[\s\S]*?(?:\n\n(?=[A-ZÀ-Ỹ0-9*#])|$)/i, "")
        .replace(/<[^>]+>/g, "")
        .replace(/::+/g, ":") // Clean up double colons like ::
        .replace(/\*\*:\s*:/g, "**:")
        // Tự động ngắt dòng nếu mô hình sinh các mục dính liền một hàng
        .replace(/\s*(\*\*(?:Đánh giá|Phân tích|Định hướng chẩn đoán|Cận lâm sàng(?: cần làm ngay)?|Triệu chứng(?: chính)?|Dấu hiệu sinh tồn|Tiền sử|Phác đồ|Điều trị|Đơn thuốc)[^*]*:\*\*)/gi, "\n\n$1\n")
        .replace(/\s*\*\s*\*\*/g, "\n* **")
        .replace(/\s*\*\s*(?=[A-ZÀ-Ỹ])/g, "\n* ")
        .replace(/\s*(\d+\.)\s*\*\*/g, "\n$1 **")
        .trim();

    // Split text into lines
    const lines = cleanText.split("\n");

    type BlockType =
        | { type: "section-header"; kind: "analysis" | "treatment" | "warning" | "general"; title: string }
        | { type: "numbered-step"; num: string; title?: string; body: string }
        | { type: "bullet-item"; level: number; title?: string; body: string }
        | { type: "paragraph"; text: string }
        | { type: "spacer" };

    const blocks: BlockType[] = [];

    for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        const line = rawLine.trim();

        if (!line) {
            if (blocks.length > 0 && blocks[blocks.length - 1].type !== "spacer") {
                blocks.push({ type: "spacer" });
            }
            continue;
        }

        // 1. Detect Section Header: e.g. **Phân tích:** or **Đánh giá:** or **Lưu ý:**
        const sectionMatch = line.match(/^(\*{0,2})(Phân tích|Lâm sàng|Chẩn đoán|Định hướng chẩn đoán|Đánh giá|Cận lâm sàng|Cận lâm sàng cần làm ngay|Trả lời|Hướng dẫn|Phác đồ|Điều trị|Chỉ định|Khuyến cáo|Lưu ý|Cảnh báo|Chống chỉ định|Thận trọng)([\s:]*)(\*{0,2})$/i);
        if (sectionMatch) {
            const rawTitle = sectionMatch[2];
            const lower = rawTitle.toLowerCase();
            let kind: "analysis" | "treatment" | "warning" | "general" = "general";
            if (lower.includes("phân tích") || lower.includes("lâm sàng") || lower.includes("chẩn đoán") || lower.includes("đánh giá")) {
                kind = "analysis";
            } else if (lower.includes("trả lời") || lower.includes("hướng dẫn") || lower.includes("phác đồ") || lower.includes("điều trị") || lower.includes("chỉ định") || lower.includes("khuyến cáo") || lower.includes("cận lâm sàng")) {
                kind = "treatment";
            } else if (lower.includes("lưu ý") || lower.includes("cảnh báo") || lower.includes("chống chỉ định") || lower.includes("thận trọng")) {
                kind = "warning";
            }
            blocks.push({
                type: "section-header",
                kind,
                title: rawTitle + ":",
            });
            continue;
        }

        // 2. Numbered step: e.g. 1. **Chuẩn bị:** or 1. Chuẩn bị
        const numMatch = line.match(/^(\d+)\.\s+(\*\*([^*]+)\*\*[:\s]*)(.*)$/);
        if (numMatch) {
            blocks.push({
                type: "numbered-step",
                num: numMatch[1],
                title: numMatch[3].replace(/[:\s]+$/, "").trim(),
                body: numMatch[4].replace(/^[:\s]+/, "").trim(),
            });
            continue;
        }

        const simpleNumMatch = line.match(/^(\d+)\.\s+(.*)$/);
        if (simpleNumMatch) {
            blocks.push({
                type: "numbered-step",
                num: simpleNumMatch[1],
                body: simpleNumMatch[2],
            });
            continue;
        }

        // 3. Bullet item: e.g. * **Tiêu đề:** Nội dung hoặc * Nội dung
        const isSubBullet = rawLine.search(/\S/) >= 4 || rawLine.startsWith("\t");
        const bulletMatch = line.match(/^[\*\-]\s+(\*\*([^*]+)\*\*[:\s]*)(.*)$/);
        if (bulletMatch) {
            blocks.push({
                type: "bullet-item",
                level: isSubBullet ? 2 : 1,
                title: bulletMatch[2].replace(/[:\s]+$/, "").trim(),
                body: bulletMatch[3].replace(/^[:\s]+/, "").trim(),
            });
            continue;
        }

        const simpleBulletMatch = line.match(/^[\*\-]\s+(.*)$/);
        if (simpleBulletMatch) {
            blocks.push({
                type: "bullet-item",
                level: isSubBullet ? 2 : 1,
                body: simpleBulletMatch[1],
            });
            continue;
        }

        // 4. Default: regular paragraph
        blocks.push({ type: "paragraph", text: line });
    }

    return (
        <div className="space-y-3 font-sans text-[13px] leading-relaxed text-slate-800">
            {/* Top Toolbar: Model Badge + Copy */}
            {!hideHeader && (
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/80 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1.5 font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/60">
                        <Sparkles size={12} className="text-teal-600" />
                        Google MedGemma 1.5 4B • Bộ Y Tế
                    </span>

                    <button
                        onClick={handleCopy}
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-slate-600 hover:text-teal-700 hover:bg-teal-50 transition-colors font-medium border border-transparent hover:border-teal-200"
                        title="Sao chép nội dung"
                    >
                        {copied ? (
                            <>
                                <Check size={12} className="text-emerald-600" />
                                <span className="text-emerald-600 font-bold">Đã sao chép</span>
                            </>
                        ) : (
                            <>
                                <Copy size={12} />
                                <span>Sao chép</span>
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Content Blocks */}
            <div className="space-y-2.5">
                {blocks.map((block, idx) => {
                    if (block.type === "spacer") {
                        return <div key={idx} className="h-1" />;
                    }

                    if (block.type === "section-header") {
                        if (block.kind === "analysis") {
                            return (
                                <div
                                    key={idx}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-50 border border-sky-200/80 text-sky-900 font-bold text-xs uppercase tracking-wide mt-2"
                                >
                                    <Stethoscope size={15} className="text-sky-600" />
                                    <span>🔬 {block.title}</span>
                                </div>
                            );
                        }

                        if (block.kind === "treatment") {
                            return (
                                <div
                                    key={idx}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200/80 text-emerald-900 font-bold text-xs uppercase tracking-wide mt-3"
                                >
                                    <ClipboardList size={15} className="text-emerald-600" />
                                    <span>📋 {block.title}</span>
                                </div>
                            );
                        }

                        if (block.kind === "warning") {
                            return (
                                <div
                                    key={idx}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200/80 text-amber-900 font-bold text-xs uppercase tracking-wide mt-3"
                                >
                                    <AlertTriangle size={15} className="text-amber-600" />
                                    <span>⚠️ {block.title}</span>
                                </div>
                            );
                        }

                        return (
                            <div
                                key={idx}
                                className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 font-bold text-xs uppercase tracking-wide mt-2"
                            >
                                <Info size={14} className="text-slate-600" />
                                <span>{block.title}</span>
                            </div>
                        );
                    }

                    if (block.type === "numbered-step") {
                        return (
                            <div key={idx} className="flex items-start gap-2.5 pl-1 py-0.5">
                                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-teal-600 text-white font-bold text-[11px] flex items-center justify-center mt-0.5 shadow-sm">
                                    {block.num}
                                </span>
                                <div className="flex-1">
                                    {block.title && (
                                        <span className="font-bold text-slate-900 mr-1.5">
                                            {block.title}:
                                        </span>
                                    )}
                                    <span className="text-slate-800">
                                        {renderInlineTokens(block.body)}
                                    </span>
                                </div>
                            </div>
                        );
                    }

                    if (block.type === "bullet-item") {
                        return (
                            <div
                                key={idx}
                                className={`flex items-start gap-2 py-0.5 ${
                                    block.level === 2 ? "pl-6 text-slate-700" : "pl-1.5"
                                }`}
                            >
                                <span
                                    className={`flex-shrink-0 rounded-full mt-2 ${
                                        block.level === 2
                                            ? "w-1.5 h-1.5 bg-slate-400"
                                            : "w-2 h-2 bg-teal-500 ring-2 ring-teal-100"
                                    }`}
                                />
                                <div className="flex-1">
                                    {block.title && (
                                        <span className="font-bold text-slate-900 mr-1.5">
                                            {block.title}:
                                        </span>
                                    )}
                                    <span className="text-slate-800">
                                        {renderInlineTokens(block.body)}
                                    </span>
                                </div>
                            </div>
                        );
                    }

                    // Regular paragraph
                    return (
                        <p key={idx} className="text-slate-800 leading-relaxed">
                            {renderInlineTokens(block.text)}
                        </p>
                    );
                })}
            </div>

            {/* Sources & Timestamp Footer */}
            {!hideFooter && (sources && sources.length > 0 || time) && (
                <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-slate-600 flex items-center gap-1">
                            <BookOpen size={11} className="text-teal-600" />
                            Nguồn đối chiếu:
                        </span>
                        {(sources && sources.length > 0
                            ? sources
                            : ["Google MedGemma 1.5 4B", "Bộ Y tế", "Dược thư Quốc gia"]
                        ).map((src, sIdx) => (
                            <span
                                key={sIdx}
                                className="px-2 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[10px] border border-slate-200 transition-colors"
                            >
                                {src}
                            </span>
                        ))}
                    </div>

                    {time && <span className="text-[10px] text-slate-400 font-mono">{time}</span>}
                </div>
            )}
        </div>
    );
}
