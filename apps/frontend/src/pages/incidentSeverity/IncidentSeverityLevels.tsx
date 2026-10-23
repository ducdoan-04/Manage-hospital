import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/authUi/input";
import { incidentSeverityService, type IncidentSeverityDTO } from "@/services/incidentSeverity";

const DEFAULT_DESCRIPTIONS: Record<string, string> = {
    Minor: "Sự cố nguy cơ thấp, không gây tổn thương hoặc không yêu cầu can thiệp lâm sàng.",
    Moderate: "Tổn thương mức độ vừa cần xử trí y tế tại chỗ, không kéo dài thời gian nằm viện.",
    Major: "Tổn thương nghiêm trọng cần can thiệp lâm sàng tích cực hoặc chuyển khoa hồi sức tích cực.",
    Critical: "Biến cố đe dọa tính mạng người bệnh, yêu cầu kích hoạt báo động đỏ khẩn cấp toàn viện.",
};

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

export default function IncidentSeverityLevels() {
    const [levels, setLevels] = useState<IncidentSeverityDTO[]>([]);
    const [originalLevels, setOriginalLevels] = useState<IncidentSeverityDTO[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        void loadLevels();
    }, []);

    async function loadLevels() {
        setIsLoading(true);
        setError("");
        try {
            const data = await incidentSeverityService.getAll();
            const normalized = data.map((level) => ({
                ...level,
                description: level.description ?? DEFAULT_DESCRIPTIONS[level.levelName] ?? "",
            }));
            setLevels(normalized);
            setOriginalLevels(normalized);
        } catch (loadError) {
            setError((loadError as Error).message);
        } finally {
            setIsLoading(false);
        }
    }

    function updateDescription(id: number, description: string) {
        setLevels((current) => current.map((level) => (level.id === id ? { ...level, description } : level)));
    }

    async function saveChanges() {
        setIsSaving(true);
        setMessage("");
        setError("");
        try {
            const changedLevels = levels.filter((level) => {
                const original = originalLevels.find((item) => item.id === level.id);
                return original?.description !== level.description;
            });
            await Promise.all(
                changedLevels.map((level) =>
                    incidentSeverityService.update(level.id, {
                        description: level.description,
                    }),
                ),
            );
            setOriginalLevels(levels);
            setMessage("Đã lưu mô tả phân cấp mức độ sự cố y khoa thành công.");
        } catch (saveError) {
            setError((saveError as Error).message);
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="mx-auto max-w-6xl font-sans">
            <div className="mb-6">
                <div className="mb-1 text-sm font-medium text-slate-500">Hệ thống &gt; Mức độ Sự cố Y khoa</div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Phân cấp Mức độ Sự cố Y khoa</h1>
                <p className="mt-1 text-sm text-slate-500">Hệ thống phân cấp 4 mức độ sự cố y khoa theo quy định an toàn người bệnh của Bộ Y tế.</p>
            </div>

            <div className="mb-6 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
                <Info className="h-5 w-5 flex-shrink-0 text-blue-600" />
                <p className="text-sm font-semibold text-blue-800">Chỉ có thể điều chỉnh mô tả định nghĩa. Cơ chế khóa bệnh án tự động được thiết lập mặc định theo cấp độ nguy cơ.</p>
            </div>

            {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            {message && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                        <tr>
                            <th className="w-56 px-6 py-3">Mức độ phân loại</th>
                            <th className="px-6 py-3">Mô tả định nghĩa lâm sàng</th>
                            <th className="w-48 px-6 py-3">Khóa hồ sơ bệnh án</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {isLoading ? (
                            <tr>
                                <td colSpan={3} className="px-6 py-10 text-center text-slate-500">
                                    Đang tải cấu hình mức độ sự cố...
                                </td>
                            </tr>
                        ) : (
                            levels.map((level) => (
                                <tr key={level.id} className="hover:bg-slate-50/60 transition-colors">
                                    <td className="px-6 py-5">
                                        <Badge className={badgeClass(level.levelName)}>
                                            {SEVERITY_TRANSLATION[level.levelName] ?? level.levelName}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-5">
                                        <Input
                                            value={level.description ?? ""}
                                            onChange={(event) => updateDescription(level.id, event.target.value)}
                                            placeholder="Nhập mô tả định nghĩa mức độ sự cố..."
                                        />
                                    </td>
                                    <td className="px-6 py-5">
                                        {level.chartLockTrigger ? (
                                            <span className="inline-flex items-center gap-1.5 font-bold text-red-600">
                                                <span className="h-2 w-2 rounded-full bg-red-500" />
                                                Tự động khóa ngay
                                            </span>
                                        ) : (
                                            <span className="text-slate-500 font-medium">Không kích hoạt</span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-6 pb-10">
                <Button type="button" variant="outline" onClick={() => setLevels(originalLevels)} disabled={isSaving} className="font-semibold">
                    Hủy bỏ
                </Button>
                <Button type="button" onClick={() => void saveChanges()} disabled={isSaving || isLoading} className="bg-blue-600 hover:bg-blue-700 font-semibold text-white">
                    {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
                </Button>
            </div>
        </div>
    );
}
