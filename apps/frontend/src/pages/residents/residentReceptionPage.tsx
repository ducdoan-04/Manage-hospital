import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { APP_ROUTES } from "../../constants/appRoutes";
import { z } from "zod";
import { CARE_LEVEL_LABEL, COGNITIVE_STATUS_LABEL, FALL_RISK_LABEL, GENDER_LABEL, MOBILITY_STATUS_LABEL } from "./constants";
import { ReceptionField, TextArea, TextInput } from "./components/receptionField";
import { residentRepository } from "./services/residentRepository";
import type { CareLevel, CognitiveStatus, FallRisk, Gender, MobilityStatus, ResidentEvaluationPayload } from "./types";

type FlatReceptionForm = {
    fullName: string;
    dateOfBirth: string;
    gender: Gender | "";
    phone: string;
    address: string;
    admissionDate: string;
    roomNumber: string;
    careLevel: CareLevel | "";
    assignedNurse: string;
    assignedDoctor: string;
    emergencyContactName: string;
    emergencyContactRelationship: string;
    emergencyContactPhone: string;
    emergencyContactEmail: string;
    primaryDiagnosis: string;
    allergies: string;
    currentMedications: string;
    mobilityStatus: MobilityStatus | "";
    cognitiveStatus: CognitiveStatus | "";
    fallRisk: FallRisk | "";
    painLevel: number;
    nutritionNotes: string;
    clinicalNotes: string;
};

type FormErrors = Partial<Record<keyof FlatReceptionForm, string>>;

const genderOptions: Gender[] = ["female", "male", "other"];
const careLevelOptions: CareLevel[] = ["independent", "assisted_living", "memory_care", "skilled_nursing"];
const mobilityOptions: MobilityStatus[] = ["independent", "walker", "wheelchair", "bed_bound"];
const cognitiveOptions: CognitiveStatus[] = ["alert_oriented", "mild_impairment", "moderate_impairment", "severe_impairment"];
const fallRiskOptions: FallRisk[] = ["low", "medium", "high"];

const formSchema = z.object({
    fullName: z.string().trim().min(2, "Vui lòng nhập họ và tên bệnh nhân."),
    dateOfBirth: z.string().min(1, "Vui lòng chọn ngày sinh."),
    gender: z.enum(["male", "female", "other"], "Vui lòng chọn giới tính."),
    phone: z.string(),
    address: z.string(),
    admissionDate: z.string().min(1, "Vui lòng chọn ngày tiếp nhận khám."),
    roomNumber: z.string(),
    careLevel: z.enum(["independent", "assisted_living", "memory_care", "skilled_nursing"], "Vui lòng chọn mức độ điều trị."),
    assignedNurse: z.string(),
    assignedDoctor: z.string(),
    emergencyContactName: z.string().trim().min(2, "Vui lòng nhập tên người liên hệ khẩn cấp."),
    emergencyContactRelationship: z.string(),
    emergencyContactPhone: z.string().trim().min(7, "Số điện thoại liên hệ phải từ 7 chữ số trở lên."),
    emergencyContactEmail: z.string().email("Địa chỉ email người liên hệ không hợp lệ.").or(z.literal("")),
    primaryDiagnosis: z.string(),
    allergies: z.string(),
    currentMedications: z.string(),
    mobilityStatus: z.enum(["independent", "walker", "wheelchair", "bed_bound"]).or(z.literal("")),
    cognitiveStatus: z.enum(["alert_oriented", "mild_impairment", "moderate_impairment", "severe_impairment"]).or(z.literal("")),
    fallRisk: z.enum(["low", "medium", "high"]).or(z.literal("")),
    painLevel: z.coerce.number().min(0).max(10),
    nutritionNotes: z.string(),
    clinicalNotes: z.string(),
});

const initialForm: FlatReceptionForm = {
    fullName: "",
    dateOfBirth: "",
    gender: "",
    phone: "",
    address: "",
    admissionDate: new Date().toISOString().slice(0, 10),
    roomNumber: "",
    careLevel: "",
    assignedNurse: "",
    assignedDoctor: "",
    emergencyContactName: "",
    emergencyContactRelationship: "",
    emergencyContactPhone: "",
    emergencyContactEmail: "",
    primaryDiagnosis: "",
    allergies: "",
    currentMedications: "",
    mobilityStatus: "",
    cognitiveStatus: "",
    fallRisk: "",
    painLevel: 0,
    nutritionNotes: "",
    clinicalNotes: "",
};

const toPayload = (form: FlatReceptionForm): ResidentEvaluationPayload => ({
    personalInfo: {
        fullName: form.fullName,
        dateOfBirth: form.dateOfBirth,
        gender: form.gender,
        phone: form.phone,
        address: form.address,
    },
    admissionInfo: {
        admissionDate: form.admissionDate,
        roomNumber: form.roomNumber,
        careLevel: form.careLevel,
        assignedNurse: form.assignedNurse,
        assignedDoctor: form.assignedDoctor,
    },
    emergencyContact: {
        name: form.emergencyContactName,
        relationship: form.emergencyContactRelationship,
        phone: form.emergencyContactPhone,
        email: form.emergencyContactEmail,
    },
    medicalSummary: {
        primaryDiagnosis: form.primaryDiagnosis,
        allergies: form.allergies,
        currentMedications: form.currentMedications,
        mobilityStatus: form.mobilityStatus,
    },
    initialEvaluation: {
        cognitiveStatus: form.cognitiveStatus,
        fallRisk: form.fallRisk,
        painLevel: form.painLevel,
        nutritionNotes: form.nutritionNotes,
        clinicalNotes: form.clinicalNotes,
    },
});

export function ResidentReceptionPage() {
    const [form, setForm] = useState(initialForm);
    const [errors, setErrors] = useState<FormErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");

    const completionScore = useMemo(() => {
        const requiredFields: Array<keyof FlatReceptionForm> = ["fullName", "dateOfBirth", "gender", "admissionDate", "careLevel", "emergencyContactName", "emergencyContactPhone"];
        const completedFields = requiredFields.filter((field) => String(form[field]).trim());

        return Math.round((completedFields.length / requiredFields.length) * 100);
    }, [form]);

    const updateField = <Key extends keyof FlatReceptionForm>(field: Key, value: FlatReceptionForm[Key]) => {
        setForm((currentForm) => ({
            ...currentForm,
            [field]: value,
        }));
        setErrors((currentErrors) => ({
            ...currentErrors,
            [field]: undefined,
        }));
        setSuccessMessage("");
    };

    const validateForm = () => {
        const result = formSchema.safeParse(form);

        if (result.success) {
            setErrors({});
            return true;
        }

        const nextErrors: FormErrors = {};

        for (const issue of result.error.issues) {
            const field = issue.path[0] as keyof FlatReceptionForm;
            nextErrors[field] = issue.message;
        }

        setErrors(nextErrors);
        return false;
    };

    const handleSubmit = async (mode: "draft" | "submit") => {
        if (mode === "submit" && !validateForm()) {
            return;
        }

        setIsSubmitting(true);

        try {
            const resident = await residentRepository.createPreScreening(toPayload(form));
            setSuccessMessage(mode === "draft" ? `Đã lưu bản nháp tiếp đón cho bệnh nhân ${resident.fullName}.` : `Bệnh nhân ${resident.fullName} đã sẵn sàng cho bước khám & đánh giá lâm sàng.`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="page-shell">
            <section className="page-header">
                <div>
                    <span className="eyebrow">Tiếp đón & Phân loại Sàng lọc</span>
                    <h1>Tiếp nhận & Sàng lọc Ban đầu</h1>
                    <p>Thu thập thông tin hành chính, người liên hệ khẩn cấp, bệnh sử và đánh giá ban đầu của điều dưỡng.</p>
                </div>
                <Link className="secondary-action" to={APP_ROUTES.RESIDENTS}>
                    ← Quay lại danh sách
                </Link>
            </section>

            <section className="intake-summary">
                <div>
                    <strong>{completionScore}% hoàn tất</strong>
                    <span>Thông tin tiếp nhận bắt buộc</span>
                </div>
                <div className="progress-track">
                    <div style={{ width: `${completionScore}%` }} />
                </div>
            </section>

            {successMessage ? <div className="success-banner">{successMessage}</div> : null}

            <form className="intake-form">
                <section className="form-card">
                    <div className="form-card__header">
                        <span>01</span>
                        <div>
                            <h2>Thông tin Cá nhân & Hành chính</h2>
                            <p>Thông tin định danh và số điện thoại liên lạc.</p>
                        </div>
                    </div>
                    <div className="form-grid">
                        <TextInput label="Họ và tên bệnh nhân *" value={form.fullName} error={errors.fullName} onChange={(event) => updateField("fullName", event.target.value)} />
                        <TextInput
                            label="Ngày sinh *"
                            type="date"
                            value={form.dateOfBirth}
                            error={errors.dateOfBirth}
                            onChange={(event) => updateField("dateOfBirth", event.target.value)}
                        />
                        <ReceptionField label="Giới tính *" error={errors.gender}>
                            <select value={form.gender} onChange={(event) => updateField("gender", event.target.value as Gender | "")}>
                                <option value="">Chọn giới tính</option>
                                {genderOptions.map((gender) => (
                                    <option key={gender} value={gender}>
                                        {GENDER_LABEL[gender]}
                                    </option>
                                ))}
                            </select>
                        </ReceptionField>
                        <TextInput label="Số điện thoại" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} />
                        <TextArea label="Địa chỉ thường trú" value={form.address} onChange={(event) => updateField("address", event.target.value)} />
                    </div>
                </section>

                <section className="form-card">
                    <div className="form-card__header">
                        <span>02</span>
                        <div>
                            <h2>Thông tin Nhập viện Dự kiến</h2>
                            <p>Phân luồng chăm sóc và chỉ định bác sĩ tiếp nhận.</p>
                        </div>
                    </div>
                    <div className="form-grid">
                        <TextInput
                            label="Ngày tiếp nhận *"
                            type="date"
                            value={form.admissionDate}
                            error={errors.admissionDate}
                            onChange={(event) => updateField("admissionDate", event.target.value)}
                        />
                        <TextInput label="Dự kiến buồng / phòng" placeholder="P-104" value={form.roomNumber} onChange={(event) => updateField("roomNumber", event.target.value)} />
                        <ReceptionField label="Mức độ điều trị *" error={errors.careLevel}>
                            <select value={form.careLevel} onChange={(event) => updateField("careLevel", event.target.value as CareLevel | "")}>
                                <option value="">Chọn mức độ điều trị</option>
                                {careLevelOptions.map((level) => (
                                    <option key={level} value={level}>
                                        {CARE_LEVEL_LABEL[level]}
                                    </option>
                                ))}
                            </select>
                        </ReceptionField>
                        <TextInput
                            label="Điều dưỡng phụ trách"
                            placeholder="ĐD. Trần Thu Hà"
                            value={form.assignedNurse}
                            onChange={(event) => updateField("assignedNurse", event.target.value)}
                        />
                        <TextInput
                            label="Bác sĩ tiếp nhận"
                            placeholder="BS.CKII. Nguyễn Văn Hùng"
                            value={form.assignedDoctor}
                            onChange={(event) => updateField("assignedDoctor", event.target.value)}
                        />
                    </div>
                </section>

                <section className="form-card">
                    <div className="form-card__header">
                        <span>03</span>
                        <div>
                            <h2>Người liên hệ Khẩn cấp / Thân nhân</h2>
                            <p>Người giám hộ hoặc thân nhân liên hệ khi cần thiết.</p>
                        </div>
                    </div>
                    <div className="form-grid">
                        <TextInput
                            label="Họ tên người thân *"
                            value={form.emergencyContactName}
                            error={errors.emergencyContactName}
                            onChange={(event) => updateField("emergencyContactName", event.target.value)}
                        />
                        <TextInput
                            label="Mối quan hệ"
                            placeholder="Con gái / Vợ / Chồng"
                            value={form.emergencyContactRelationship}
                            onChange={(event) => updateField("emergencyContactRelationship", event.target.value)}
                        />
                        <TextInput
                            label="Số điện thoại liên hệ *"
                            value={form.emergencyContactPhone}
                            error={errors.emergencyContactPhone}
                            onChange={(event) => updateField("emergencyContactPhone", event.target.value)}
                        />
                        <TextInput
                            label="Email liên hệ"
                            type="email"
                            value={form.emergencyContactEmail}
                            error={errors.emergencyContactEmail}
                            onChange={(event) => updateField("emergencyContactEmail", event.target.value)}
                        />
                    </div>
                </section>

                <section className="form-card">
                    <div className="form-card__header">
                        <span>04</span>
                        <div>
                            <h2>Tóm tắt Bệnh lý & Lâm sàng</h2>
                            <p>Bệnh sử và các ghi nhận y tế ban đầu của bệnh nhân.</p>
                        </div>
                    </div>
                    <div className="form-grid">
                        <TextInput label="Lý do khám / Chẩn đoán sơ bộ" value={form.primaryDiagnosis} onChange={(event) => updateField("primaryDiagnosis", event.target.value)} />
                        <ReceptionField label="Tình trạng vận động">
                            <select value={form.mobilityStatus} onChange={(event) => updateField("mobilityStatus", event.target.value as MobilityStatus | "")}>
                                <option value="">Chọn khả năng vận động</option>
                                {mobilityOptions.map((status) => (
                                    <option key={status} value={status}>
                                        {MOBILITY_STATUS_LABEL[status]}
                                    </option>
                                ))}
                            </select>
                        </ReceptionField>
                        <TextArea label="Tiền sử dị ứng (thuốc, thức ăn)" value={form.allergies} onChange={(event) => updateField("allergies", event.target.value)} />
                        <TextArea label="Các loại thuốc đang sử dụng" value={form.currentMedications} onChange={(event) => updateField("currentMedications", event.target.value)} />
                    </div>
                </section>

                <section className="form-card">
                    <div className="form-card__header">
                        <span>05</span>
                        <div>
                            <h2>Sàng lọc & Đánh giá Ban đầu</h2>
                            <p>Sàng lọc nguy cơ ngã, tri giác và ghi chú của điều dưỡng.</p>
                        </div>
                    </div>
                    <div className="form-grid">
                        <ReceptionField label="Tình trạng nhận thức / tri giác">
                            <select value={form.cognitiveStatus} onChange={(event) => updateField("cognitiveStatus", event.target.value as CognitiveStatus | "")}>
                                <option value="">Chọn tình trạng tri giác</option>
                                {cognitiveOptions.map((status) => (
                                    <option key={status} value={status}>
                                        {COGNITIVE_STATUS_LABEL[status]}
                                    </option>
                                ))}
                            </select>
                        </ReceptionField>
                        <ReceptionField label="Nguy cơ té ngã">
                            <select value={form.fallRisk} onChange={(event) => updateField("fallRisk", event.target.value as FallRisk | "")}>
                                <option value="">Chọn mức độ nguy cơ ngã</option>
                                {fallRiskOptions.map((risk) => (
                                    <option key={risk} value={risk}>
                                        {FALL_RISK_LABEL[risk]}
                                    </option>
                                ))}
                            </select>
                        </ReceptionField>
                        <TextInput
                            label="Thang điểm đau (0 - 10)"
                            type="number"
                            min={0}
                            max={10}
                            value={form.painLevel}
                            onChange={(event) => updateField("painLevel", Number(event.target.value))}
                        />
                        <TextArea label="Ghi chú chế độ ăn / dinh dưỡng" value={form.nutritionNotes} onChange={(event) => updateField("nutritionNotes", event.target.value)} />
                        <TextArea label="Ghi chú nhận định ban đầu của điều dưỡng" value={form.clinicalNotes} onChange={(event) => updateField("clinicalNotes", event.target.value)} />
                    </div>
                </section>
            </form>

            <footer className="sticky-actions">
                <button className="secondary-action" type="button" disabled={isSubmitting} onClick={() => handleSubmit("draft")}>
                    Lưu bản nháp
                </button>
                <button className="primary-action" type="button" disabled={isSubmitting} onClick={() => handleSubmit("submit")}>
                    {isSubmitting ? "Đang lưu..." : "Xác nhận & Chuyển khám"}
                </button>
            </footer>
        </main>
    );
}
