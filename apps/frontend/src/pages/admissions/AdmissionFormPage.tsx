import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { admissionsService } from "../../services/admissions";
import { facilityService } from "../../services/facility";
import { residentsService } from "../../services/residents";
import { fieldClassName, labelClassName, LoadingState, Notice, Panel, PrimaryButton, SecondaryButton, WorkflowPage } from "../../components/workflow/WorkflowUi";

const requiredConsents = [
    "Giấy cam kết nhập viện và tuân thủ nội quy",
    "Cam kết bảo mật thông tin bệnh án y khoa",
    "Cam kết chi trả viện phí & đồng chi trả BHYT",
    "Phiếu đồng ý phẫu thuật / thủ thuật can thiệp y tế",
];

export default function AdmissionFormPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const residentIdFromQuery = searchParams.get("residentId") ?? "";
    const residentsQuery = useQuery({ queryKey: ["resident-options"], queryFn: () => residentsService.getAll() });
    const facilityQuery = useQuery({ queryKey: ["facility-settings"], queryFn: facilityService.getCurrentSettings });
    const [form, setForm] = useState({
        residentId: residentIdFromQuery,
        bedId: "",
        admissionDate: new Date().toISOString().slice(0, 10),
        payerSource: "Medicare",
        policyNumber: "",
        primaryPhysician: "",
        nurseInCharge: "",
        consents: [] as string[],
    });
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!form.residentId && residentsQuery.data?.[0]) {
            setForm((current) => ({ ...current, residentId: residentsQuery.data![0]!.id }));
        }
    }, [form.residentId, residentsQuery.data]);

    const availableBeds = useMemo(
        () => facilityQuery.data?.rooms.flatMap((room) => room.beds.filter((bed) => bed.status === "AVAILABLE").map((bed) => ({ ...bed, room }))) ?? [],
        [facilityQuery.data],
    );
    const selectedResident = residentsQuery.data?.find((resident) => resident.id === form.residentId);
    const canSubmit = Boolean(
        form.residentId && facilityQuery.data?.id && form.bedId && form.admissionDate && form.payerSource && requiredConsents.every((consent) => form.consents.includes(consent)),
    );

    const mutation = useMutation({
        mutationFn: () =>
            admissionsService.create({
                ...form,
                facilityId: facilityQuery.data!.id,
            }),
        onSuccess: (result) => {
            setMessage("Tiếp nhận nhập viện thành công. Trạng thái bệnh nhân chuyển sang Đang điều trị nội trú.");
            const residentId = result?.data?.residentId ?? result?.residentId ?? form.residentId;
            window.setTimeout(() => navigate(`/residents/${residentId}`), 800);
        },
    });

    if (residentsQuery.isLoading || facilityQuery.isLoading) {
        return (
            <WorkflowPage title="Hồ sơ Nhập viện">
                <Panel>
                    <LoadingState />
                </Panel>
            </WorkflowPage>
        );
    }

    return (
        <WorkflowPage
            breadcrumb="Bệnh nhân  >  Quy trình Nhập viện Điều trị"
            title="Bước 2: Hồ sơ Nhập viện & Phân buồng"
            description="Chỉ định buồng giường bệnh khả dụng, xác nhận thông tin BHYT và ghi nhận các cam kết y khoa."
        >
            <div className="mb-5 grid grid-cols-3 overflow-hidden rounded-lg border border-blue-200 text-center text-sm font-semibold">
                <div className="bg-white px-4 py-3 text-blue-600">1&nbsp; Sàng lọc ban đầu ✓</div>
                <div className="bg-blue-600 px-4 py-3 text-white">2&nbsp; Hồ sơ Nhập viện</div>
                <div className="bg-white px-4 py-3 text-slate-400">3&nbsp; Khám & Đánh giá lâm sàng</div>
            </div>
            {message && (
                <div className="mb-4">
                    <Notice type="success">{message}</Notice>
                </div>
            )}
            {mutation.error && (
                <div className="mb-4">
                    <Notice type="error">{String(mutation.error)}</Notice>
                </div>
            )}
            <div className="grid gap-6 lg:grid-cols-[1fr_310px]">
                <div className="space-y-5">
                    <Panel title="Thông tin Bệnh nhân">
                        <div className="grid gap-4 md:grid-cols-2">
                            <label className={labelClassName}>
                                Chọn bệnh nhân *
                                <select className={fieldClassName} value={form.residentId} onChange={(event) => setForm({ ...form, residentId: event.target.value })}>
                                    {residentsQuery.data?.map((resident) => (
                                        <option key={resident.id} value={resident.id}>
                                            {resident.fullName} · {resident.roomNumber ?? "Chưa phân phòng"}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                                <strong className="block text-slate-900">{selectedResident?.fullName ?? "Chưa chọn bệnh nhân"}</strong>
                                {selectedResident && (
                                    <>
                                        Ngày sinh: {selectedResident.dateOfBirth} · Mã BN: {selectedResident.residentCode}
                                    </>
                                )}
                            </div>
                        </div>
                    </Panel>
                    <Panel title="Chi tiết Nhập viện">
                        <div className="grid gap-5 md:grid-cols-2">
                            <label className={labelClassName}>
                                Ngày nhập viện *
                                <input
                                    className={fieldClassName}
                                    type="date"
                                    value={form.admissionDate}
                                    onChange={(event) => setForm({ ...form, admissionDate: event.target.value })}
                                />
                            </label>
                            <label className={labelClassName}>
                                Phân buồng / Giường bệnh *
                                <select className={fieldClassName} value={form.bedId} onChange={(event) => setForm({ ...form, bedId: event.target.value })}>
                                    <option value="">Chọn buồng giường còn trống...</option>
                                    {availableBeds.map((bed) => (
                                        <option key={bed.id} value={bed.id}>
                                            Phòng {bed.room.roomNumber} - Giường {bed.bedNumber} ({bed.room.roomType})
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    </Panel>
                    <Panel title="Đối tượng Chi trả & BHYT">
                        <div className="grid gap-5 md:grid-cols-2">
                            <label className={labelClassName}>
                                Nguồn thanh toán / Bảo hiểm *
                                <select className={fieldClassName} value={form.payerSource} onChange={(event) => setForm({ ...form, payerSource: event.target.value })}>
                                    <option value="Medicare">Bảo hiểm Y tế (BHYT Nhà nước)</option>
                                    <option value="Medicaid">Chính sách bảo trợ / Hộ nghèo</option>
                                    <option value="Private Pay">Viện phí tự chi trả (Thu phí)</option>
                                    <option value="Insurance">Bảo hiểm Sức khỏe / Thương mại</option>
                                </select>
                            </label>
                            <label className={labelClassName}>
                                Số thẻ BHYT / Mã hợp đồng bảo hiểm
                                <input className={fieldClassName} placeholder="VD: DN4010123456789" value={form.policyNumber} onChange={(event) => setForm({ ...form, policyNumber: event.target.value })} />
                            </label>
                        </div>
                    </Panel>
                    <Panel title="Đội ngũ Y Bác sĩ phụ trách">
                        <div className="grid gap-5 md:grid-cols-2">
                            <label className={labelClassName}>
                                Bác sĩ điều trị chính
                                <input className={fieldClassName} placeholder="BS.CKII. Nguyễn Văn Hùng" value={form.primaryPhysician} onChange={(event) => setForm({ ...form, primaryPhysician: event.target.value })} />
                            </label>
                            <label className={labelClassName}>
                                Điều dưỡng phụ trách buồng
                                <input className={fieldClassName} placeholder="ĐD. Trần Thu Hà" value={form.nurseInCharge} onChange={(event) => setForm({ ...form, nurseInCharge: event.target.value })} />
                            </label>
                        </div>
                    </Panel>
                    <Panel title="Văn bản Cam kết & Đồng thuận" description="Tất cả các cam kết y khoa bắt buộc phải được bệnh nhân hoặc thân nhân xác nhận trước khi hoàn tất nhập viện.">
                        <div className="grid gap-3 md:grid-cols-2">
                            {requiredConsents.map((consent) => (
                                <label key={consent} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm font-medium text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={form.consents.includes(consent)}
                                        onChange={(event) =>
                                            setForm({ ...form, consents: event.target.checked ? [...form.consents, consent] : form.consents.filter((item) => item !== consent) })
                                        }
                                    />
                                    {consent}
                                    <span className="ml-auto text-xs text-red-500 font-semibold">Bắt buộc</span>
                                </label>
                            ))}
                        </div>
                    </Panel>
                </div>
                <div className="space-y-5">
                    <Panel title="Bộ phận thực hiện">
                        <p className="font-bold text-slate-900">Phòng Tiếp đón & Nhập viện</p>
                        <p className="mt-2 text-sm text-slate-500">Hoàn tất thủ tục hành chính, phân buồng giường, kiểm tra thẻ BHYT và thu thập cam kết y tế.</p>
                    </Panel>
                    <Panel title="Công suất Giường bệnh">
                        <p className="text-3xl font-bold text-blue-600">{availableBeds.length}</p>
                        <p className="text-sm text-slate-500">giường bệnh còn trống trên tổng số {facilityQuery.data?.rooms.length ?? 0} buồng bệnh</p>
                    </Panel>
                </div>
            </div>
            <div className="mt-6 flex justify-between border-t border-slate-200 pt-5">
                <SecondaryButton onClick={() => navigate(-1)}>← Quay lại</SecondaryButton>
                <div className="flex gap-3">
                    <SecondaryButton onClick={() => setMessage("Đã lưu bản nháp hồ sơ vào phiên làm việc.")}>Lưu bản nháp</SecondaryButton>
                    <PrimaryButton disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()}>
                        {mutation.isPending ? "Đang xử lý..." : "Xác nhận Nhập viện"}
                    </PrimaryButton>
                </div>
            </div>
        </WorkflowPage>
    );
}
