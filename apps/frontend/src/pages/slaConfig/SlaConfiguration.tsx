import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/authUi/input";
import { slaConfigService, type SlaConfigDTO } from "@/services/slaConfig";

const SEVERITY_TRANSLATION: Record<string, string> = {
    Minor: "Mức 1 - Nhẹ",
    Moderate: "Mức 2 - Trung bình",
    Major: "Mức 3 - Nghiêm trọng",
    Critical: "Mức 4 - Nguy kịch (Báo động đỏ)",
};

function badgeClass(levelName: string): string {
    const normalized = levelName.toLowerCase();
    if (normalized === "critical") return "bg-red-100 text-red-700 border-red-300 font-semibold";
    if (normalized === "major") return "bg-orange-100 text-orange-700 border-orange-300 font-semibold";
    if (normalized === "moderate") return "bg-amber-100 text-amber-700 border-amber-300 font-semibold";
    return "bg-slate-100 text-slate-600 border-slate-300 font-semibold";
}

export default function SlaConfiguration() {
    const [rows, setRows] = useState<SlaConfigDTO[]>([]);
    const [originalRows, setOriginalRows] = useState<SlaConfigDTO[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        void loadRows();
    }, []);

    async function loadRows() {
        setIsLoading(true);
        setError("");
        try {
            const data = await slaConfigService.getAll();
            setRows(data);
            setOriginalRows(data);
        } catch (loadError) {
            setError((loadError as Error).message);
        } finally {
            setIsLoading(false);
        }
    }

    function updateRow(id: number, patch: Partial<SlaConfigDTO>) {
        setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    }

    async function saveChanges() {
        setIsSaving(true);
        setMessage("");
        setError("");
        try {
            const changedRows = rows.filter((row) => {
                const original = originalRows.find((item) => item.id === row.id);
                return JSON.stringify(original) !== JSON.stringify(row);
            });
            await Promise.all(
                changedRows.map((row) =>
                    slaConfigService.update(row.id, {
                        slaWindowHrs: row.slaWindowHrs,
                        externalReportRequired: row.externalReportRequired,
                        regulatoryBody: row.regulatoryBody,
                    }),
                ),
            );
            setOriginalRows(rows);
            setMessage("Đã lưu cấu hình thời hạn SLA thành công.");
        } catch (saveError) {
            setError((saveError as Error).message);
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="mx-auto max-w-6xl font-sans">
            <div className="mb-6">
                <div className="mb-1 text-sm font-medium text-slate-500">Hệ thống &gt; Cấu hình SLA Thời hạn Báo cáo</div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Thời hạn Báo cáo Sự cố Y khoa (SLA)</h1>
                <p className="mt-1 text-sm text-slate-500">Quy định thời hạn báo cáo cơ quan quản lý (Bộ Y tế / Sở Y tế) theo mức độ nghiêm trọng của sự cố y khoa.</p>
            </div>

            <div className="mb-6 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
                <Info className="h-5 w-5 flex-shrink-0 text-blue-600" />
                <p className="text-sm font-semibold text-blue-800">
                    Báo cáo gửi cơ quan quản lý được gửi điện tử theo chuẩn của Bộ Y tế; mã biên nhận và thời gian lưu vết được ghi nhận tự động trong sổ kiểm toán.
                </p>
            </div>

            {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            {message && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                        <tr>
                            <th className="w-56 px-6 py-3">Mức độ nghiêm trọng</th>
                            <th className="px-6 py-3">Báo cáo tuyến trên</th>
                            <th className="px-6 py-3">Thời hạn xử lý (Giờ)</th>
                            <th className="px-6 py-3">Cơ quan tiếp nhận</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {isLoading ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-10 text-center text-slate-500">
                                    Đang tải cấu hình thời hạn SLA...
                                </td>
                            </tr>
                        ) : (
                            rows.map((row) => (
                                <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                                    <td className="px-6 py-5">
                                        <Badge className={badgeClass(row.severity.levelName)}>
                                            {SEVERITY_TRANSLATION[row.severity.levelName] ?? row.severity.levelName}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-5">
                                        <label className="inline-flex items-center gap-2 text-slate-700 font-medium cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                checked={row.externalReportRequired}
                                                onChange={(event) => updateRow(row.id, { externalReportRequired: event.target.checked })}
                                            />
                                            {row.externalReportRequired ? (
                                                <span className="text-blue-700 font-semibold">Bắt buộc báo cáo</span>
                                            ) : (
                                                <span className="text-slate-500">Nội bộ bệnh viện</span>
                                            )}
                                        </label>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="number"
                                                min={0}
                                                disabled={!row.externalReportRequired}
                                                value={row.slaWindowHrs}
                                                onChange={(event) => updateRow(row.id, { slaWindowHrs: Number(event.target.value) })}
                                                className="w-28 font-bold"
                                            />
                                            <span className="text-xs text-slate-500 font-medium">giờ</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <Input
                                            disabled={!row.externalReportRequired}
                                            value={row.regulatoryBody ?? ""}
                                            onChange={(event) => updateRow(row.id, { regulatoryBody: event.target.value })}
                                            placeholder={row.externalReportRequired ? "Ví dụ: Sở Y tế Hà Nội / Cục Quản lý Khám chữa bệnh" : "Không áp dụng"}
                                        />
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-6 pb-10">
                <Button type="button" variant="outline" onClick={() => setRows(originalRows)} disabled={isSaving} className="font-semibold">
                    Hủy bỏ
                </Button>
                <Button type="button" onClick={() => void saveChanges()} disabled={isSaving || isLoading} className="bg-blue-600 hover:bg-blue-700 font-semibold text-white">
                    {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
                </Button>
            </div>
        </div>
    );
}
