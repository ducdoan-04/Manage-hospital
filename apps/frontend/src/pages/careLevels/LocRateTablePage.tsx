import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/authUi/input";
import {
    careLevelsService,
    type CareLevel,
} from "@/services/careLevels";

type CareLevelForm = Record<string, Pick<CareLevel, "dailyRate" | "effectiveFrom">>;

export default function LocRateTablePage() {
    const queryClient = useQueryClient();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<CareLevelForm>({});
    const [message, setMessage] = useState("");
    const [validationError, setValidationError] = useState("");

    const { data = [], isLoading, isError } = useQuery({
        queryKey: ["careLevels"],
        queryFn: () => careLevelsService.getCareLevels(),
    });

    useEffect(() => {
        const nextFormData = data.reduce<CareLevelForm>((result, careLevel) => {
            result[careLevel.id] = {
                dailyRate: careLevel.dailyRate,
                effectiveFrom: careLevel.effectiveFrom,
            };

            return result;
        }, {});

        setFormData(nextFormData);
    }, [data]);

    const mutation = useMutation({
        mutationFn: async () => {
            const invalidRate = Object.values(formData).some(
                (row) => Number.isNaN(row.dailyRate) || row.dailyRate < 0,
            );

            if (invalidRate) {
                throw new Error("LOC rate must be greater than or equal to 0.");
            }

            const changedRows = data.filter((careLevel) => {
                const current = formData[careLevel.id];

                return current && (
                    current.dailyRate !== careLevel.dailyRate ||
                    current.effectiveFrom !== careLevel.effectiveFrom
                );
            });

            return Promise.all(
                changedRows.map((careLevel) =>
                    careLevelsService.updateCareLevel(careLevel.id, formData[careLevel.id]),
                ),
            );
        },
        onSuccess: () => {
            setValidationError("");
            setMessage("LOC rates saved successfully.");
            setEditingId(null);
            queryClient.invalidateQueries({ queryKey: ["careLevels"] });
        },
        onError: (error) => {
            setMessage("");
            setValidationError(error instanceof Error ? error.message : "Unable to save LOC rates.");
        },
    });

    const hasInvalidRate = Object.values(formData).some(
        (row) => Number.isNaN(row.dailyRate) || row.dailyRate < 0,
    );

    if (isLoading) {
        return <div className="p-8 text-center text-slate-500">Đang tải bảng định mức LOC...</div>;
    }

    if (isError) {
        return <div className="p-8 text-center text-red-500">Không thể tải dữ liệu bảng định mức LOC.</div>;
    }

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val);

    return (
        <div className="mx-auto max-w-6xl pb-24 font-sans">
            <div className="mb-4">
                <div className="mb-1 text-sm font-medium text-slate-500">
                    Hệ thống &gt; <span className="text-slate-700">Định mức chi phí LOC</span>
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Bảng định mức Cấp độ Chăm sóc</h1>
                <p className="mt-1 text-sm text-slate-500">
                    Định mức viện phí hằng ngày theo từng phân tầng Cấp độ Chăm sóc — thang điểm chuẩn hóa theo mô hình đánh giá lâm sàng (§5E)
                </p>
            </div>

            <div className="mb-5 flex items-center gap-3 rounded-md border border-blue-300 bg-blue-100 px-4 py-3 text-sm font-bold text-blue-700">
                <Info className="h-5 w-5 flex-shrink-0" />
                <span>
                    4 cấp độ được cố định theo mô hình phân loại lâm sàng và không thể thêm/xóa. Chỉ có thể điều chỉnh Đơn giá/ngày và Ngày hiệu lực.
                </span>
            </div>

            <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-500">
                        <tr>
                            <th className="px-4 py-3">Cấp độ chăm sóc</th>
                            <th className="px-4 py-3">Thang điểm ADL/IADL</th>
                            <th className="px-4 py-3">Định mức / Ngày</th>
                            <th className="px-4 py-3">Ngày hiệu lực</th>
                            <th className="px-4 py-3">Người cập nhật cuối</th>
                            <th className="px-4 py-3 text-right">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {data.map((careLevel) => {
                            const isEditing = editingId === careLevel.id;
                            const rowForm = formData[careLevel.id] ?? {
                                dailyRate: careLevel.dailyRate,
                                effectiveFrom: careLevel.effectiveFrom,
                            };

                            return (
                                <tr key={careLevel.id} className="text-slate-700 hover:bg-slate-50/60 transition-colors">
                                    <td className="px-4 py-4">
                                        <Badge className="border-blue-300 bg-blue-100 text-blue-700 font-semibold">
                                            {careLevel.levelName}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-4 font-medium text-slate-600">
                                        {careLevel.scoreMin} - {careLevel.scoreMax} điểm
                                    </td>
                                    <td className="px-4 py-4 font-bold text-slate-900">
                                        {isEditing ? (
                                            <div className="relative w-44">
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    className="pr-8"
                                                    value={rowForm.dailyRate}
                                                    onChange={(event) => updateRow(careLevel.id, "dailyRate", Number(event.target.value))}
                                                />
                                                <span className="pointer-events-none absolute right-3 top-2.5 text-xs font-bold text-slate-400">₫</span>
                                            </div>
                                        ) : (
                                            formatCurrency(rowForm.dailyRate)
                                        )}
                                    </td>
                                    <td className="px-4 py-4 text-slate-600">
                                        {isEditing ? (
                                            <Input
                                                type="date"
                                                className="w-40"
                                                value={rowForm.effectiveFrom}
                                                onChange={(event) => updateRow(careLevel.id, "effectiveFrom", event.target.value)}
                                            />
                                        ) : (
                                            rowForm.effectiveFrom
                                        )}
                                    </td>
                                    <td className="px-4 py-4 text-slate-500 font-medium">{careLevel.lastUpdatedBy}</td>
                                    <td className="px-4 py-4 text-right">
                                        <button
                                            className="font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                                            onClick={() => setEditingId(isEditing ? null : careLevel.id)}
                                        >
                                            {isEditing ? "Xong" : "Sửa định mức"}
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <p className="mt-4 text-xs text-slate-400">
                Các cấp độ không thể thêm hoặc xóa tại đây — ngưỡng thang điểm được chuẩn hóa theo mô hình đánh giá sinh hoạt ADL/IADL (Đề án Bệnh viện §5E) và tiêu chuẩn phân loại bệnh nhân nội trú.
            </p>
            {validationError && (
                <p className="mt-3 text-sm font-semibold text-red-600">{validationError}</p>
            )}
            {message && (
                <p className="mt-3 text-sm font-semibold text-emerald-600">{message}</p>
            )}

            <div className="fixed bottom-0 left-[260px] right-0 z-10 flex justify-end gap-3 border-t border-slate-200 bg-white px-8 py-4 shadow-lg">
                <Button
                    variant="outline"
                    className="h-11 w-36 rounded-md font-semibold"
                    onClick={() => {
                        setEditingId(null);
                        setFormData(
                            data.reduce<CareLevelForm>((result, careLevel) => {
                                result[careLevel.id] = {
                                    dailyRate: careLevel.dailyRate,
                                    effectiveFrom: careLevel.effectiveFrom,
                                };

                                return result;
                            }, {}),
                        );
                    }}
                >
                    Hủy bỏ
                </Button>
                <Button
                    className="h-11 w-64 rounded-md bg-blue-600 font-semibold text-white hover:bg-blue-700"
                    onClick={() => mutation.mutate()}
                    disabled={mutation.isPending || hasInvalidRate}
                >
                    {mutation.isPending ? "Đang lưu..." : "Lưu thay đổi"}
                </Button>
            </div>
        </div>
    );

    function updateRow<Key extends keyof CareLevelForm[string]>(
        id: string,
        key: Key,
        value: CareLevelForm[string][Key],
    ) {
        if (key === "dailyRate" && typeof value === "number" && value < 0) {
            setValidationError("Định mức chi phí LOC phải lớn hơn hoặc bằng 0.");
        } else {
            setValidationError("");
        }

        setFormData((current) => ({
            ...current,
            [id]: {
                ...current[id],
                [key]: value,
            },
        }));
    }
}
