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
                    <Link
                        className="secondary-action"
                        style={{ backgroundColor: "#047857", color: "#ffffff", borderColor: "#047857" }}
                        to="/ai-assistant"
                    >
                        ✨ Mở AI Trợ lý Bệnh án
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

                {/* HỒ SƠ BỆNH ÁN ĐIỆN TỬ EMR ĐÃ LƯU TỪ AI */}
                <article className="detail-panel detail-panel--wide" style={{ marginTop: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                        <div>
                            <h2 style={{ margin: 0 }}>Hồ sơ Bệnh án Điện tử EMR (Lịch sử Lâm sàng AI)</h2>
                            <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "#64748b" }}>
                                Tổng hợp các lần khám, trích xuất bệnh án giọng nói và phác đồ đã được lưu vào hệ thống HIS/EMR.
                            </p>
                        </div>
                        <Link
                            to="/ai-assistant"
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "6px 14px",
                                backgroundColor: "#059669",
                                color: "#ffffff",
                                borderRadius: "8px",
                                fontSize: "0.8rem",
                                fontWeight: "bold",
                                textDecoration: "none",
                            }}
                        >
                            + Lập Bệnh án Mới với AI
                        </Link>
                    </div>

                    {!resident.emrRecords || resident.emrRecords.length === 0 ? (
                        <div style={{ padding: "2rem", textAlign: "center", backgroundColor: "#f8fafc", borderRadius: "12px", border: "1px dashed #cbd5e1" }}>
                            <p style={{ margin: 0, fontWeight: "bold", color: "#475569" }}>Chưa có Bệnh án EMR nào được lưu cho bệnh nhân này.</p>
                            <p style={{ margin: "6px 0 12px 0", fontSize: "0.85rem", color: "#64748b" }}>
                                Bạn có thể sử dụng AI Trợ lý để nói hoặc nhập triệu chứng, AI sẽ tự động phân loại ICD-10 và tạo đơn thuốc.
                            </p>
                            <Link
                                to="/ai-assistant"
                                style={{
                                    display: "inline-block",
                                    padding: "8px 16px",
                                    backgroundColor: "#059669",
                                    color: "#ffffff",
                                    borderRadius: "8px",
                                    fontSize: "0.85rem",
                                    fontWeight: "bold",
                                    textDecoration: "none",
                                }}
                            >
                                ✨ Mở Trợ lý Trích xuất Bệnh án AI
                            </Link>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            {resident.emrRecords.map((record, index) => (
                                <div
                                    key={record.id}
                                    style={{
                                        padding: "1.25rem",
                                        borderRadius: "12px",
                                        border: "1px solid #e2e8f0",
                                        backgroundColor: index === 0 ? "#f0fdf4" : "#ffffff",
                                        borderColor: index === 0 ? "#86efac" : "#e2e8f0",
                                    }}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem", borderBottom: "1px solid rgba(0,0,0,0.06)", paddingBottom: "0.5rem" }}>
                                        <div>
                                            <span style={{ fontSize: "0.75rem", fontWeight: "bold", padding: "2px 8px", borderRadius: "9999px", backgroundColor: index === 0 ? "#dcfce7" : "#f1f5f9", color: index === 0 ? "#166534" : "#475569" }}>
                                                {index === 0 ? "Bệnh án Mới Nhất" : `Bệnh án #${record.id.slice(0, 8)}`}
                                            </span>
                                            <span style={{ fontSize: "0.8rem", color: "#64748b", marginLeft: "10px" }}>
                                                Lưu lúc: {new Date(record.createdAt).toLocaleString("vi-VN")}
                                            </span>
                                        </div>
                                        <span style={{ fontSize: "0.75rem", color: "#16a34a", fontWeight: "bold" }}>
                                            ✓ Đã lưu CSDL HIS/EMR
                                        </span>
                                    </div>

                                    {record.chiefComplaint && (
                                        <div style={{ marginBottom: "0.5rem" }}>
                                            <strong style={{ fontSize: "0.85rem", color: "#1e293b" }}>Lý do khám: </strong>
                                            <span style={{ fontSize: "0.85rem", color: "#334155" }}>{record.chiefComplaint}</span>
                                        </div>
                                    )}

                                    {record.icd10 && record.icd10.length > 0 && (
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "0.75rem" }}>
                                            <strong style={{ fontSize: "0.8rem", color: "#1e293b", alignSelf: "center" }}>Chẩn đoán ICD-10:</strong>
                                            {record.icd10.map((icd, i) => (
                                                <span
                                                    key={i}
                                                    style={{
                                                        padding: "2px 8px",
                                                        borderRadius: "6px",
                                                        backgroundColor: "#e0f2fe",
                                                        color: "#0369a1",
                                                        fontSize: "0.75rem",
                                                        fontWeight: "600",
                                                        border: "1px solid #bae6fd",
                                                    }}
                                                >
                                                    {icd.code} - {icd.nameVi}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {record.clinicalNote && (
                                        <div style={{ padding: "0.75rem", backgroundColor: "rgba(255,255,255,0.7)", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.05)", marginBottom: "0.75rem", fontSize: "0.8rem", color: "#334155", lineHeight: "1.5", whiteSpace: "pre-line" }}>
                                            {record.clinicalNote}
                                        </div>
                                    )}

                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "0.75rem", fontSize: "0.8rem" }}>
                                        {record.medications && record.medications.length > 0 && (
                                            <div style={{ padding: "0.75rem", backgroundColor: "#fafaf9", borderRadius: "8px", border: "1px solid #f5f5f4" }}>
                                                <strong style={{ color: "#059669", display: "block", marginBottom: "4px" }}>💊 Đơn thuốc đã lưu ({record.medications.length}):</strong>
                                                <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "#44403c" }}>
                                                    {record.medications.map((m, mi) => (
                                                        <li key={mi}>
                                                            <strong>{m.drugName}</strong> {m.dosage ? `· ${m.dosage}` : ""} {m.frequency ? `· ${m.frequency}` : ""}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {record.orders && record.orders.length > 0 && (
                                            <div style={{ padding: "0.75rem", backgroundColor: "#fafaf9", borderRadius: "8px", border: "1px solid #f5f5f4" }}>
                                                <strong style={{ color: "#2563eb", display: "block", marginBottom: "4px" }}>🧪 Chỉ định cận lâm sàng ({record.orders.length}):</strong>
                                                <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "#1e293b" }}>
                                                    {record.orders.map((o, oi) => (
                                                        <li key={oi}>
                                                            [{o.type}] <strong>{o.name}</strong> {o.priority === "STAT" ? "(Khẩn cấp)" : ""}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </article>
            </section>
        </main>
    );
}
