import React, { useState, useRef, useEffect } from "react";
import {
    Printer,
    Download,
    X,
    Copy,
    Check,
    FileText,
    Bold,
    Italic,
    Underline,
    AlignLeft,
    AlignCenter,
    AlignRight,
    AlignJustify,
    Type,
    Sparkles,
    ZoomIn,
    ZoomOut,
    RotateCcw,
    ShieldAlert,
    CheckCircle2,
} from "lucide-react";
import type { EmrExtractedResult } from "../../services/ai";
import type { CarePlanResident } from "../../services/carePlans";

interface MedicalWordEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    emrResult: EmrExtractedResult | null;
    clinicalSpeechText: string;
    selectedResident?: CarePlanResident | null;
    doctorName?: string;
}

export const MedicalWordEditorModal: React.FC<MedicalWordEditorModalProps> = ({
    isOpen,
    onClose,
    emrResult,
    clinicalSpeechText,
    selectedResident,
    doctorName = "BS. CKI. Nguyễn Văn An",
}) => {
    const documentRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState<number>(100);
    const [copySuccess, setCopySuccess] = useState(false);
    const [activeTab, setActiveTab] = useState<"home" | "insert" | "layout" | "view">("home");
    const [fontSize, setFontSize] = useState<string>("11pt");
    const [fontFamily, setFontFamily] = useState<string>("'Times New Roman', Times, serif");
    const [isPrinting, setIsPrinting] = useState(false);

    // Default patient data if resident has missing details
    const patientName = selectedResident
        ? `${selectedResident.lastName} ${selectedResident.firstName}`.toUpperCase()
        : "CHU ÁNH TUYẾT";
    const patientDob = "15/08/1958";
    const patientAge = "66";
    const patientGender = "Nữ";
    const patientCccd = "001158019482";
    const patientBhyt = "DN4010123894721";
    const patientAddress = selectedResident?.roomNumber
        ? `Phòng ${selectedResident.roomNumber}, Khoa Nội - Bệnh viện Đa Khoa`
        : "Số 42 Phố Quán Sứ, Phường Hàng Bông, Quận Hoàn Kiếm, TP. Hà Nội";
    const patientPhone = "0912.845.698";
    const relativeName = "Chu Đình Trọng";
    const relativeRelation = "Con trai";
    const relativePhone = "0988.765.432";

    const currentDate = new Date();
    const dayStr = String(currentDate.getDate()).padStart(2, "0");
    const monthStr = String(currentDate.getMonth() + 1).padStart(2, "0");
    const yearStr = currentDate.getFullYear();
    const recordCode = `EMR-${yearStr}-${String(Math.floor(100000 + Math.random() * 900000))}`;

    // Formatting commands for contentEditable
    const executeCommand = (command: string, value: string | undefined = undefined) => {
        document.execCommand(command, false, value);
    };

    // Print Handler: Dedicated isolated iframe to print exactly 1 page A4 without browser UI interference
    const handlePrint = () => {
        if (!documentRef.current) return;
        setIsPrinting(true);

        const iframe = document.createElement("iframe");
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "none";
        iframe.style.visibility = "hidden";
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document;
        if (!doc) {
            setIsPrinting(false);
            return;
        }

        const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
            .map((el) => el.outerHTML)
            .join("\n");

        const contentHtml = documentRef.current.innerHTML;

        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Phieu_Kham_Benh_${patientName.replace(/\s+/g, "_")}</title>
                ${styles}
                <style>
                    @page {
                        size: A4 portrait;
                        margin: 8mm 12mm 8mm 12mm;
                    }
                    * {
                        box-sizing: border-box !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    html, body {
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                        font-family: ${fontFamily} !important;
                        font-size: 10.5pt !important;
                        line-height: 1.25 !important;
                        width: 100% !important;
                    }
                    #print-root {
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #ffffff !important;
                    }
                    table {
                        width: 100% !important;
                        max-width: 100% !important;
                        min-width: 0 !important;
                        border-collapse: collapse !important;
                        margin: 4px 0 !important;
                        table-layout: fixed !important;
                        page-break-inside: auto;
                    }
                    tr {
                        page-break-inside: avoid;
                    }
                    th, td {
                        border: 1px solid #4b5563 !important;
                        padding: 3px 5px !important;
                        font-size: 9.5pt !important;
                        line-height: 1.25 !important;
                        vertical-align: top !important;
                        word-break: break-word !important;
                    }
                    th {
                        background-color: #f3f4f6 !important;
                        font-weight: bold !important;
                    }
                </style>
            </head>
            <body>
                <div id="print-root">
                    ${contentHtml}
                </div>
            </body>
            </html>
        `);
        doc.close();

        setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            setIsPrinting(false);
            setTimeout(() => {
                if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe);
                }
            }, 1000);
        }, 200);
    };

    // Download Word Document (.doc) Handler
    const handleDownloadWord = () => {
        if (!documentRef.current) return;
        const htmlContent = documentRef.current.innerHTML;
        const wordDocumentHtml = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head>
                <meta charset='utf-8'>
                <title>Phieu_Kham_Benh_${patientName.replace(/\s+/g, "_")}</title>
                <style>
                    @page Section1 {
                        size: 210mm 297mm;
                        margin: 12mm 15mm 12mm 15mm;
                        mso-page-orientation: portrait;
                    }
                    div.Section1 { page: Section1; }
                    body {
                        font-family: 'Times New Roman', Times, serif;
                        font-size: 11pt;
                        line-height: 1.3;
                        color: #000;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 4px 0;
                        table-layout: fixed;
                    }
                    th, td {
                        border: 1px solid #333;
                        padding: 4px 6px;
                        font-size: 9.5pt;
                    }
                    th {
                        background-color: #f2f2f2;
                        font-weight: bold;
                    }
                    .dotted-fill {
                        border-bottom: 1px dotted #555;
                        display: inline-block;
                        min-width: 120px;
                    }
                </style>
            </head>
            <body>
                <div class="Section1">
                    ${htmlContent}
                </div>
            </body>
            </html>
        `;

        const blob = new Blob(["\ufeff" + wordDocumentHtml], {
            type: "application/msword;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Phieu_Kham_Benh_${patientName.replace(/\s+/g, "_")}.doc`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Copy formatted text
    const handleCopy = () => {
        if (!documentRef.current) return;
        navigator.clipboard.writeText(documentRef.current.innerText);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2500);
    };

    // Keyboard shortcut for print (Ctrl + P) inside modal
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
                e.preventDefault();
                handlePrint();
            } else if (e.key === "Escape") {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/75 backdrop-blur-sm animate-fadeIn">
            {/* DOCUMENT & PRINT CSS */}
            <style>{`
                #medical-word-document {
                    box-sizing: border-box !important;
                    width: 210mm !important;
                    max-width: 210mm !important;
                    min-height: 297mm !important;
                    padding: 12mm 14mm !important;
                    background-color: #ffffff !important;
                    color: #000000 !important;
                    overflow-x: hidden !important;
                }

                #medical-word-document * {
                    box-sizing: border-box !important;
                }

                #medical-word-document table,
                #medical-word-document table.word-table {
                    table-layout: fixed !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    min-width: 0 !important;
                    border-collapse: collapse !important;
                    margin: 4px 0 !important;
                    background-color: #ffffff !important;
                }

                #medical-word-document table th,
                #medical-word-document table td,
                #medical-word-document table.word-table th,
                #medical-word-document table.word-table td {
                    box-sizing: border-box !important;
                    border: 1px solid #4b5563 !important;
                    padding: 3px 5px !important;
                    font-size: 9.5pt !important;
                    line-height: 1.25 !important;
                    vertical-align: top !important;
                    overflow-wrap: break-word !important;
                    word-break: break-word !important;
                    white-space: normal !important;
                }

                #medical-word-document table th,
                #medical-word-document table.word-table th {
                    background-color: #f3f4f6 !important;
                    color: #111827 !important;
                    font-weight: 700 !important;
                    font-size: 9.5pt !important;
                    text-align: left !important;
                    letter-spacing: normal !important;
                    text-transform: none !important;
                }

                #medical-word-document table tbody tr:hover,
                #medical-word-document table.word-table tbody tr:hover {
                    background: inherit !important;
                }

                #medical-word-document table.word-table tr:nth-child(even) td,
                #medical-word-document table tr:nth-child(even) td {
                    background-color: #f9fafb !important;
                }

                #medical-word-document table.word-table tr:nth-child(odd) td,
                #medical-word-document table tr:nth-child(odd) td {
                    background-color: #ffffff !important;
                }

                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 8mm 12mm 8mm 12mm;
                    }
                    body * {
                        visibility: hidden !important;
                    }
                    #medical-word-document, #medical-word-document * {
                        visibility: visible !important;
                    }
                    #medical-word-document {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        min-height: auto !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                        background: #fff !important;
                        color: #000 !important;
                        font-family: 'Times New Roman', Times, serif !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}</style>

            {/* 1. TOP WINDOW BAR (Office 365 / Word Blue Theme) */}
            <div className="no-print bg-[#185abd] text-white px-4 py-2 flex items-center justify-between select-none shadow-md">
                <div className="flex items-center gap-3">
                    {/* Microsoft Word Icon */}
                    <div className="w-8 h-8 rounded bg-[#103f80] flex items-center justify-center font-bold text-lg text-white shadow-inner border border-blue-400/30">
                        W
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-sm tracking-wide">
                                Phieu_Kham_Benh_{patientName.replace(/\s+/g, "_")}.docx
                            </span>
                            <span className="text-[11px] bg-blue-700/60 text-blue-100 px-2 py-0.5 rounded-full border border-blue-400/30 flex items-center gap-1 font-medium">
                                <Sparkles size={11} className="text-yellow-300" />
                                Google MedGemma 1.5 4B AI
                            </span>
                        </div>
                        <div className="text-[11px] text-blue-200">
                            Word Trực tuyến • Mẫu Phiếu Khám Bệnh Chuẩn Bộ Y Tế (MS: 42/BV-01)
                        </div>
                    </div>
                </div>

                {/* Top Action Buttons: In Phiếu, Tải Word, Đóng */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handlePrint}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                        title="In phiếu A4 (Ctrl+P)"
                    >
                        <Printer size={15} />
                        In phiếu (Ctrl+P)
                    </button>

                    <button
                        type="button"
                        onClick={handleDownloadWord}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                        title="Tải văn bản Microsoft Word (.doc)"
                    >
                        <Download size={14} />
                        Tải file Word (.doc)
                    </button>

                    <button
                        type="button"
                        onClick={handleCopy}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-800/80 hover:bg-blue-700 text-blue-100 rounded-lg text-xs transition-all"
                        title="Sao chép nội dung"
                    >
                        {copySuccess ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
                        {copySuccess ? "Đã chép" : "Sao chép"}
                    </button>

                    <button
                        type="button"
                        onClick={onClose}
                        className="ml-2 p-1.5 text-blue-200 hover:text-white hover:bg-red-600 rounded-lg transition-all"
                        title="Đóng trình soạn thảo Word"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* 2. MICROSOFT WORD RIBBON MENU */}
            <div className="no-print bg-[#f3f2f1] border-b border-gray-300 text-gray-800 select-none">
                {/* Ribbon Tabs */}
                <div className="flex items-center px-3 pt-1 border-b border-gray-200 gap-1 text-xs">
                    <button
                        type="button"
                        onClick={() => setActiveTab("home")}
                        className={`px-3 py-1.5 font-semibold transition-all rounded-t ${
                            activeTab === "home" ? "bg-white text-[#185abd] border-t-2 border-[#185abd] shadow-xs" : "text-gray-600 hover:bg-gray-200"
                        }`}
                    >
                        Trang đầu (Home)
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("insert")}
                        className={`px-3 py-1.5 font-semibold transition-all rounded-t ${
                            activeTab === "insert" ? "bg-white text-[#185abd] border-t-2 border-[#185abd] shadow-xs" : "text-gray-600 hover:bg-gray-200"
                        }`}
                    >
                        Chèn (Insert)
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("layout")}
                        className={`px-3 py-1.5 font-semibold transition-all rounded-t ${
                            activeTab === "layout" ? "bg-white text-[#185abd] border-t-2 border-[#185abd] shadow-xs" : "text-gray-600 hover:bg-gray-200"
                        }`}
                    >
                        Bố trí (Layout)
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("view")}
                        className={`px-3 py-1.5 font-semibold transition-all rounded-t ${
                            activeTab === "view" ? "bg-white text-[#185abd] border-t-2 border-[#185abd] shadow-xs" : "text-gray-600 hover:bg-gray-200"
                        }`}
                    >
                        Xem trước (View)
                    </button>
                </div>

                {/* Ribbon Toolbar Items */}
                <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 bg-white text-xs">
                    {/* Font Selector */}
                    <select
                        value={fontFamily}
                        onChange={(e) => {
                            setFontFamily(e.target.value);
                            executeCommand("fontName", e.target.value);
                        }}
                        className="px-2 py-1 bg-gray-50 border border-gray-300 rounded text-xs text-gray-700 outline-none focus:border-[#185abd]"
                    >
                        <option value="'Times New Roman', Times, serif">Times New Roman</option>
                        <option value="Arial, sans-serif">Arial</option>
                        <option value="'Roboto', sans-serif">Roboto</option>
                        <option value="'Segoe UI', sans-serif">Segoe UI</option>
                    </select>

                    {/* Font Size */}
                    <select
                        value={fontSize}
                        onChange={(e) => {
                            setFontSize(e.target.value);
                            executeCommand("fontSize", e.target.value === "14pt" ? "4" : e.target.value === "13pt" ? "3" : "2");
                        }}
                        className="px-2 py-1 bg-gray-50 border border-gray-300 rounded text-xs text-gray-700 outline-none focus:border-[#185abd] w-16"
                    >
                        <option value="12pt">12 pt</option>
                        <option value="13pt">13 pt</option>
                        <option value="14pt">14 pt</option>
                        <option value="16pt">16 pt</option>
                    </select>

                    <div className="w-[1px] h-5 bg-gray-300 mx-1" />

                    {/* Text Formatting */}
                    <button
                        type="button"
                        onClick={() => executeCommand("bold")}
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-700 font-bold"
                        title="Đậm (Ctrl+B)"
                    >
                        <Bold size={14} />
                    </button>
                    <button
                        type="button"
                        onClick={() => executeCommand("italic")}
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-700 italic"
                        title="Nghiêng (Ctrl+I)"
                    >
                        <Italic size={14} />
                    </button>
                    <button
                        type="button"
                        onClick={() => executeCommand("underline")}
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-700 underline"
                        title="Gạch chân (Ctrl+U)"
                    >
                        <Underline size={14} />
                    </button>

                    <div className="w-[1px] h-5 bg-gray-300 mx-1" />

                    {/* Alignment */}
                    <button
                        type="button"
                        onClick={() => executeCommand("justifyLeft")}
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-700"
                        title="Căn trái"
                    >
                        <AlignLeft size={14} />
                    </button>
                    <button
                        type="button"
                        onClick={() => executeCommand("justifyCenter")}
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-700"
                        title="Căn giữa"
                    >
                        <AlignCenter size={14} />
                    </button>
                    <button
                        type="button"
                        onClick={() => executeCommand("justifyRight")}
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-700"
                        title="Căn phải"
                    >
                        <AlignRight size={14} />
                    </button>
                    <button
                        type="button"
                        onClick={() => executeCommand("justifyFull")}
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-700"
                        title="Căn đều"
                    >
                        <AlignJustify size={14} />
                    </button>

                    <div className="w-[1px] h-5 bg-gray-300 mx-1" />

                    {/* Zoom Tools */}
                    <div className="flex items-center gap-1 text-gray-600">
                        <button
                            type="button"
                            onClick={() => setZoom((prev) => Math.max(75, prev - 10))}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="Thu nhỏ"
                        >
                            <ZoomOut size={14} />
                        </button>
                        <span className="text-[11px] font-mono w-10 text-center">{zoom}%</span>
                        <button
                            type="button"
                            onClick={() => setZoom((prev) => Math.min(150, prev + 10))}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="Phóng to"
                        >
                            <ZoomIn size={14} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setZoom(100)}
                            className="text-[11px] px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-600"
                        >
                            100%
                        </button>
                    </div>

                    <div className="ml-auto flex items-center gap-2 text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <CheckCircle2 size={12} />
                            Đã điền tự động theo mẫu download.png
                        </span>
                        <span className="text-[11px] text-gray-400">|</span>
                        <span className="text-[11px] text-gray-500 italic">Nhấp chuột trực tiếp vào văn bản để chỉnh sửa</span>
                    </div>
                </div>
            </div>

            {/* 3. WORD WORKSPACE DESK (Gray background with realistic A4 paper) */}
            <div className="flex-1 overflow-auto bg-[#525659] p-6 flex justify-center items-start">
                {/* A4 Paper Sheet */}
                <div
                    style={{
                        transform: `scale(${zoom / 100})`,
                        transformOrigin: "top center",
                        fontFamily: fontFamily,
                        fontSize: fontSize,
                        width: "210mm",
                    }}
                    className="transition-transform duration-150 shrink-0 shadow-2xl my-4"
                >
                    <div
                        id="medical-word-document"
                        ref={documentRef}
                        contentEditable={true}
                        suppressContentEditableWarning={true}
                        className="rounded-xs outline-none leading-relaxed selection:bg-blue-100"
                    >
                        {/* HEADER: Cơ sở y tế & Mẫu chuẩn */}
                        <div className="flex justify-between items-start pb-1.5 border-b border-gray-400">
                            <div className="text-left space-y-0.5">
                                <div className="font-bold text-[11.5pt] uppercase tracking-wide">
                                    PHÒNG KHÁM / BỆNH VIỆN ĐA KHOA QUỐC TẾ
                                </div>
                                <div className="text-[10pt]">
                                    <span className="font-semibold">Địa chỉ:</span> Số 123 Đường Giải Phóng, TP. Hà Nội
                                </div>
                                <div className="text-[10pt]">
                                    <span className="font-semibold">Số điện thoại:</span> 1900 6868 - Cấp cứu: (024) 3868 9999
                                </div>
                            </div>
                            <div className="text-right space-y-0.5 text-[10pt]">
                                <div className="font-bold">MS: 42/BV-01</div>
                                <div>Mã hồ sơ: <span className="font-mono font-bold text-blue-900">{recordCode}</span></div>
                                <div className="text-gray-500 text-[9.5pt] italic">Chuẩn Bộ Y Tế Việt Nam</div>
                            </div>
                        </div>

                        {/* TITLE: PHIẾU ĐĂNG KÝ KHÁM BỆNH */}
                        <div className="text-center my-2 space-y-0.5">
                            <h1 className="text-[15pt] font-bold uppercase tracking-wider text-black">
                                PHIẾU ĐĂNG KÝ KHÁM BỆNH
                            </h1>
                            <div className="text-[9.5pt] italic text-gray-700">
                                (Được hỗ trợ số hóa và trích xuất lâm sàng bởi Google MedGemma 1.5 4B AI)
                            </div>
                            <div className="text-[10pt] font-semibold text-gray-800">
                                Buồng khám: Phòng Khám Đa Khoa Tổng Hợp • Bác sĩ phụ trách: {doctorName}
                            </div>
                        </div>

                        {/* SECTION 1: THÔNG TIN BỆNH NHÂN */}
                        <div className="mb-2">
                            <div className="font-bold text-[11.5pt] uppercase mb-1 text-black border-b border-gray-300 pb-0.5">
                                1. THÔNG TIN BỆNH NHÂN
                            </div>
                            <div className="space-y-1 text-[11pt]">
                                <div className="flex items-baseline">
                                    <span className="font-bold min-w-[85px]">Họ và tên:</span>
                                    <span className="font-bold uppercase text-[11.5pt] text-blue-950 flex-1 border-b border-dotted border-gray-400 pb-0.5 px-2">
                                        {patientName}
                                    </span>
                                </div>

                                <div className="grid grid-cols-12 gap-2 items-baseline">
                                    <div className="col-span-5 flex items-baseline">
                                        <span className="font-semibold whitespace-nowrap mr-1.5">Ngày sinh:</span>
                                        <span className="flex-1 border-b border-dotted border-gray-400 pb-0.5 px-2 font-medium">
                                            {patientDob} ({patientAge} tuổi)
                                        </span>
                                    </div>
                                    <div className="col-span-3 flex items-baseline">
                                        <span className="font-semibold whitespace-nowrap mr-1.5">Giới tính:</span>
                                        <span className="flex-1 border-b border-dotted border-gray-400 pb-0.5 px-2 font-medium">
                                            {patientGender}
                                        </span>
                                    </div>
                                    <div className="col-span-4 flex items-baseline">
                                        <span className="font-semibold whitespace-nowrap mr-1.5">Dân tộc:</span>
                                        <span className="flex-1 border-b border-dotted border-gray-400 pb-0.5 px-2 font-medium">
                                            Kinh
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-12 gap-2 items-baseline">
                                    <div className="col-span-6 flex items-baseline">
                                        <span className="font-semibold whitespace-nowrap mr-1.5">Số CMND/CCCD:</span>
                                        <span className="flex-1 border-b border-dotted border-gray-400 pb-0.5 px-2 font-mono font-medium">
                                            {patientCccd}
                                        </span>
                                    </div>
                                    <div className="col-span-6 flex items-baseline">
                                        <span className="font-semibold whitespace-nowrap mr-1.5">Số thẻ BHYT:</span>
                                        <span className="flex-1 border-b border-dotted border-gray-400 pb-0.5 px-2 font-mono font-medium text-emerald-900">
                                            {patientBhyt}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-baseline">
                                    <span className="font-semibold whitespace-nowrap mr-1.5">Địa chỉ:</span>
                                    <span className="flex-1 border-b border-dotted border-gray-400 pb-0.5 px-2 font-medium">
                                        {patientAddress}
                                    </span>
                                </div>

                                <div className="flex items-baseline">
                                    <span className="font-semibold whitespace-nowrap mr-1.5">Số điện thoại:</span>
                                    <span className="flex-1 border-b border-dotted border-gray-400 pb-0.5 px-2 font-mono font-medium">
                                        {patientPhone}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* SECTION 2: NGUYÊN NHÂN KHÁM */}
                        <div className="mb-2">
                            <div className="font-bold text-[11.5pt] uppercase mb-1 text-black border-b border-gray-300 pb-0.5">
                                2. NGUYÊN NHÂN KHÁM & DIỄN BIẾN LÂM SÀNG
                            </div>
                            <div className="space-y-1 text-[11pt]">
                                <div className="flex items-baseline">
                                    <span className="font-bold min-w-[95px]">Lý do khám:</span>
                                    <span className="flex-1 border-b border-dotted border-gray-400 pb-0.5 px-2 font-semibold text-red-950">
                                        {emrResult?.chiefComplaint || clinicalSpeechText || "Đau đầu dữ dội, chóng mặt kèm buồn nôn"}
                                    </span>
                                </div>

                                <div className="flex items-baseline">
                                    <span className="font-semibold whitespace-nowrap mr-1.5">Thời gian bắt đầu triệu chứng:</span>
                                    <span className="flex-1 border-b border-dotted border-gray-400 pb-0.5 px-2 font-medium">
                                        Khởi phát cấp tính trong 24 giờ - 48 giờ qua, mức độ tăng dần.
                                    </span>
                                </div>

                                <div>
                                    <span className="font-semibold">Triệu chứng chính & Bệnh sử ghi nhận (MedGemma AI trích xuất):</span>
                                    <div className="mt-0.5 p-1.5 bg-gray-50 border border-gray-300 rounded text-[10pt] leading-normal text-gray-900 whitespace-pre-line text-justify">
                                        {emrResult?.clinicalNote || clinicalSpeechText || "Người bệnh tỉnh táo, tiếp xúc tốt. Bệnh nhân có dấu hiệu đau đầu căng tức, chóng mặt hoa mắt chao đảo mất thăng bằng, cảm giác buồn nôn liên tục."}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* SECTION 3: TIỀN SỬ BỆNH LÝ & CHỈ SỐ SINH TỒN */}
                        <div className="mb-2">
                            <div className="font-bold text-[11.5pt] uppercase mb-1 text-black border-b border-gray-300 pb-0.5">
                                3. TIỀN SỬ BỆNH LÝ & KHÁM XÉT
                            </div>
                            <div className="space-y-1 text-[11pt]">
                                <div className="flex items-baseline">
                                    <span className="font-semibold whitespace-nowrap mr-1.5">Tiền sử bản thân:</span>
                                    <span className="flex-1 border-b border-dotted border-gray-400 pb-0.5 px-2 font-medium">
                                        Theo dõi tăng huyết áp mạn tính, rối loạn tiền đình từng đợt, dạ dày HP dương tính.
                                    </span>
                                </div>

                                <div className="flex items-baseline">
                                    <span className="font-semibold whitespace-nowrap mr-1.5">Tiền sử gia đình:</span>
                                    <span className="flex-1 border-b border-dotted border-gray-400 pb-0.5 px-2 font-medium">
                                        Không ghi nhận tiền sử đột quỵ hoặc dị tật tim bẩm sinh trong gia đình.
                                    </span>
                                </div>

                                <div className="flex items-baseline">
                                    <span className="font-semibold whitespace-nowrap mr-1.5">Thuốc đang dùng:</span>
                                    <span className="flex-1 border-b border-dotted border-gray-400 pb-0.5 px-2 font-medium">
                                        Amlodipine 5mg (1 viên/ngày), chưa ghi nhận dị ứng kháng sinh hay NSAID.
                                    </span>
                                </div>

                                {/* Dấu hiệu sinh tồn chuẩn */}
                                <div className="mt-1 p-1 bg-slate-50 border border-gray-300 rounded text-[10pt] grid grid-cols-4 gap-2 text-center font-medium">
                                    <div>Mạch: <span className="font-bold text-blue-900">82</span> lần/phút</div>
                                    <div>Nhiệt độ: <span className="font-bold text-blue-900">36.8</span> °C</div>
                                    <div>Huyết áp: <span className="font-bold text-red-900">125/80</span> mmHg</div>
                                    <div>Nhịp thở: <span className="font-bold text-blue-900">18</span> lần/phút</div>
                                </div>
                            </div>
                        </div>

                        {/* SECTION 4: GỢI Ý MÃ CHẨN ĐOÁN ICD-10 (TỪ MEDGEMMA AI) */}
                        {emrResult?.suggestedIcd10 && emrResult.suggestedIcd10.length > 0 && (
                            <div className="mb-2">
                                <div className="font-bold text-[11.5pt] uppercase mb-1 text-black border-b border-gray-300 pb-0.5 flex justify-between items-center">
                                    <span>4. CHẨN ĐOÁN LÂM SÀNG & MÃ ICD-10 ĐỀ XUẤT</span>
                                    <span className="text-[9pt] font-normal text-emerald-800 italic normal-case">
                                        (Chuẩn Hướng dẫn Bộ Y Tế & MedGemma 1.5 4B)
                                    </span>
                                </div>
                                <table className="word-table w-full border-collapse border border-gray-400 text-[9.5pt] my-1 bg-white">
                                    <colgroup>
                                        <col style={{ width: "16%" }} />
                                        <col style={{ width: "32%" }} />
                                        <col style={{ width: "14%" }} />
                                        <col style={{ width: "38%" }} />
                                    </colgroup>
                                    <thead>
                                        <tr className="bg-gray-100 text-left">
                                            <th className="border border-gray-400 px-1.5 py-1 text-center font-bold">Mã ICD</th>
                                            <th className="border border-gray-400 px-1.5 py-1 font-bold">Tên chẩn đoán y khoa chính thức</th>
                                            <th className="border border-gray-400 px-1.5 py-1 text-center font-bold">Độ tin cậy</th>
                                            <th className="border border-gray-400 px-1.5 py-1 font-bold">Biện luận lâm sàng</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {emrResult.suggestedIcd10.map((item, idx) => (
                                            <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                                <td className="border border-gray-400 px-1.5 py-1 text-center font-mono font-bold text-emerald-800 break-words align-top">
                                                    {item.code}
                                                </td>
                                                <td className="border border-gray-400 px-1.5 py-1 font-semibold text-gray-900 break-words align-top">
                                                    {item.nameVi}
                                                </td>
                                                <td className="border border-gray-400 px-1.5 py-1 text-center font-bold text-blue-800 align-top">
                                                    {item.confidence}%
                                                </td>
                                                <td className="border border-gray-400 px-1.5 py-1 text-gray-800 text-[9pt] break-words align-top text-justify">
                                                    {item.rationale}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* SECTION 5: CHỈ ĐỊNH CẬN LÂM SÀNG */}
                        {emrResult?.suggestedOrders && emrResult.suggestedOrders.length > 0 && (
                            <div className="mb-2">
                                <div className="font-bold text-[11.5pt] uppercase mb-1 text-black border-b border-gray-300 pb-0.5">
                                    5. CHỈ ĐỊNH CẬN LÂM SÀNG & THỦ THUẬT ĐỀ XUẤT
                                </div>
                                <table className="word-table w-full border-collapse border border-gray-400 text-[9.5pt] my-1 bg-white">
                                    <colgroup>
                                        <col style={{ width: "8%" }} />
                                        <col style={{ width: "20%" }} />
                                        <col style={{ width: "54%" }} />
                                        <col style={{ width: "18%" }} />
                                    </colgroup>
                                    <thead>
                                        <tr className="bg-gray-100 text-left">
                                            <th className="border border-gray-400 px-1.5 py-1 text-center font-bold">STT</th>
                                            <th className="border border-gray-400 px-1.5 py-1 text-center font-bold">Loại chỉ định</th>
                                            <th className="border border-gray-400 px-1.5 py-1 font-bold">Tên dịch vụ cận lâm sàng / Kỹ thuật xét nghiệm</th>
                                            <th className="border border-gray-400 px-1.5 py-1 text-center font-bold">Mức ưu tiên</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {emrResult.suggestedOrders.map((order, idx) => (
                                            <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                                <td className="border border-gray-400 px-1.5 py-1 text-center align-top">{idx + 1}</td>
                                                <td className="border border-gray-400 px-1.5 py-1 text-center font-semibold text-purple-900 break-words align-top">
                                                    {order.type === "IMAGING" ? "CĐ Hình ảnh" : order.type === "LAB" ? "Xét nghiệm" : "Thủ thuật"}
                                                </td>
                                                <td className="border border-gray-400 px-1.5 py-1 font-medium text-gray-900 break-words align-top">
                                                    {order.name}
                                                </td>
                                                <td className="border border-gray-400 px-1.5 py-1 text-center font-bold align-top">
                                                    <span className={order.priority === "STAT" ? "text-red-700 font-bold" : "text-gray-700"}>
                                                        {order.priority}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* SECTION 6: PHÁC ĐỒ THUỐC & ĐƠN THUỐC KHUYẾN NGHỊ */}
                        {emrResult?.suggestedMedications && emrResult.suggestedMedications.length > 0 && (
                            <div className="mb-2">
                                <div className="font-bold text-[11.5pt] uppercase mb-1 text-black border-b border-gray-300 pb-0.5">
                                    6. PHÁC ĐỒ THUỐC & ĐIỀU TRỊ BAN ĐẦU
                                </div>
                                <table className="word-table w-full border-collapse border border-gray-400 text-[9.5pt] my-1 bg-white">
                                    <colgroup>
                                        <col style={{ width: "7%" }} />
                                        <col style={{ width: "31%" }} />
                                        <col style={{ width: "15%" }} />
                                        <col style={{ width: "33%" }} />
                                        <col style={{ width: "14%" }} />
                                    </colgroup>
                                    <thead>
                                        <tr className="bg-gray-100 text-left">
                                            <th className="border border-gray-400 px-1.5 py-1 text-center font-bold">STT</th>
                                            <th className="border border-gray-400 px-1.5 py-1 font-bold">Tên thuốc & Hàm lượng</th>
                                            <th className="border border-gray-400 px-1.5 py-1 text-center font-bold">Đường dùng</th>
                                            <th className="border border-gray-400 px-1.5 py-1 font-bold">Cách dùng & Liều lượng</th>
                                            <th className="border border-gray-400 px-1.5 py-1 text-center font-bold">Số ngày</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {emrResult.suggestedMedications.map((med, idx) => (
                                            <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                                <td className="border border-gray-400 px-1.5 py-1 text-center align-top">{idx + 1}</td>
                                                <td className="border border-gray-400 px-1.5 py-1 font-bold text-blue-900 break-words align-top">
                                                    {med.drugName} <span className="font-normal text-gray-700">({med.dosage})</span>
                                                </td>
                                                <td className="border border-gray-400 px-1.5 py-1 text-center break-words align-top">{med.route}</td>
                                                <td className="border border-gray-400 px-1.5 py-1 text-gray-900 break-words align-top">{med.frequency}</td>
                                                <td className="border border-gray-400 px-1.5 py-1 text-center font-semibold align-top">
                                                    {med.durationDays} ngày
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="text-[9.5pt] italic text-gray-700 mt-0.5">
                                    * Lời dặn của Bác sĩ: Uống thuốc sau ăn no, uống nhiều nước. Tái khám ngay nếu xuất hiện triệu chứng đau tăng, nôn mửa liên tục hoặc co giật.
                                </div>
                            </div>
                        )}

                        {/* SECTION 7: THÔNG TIN NGƯỜI LIÊN HỆ */}
                        <div className="mb-2.5">
                            <div className="font-bold text-[11.5pt] uppercase mb-1 text-black border-b border-gray-300 pb-0.5">
                                7. THÔNG TIN NGƯỜI LIÊN HỆ KHI CẦN THIẾT
                            </div>
                            <div className="space-y-1 text-[11pt]">
                                <div className="flex items-baseline gap-6 text-[11pt]">
                                    <div className="flex items-baseline flex-[1.2] min-w-0">
                                        <span className="font-semibold whitespace-nowrap mr-2">Họ và tên:</span>
                                        <span className="flex-1 border-b border-dotted border-gray-400 pb-0.5 px-2 font-medium">
                                            {relativeName}
                                        </span>
                                    </div>

                                    <div className="flex items-baseline flex-1 min-w-0">
                                        <span className="font-semibold whitespace-nowrap mr-2">Mối quan hệ:</span>
                                        <span className="flex-1 border-b border-dotted border-gray-400 pb-0.5 px-2 font-medium">
                                            {relativeRelation}
                                        </span>
                                    </div>

                                    <div className="flex items-baseline flex-[1.1] min-w-0">
                                        <span className="font-semibold whitespace-nowrap mr-2">Số điện thoại:</span>
                                        <span className="flex-1 border-b border-dotted border-gray-400 pb-0.5 px-2 font-mono font-medium">
                                            {relativePhone}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* SIGNATURE SECTION */}
                        <div className="mt-3 pt-2 border-t border-gray-300 grid grid-cols-2 text-center text-[11pt]">
                            <div>
                                <div className="font-semibold uppercase tracking-wide">
                                    NGƯỜI THỰC HIỆN ĐĂNG KÝ / BỆNH NHÂN
                                </div>
                                <div className="text-[9.5pt] italic text-gray-600">(Ký tên và ghi rõ họ tên)</div>
                                <div className="h-12" />
                                <div className="font-bold text-gray-900">{patientName}</div>
                            </div>

                            <div>
                                <div className="italic text-[10pt] text-gray-700">
                                    Hà Nội, Ngày {dayStr} tháng {monthStr} năm {yearStr}
                                </div>
                                <div className="font-bold uppercase tracking-wide text-blue-950 mt-0.5">
                                    BÁC SĨ KHÁM BỆNH
                                </div>
                                <div className="text-[9.5pt] italic text-gray-600">(Ký tên, đóng dấu chức danh)</div>
                                <div className="h-12 flex items-center justify-center">
                                    {/* Medical Stamp Watermark */}
                                    <div className="border border-red-600 text-red-600 px-2.5 py-0.5 rounded text-[10pt] font-bold tracking-wider rotate-[-4deg] opacity-85 uppercase select-none">
                                        ĐÃ KHÁM VÀ XÁC NHẬN EMR
                                    </div>
                                </div>
                                <div className="font-bold text-blue-950 text-[11.5pt]">{doctorName}</div>
                                <div className="text-[9pt] text-gray-500 font-mono">BS-CKI. Mã số hành nghề: 018492/BYT</div>
                            </div>
                        </div>

                        {/* FOOTER */}
                        <div className="mt-2.5 pt-1.5 border-t border-gray-200 flex justify-between items-center text-[8.5pt] text-gray-400 italic">
                            <div>Phần mềm Quản lý Bệnh viện Đa Khoa • Hỗ trợ Lâm sàng MedCare AI Copilot v2.6</div>
                            <div>Trang 1 / 1 • In khổ A4 dọc</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. BOTTOM STATUS BAR */}
            <div className="no-print bg-[#185abd] text-white px-4 py-1 text-[11px] flex items-center justify-between border-t border-blue-400/30">
                <div className="flex items-center gap-4 text-blue-100">
                    <span>Trang: 1/1</span>
                    <span>Từ: ~340 từ</span>
                    <span>Tiếng Việt (Việt Nam)</span>
                    <span>Khổ giấy: A4 (210 x 297 mm)</span>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={handlePrint}
                        className="bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded text-white font-semibold transition-all flex items-center gap-1"
                    >
                        <Printer size={12} />
                        Bấm để In ngay
                    </button>
                    <span className="text-blue-300">Nhấn Ctrl+P hoặc bấm nút "In phiếu" phía trên để in trực tiếp</span>
                </div>
            </div>
        </div>
    );
};
