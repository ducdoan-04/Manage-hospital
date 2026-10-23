import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { APP_ROUTES } from "../../constants/appRoutes";
import { CARE_LEVEL_LABEL, COGNITIVE_STATUS_LABEL, FALL_RISK_LABEL, GENDER_LABEL, MOBILITY_STATUS_LABEL, RESIDENT_STATUS_LABEL } from "./constants";
import { ResidentStatusBadge } from "./components/residentStatusBadge";
import { calculateAge, residentRepository } from "./services/residentRepository";
import type { Resident, ResidentStatus } from "./types";

const residentStatuses: ResidentStatus[] = ["pending", "under_evaluation", "admitted", "discharged"];

const displayValue = (value?: string | number) => (value === undefined || value === "" ? "Chưa ghi nhận" : String(value));

export function ResidentProfileDetailPage() {
    const { id } = useParams();
    const [resident, setResident] = useState<Resident | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        if (!id) {
            setErrorMessage("Thiếu mã định danh bệnh nhân.");
            setIsLoading(false);
            return;
        }

        let isActive = true;
        setIsLoading(true);

        residentRepository
            .getResident(id)
            .then((result) => {
                if (isActive) {
                    setResident(result);
                }
            })
            .catch(() => {
                if (isActive) {
                    setErrorMessage("Không thể tải thông tin hồ sơ bệnh nhân.");
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

    const handleStatusChange = async (status: ResidentStatus) => {
        if (!id || !resident || resident.status === status) {
            return;
        }

        setIsUpdatingStatus(true);
        setErrorMessage("");

        try {
            const updatedResident = await residentRepository.updateStatus(id, {
                status,
            });
            setResident(updatedResident);
        } catch {
            setErrorMessage("Không thể cập nhật trạng thái bệnh nhân.");
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    if (isLoading) {
        return (
            <main className="page-shell">
                <div className="empty-state">
                    <strong>Đang tải hồ sơ bệnh án...</strong>
                    <span>Đang trích xuất dữ liệu lâm sàng của bệnh nhân.</span>
                </div>
            </main>
        );
    }

    if (!resident) {
        return (
            <main className="page-shell">
                <div className="empty-state">
                    <strong>Không tìm thấy bệnh nhân</strong>
                    <span>{errorMessage || "Hồ sơ bệnh nhân được yêu cầu không tồn tại."}</span>
                </div>
            </main>
        );
    }

    return (
        <main className="page-shell">
            <section className="page-header">
                <div>
                    <span className="eyebrow">Hồ sơ Bệnh nhân</span>
                    <h1>{resident.fullName}</h1>
                    <p>
                        Mã BN: {resident.residentCode} · Buồng/Giường: {resident.roomNumber ?? "Chưa phân phòng"} · {CARE_LEVEL_LABEL[resident.careLevel]}
                    </p>
                </div>
                <div className="header-actions">
                    <Link className="secondary-action" to={APP_ROUTES.RESIDENTS}>
                        ← Quay lại danh sách
                    </Link>
                    <Link className="primary-action" to={`${APP_ROUTES.RESIDENTS}/${resident.id}/edit`}>
                        Chỉnh sửa hồ sơ
                    </Link>
                </div>
            </section>

            {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}

            <section className="profile-hero">
                <div className="profile-avatar" aria-hidden="true">
                    {resident.fullName
                        .split(" ")
                        .map((name) => name[0])
                        .slice(0, 2)
                        .join("")}
                </div>
                <div>
                    <h2>{resident.fullName}</h2>
                    <p>
                        {calculateAge(resident.dateOfBirth)} tuổi · {GENDER_LABEL[resident.gender]} · Ngày vào viện: {resident.admissionDate}
                    </p>
                </div>
                <ResidentStatusBadge status={resident.status} />
            </section>

            <section className="profile-grid">
                <article className="detail-panel">
                    <h2>Thông tin Nhập viện</h2>
                    <dl className="detail-list">
                        <div>
                            <dt>Buồng / Giường</dt>
                            <dd>{displayValue(resident.roomNumber)}</dd>
                        </div>
                        <div>
                            <dt>Mức độ điều trị</dt>
                            <dd>{CARE_LEVEL_LABEL[resident.careLevel]}</dd>
                        </div>
                        <div>
                            <dt>Điều dưỡng phụ trách</dt>
                            <dd>{displayValue(resident.assignedNurse)}</dd>
                        </div>
                        <div>
                            <dt>Bác sĩ điều trị</dt>
                            <dd>{displayValue(resident.assignedDoctor)}</dd>
                        </div>
                    </dl>
                </article>

                <article className="detail-panel">
                    <h2>Trạng thái Điều trị</h2>
                    <label className="field">
                        <span>Cập nhật trạng thái</span>
                        <select value={resident.status} disabled={isUpdatingStatus} onChange={(event) => handleStatusChange(event.target.value as ResidentStatus)}>
                            {residentStatuses.map((status) => (
                                <option key={status} value={status}>
                                    {RESIDENT_STATUS_LABEL[status]}
                                </option>
                            ))}
                        </select>
                    </label>
                </article>

                <article className="detail-panel">
                    <h2>Người liên hệ Khẩn cấp / Thân nhân</h2>
                    <dl className="detail-list">
                        <div>
                            <dt>Họ và tên</dt>
                            <dd>{resident.emergencyContactName}</dd>
                        </div>
                        <div>
                            <dt>Quan hệ</dt>
                            <dd>{displayValue(resident.emergencyContactRelationship)}</dd>
                        </div>
                        <div>
                            <dt>Điện thoại</dt>
                            <dd>{resident.emergencyContactPhone}</dd>
                        </div>
                        <div>
                            <dt>Email</dt>
                            <dd>{displayValue(resident.emergencyContactEmail)}</dd>
                        </div>
                    </dl>
                </article>

                <article className="detail-panel">
                    <h2>Tóm tắt Lâm sàng & Bệnh học</h2>
                    <dl className="detail-list">
                        <div>
                            <dt>Chẩn đoán chính</dt>
                            <dd>{displayValue(resident.primaryDiagnosis)}</dd>
                        </div>
                        <div>
                            <dt>Tiền sử dị ứng</dt>
                            <dd>{displayValue(resident.allergies)}</dd>
                        </div>
                        <div>
                            <dt>Thuốc đang dùng</dt>
                            <dd>{displayValue(resident.currentMedications)}</dd>
                        </div>
                        <div>
                            <dt>Tình trạng vận động</dt>
                            <dd>{resident.mobilityStatus ? MOBILITY_STATUS_LABEL[resident.mobilityStatus] : "Chưa ghi nhận"}</dd>
                        </div>
                    </dl>
                </article>

                <article className="detail-panel detail-panel--wide">
                    <h2>Đánh giá & Sàng lọc Ban đầu</h2>
                    <dl className="detail-list detail-list--three">
                        <div>
                            <dt>Tình trạng tri giác</dt>
                            <dd>{resident.cognitiveStatus ? COGNITIVE_STATUS_LABEL[resident.cognitiveStatus] : "Chưa ghi nhận"}</dd>
                        </div>
                        <div>
                            <dt>Nguy cơ té ngã</dt>
                            <dd>{resident.fallRisk ? FALL_RISK_LABEL[resident.fallRisk] : "Chưa ghi nhận"}</dd>
                        </div>
                        <div>
                            <dt>Thang điểm đau</dt>
                            <dd>{displayValue(resident.painLevel)} / 10</dd>
                        </div>
                        <div>
                            <dt>Chế độ dinh dưỡng</dt>
                            <dd>{displayValue(resident.nutritionNotes)}</dd>
                        </div>
                        <div>
                            <dt>Ghi chú lâm sàng</dt>
                            <dd>{displayValue(resident.clinicalNotes)}</dd>
                        </div>
                    </dl>
                </article>
            </section>
        </main>
    );
}
