import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { incidentsService } from "../../services/incidents";
import { fieldClassName, labelClassName, LoadingState, Notice, Panel, PrimaryButton, SecondaryButton, WorkflowPage } from "../../components/workflow/WorkflowUi";

export default function ExternalReportPage() {
    const navigate = useNavigate();
    const { id = "" } = useParams();
    const query = useQuery({ queryKey: ["incident", id], queryFn: () => incidentsService.getIncidentById(id), enabled: Boolean(id) });
    const [form, setForm] = useState({
        agency: "Sở Y tế / Cục Quản lý Khám Chữa Bệnh (Bộ Y tế)",
        referenceNumber: "",
        submittedAt: new Date().toISOString().slice(0, 16),
        passwordConfirm: "",
        notes: "",
    });
    const mutation = useMutation({ mutationFn: () => incidentsService.submitExternalReport(id, form), onSuccess: () => navigate(`/incidents/${id}`) });
    if (query.isLoading || !query.data)
        return (
            <WorkflowPage title="Báo cáo Cơ quan Quản lý">
                <Panel>
                    <LoadingState />
                </Panel>
            </WorkflowPage>
        );
    const incident = query.data;
    return (
        <WorkflowPage
            breadcrumb={`Sự cố Y khoa  >  #${id}  >  Báo Cáo Ngoại Viện`}
            title="Gửi Báo Cáo Cơ Quan Quản Lý Y Tế"
            description="Kiểm tra toàn bộ hồ sơ sự cố y khoa và xác thực chữ ký số truyền dữ liệu đến cơ quan thẩm quyền."
        >
            {(query.error || mutation.error) && (
                <div className="mb-4">
                    <Notice type="error">{String(query.error ?? mutation.error)}</Notice>
                </div>
            )}
            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
                <div className="space-y-5">
                    <Panel title="Xem Trước Hồ Sơ Sự Cố">
                        <dl className="grid gap-4 text-sm md:grid-cols-[170px_1fr]">
                            <dt className="font-semibold text-slate-500">Người bệnh</dt>
                            <dd>{incident.resident.fullName}</dd>
                            <dt className="font-semibold text-slate-500">Loại sự cố</dt>
                            <dd>
                                {incident.incidentType} · {incident.severity.name}
                            </dd>
                            <dt className="font-semibold text-slate-500">Thời gian báo cáo</dt>
                            <dd>
                                {new Date(incident.reportedAt).toLocaleString('vi-VN')} bởi {incident.reporter.name}
                            </dd>
                            <dt className="font-semibold text-slate-500">Diễn biến</dt>
                            <dd>{incident.description}</dd>
                            <dt className="font-semibold text-slate-500">Nguyên nhân gốc rễ</dt>
                            <dd>{incident.investigation.rootCause || "Chưa hoàn tất phân tích"}</dd>
                            <dt className="font-semibold text-slate-500">Biện pháp khắc phục</dt>
                            <dd>{incident.investigation.correctiveAction || "Chưa có văn bản"}</dd>
                        </dl>
                    </Panel>
                    <Panel title="Tóm Tắt Dòng Thời Gian">
                        <ul className="space-y-3 text-sm">
                            {incident.timeline.map((item: any) => (
                                <li key={item.id} className="rounded-lg bg-slate-50 p-3">
                                    <strong>{item.description}</strong>
                                    <span className="block text-xs text-slate-500">{new Date(item.timestamp).toLocaleString('vi-VN')}</span>
                                </li>
                            ))}
                        </ul>
                    </Panel>
                </div>
                <Panel title="Xác Thực Ký Số & Gửi Báo Cáo">
                    <div className="space-y-4">
                        <label className={labelClassName}>
                            Cơ quan quản lý tiếp nhận *
                            <input className={fieldClassName} value={form.agency} onChange={(event) => setForm({ ...form, agency: event.target.value })} />
                        </label>
                        <label className={labelClassName}>
                            Số công văn / Mã tham chiếu
                            <input
                                className={fieldClassName}
                                value={form.referenceNumber}
                                onChange={(event) => setForm({ ...form, referenceNumber: event.target.value })}
                                placeholder="Hệ thống tự sinh nếu để trống"
                            />
                        </label>
                        <label className={labelClassName}>
                            Thời gian gửi báo cáo *
                            <input
                                className={fieldClassName}
                                type="datetime-local"
                                value={form.submittedAt}
                                onChange={(event) => setForm({ ...form, submittedAt: event.target.value })}
                            />
                        </label>
                        <label className={labelClassName}>
                            Ghi chú kèm theo
                            <textarea className={`${fieldClassName} min-h-20`} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
                        </label>
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                            <label className={labelClassName}>
                                Mật khẩu xác thực Chữ ký số *
                                <input
                                    className={fieldClassName}
                                    type="password"
                                    value={form.passwordConfirm}
                                    onChange={(event) => setForm({ ...form, passwordConfirm: event.target.value })}
                                    autoComplete="current-password"
                                />
                            </label>
                            <p className="mt-2 text-xs text-amber-700">Mật khẩu của bạn sẽ ký số pháp lý vào gói tin báo cáo và tạo bản ghi kiểm toán bất biến.</p>
                        </div>
                        <PrimaryButton className="w-full bg-[#0F766E] hover:bg-[#115E59]" disabled={!form.agency.trim() || !form.passwordConfirm || mutation.isPending} onClick={() => mutation.mutate()}>
                            {mutation.isPending ? "Đang gửi..." : "Ký Số & Gửi Báo Cáo"}
                        </PrimaryButton>
                        <SecondaryButton className="w-full" onClick={() => navigate(-1)}>
                            Hủy bỏ
                        </SecondaryButton>
                    </div>
                </Panel>
            </div>
        </WorkflowPage>
    );
}

