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

    // Clean up content and remove duplicate colons/stray thinking
    const cleanText = content
        .replace(/<unused\d+>thought[\s\S]*?(?:<\/thought>|<unused\d+>|$)/gi, "")
        .replace(/^thought\s+Here's a thinking process[\s\S]*?(?:\n\n(?=[A-ZÀ-Ỹ0-9*#])|$)/i, "")
        .replace(/<[^>]+>/g, "")
        .replace(/::+/g, ":") // Clean up double colons like ::
        .replace(/\*\*:\s*:/g, "**:")
        .replace(/\r\n/g, "\n")
        // Tách các dấu đầu dòng nếu bị dính liền trên 1 dòng: "đoạn 1 * đoạn 2" (không làm hỏng **bold**)
        .replace(/([^\n*])\s+([*•-]\s+)/g, "$1\n$2")
        .trim();

    // Split text into lines
    const lines = cleanText.split("\n");

    type BlockType =
        | { type: "heading"; level: number; text: string }
        | { type: "group-header"; title: string }
        | { type: "sub-header"; title: string }
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

        // Bỏ qua các dòng chỉ chứa dấu hoa thị hoặc gạch đầu dòng rác
        if (/^[*•\-—\s]+$/.test(line)) {
            continue;
        }

        // 1. Heading: #, ##, ###, ####
        const headingMatch = line.match(/^(#{1,4})\s+(.*)$/);
        if (headingMatch) {
            const level = headingMatch[1].length;
            const headingText = headingMatch[2].replace(/\*\*$/, "").replace(/^\*\*/, "").trim();
            blocks.push({
                type: "heading",
                level,
                text: headingText,
            });
            continue;
        }

        // 2. Bold Standalone Section Header: e.g. **Thông tin chung:** hoặc **Lưu ý:**
        const isHeaderCandidate =
            (line.startsWith("**") && line.endsWith(":**")) ||
            (line.startsWith("**") && line.endsWith("**") && !line.includes(". ")) ||
            (line.endsWith(":") && line.length < 50 && !line.includes(". ") && !line.startsWith("*") && !line.startsWith("-"));

        if (isHeaderCandidate) {
            const rawTitle = line
                .replace(/^\*+\s*/, "")
                .replace(/\*+[:\s]*$/, "")
                .replace(/[:\s]+$/, "")
                .trim();

            if (rawTitle.length >= 2 && rawTitle.length < 60) {
                const lower = rawTitle.toLowerCase();
                let kind: "analysis" | "treatment" | "warning" | "general" = "general";
                if (
                    lower.includes("lưu ý") ||
                    lower.includes("cảnh báo") ||
                    lower.includes("nguy hiểm") ||
                    lower.includes("chống chỉ định") ||
                    lower.includes("thận trọng") ||
                    lower.includes("tác dụng phụ")
                ) {
                    kind = "warning";
                } else if (
                    lower.includes("phân tích") ||
                    lower.includes("lâm sàng") ||
                    lower.includes("chẩn đoán") ||
                    lower.includes("đánh giá") ||
                    lower.includes("triệu chứng")
                ) {
                    kind = "analysis";
                } else if (
                    lower.includes("phác đồ") ||
                    lower.includes("điều trị") ||
                    lower.includes("xử trí") ||
                    lower.includes("khuyến cáo") ||
                    lower.includes("hướng dẫn") ||
                    lower.includes("cận lâm sàng") ||
                    lower.includes("bác sĩ nên")
                ) {
                    kind = "treatment";
                }

                blocks.push({
                    type: "section-header",
                    kind,
                    title: rawTitle + ":",
                });
                continue;
            }
        }

        // 3. Numbered step: e.g. 1. **Chuẩn bị:** or 1. Chuẩn bị
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

        // 4. Bullet item: e.g. * **Tiêu đề:** Nội dung hoặc * Nội dung
        const isSubBullet = rawLine.search(/\S/) >= 3 || rawLine.startsWith("\t");
        const bulletMatch = line.match(/^[\*\-•]\s+(\*\*([^*]+)\*\*[:\s]*)(.*)$/);
        if (bulletMatch) {
            const title = bulletMatch[2].replace(/[:\s]+$/, "").trim();
            const body = bulletMatch[3].replace(/^[:\s]+/, "").trim();

            // Nếu không có body phía sau (ví dụ `* **Thuốc giảm đau:**`), đây là tiêu đề nhóm/tiểu mục
            if (!body) {
                blocks.push({
                    type: isSubBullet ? "sub-header" : "group-header",
                    title: title + ":",
                });
                continue;
            }

            blocks.push({
                type: "bullet-item",
                level: isSubBullet ? 2 : 1,
                title,
                body,
            });
            continue;
        }

        const simpleBulletMatch = line.match(/^[\*\-•]\s+(.*)$/);
        if (simpleBulletMatch) {
            const rawBody = simpleBulletMatch[1].trim();
            if (rawBody && !/^[*•\-—\s]+$/.test(rawBody)) {
                // Nếu mục không có nội dung giải thích mà chỉ là tên nhóm kết thúc bằng dấu hai chấm
                if (rawBody.endsWith(":") && rawBody.length < 50) {
                    blocks.push({
                        type: isSubBullet ? "sub-header" : "group-header",
                        title: rawBody,
                    });
                    continue;
                }

                blocks.push({
                    type: "bullet-item",
                    level: isSubBullet ? 2 : 1,
                    body: rawBody,
                });
            }
            continue;
        }

        // 5. Default: regular paragraph
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
            <div className="space-y-2">
                {blocks.map((block, idx) => {
                    if (block.type === "spacer") {
                        return <div key={idx} className="h-0.5" />;
                    }

                    if (block.type === "heading") {
                        if (block.level <= 2) {
                            return (
                                <div
                                    key={idx}
                                    className="pt-2 pb-1 border-b border-teal-100 flex items-center gap-2 text-teal-900 font-bold text-sm md:text-[14.5px]"
                                >
                                    <Sparkles size={15} className="text-teal-600 flex-shrink-0" />
                                    <span>{renderInlineTokens(block.text)}</span>
                                </div>
                            );
                        }
                        return (
                            <div
                                key={idx}
                                className="pt-2 text-slate-900 font-bold text-xs md:text-sm flex items-center gap-1.5"
                            >
                                <span className="w-1.5 h-3.5 bg-teal-600 rounded-sm inline-block" />
                                <span>{renderInlineTokens(block.text)}</span>
                            </div>
                        );
                    }

                    if (block.type === "group-header") {
                        return (
                            <div
                                key={idx}
                                className="font-bold text-teal-950 text-[13px] mt-3 pt-1.5 border-t border-slate-100 flex items-center gap-1.5"
                            >
                                <span className="w-1.5 h-3.5 rounded bg-teal-600 inline-block flex-shrink-0" />
                                <span>{renderInlineTokens(block.title)}</span>
                            </div>
                        );
                    }

                    if (block.type === "sub-header") {
                        return (
                            <div
                                key={idx}
                                className="font-semibold text-slate-900 text-[12.5px] mt-1.5 pl-2.5 flex items-center gap-1.5 text-teal-800"
                            >
                                <span className="text-teal-600 font-bold">•</span>
                                <span>{renderInlineTokens(block.title)}</span>
                            </div>
                        );
                    }

                    if (block.type === "section-header") {
                        const cleanTitle = block.title.replace(/^[⚠️🔬📋ℹ️\s*#]+/, "").replace(/[:\s]+$/, "").trim();

                        if (block.kind === "warning") {
                            return (
                                <div
                                    key={idx}
                                    className="flex items-center gap-1.5 text-amber-900 font-bold text-xs uppercase tracking-wide mt-3 pt-1 border-t border-amber-200/50"
                                >
                                    <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
                                    <span>{cleanTitle}:</span>
                                </div>
                            );
                        }

                        if (block.kind === "analysis") {
                            return (
                                <div
                                    key={idx}
                                    className="flex items-center gap-1.5 text-sky-900 font-bold text-xs uppercase tracking-wide mt-2.5"
                                >
                                    <Stethoscope size={14} className="text-sky-600 flex-shrink-0" />
                                    <span>{cleanTitle}:</span>
                                </div>
                            );
                        }

                        if (block.kind === "treatment") {
                            return (
                                <div
                                    key={idx}
                                    className="flex items-center gap-1.5 text-emerald-900 font-bold text-xs uppercase tracking-wide mt-2.5"
                                >
                                    <ClipboardList size={14} className="text-emerald-600 flex-shrink-0" />
                                    <span>{cleanTitle}:</span>
                                </div>
                            );
                        }

                        return (
                            <div
                                key={idx}
                                className="flex items-center gap-1.5 text-slate-700 font-bold text-xs uppercase tracking-wide mt-2"
                            >
                                <Info size={13} className="text-slate-500 flex-shrink-0" />
                                <span>{cleanTitle}:</span>
                            </div>
                        );
                    }

                    if (block.type === "numbered-step") {
                        return (
                            <div key={idx} className="flex items-start gap-2.5 pl-1 py-0.5">
                                <span className="flex-shrink-0 w-4.5 h-4.5 rounded-full bg-teal-600 text-white font-bold text-[10px] flex items-center justify-center mt-0.5 shadow-sm">
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
                        const isSub = block.level >= 2;
                        return (
                            <div
                                key={idx}
                                className={`flex items-start gap-2 py-0.5 ${
                                    isSub ? "pl-5 text-slate-700" : "pl-2 text-slate-800"
                                }`}
                            >
                                <span
                                    className={`flex-shrink-0 rounded-full mt-2 ${
                                        isSub
                                            ? "w-1 h-1 bg-slate-400"
                                            : "w-1.5 h-1.5 bg-slate-500"
                                    }`}
                                />
                                <div className="flex-1 text-[13px] leading-relaxed">
                                    {block.title && (
                                        <strong className="font-bold text-slate-900 mr-1.5">
                                            {block.title}:
                                        </strong>
                                    )}
                                    <span>
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
