import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { incidentsService } from "../../services/incidents";
import { EmptyState, LoadingState, Notice, Panel, PrimaryButton, StatusBadge, WorkflowPage } from "../../components/workflow/WorkflowUi";

const formatRemaining = (minutes: number) => {
    if (minutes < 0) return "QUÁ HẠN";
    if (minutes < 60) return `Còn ${minutes} phút`;
    return `Còn ${Math.ceil(minutes / 60)} giờ`;
};
const severityTone = (name: string) =>
    name.toLowerCase().includes("critical") ? "danger" : name.toLowerCase().includes("major") ? "warning" : name.toLowerCase().includes("moderate") ? "warning" : "neutral";

export default function IncidentList() {
    const navigate = useNavigate();
    const query = useQuery({ queryKey: ["incidents"], queryFn: incidentsService.getIncidents, refetchInterval: 60_000 });
    const [status, setStatus] = useState("ALL");
    const [search, setSearch] = useState("");
    const rows = useMemo(
        () =>
            (query.data ?? []).filter(
                (incident: any) =>
                    (status === "ALL" || incident.status === status) &&
                    (!search.trim() ||
                        incident.resident.fullName.toLowerCase().includes(search.toLowerCase()) ||
                        incident.incidentType.toLowerCase().includes(search.toLowerCase())),
            ),
        [query.data, status, search],
    );
    return (
        <WorkflowPage
            breadcrumb="An toàn Người bệnh & Sự cố Y khoa"
            title="Danh sách Sự cố Y khoa"
            description="Theo dõi các sự cố y tế đang xử lý, trạng thái khóa bệnh án và thời hạn báo cáo theo quy chế Bộ Y tế."
            actions={<PrimaryButton className="bg-[#0F766E] hover:bg-[#115E59]" onClick={() => navigate("/incidents/report")}>+ Báo cáo Sự cố Mới</PrimaryButton>}
        >
            {query.error && (
                <div className="mb-4">
                    <Notice type="error">{String(query.error)}</Notice>
                </div>
            )}
            <Panel
                title="Hàng đợi Xử lý Sự cố"
                actions={
                    <div className="flex flex-wrap gap-2">
                        <input
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            placeholder="Tìm kiếm người bệnh hoặc loại sự cố..."
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                        <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
                            <option value="ALL">TẤT CẢ TRẠNG THÁI</option>
                            <option value="OPEN">MỚI GHI NHẬN</option>
                            <option value="UNDER_INVESTIGATION">ĐANG XÁC MINH</option>
                            <option value="PENDING_REVIEW">CHỜ DUYỆT</option>
                            <option value="RESOLVED">ĐÃ XỬ LÝ</option>
                        </select>
                    </div>
                }
            >
                {query.isLoading ? (
                    <LoadingState />
                ) : !rows.length ? (
                    <EmptyState label="Không tìm thấy sự cố y khoa nào phù hợp với bộ lọc hiện tại." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[950px] text-left text-sm">
                            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                                <tr>
                                    <th className="px-4 py-3">Người bệnh</th>
                                    <th className="px-4 py-3">Phân loại sự cố</th>
                                    <th className="px-4 py-3">Mức độ nghiêm trọng</th>
                                    <th className="px-4 py-3">Thời gian ghi nhận</th>
                                    <th className="px-4 py-3">Hạn xử lý (SLA)</th>
                                    <th className="px-4 py-3">Trạng thái</th>
                                    <th className="px-4 py-3">Bệnh án</th>
                                    <th className="px-4 py-3 text-right">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {rows.map((incident: any) => (
                                    <tr key={incident.id}>
                                        <td className="px-4 py-4 font-semibold">
                                            {incident.resident.fullName}
                                            <span className="block text-xs font-normal text-slate-500">Phòng {incident.resident.roomNumber ?? "—"}</span>
                                        </td>
                                        <td className="px-4 py-4">{incident.incidentType}</td>
                                        <td className="px-4 py-4">
                                            <StatusBadge tone={severityTone(incident.severity.name) as any}>{incident.severity.name}</StatusBadge>
                                        </td>
                                        <td className="px-4 py-4">{new Date(incident.reportedAt).toLocaleString('vi-VN')}</td>
                                        <td
                                            className={`px-4 py-4 font-bold ${incident.isSlaOverdue ? "text-red-600" : incident.slaRemainingMinutes <= 24 * 60 ? "text-amber-700" : "text-emerald-700"}`}
                                        >
                                            {formatRemaining(incident.slaRemainingMinutes)}
                                        </td>
                                        <td className="px-4 py-4">
                                            <StatusBadge tone={incident.status === "RESOLVED" ? "success" : "info"}>
                                                {incident.status === "RESOLVED" ? "ĐÃ XỬ LÝ" : incident.status === "OPEN" ? "MỚI GHI NHẬN" : incident.status === "UNDER_INVESTIGATION" ? "ĐANG XÁC MINH" : "CHỜ DUYỆT"}
                                            </StatusBadge>
                                        </td>
                                        <td className="px-4 py-4">
                                            <StatusBadge tone={incident.resident.isChartLocked ? "danger" : "success"}>
                                                {incident.resident.isChartLocked ? "Đã khóa" : "Bình thường"}
                                            </StatusBadge>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <button className="font-semibold text-[#0F766E] hover:underline" onClick={() => navigate(`/incidents/${incident.id}`)}>
                                                Xem chi tiết
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Panel>
        </WorkflowPage>
    );
}

