import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { APP_ROUTES } from "../../constants/appRoutes";
import { CARE_LEVEL_LABEL, GENDER_LABEL, MOBILITY_STATUS_LABEL } from "./constants";
import { ReceptionField, TextArea, TextInput } from "./components/receptionField";
import { residentRepository } from "./services/residentRepository";
import type { CareLevel, Gender, MobilityStatus, Resident, ResidentFormPayload } from "./types";

type ResidentFormState = {
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
};

type FormErrors = Partial<Record<keyof ResidentFormState, string>>;

const genderOptions: Gender[] = ["female", "male", "other"];
const careLevelOptions: CareLevel[] = ["independent", "assisted_living", "memory_care", "skilled_nursing"];
const mobilityOptions: MobilityStatus[] = ["independent", "walker", "wheelchair", "bed_bound"];

const residentFormSchema = z.object({
    fullName: z.string().trim().min(2, "Họ và tên bệnh nhân phải có ít nhất 2 ký tự."),
    dateOfBirth: z.string().min(1, "Vui lòng chọn ngày sinh."),
    gender: z.enum(["male", "female", "other"], "Vui lòng chọn giới tính."),
    phone: z.string(),
    address: z.string(),
    admissionDate: z.string().min(1, "Vui lòng chọn ngày nhập viện."),
    roomNumber: z.string().trim().min(1, "Vui lòng chỉ định buồng / giường bệnh."),
    careLevel: z.enum(["independent", "assisted_living", "memory_care", "skilled_nursing"], "Vui lòng chọn mức độ chăm sóc."),
    assignedNurse: z.string(),
    assignedDoctor: z.string(),
    emergencyContactName: z.string().trim().min(2, "Vui lòng nhập tên người thân / liên hệ khẩn cấp."),
    emergencyContactRelationship: z.string(),
    emergencyContactPhone: z.string().trim().min(7, "Số điện thoại liên hệ phải từ 7 chữ số trở lên."),
    emergencyContactEmail: z.string().email("Địa chỉ email người liên hệ không hợp lệ.").or(z.literal("")),
    primaryDiagnosis: z.string(),
    allergies: z.string(),
    currentMedications: z.string(),
    mobilityStatus: z.enum(["independent", "walker", "wheelchair", "bed_bound"]).or(z.literal("")),
});

const initialForm: ResidentFormState = {
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
};

const mapResidentToForm = (resident: Resident): ResidentFormState => ({
    fullName: resident.fullName,
    dateOfBirth: resident.dateOfBirth,
    gender: resident.gender,
    phone: resident.phone ?? "",
    address: resident.address ?? "",
    admissionDate: resident.admissionDate,
    roomNumber: resident.roomNumber ?? "",
    careLevel: resident.careLevel,
    assignedNurse: resident.assignedNurse ?? "",
    assignedDoctor: resident.assignedDoctor ?? "",
    emergencyContactName: resident.emergencyContactName,
    emergencyContactRelationship: resident.emergencyContactRelationship ?? "",
    emergencyContactPhone: resident.emergencyContactPhone,
    emergencyContactEmail: resident.emergencyContactEmail ?? "",
    primaryDiagnosis: resident.primaryDiagnosis ?? "",
    allergies: resident.allergies ?? "",
    currentMedications: resident.currentMedications ?? "",
    mobilityStatus: resident.mobilityStatus ?? "",
});

const toPayload = (form: ResidentFormState): ResidentFormPayload => ({
    fullName: form.fullName,
    dateOfBirth: form.dateOfBirth,
    gender: form.gender as Gender,
    phone: form.phone,
    address: form.address,
    admissionDate: form.admissionDate,
    roomNumber: form.roomNumber,
    careLevel: form.careLevel as CareLevel,
    assignedNurse: form.assignedNurse,
    assignedDoctor: form.assignedDoctor,
    emergencyContactName: form.emergencyContactName,
    emergencyContactRelationship: form.emergencyContactRelationship,
    emergencyContactPhone: form.emergencyContactPhone,
    emergencyContactEmail: form.emergencyContactEmail,
    primaryDiagnosis: form.primaryDiagnosis,
    allergies: form.allergies,
    currentMedications: form.currentMedications,
    mobilityStatus: form.mobilityStatus,
});

export function ResidentFormPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [form, setForm] = useState(initialForm);
    const [errors, setErrors] = useState<FormErrors>({});
    const [isLoading, setIsLoading] = useState(Boolean(id));
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    const isEditMode = Boolean(id);

    useEffect(() => {
        if (!id) {
            return;
        }

        let isActive = true;
        setIsLoading(true);

        residentRepository
            .getResident(id)
            .then((resident) => {
                if (isActive) {
                    setForm(mapResidentToForm(resident));
                }
            })
            .catch(() => {
                if (isActive) {
                    setErrorMessage("Unable to load resident profile.");
                }
            })
            .finally(() => {
                if (isActive) {
                    setIsLoading(false);
                }
            });

        return () => {
            isActive = false;
        };
    }, [id]);

    const completionScore = useMemo(() => {
        const requiredFields: Array<keyof ResidentFormState> = [
            "fullName",
            "dateOfBirth",
            "gender",
            "roomNumber",
            "admissionDate",
            "careLevel",
            "emergencyContactName",
            "emergencyContactPhone",
        ];
        const completedFields = requiredFields.filter((field) => String(form[field]).trim());

        return Math.round((completedFields.length / requiredFields.length) * 100);
    }, [form]);

    const updateField = <Key extends keyof ResidentFormState>(field: Key, value: ResidentFormState[Key]) => {
        setForm((currentForm) => ({ ...currentForm, [field]: value }));
        setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }));
        setErrorMessage("");
    };

    const validateForm = () => {
        const result = residentFormSchema.safeParse(form);

        if (result.success) {
            setErrors({});
            return true;
        }

        const nextErrors: FormErrors = {};

        for (const issue of result.error.issues) {
            const field = issue.path[0] as keyof ResidentFormState;
            nextErrors[field] = issue.message;
        }

        setErrors(nextErrors);
        return false;
    };

    const handleSubmit = async () => {
        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);

        try {
            const savedResident = isEditMode && id ? await residentRepository.updateResident(id, toPayload(form)) : await residentRepository.createResident(toPayload(form));

            navigate(`${APP_ROUTES.RESIDENTS}/${savedResident.id}`);
        } catch {
            setErrorMessage("Không thể lưu thông tin bệnh nhân. Vui lòng kiểm tra lại biểu mẫu.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <main className="page-shell">
                <div className="empty-state">
                    <strong>Đang tải biểu mẫu bệnh nhân...</strong>
                    <span>Đang nạp dữ liệu hồ sơ bệnh án.</span>
                </div>
            </main>
        );
    }

    return (
        <main className="page-shell">
            <section className="page-header">
                <div>
                    <span className="eyebrow">Hồ sơ Bệnh nhân</span>
                    <h1>{isEditMode ? "Chỉnh sửa Hồ sơ Bệnh nhân" : "Tiếp nhận Bệnh nhân mới"}</h1>
                    <p>Quản lý thông tin hành chính, phân buồng giường, chỉ định bác sĩ điều trị và thông tin thân nhân.</p>
                </div>
                <Link className="secondary-action" to={APP_ROUTES.RESIDENTS}>
                    ← Quay lại danh sách
                </Link>
            </section>

            <section className="intake-summary">
                <div>
                    <strong>{completionScore}% hoàn tất</strong>
                    <span>Các trường thông tin bệnh án bắt buộc</span>
                </div>
                <div className="progress-track">
                    <div style={{ width: `${completionScore}%` }} />
                </div>
            </section>

            {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}

            <form className="intake-form">
                <section className="form-card">
                    <div className="form-card__header">
                        <span>01</span>
                        <div>
                            <h2>Thông tin Cá nhân & Hành chính</h2>
                            <p>Thông tin định danh người bệnh và liên hệ trực tiếp.</p>
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
                        <TextInput label="Số điện thoại liên hệ" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} />
                        <TextArea label="Địa chỉ thường trú" value={form.address} onChange={(event) => updateField("address", event.target.value)} />
                    </div>
                </section>

                <section className="form-card">
                    <div className="form-card__header">
                        <span>02</span>
                        <div>
                            <h2>Thông tin Nhập viện & Phân buồng</h2>
                            <p>Số phòng, ngày vào viện, mức độ chăm sóc và bác sĩ phụ trách.</p>
                        </div>
                    </div>
                    <div className="form-grid">
                        <TextInput
                            label="Ngày nhập viện *"
                            type="date"
                            value={form.admissionDate}
                            error={errors.admissionDate}
                            onChange={(event) => updateField("admissionDate", event.target.value)}
                        />
                        <TextInput label="Buồng / Giường bệnh *" value={form.roomNumber} error={errors.roomNumber} onChange={(event) => updateField("roomNumber", event.target.value)} />
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
                        <TextInput label="Điều dưỡng phụ trách" value={form.assignedNurse} onChange={(event) => updateField("assignedNurse", event.target.value)} />
                        <TextInput label="Bác sĩ điều trị" value={form.assignedDoctor} onChange={(event) => updateField("assignedDoctor", event.target.value)} />
                    </div>
                </section>

                <section className="form-card">
                    <div className="form-card__header">
                        <span>03</span>
                        <div>
                            <h2>Người liên hệ Khẩn cấp / Thân nhân</h2>
                            <p>Thông tin thân nhân để trao đổi bệnh lý và đồng thuận phẫu thuật/điều trị.</p>
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
                            value={form.emergencyContactRelationship}
                            onChange={(event) => updateField("emergencyContactRelationship", event.target.value)}
                        />
                        <TextInput
                            label="Số điện thoại *"
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
                            <h2>Tóm tắt Tiền sử & Bệnh học</h2>
                            <p>Chẩn đoán y khoa, thuốc và dị ứng hiển thị trong hồ sơ bệnh án.</p>
                        </div>
                    </div>
                    <div className="form-grid">
                        <TextInput label="Chẩn đoán chính vào viện" value={form.primaryDiagnosis} onChange={(event) => updateField("primaryDiagnosis", event.target.value)} />
                        <ReceptionField label="Tình trạng vận động">
                            <select value={form.mobilityStatus} onChange={(event) => updateField("mobilityStatus", event.target.value as MobilityStatus | "")}>
                                <option value="">Chọn tình trạng vận động</option>
                                {mobilityOptions.map((status) => (
                                    <option key={status} value={status}>
                                        {MOBILITY_STATUS_LABEL[status]}
                                    </option>
                                ))}
                            </select>
                        </ReceptionField>
                        <TextArea label="Tiền sử dị ứng thuốc / thực phẩm" value={form.allergies} onChange={(event) => updateField("allergies", event.target.value)} />
                        <TextArea label="Thuốc đang dùng trước khi nhập viện" value={form.currentMedications} onChange={(event) => updateField("currentMedications", event.target.value)} />
                    </div>
                </section>
            </form>

            <footer className="sticky-actions">
                <Link className="secondary-action" to={APP_ROUTES.RESIDENTS}>
                    Hủy bỏ
                </Link>
                <button className="primary-action" type="button" disabled={isSubmitting} onClick={handleSubmit}>
                    {isSubmitting ? "Đang lưu..." : isEditMode ? "Lưu thay đổi" : "Tạo hồ sơ bệnh nhân"}
                </button>
            </footer>
        </main>
    );
}
