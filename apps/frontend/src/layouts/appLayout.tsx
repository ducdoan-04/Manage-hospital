import { Calendar, ClipboardCheck, ClipboardList, FilePlus2, HeartPulse, LayoutDashboard, Receipt, Stethoscope, UserRound, Users, ShieldAlert } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { APP_ROUTES } from "../constants/appRoutes";
import { session } from "../utils/session";

const navigationItems = [
    { label: "Tổng quan", to: APP_ROUTES.DASHBOARD, icon: LayoutDashboard, end: true },
    { label: "Quản lý Bệnh nhân", to: APP_ROUTES.RESIDENTS, icon: Users, end: false },
    { label: "Tiếp đón & Sàng lọc", to: APP_ROUTES.PRE_ADMISSION_SCREENING, icon: ClipboardList, end: true },
    { label: "Hồ sơ Nhập viện", to: APP_ROUTES.ADMISSION_CREATE, icon: FilePlus2, end: true },
    { label: "Khám & Đánh giá", to: APP_ROUTES.ASSESSMENT_HISTORY, icon: ClipboardCheck, end: false },
    { label: "Phác đồ điều trị", to: APP_ROUTES.CARE_PLANS, icon: ClipboardList, end: false },
    { label: "Y lệnh chăm sóc", to: APP_ROUTES.DAILY_TASKS, icon: ClipboardCheck, end: false },
    { label: "Viện phí & BHYT", to: APP_ROUTES.BILLING_COST_PANEL, icon: Receipt, end: false },
    { label: "Sự cố y khoa", to: APP_ROUTES.INCIDENTS, icon: ShieldAlert, end: false },
    { label: "Lịch trực Bác sĩ", to: APP_ROUTES.DOCTOR_SCHEDULE, icon: Calendar, end: true },
    { label: "Cấp phát thuốc (eMAR)", to: APP_ROUTES.EMAR, icon: Stethoscope, end: true },
];

export function AppLayout() {
    const user = session.getUser();
    const displayName = user ? `${user.firstName} ${user.lastName}` : "BS. Nguyễn Văn An";
    const initials = user?.firstName ? `${user.firstName[0]}${user.lastName ? user.lastName[0] : ""}`.toUpperCase() : "BV";

    return (
        <div className="app-layout">
            <aside className="sidebar">
                <div className="brand">
                    <div className="brand__icon">
                        <HeartPulse size={24} />
                    </div>
                    <div>
                        <strong>BV Đa Khoa</strong>
                        <span>Hệ thống Quản lý Y tế</span>
                    </div>
                </div>

                <nav className="sidebar-nav" aria-label="Main navigation">
                    {navigationItems.map((item) => {
                        const Icon = item.icon;

                        return (
                            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? "sidebar-link sidebar-link--active" : "sidebar-link")}>
                                <Icon size={18} />
                                <span>{item.label}</span>
                            </NavLink>
                        );
                    })}
                </nav>
            </aside>

            <div className="content-area">
                <header className="topbar">
                    <div className="topbar-resident">
                        <div className="topbar-avatar">
                            {initials}
                            <span aria-hidden="true" />
                        </div>
                        <div>
                            <strong>Hệ thống Quản lý Bệnh viện Đa khoa</strong>
                            <span>Hồ sơ bệnh án, phác đồ điều trị, lịch trực và quản lý thuốc</span>
                        </div>
                    </div>

                    <div className="alert-chips" aria-label="Cảnh báo bệnh nhân">
                        <span className="alert-chip alert-chip--danger">Không CPR / DNR</span>
                        <span className="alert-chip alert-chip--danger">Dị ứng: Penicillin</span>
                        <span className="alert-chip alert-chip--neutral">Nguy cơ ngã cao</span>
                    </div>

                    <div className="user-chip">
                        <span>
                            <UserRound size={16} />
                        </span>
                        <strong>{displayName}</strong>
                    </div>
                </header>

                <Outlet />
            </div>
        </div>
    );
}

