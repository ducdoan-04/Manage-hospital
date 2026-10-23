import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { careTasksService } from "../../services/careTasks";
import { residentsService } from "../../services/residents";
import { vitalsService } from "../../services/vitals";
import { fieldClassName, labelClassName, LoadingState, Notice, Panel, PrimaryButton, SecondaryButton, WorkflowPage } from "../../components/workflow/WorkflowUi";

const initialVitals = {
    bloodPressureSystolic: 120,
    bloodPressureDiastolic: 80,
    heartRateBpm: 72,
    respiratoryRate: 16,
    temperatureFahrenheit: 98.6,
    spo2Percentage: 98,
    painScale: 0,
    notes: "",
};

export default function BedsideVitalsPage() {
    const navigate = useNavigate();
    const { taskId } = useParams();
    const [searchParams] = useSearchParams();
    const residentIdFromQuery = searchParams.get("residentId") ?? "";
    const taskQuery = useQuery({ queryKey: ["care-task", taskId], queryFn: () => careTasksService.getById(taskId!), enabled: Boolean(taskId) });
    const residentId = residentIdFromQuery || taskQuery.data?.resident?.id || "";
    const residentsQuery = useQuery({ queryKey: ["resident-options"], queryFn: () => residentsService.getAll(), enabled: !residentId });
    const [manualResidentId, setManualResidentId] = useState("");
    const selectedResidentId = residentId || manualResidentId || residentsQuery.data?.[0]?.id || "";
    const [form, setForm] = useState(initialVitals);
    const [acknowledgeAbnormal, setAcknowledgeAbnormal] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const abnormalReasons = useMemo(() => {
        const reasons: string[] = [];
        if (form.bloodPressureSystolic < 90 || form.bloodPressureSystolic > 160 || form.bloodPressureDiastolic < 60 || form.bloodPressureDiastolic > 100)
            reasons.push("Huyết áp nằm ngoài khoảng an toàn");
        if (form.heartRateBpm < 50 || form.heartRateBpm > 110) reasons.push("Nhịp tim/Mạch bất thường");
        if (form.respiratoryRate < 10 || form.respiratoryRate > 24) reasons.push("Nhịp thở nằm ngoài phạm vi bình thường");
        if (form.temperatureFahrenheit < 95 || form.temperatureFahrenheit > 100.4) reasons.push("Nhiệt độ cơ thể cảnh báo sốt / hạ thân nhiệt");
        if (form.spo2Percentage < 92) reasons.push("Nồng độ oxy trong máu thấp (SpO2 < 92%)");
        if (form.painScale >= 7) reasons.push("Bệnh nhân đau dữ dội (thang điểm >= 7)");
        return reasons;
    }, [form]);
    const mutation = useMutation({
        mutationFn: () => vitalsService.create({ residentId: selectedResidentId, taskId, ...form, acknowledgeAbnormal }),
        onSuccess: (result) => {
            setMessage(result.abnormal ? `Đã lưu chỉ số sinh tồn kèm cảnh báo: ${result.abnormalReasons.join(", ")}` : "Đã lưu các chỉ số sinh tồn thành công và hoàn thành y lệnh chăm sóc.");
        },
    });
    if (taskId && taskQuery.isLoading)
        return (
            <WorkflowPage title="Chỉ số Sinh tồn">
                <Panel>
                    <LoadingState />
                </Panel>
            </WorkflowPage>
        );
    return (
        <WorkflowPage breadcrumb="Kế hoạch Điều trị  >  Chỉ số Sinh tồn" title="Ghi nhận Chỉ số Sinh tồn Tại giường" description="Ghi nhận các dấu hiệu sinh tồn bắt buộc với cơ chế xác nhận an toàn khi có chỉ số ngoài ngưỡng.">
            {message && (
                <div className="mb-4">
                    <Notice type={abnormalReasons.length ? "warning" : "success"}>{message}</Notice>
                </div>
            )}
            {mutation.error && (
                <div className="mb-4">
                    <Notice type="error">{String(mutation.error)}</Notice>
                </div>
            )}
            {abnormalReasons.length > 0 && (
                <div className="mb-4">
                    <Notice type="warning">
                        <strong>Cảnh báo chỉ số sinh tồn bất thường:</strong> {abnormalReasons.join("; ")}. Điều dưỡng cần xác nhận trước khi lưu vào bệnh án.
                    </Notice>
                </div>
            )}
            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                <Panel title="Bảng Nhập Chỉ số Sinh tồn">
                    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                        {Object.entries(form)
                            .filter(([field]) => field !== "notes")
                            .map(([field, value]) => {
                                const labels: Record<string, string> = {
                                    bloodPressureSystolic: "HA tâm thu (mmHg)",
                                    bloodPressureDiastolic: "HA tâm trương (mmHg)",
                                    heartRateBpm: "Mạch (lần/phút)",
                                    respiratoryRate: "Nhịp thở (lần/phút)",
                                    temperatureFahrenheit: "Thân nhiệt (°F)",
                                    spo2Percentage: "SpO2 (%)",
                                    painScale: "Thang đau (0-10)",
                                };
                                return (
                                    <label key={field} className={labelClassName}>
                                        {labels[field] ?? field} *
                                        <input
                                            className={fieldClassName}
                                            type="number"
                                            step={field === "temperatureFahrenheit" ? "0.1" : "1"}
                                            value={value}
                                            onChange={(event) => setForm({ ...form, [field]: Number(event.target.value) })}
                                        />
                                    </label>
                                );
                            })}
                        <label className={`${labelClassName} md:col-span-2 lg:col-span-4`}>
                            Ghi chú Lâm sàng & Triệu chứng kèm theo
                            <textarea className={`${fieldClassName} min-h-24`} placeholder="Ghi nhận biểu hiện đau, khó thở, tri giác của bệnh nhân..." value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
                        </label>
                    </div>
                </Panel>
                <div className="space-y-5">
                    <Panel title="Bệnh nhân">
                        <p className="font-bold text-slate-900">{taskQuery.data?.resident?.fullName ?? "Nhập thủ công"}</p>
                        <p className="text-sm text-slate-500">Phòng {taskQuery.data?.resident?.roomNumber ?? "—"}</p>
                        {!residentId && (
                            <select className={fieldClassName} value={selectedResidentId} onChange={(event) => setManualResidentId(event.target.value)}>
                                {residentsQuery.data?.map((resident) => (
                                    <option key={resident.id} value={resident.id}>
                                        {resident.fullName}
                                    </option>
                                ))}
                            </select>
                        )}
                    </Panel>
                    {abnormalReasons.length > 0 && (
                        <Panel title="Xác nhận An toàn Người bệnh">
                            <label className="flex items-start gap-3 text-sm text-slate-700">
                                <input className="mt-1" type="checkbox" checked={acknowledgeAbnormal} onChange={(event) => setAcknowledgeAbnormal(event.target.checked)} />
                                Tôi đã kiểm tra kỹ các chỉ số sinh tồn bất thường và sẽ báo cáo Bác sĩ điều trị / Trưởng ca trực theo quy trình chuyên môn.
                            </label>
                        </Panel>
                    )}
                </div>
            </div>
            <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-5">
                <SecondaryButton onClick={() => navigate(-1)}>Hủy bỏ</SecondaryButton>
                <PrimaryButton disabled={!selectedResidentId || mutation.isPending || (abnormalReasons.length > 0 && !acknowledgeAbnormal)} onClick={() => mutation.mutate()}>
                    {mutation.isPending ? "Đang lưu..." : "Lưu Chỉ số Sinh tồn"}
                </PrimaryButton>
            </div>
        </WorkflowPage>
    );
}
