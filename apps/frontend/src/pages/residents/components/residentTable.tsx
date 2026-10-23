import { Link } from "react-router-dom";
import { APP_ROUTES } from "../../../constants/appRoutes";
import { CARE_LEVEL_LABEL, GENDER_LABEL } from "../constants";
import { calculateAge } from "../services/residentRepository";
import type { Resident } from "../types";
import { ResidentStatusBadge } from "./residentStatusBadge";

type ResidentTableProps = {
    residents: Resident[];
    isLoading: boolean;
};

export function ResidentTable({ residents, isLoading }: ResidentTableProps) {
    if (isLoading) {
        return (
            <div className="empty-state">
                <strong>Đang tải danh sách bệnh nhân...</strong>
                <span>Hệ thống đang đồng bộ dữ liệu hồ sơ bệnh án mới nhất.</span>
            </div>
        );
    }

    if (residents.length === 0) {
        return (
            <div className="empty-state">
                <strong>Không tìm thấy bệnh nhân nào</strong>
                <span>Vui lòng thử điều chỉnh lại từ khóa tìm kiếm hoặc tiêu chí lọc.</span>
            </div>
        );
    }

    return (
        <div className="table-card">
            <table>
                <thead>
                    <tr>
                        <th>Bệnh nhân</th>
                        <th>Tuổi / Giới tính</th>
                        <th>Phòng / Giường</th>
                        <th>Mức độ điều trị</th>
                        <th>Bác sĩ & Điều dưỡng</th>
                        <th>Ngày nhập viện</th>
                        <th>Trạng thái</th>
                        <th>Thao tác</th>
                    </tr>
                </thead>
                <tbody>
                    {residents.map((resident) => (
                        <tr key={resident.id}>
                            <td>
                                <div className="resident-cell">
                                    <div className="avatar" aria-hidden="true">
                                        {resident.fullName
                                            .split(" ")
                                            .map((name) => name[0])
                                            .slice(0, 2)
                                            .join("")}
                                    </div>
                                    <div>
                                        <strong>{resident.fullName}</strong>
                                        <span>{resident.residentCode}</span>
                                    </div>
                                </div>
                            </td>
                            <td>
                                {calculateAge(resident.dateOfBirth)} tuổi / {GENDER_LABEL[resident.gender]}
                            </td>
                            <td>{resident.roomNumber ?? "Chưa phân buồng"}</td>
                            <td>{CARE_LEVEL_LABEL[resident.careLevel]}</td>
                            <td>
                                <div className="stacked-text">
                                    <strong>{resident.assignedDoctor ?? "Chưa phân công BS"}</strong>
                                    <span>{resident.assignedNurse ?? "Chưa phân công ĐD"}</span>
                                </div>
                            </td>
                            <td>{resident.admissionDate}</td>
                            <td>
                                <ResidentStatusBadge status={resident.status} />
                            </td>
                            <td>
                                <div className="table-actions">
                                    <Link to={`${APP_ROUTES.RESIDENTS}/${resident.id}`}>Xem hồ sơ</Link>
                                    <Link to={`${APP_ROUTES.RESIDENTS}/${resident.id}/edit`}>Chỉnh sửa</Link>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
