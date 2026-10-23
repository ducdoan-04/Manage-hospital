import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { incidentsService } from "../../services/incidents";
import { session } from "../../utils/session";
import { fieldClassName, labelClassName, LoadingState, Notice, Panel, PrimaryButton, SecondaryButton, StatusBadge, WorkflowPage } from "../../components/workflow/WorkflowUi";

const formatRemaining = (minutes: number) => (minutes < 0 ? "QUÁ HẠN XỬ LÝ" : minutes < 60 ? `Còn ${minutes} phút` : `Còn ${Math.ceil(minutes / 60)} giờ`);

export default function IncidentDetail() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { id = "" } = useParams();
    const user = session.getUser();
    const canManage = user?.roleName === "System Admin" || user?.roleName === "DON (Director of Nursing)";
    const query = useQuery({ queryKey: ["incident", id], queryFn: () => incidentsService.getIncidentById(id), enabled: Boolean(id), refetchInterval: 60_000 });
    const [investigation, setInvestigation] = useState({ rootCause: "", correctiveAction: "", preventiveAction: "", witnesses: "" });
    const [note, setNote] = useState("");
    const [resolution, setResolution] = useState("");
    const [followUpPlan, setFollowUpPlan] = useState("");
    const [message, setMessage] = useState<string | null>(null);
    useEffect(() => {
        if (query.data?.investigation)
            setInvestigation({
                rootCause: query.data.investigation.rootCause ?? "",
                correctiveAction: query.data.investigation.correctiveAction ?? "",
                preventiveAction: query.data.investigation.preventiveAction ?? "",
                witnesses: (query.data.investigation.witnesses ?? []).join(", "),
            });
    }, [query.data]);
    const refresh = async () => {
        await queryClient.invalidateQueries({ queryKey: ["incident", id] });
        await queryClient.invalidateQueries({ queryKey: ["incidents"] });
    };
    const investigationMutation = useMutation({
        mutationFn: () =>
            incidentsService.updateInvestigation(id, {
                ...investigation,
                witnesses: investigation.witnesses
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
                status: "UNDER_INVESTIGATION",
            }),
        onSuccess: async () => {
            setMessage("Phân tích nguyên nhân gốc rễ và kế hoạch khắc phục đã được lưu.");
            await refresh();
        },
    });
    const noteMutation = useMutation({
        mutationFn: () => incidentsService.addProgressNote(id, note),
        onSuccess: async () => {
            setNote("");
            setMessage("Đã thêm ghi chú theo dõi diễn biến sự cố.");
            await refresh();
        },
    });
    const reviewMutation = useMutation({
        mutationFn: () => incidentsService.requestDonReview(id),
        onSuccess: async () => {
            setMessage("Đã gửi sự cố tới hàng đợi duyệt của Trưởng khoa Điều dưỡng.");
            await refresh();
        },
    });
    const resolveMutation = useMutation({
        mutationFn: () => incidentsService.resolve(id, { resolution, followUpPlan }),
        onSuccess: async () => {
            setMessage("Sự cố đã được đánh dấu giải quyết hoàn tất.");
            await refresh();
        },
    });
    if (query.isLoading || !query.data)
        return (
            <WorkflowPage title="Chi tiết Sự cố Y khoa">
                <Panel>
                    <LoadingState />
                </Panel>
            </WorkflowPage>
        );
    const incident = query.data;
    const anyError = query.error ?? investigationMutation.error ?? noteMutation.error ?? reviewMutation.error ?? resolveMutation.error;
    const isNurseView = !canManage;
    const checklist = [
        { label: "Ghi chú theo dõi lâm sàng", complete: incident.timeline?.some((item: any) => item.type === "INCIDENT_NOTE") },
        { label: "Trạng thái Bệnh án", complete: !incident.resident.isChartLocked },
        { label: "Báo cáo Sở Y tế / Cục QLKCB", complete: Boolean(incident.externalReport) },
    ];
    return (
        <WorkflowPage
            breadcrumb={`Sự cố Y khoa  >  Danh sách Sự cố  >  #${incident.id}`}
            title={`Sự cố #${incident.id} — ${incident.resident.fullName}`}
            description={`${incident.incidentType} · Vị trí: ${incident.location} · Người báo cáo: ${incident.reporter.name} · ${new Date(incident.reportedAt).toLocaleString('vi-VN')}`}
        >
            {isNurseView && (
                <div className="mb-4">
                    <Notice type="info">Vai trò: Điều dưỡng / Kỹ thuật viên (Chỉ ghi chép tiến trình). Mở khóa bệnh án và kết luận xử lý thuộc thẩm quyền của Lãnh đạo khoa / Giám đốc điều dưỡng.</Notice>
                </div>
            )}
            {message && (
                <div className="mb-4">
                    <Notice type="success">{message}</Notice>
                </div>
            )}
            {anyError && (
                <div className="mb-4">
                    <Notice type="error">{String(anyError)}</Notice>
                </div>
            )}
            <div className="grid gap-6 lg:grid-cols-[1fr_310px]">
                <div className="space-y-5">
                    <Panel title="Thông tin Báo cáo (Chỉ xem)">
                        <dl className="grid gap-4 text-sm md:grid-cols-[180px_1fr]">
                            <dt className="font-semibold text-slate-500">Mức độ nghiêm trọng</dt>
                            <dd>
                                <StatusBadge tone={incident.severity.name.toLowerCase().includes("critical") ? "danger" : "warning"}>{incident.severity.name}</StatusBadge>
                            </dd>
                            <dt className="font-semibold text-slate-500">Địa điểm xảy ra</dt>
                            <dd>{incident.location}</dd>
                            <dt className="font-semibold text-slate-500">Mô tả diễn biến</dt>
                            <dd>{incident.description}</dd>
                            <dt className="font-semibold text-slate-500">Xử trí tức thì tại chỗ</dt>
                            <dd>{incident.immediateAction || "Chưa ghi nhận"}</dd>
                            <dt className="font-semibold text-slate-500">Trạng thái xử lý</dt>
                            <dd>
                                <StatusBadge tone={incident.status === "RESOLVED" ? "success" : "info"}>
                                    {incident.status === "RESOLVED" ? "ĐÃ XỬ LÝ XONG" : incident.status === "OPEN" ? "MỚI GHI NHẬN" : incident.status === "UNDER_INVESTIGATION" ? "ĐANG XÁC MINH" : "CHỜ DUYỆT"}
                                </StatusBadge>
                            </dd>
                        </dl>
                    </Panel>
                    {canManage && (
                        <Panel title="Phân tích Nguyên nhân Gốc rễ & Biện pháp Khắc phục" description="Chỉ dành cho Lãnh đạo khoa và Quản trị viên y tế.">
                            <div className="grid gap-4 md:grid-cols-2">
                                <label className={`${labelClassName} md:col-span-2`}>
                                    Nguyên nhân gốc rễ (RCA)
                                    <textarea
                                        className={`${fieldClassName} min-h-24`}
                                        value={investigation.rootCause}
                                        onChange={(event) => setInvestigation({ ...investigation, rootCause: event.target.value })}
                                        placeholder="Phân tích nguyên nhân trực tiếp và gián tiếp dẫn đến sự cố..."
                                    />
                                </label>
                                <label className={labelClassName}>
                                    Biện pháp khắc phục tức thì
                                    <textarea
                                        className={`${fieldClassName} min-h-24`}
                                        value={investigation.correctiveAction}
                                        onChange={(event) => setInvestigation({ ...investigation, correctiveAction: event.target.value })}
                                        placeholder="Hành động khắc phục để xử lý tổn thương..."
                                    />
                                </label>
                                <label className={labelClassName}>
                                    Biện pháp phòng ngừa tái diễn
                                    <textarea
                                        className={`${fieldClassName} min-h-24`}
                                        value={investigation.preventiveAction}
                                        onChange={(event) => setInvestigation({ ...investigation, preventiveAction: event.target.value })}
                                        placeholder="Đề xuất cải tiến quy trình, tập huấn nhân sự..."
                                    />
                                </label>
                                <label className={`${labelClassName} md:col-span-2`}>
                                    Nhân chứng liên quan (ngăn cách bằng dấu phẩy)
                                    <input
                                        className={fieldClassName}
                                        value={investigation.witnesses}
                                        onChange={(event) => setInvestigation({ ...investigation, witnesses: event.target.value })}
                                    />
                                </label>
                            </div>
                            <div className="mt-4 text-right">
                                <PrimaryButton className="bg-[#0F766E] hover:bg-[#115E59]" disabled={investigationMutation.isPending} onClick={() => investigationMutation.mutate()}>
                                    Lưu Biên Bản Xác Minh
                                </PrimaryButton>
                            </div>
                        </Panel>
                    )}
                    <Panel title="Dòng Thời Gian Diễn Biến & Xử Lý">
                        <div className="space-y-0">
                            {incident.timeline?.map((event: any, index: number) => (
                                <div key={event.id} className="relative flex gap-4 pb-6">
                                    <div className="relative z-10 mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-[#0F766E] bg-white" />
                                    {index < incident.timeline.length - 1 && <div className="absolute top-4 left-[5px] h-full w-px bg-slate-200" />}
                                    <div>
                                        <p className="font-semibold text-slate-900">{event.description}</p>
                                        <p className="text-xs text-slate-500">
                                            {event.user} · {new Date(event.timestamp).toLocaleString('vi-VN')}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Panel>
                    <Panel title="Thêm Ghi Chú Tiến Trình Lâm Sàng">
                        <textarea
                            className={`${fieldClassName} min-h-24`}
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            placeholder="Ghi nhận các diễn biến sức khỏe, phản hồi của người bệnh hoặc y lệnh bổ sung..."
                        />
                        <div className="mt-4 text-right">
                            <PrimaryButton className="bg-[#0F766E] hover:bg-[#115E59]" disabled={!note.trim() || noteMutation.isPending} onClick={() => noteMutation.mutate()}>
                                Ghi Nhận Tiến Trình
                            </PrimaryButton>
                        </div>
                    </Panel>
                </div>
                <div className="space-y-5">
                    <Panel title="Thời Hạn Xử Lý Theo Quy Định (SLA)">
                        <p className={`text-2xl font-bold ${incident.isSlaOverdue ? "text-red-600" : "text-emerald-600"}`}>{formatRemaining(incident.slaRemainingMinutes)}</p>
                        <p className="mt-2 text-sm text-slate-500">Hạn chót: {new Date(incident.slaDeadline).toLocaleString('vi-VN')}</p>
                    </Panel>
                    <Panel title="Trạng Thái Hồ Sơ Bệnh Án">
                        <StatusBadge tone={incident.resident.isChartLocked ? "danger" : "success"}>
                            {incident.resident.isChartLocked ? "ĐÃ PHONG TỎA BỆNH ÁN" : "BÌNH THƯỜNG / ĐƯỢC CHỈNH SỬA"}
                        </StatusBadge>
                    </Panel>
                    {!incident.resident.isChartLocked && canManage && (
                        <Panel title="Bảng Kiểm Hoàn Tất Xử Lý">
                            <div className="space-y-3">
                                {checklist.map((item) => (
                                    <div key={item.label} className="flex items-center justify-between text-sm">
                                        <span>{item.label}</span>
                                        <StatusBadge tone={item.complete ? "success" : "warning"}>{item.complete ? "Đã đạt" : "Chưa hoàn tất"}</StatusBadge>
                                    </div>
                                ))}
                            </div>
                        </Panel>
                    )}
                    <Panel title={canManage ? "Quyền Hạn Lãnh Đạo Khoa / DON" : "Thao Tác Điều Dưỡng"}>
                        <div className="space-y-3">
                            {canManage ? (
                                <>
                                    <SecondaryButton className="w-full" onClick={() => navigate(`/incidents/${id}/external-report`)}>
                                        Gửi Báo Cáo Cơ Quan Quản Lý
                                    </SecondaryButton>
                                    <SecondaryButton
                                        className="w-full border-red-300 text-red-600 hover:bg-red-50"
                                        disabled={!incident.resident.isChartLocked}
                                        onClick={() => navigate(`/incidents/${id}/unlock`)}
                                    >
                                        Mở Khóa Bệnh Án
                                    </SecondaryButton>
                                    <label className={labelClassName}>
                                        Kết luận Xử lý Sự cố
                                        <textarea className={`${fieldClassName} min-h-20`} value={resolution} onChange={(event) => setResolution(event.target.value)} placeholder="Tóm tắt kết luận và hình thức xử lý..." />
                                    </label>
                                    <label className={labelClassName}>
                                        Kế hoạch Theo dõi Tiếp theo
                                        <textarea className={`${fieldClassName} min-h-20`} value={followUpPlan} onChange={(event) => setFollowUpPlan(event.target.value)} placeholder="Kế hoạch tái khám và giám sát an toàn..." />
                                    </label>
                                    <PrimaryButton
                                        className="w-full bg-[#0F766E] hover:bg-[#115E59]"
                                        disabled={incident.resident.isChartLocked || !incident.externalReport || !resolution.trim() || resolveMutation.isPending}
                                        onClick={() => resolveMutation.mutate()}
                                    >
                                        Đóng &amp; Hoàn Tất Sự Cố
                                    </PrimaryButton>
                                    {incident.resident.isChartLocked && <p className="text-xs text-amber-600">Cần mở khóa bệnh án trước khi đóng sự cố.</p>}
                                </>
                            ) : (
                                <>
                                    <PrimaryButton className="w-full bg-[#0F766E] hover:bg-[#115E59]" disabled={!note.trim() || noteMutation.isPending} onClick={() => noteMutation.mutate()}>
                                        Thêm Ghi Chú Tiến Trình
                                    </PrimaryButton>
                                    <SecondaryButton className="w-full" disabled={reviewMutation.isPending} onClick={() => reviewMutation.mutate()}>
                                        Trình Lãnh Đạo Duyệt
                                    </SecondaryButton>
                                    <p className="text-xs text-amber-700">Mở khóa bệnh án và kết luận xử lý thuộc thẩm quyền của Lãnh đạo khoa / DON.</p>
                                </>
                            )}
                        </div>
                    </Panel>
                </div>
            </div>
        </WorkflowPage>
    );
}

