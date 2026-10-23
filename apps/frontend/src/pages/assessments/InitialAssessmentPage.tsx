import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { assessmentsService } from "../../services/assessments";
import { residentsService } from "../../services/residents";
import { vitalsService } from "../../services/vitals";
import { fieldClassName, labelClassName, LoadingState, Notice, Panel, PrimaryButton, SecondaryButton, WorkflowPage } from "../../components/workflow/WorkflowUi";

const adlMetrics = ["Bed Mobility", "Transfer", "Locomotion (Walk)", "Dressing", "Eating", "Toilet Use", "Personal Hygiene", "Bathing"];

const defaultVitals = {
    bloodPressureSystolic: 120,
    bloodPressureDiastolic: 80,
    heartRateBpm: 72,
    respiratoryRate: 16,
    temperatureFahrenheit: 98.6,
    spo2Percentage: 98,
    painScale: 0,
};

export default function InitialAssessmentPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const residentsQuery = useQuery({ queryKey: ["resident-options"], queryFn: () => residentsService.getAll() });
    const [residentId, setResidentId] = useState(searchParams.get("residentId") ?? "");
    const [scores, setScores] = useState<Record<string, number>>(Object.fromEntries(adlMetrics.map((metric) => [metric, 0])));
    const [allergyInput, setAllergyInput] = useState("");
    const [allergies, setAllergies] = useState<string[]>([]);
    const [clinicalNotes, setClinicalNotes] = useState("");
    const [vitals, setVitals] = useState(defaultVitals);

    const selectedResidentId = residentId || residentsQuery.data?.[0]?.id || "";
    const selectedResident = residentsQuery.data?.find((resident) => resident.id === selectedResidentId);
    const adlTotal = useMemo(() => Object.values(scores).reduce((sum, score) => sum + score, 0), [scores]);

    const mutation = useMutation({
        mutationFn: async () => {
            if (!selectedResidentId) throw new Error("Select a resident before saving the assessment.");
            const assessment = await assessmentsService.create({
                residentId: selectedResidentId,
                metrics: adlMetrics.map((metricName) => ({ category: "ADL", metricName, score: scores[metricName] ?? 0 })),
                clinicalNotes: JSON.stringify({ notes: clinicalNotes, allergies }),
            });
            await vitalsService.create({ residentId: selectedResidentId, ...vitals, notes: "Initial assessment vitals" });
            return assessment;
        },
        onSuccess: (assessment) => navigate(`/residents/${selectedResidentId}/loc-classification?assessmentId=${assessment.id}`),
    });

    if (residentsQuery.isLoading) {
        return (
            <WorkflowPage title="Initial Assessment">
                <Panel>
                    <LoadingState />
                </Panel>
            </WorkflowPage>
        );
    }

    return (
        <WorkflowPage
            breadcrumb="Bệnh nhân  >  Quy trình Nhập viện Điều trị"
            title="Bước 3: Khám lâm sàng & Đánh giá Ban đầu"
            description={`${selectedResident?.fullName ?? "Chọn bệnh nhân"} · Đánh giá thang điểm hoạt động sống (ADL) và phân tầng mức độ chăm sóc y tế.`}
        >
            <div className="mb-5 grid grid-cols-3 overflow-hidden rounded-lg border border-blue-200 text-center text-sm font-semibold">
                <div className="bg-white px-4 py-3 text-blue-600">1&nbsp; Sàng lọc ban đầu ✓</div>
                <div className="bg-white px-4 py-3 text-blue-600">2&nbsp; Hồ sơ Nhập viện ✓</div>
                <div className="bg-blue-600 px-4 py-3 text-white">3&nbsp; Khám & Đánh giá lâm sàng</div>
            </div>
            {mutation.error && (
                <div className="mb-4">
                    <Notice type="error">{String(mutation.error)}</Notice>
                </div>
            )}
            <div className="space-y-5">
                <Panel title="Bệnh nhân">
                    <label className={labelClassName}>
                        Bệnh nhân đánh giá *
                        <select className={fieldClassName} value={selectedResidentId} onChange={(event) => setResidentId(event.target.value)}>
                            {residentsQuery.data?.map((resident) => (
                                <option key={resident.id} value={resident.id}>
                                    {resident.fullName} · {resident.roomNumber ?? "Chưa phân phòng"}
                                </option>
                            ))}
                        </select>
                    </label>
                </Panel>
                <Panel title="Đánh giá Thang điểm Sinh hoạt Hàng ngày (ADL Scoring)" actions={<div className="text-lg font-bold text-slate-900">Tổng điểm ADL: {adlTotal} / 32</div>}>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-sm">
                            <thead>
                                <tr className="text-xs text-slate-500">
                                    <th className="pb-3 text-left">Hoạt động sinh hoạt</th>
                                    {[0, 1, 2, 3, 4].map((score) => (
                                        <th key={score} className="pb-3 text-center">
                                            {score} điểm
                                            <span className="block font-normal">{["Tự chủ", "Giám sát", "Hỗ trợ 1 phần", "Hỗ trợ nhiều", "Phụ thuộc"][score]}</span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {adlMetrics.map((metric) => (
                                    <tr key={metric}>
                                        <td className="py-3 font-medium text-slate-700">{metric}</td>
                                        {[0, 1, 2, 3, 4].map((score) => (
                                            <td key={score} className="py-3 text-center">
                                                <input
                                                    aria-label={`${metric} điểm ${score}`}
                                                    type="radio"
                                                    name={metric}
                                                    checked={scores[metric] === score}
                                                    onChange={() => setScores({ ...scores, [metric]: score })}
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Panel>
                <div className="grid gap-5 lg:grid-cols-2">
                    <Panel title="Tiền sử Dị ứng">
                        <div className="flex gap-2">
                            <input className={fieldClassName} value={allergyInput} onChange={(event) => setAllergyInput(event.target.value)} placeholder="Nhập tên thuốc hoặc dị nguyên..." />
                            <SecondaryButton
                                onClick={() => {
                                    if (allergyInput.trim()) {
                                        setAllergies([...allergies, allergyInput.trim()]);
                                        setAllergyInput("");
                                    }
                                }}
                            >
                                + Thêm dị ứng
                            </SecondaryButton>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                            {allergies.length === 0 ? (
                                <span className="text-sm text-slate-500">Chưa ghi nhận tiền sử dị ứng.</span>
                            ) : (
                                allergies.map((allergy) => (
                                    <button
                                        key={allergy}
                                        onClick={() => setAllergies(allergies.filter((item) => item !== allergy))}
                                        className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700"
                                    >
                                        {allergy} ×
                                    </button>
                                ))
                            )}
                        </div>
                    </Panel>
                    <Panel title="Ghi chú Khám & Bệnh học Lâm sàng">
                        <textarea
                            className={`${fieldClassName} min-h-28`}
                            value={clinicalNotes}
                            onChange={(event) => setClinicalNotes(event.target.value)}
                            placeholder="Ghi chẩn đoán lâm sàng, tri giác, khả năng vận động và các dấu hiệu bất thường..."
                        />
                    </Panel>
                </div>
                <Panel title="Dấu hiệu Sinh tồn (Vitals)">
                    <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-7">
                        {Object.entries(vitals).map(([field, value]) => {
                            const labels: Record<string, string> = {
                                bloodPressureSystolic: "HA tâm thu (mmHg)",
                                bloodPressureDiastolic: "HA tâm trương (mmHg)",
                                heartRateBpm: "Nhịp tim (bpm)",
                                respiratoryRate: "Nhịp thở (lần/ph)",
                                temperatureFahrenheit: "Nhiệt độ (°F)",
                                spo2Percentage: "SpO2 (%)",
                                painScale: "Điểm đau (0-10)",
                            };
                            return (
                                <label key={field} className={labelClassName}>
                                    {labels[field] ?? field}
                                    <input
                                        className={fieldClassName}
                                        type="number"
                                        step={field === "temperatureFahrenheit" ? "0.1" : "1"}
                                        value={value}
                                        onChange={(event) => setVitals({ ...vitals, [field]: Number(event.target.value) })}
                                    />
                                </label>
                            );
                        })}
                    </div>
                </Panel>
            </div>
            <div className="mt-6 flex justify-between border-t border-slate-200 pt-5">
                <SecondaryButton onClick={() => navigate(-1)}>← Quay lại</SecondaryButton>
                <PrimaryButton disabled={!selectedResidentId || mutation.isPending} onClick={() => mutation.mutate()}>
                    {mutation.isPending ? "Đang lưu..." : "Lưu Kết quả Khám → Xác định Mức độ Điều trị"}
                </PrimaryButton>
            </div>
        </WorkflowPage>
    );
}
