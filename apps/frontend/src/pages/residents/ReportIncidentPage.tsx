import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { incidentSeverityService } from "../../services/incidentSeverity";
import { incidentsService } from "../../services/incidents";
import { residentsService } from "../../services/residents";
import { fieldClassName, labelClassName, LoadingState, Notice, Panel, PrimaryButton, SecondaryButton, WorkflowPage } from "../../components/workflow/WorkflowUi";

const incidentTypes = [
    "Ngã / Té ngã",
    "Sai sót dùng thuốc / Y lệnh",
    "Rời khoa / đi lạc không phép",
    "Khiếu nại hành vi / ngược đãi",
    "Chấn thương y tế phát sinh",
    "Bất thường hành vi / kích động",
    "Khác"
];

export default function ReportIncidentPage() {
    const navigate = useNavigate();
    const residentsQuery = useQuery({ queryKey: ["resident-options"], queryFn: () => residentsService.getAll() });
    const severityQuery = useQuery({ queryKey: ["incident-severities"], queryFn: incidentSeverityService.getAll });
    const [form, setForm] = useState({
        residentId: "",
        incidentType: "Ngã / Té ngã",
        severityId: "",
        occurredAt: new Date().toISOString().slice(0, 16),
        location: "",
        description: "",
        witnesses: "",
        immediateAction: "",
    });
    const selectedResidentId = form.residentId || residentsQuery.data?.[0]?.id || "";
    const selectedSeverityId = form.severityId || String(severityQuery.data?.[0]?.id ?? "");
    const requiredComplete = Boolean(
        selectedResidentId && selectedSeverityId && form.incidentType && form.occurredAt && form.location.trim() && form.description.trim() && form.immediateAction.trim(),
    );
    const mutation = useMutation({
        mutationFn: () => incidentsService.create({ ...form, residentId: selectedResidentId, severityId: Number(selectedSeverityId), notifyDon: true }),
        onSuccess: (result) => {
            const incident = result.data;
            navigate(incident.resident.isChartLocked ? `/incidents/${incident.id}/lock-confirm` : `/incidents/${incident.id}`);
        },
    });
    if (residentsQuery.isLoading || severityQuery.isLoading)
        return (
            <WorkflowPage title="Báo cáo Sự cố Y khoa Mới">
                <Panel>
                    <LoadingState />
                </Panel>
            </WorkflowPage>
        );
    return (
        <WorkflowPage
            breadcrumb="An toàn & Sự cố  >  Lập Biên Bản Sự Cố"
            title="Báo cáo Sự cố Y khoa Mới"
            description="Điền đầy đủ các trường thông tin bắt buộc. Mức độ rủi ro sẽ tự động kích hoạt thời hạn xử lý (SLA) và quy trình phong tỏa bệnh án nếu nghiêm trọng."
        >
            {mutation.error && (
                <div className="mb-4">
                    <Notice type="error">{String(mutation.error)}</Notice>
                </div>
            )}
            <div className="grid gap-6 lg:grid-cols-[1fr_310px]">
                <Panel title="Thông tin Chi tiết Sự cố">
                    <div className="grid gap-5 md:grid-cols-2">
                        <label className={labelClassName}>
                            Người bệnh liên quan *
                            <select className={fieldClassName} value={selectedResidentId} onChange={(event) => setForm({ ...form, residentId: event.target.value })}>
                                {residentsQuery.data?.map((resident) => (
                                    <option key={resident.id} value={resident.id}>
                                        {resident.fullName} · Phòng {resident.roomNumber ?? "—"}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className={labelClassName}>
                            Loại sự cố y khoa *
                            <select className={fieldClassName} value={form.incidentType} onChange={(event) => setForm({ ...form, incidentType: event.target.value })}>
                                {incidentTypes.map((type) => (
                                    <option key={type}>{type}</option>
                                ))}
                            </select>
                        </label>
                        <label className={labelClassName}>
                            Mức độ nghiêm trọng *
                            <select className={fieldClassName} value={selectedSeverityId} onChange={(event) => setForm({ ...form, severityId: event.target.value })}>
                                {severityQuery.data?.map((severity: any) => (
                                    <option key={severity.id} value={severity.id}>
                                        {severity.levelName}
                                        {severity.chartLockTrigger ? " · Tự động khóa bệnh án" : ""}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className={labelClassName}>
                            Thời gian xảy ra sự cố *
                            <input
                                className={fieldClassName}
                                type="datetime-local"
                                value={form.occurredAt}
                                onChange={(event) => setForm({ ...form, occurredAt: event.target.value })}
                            />
                        </label>
                        <label className={`${labelClassName} md:col-span-2`}>
                            Địa điểm xảy ra sự cố *
                            <input
                                className={fieldClassName}
                                value={form.location}
                                onChange={(event) => setForm({ ...form, location: event.target.value })}
                                placeholder="Ví dụ: Phòng P-204B — khu vực nhà vệ sinh"
                            />
                        </label>
                        <label className={`${labelClassName} md:col-span-2`}>
                            Mô tả chi tiết diễn biến sự cố *
                            <textarea
                                className={`${fieldClassName} min-h-28`}
                                value={form.description}
                                onChange={(event) => setForm({ ...form, description: event.target.value })}
                                placeholder="Mô tả cụ thể người bệnh đang làm gì, sự việc diễn ra thế nào..."
                            />
                        </label>
                        <label className={`${labelClassName} md:col-span-2`}>
                            Nhân chứng / Người có mặt (tùy chọn)
                            <input className={fieldClassName} value={form.witnesses} onChange={(event) => setForm({ ...form, witnesses: event.target.value })} placeholder="ĐD. Nguyễn Thị Thảo, Hộ lý Lê Văn Nam" />
                        </label>
                        <label className={`${labelClassName} md:col-span-2`}>
                            Biện pháp xử trí y tế tức thì *
                            <textarea
                                className={`${fieldClassName} min-h-24`}
                                value={form.immediateAction}
                                onChange={(event) => setForm({ ...form, immediateAction: event.target.value })}
                                placeholder="Đã sơ cứu, đo lại dấu hiệu sinh tồn, báo cáo bác sĩ trực ca..."
                            />
                        </label>
                    </div>
                </Panel>
                <div className="space-y-5">
                    <Panel title="Người Báo Cáo">
                        <p className="font-bold text-slate-900">Ghi nhận từ tài khoản đăng nhập</p>
                        <p className="mt-2 text-sm text-slate-500">Dấu thời gian bất biến: {new Date().toLocaleString('vi-VN')}</p>
                    </Panel>
                    <Panel title="Quy trình Tiếp theo">
                        <ol className="space-y-2 text-sm text-slate-600">
                            <li>1. Đánh giá mức độ nghiêm trọng & kích hoạt SLA.</li>
                            <li>2. Gửi thông báo khẩn cấp tới Trưởng khoa / DON.</li>
                            <li>3. Tự động phong tỏa bệnh án nếu mức độ nguy cấp.</li>
                            <li>4. Sự cố đưa vào hàng đợi xác minh nguyên nhân gốc rễ.</li>
                        </ol>
                    </Panel>
                    <Notice type="warning">Sự cố mức độ nghiêm trọng cao sẽ tự động khóa hồ sơ bệnh án để bảo toàn tính minh bạch cho đến khi lãnh đạo phê duyệt mở khóa.</Notice>
                </div>
            </div>
            <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-5">
                <SecondaryButton onClick={() => navigate(-1)}>Hủy bỏ</SecondaryButton>
                <PrimaryButton className="bg-[#0F766E] hover:bg-[#115E59]" disabled={!requiredComplete || mutation.isPending} onClick={() => mutation.mutate()}>
                    {mutation.isPending ? "Đang gửi báo cáo..." : "Gửi Báo Cáo Sự Cố"}
                </PrimaryButton>
            </div>
        </WorkflowPage>
    );
}

