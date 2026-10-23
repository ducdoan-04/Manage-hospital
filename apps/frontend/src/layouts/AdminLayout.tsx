import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, HelpCircle, Home, User as UserIcon, Shield, Building2, Banknote, Clock, Box, AlertTriangle, Settings, Database, FileText, LogOut, ChevronDown } from "lucide-react";
import { authService } from "../services/auth";
import { session } from "../utils/session";
import type { User } from "../types/auth";

export function AdminLayout({ children }: { children: React.ReactNode }) {
    const navigate = useNavigate();
    const location = useLocation();
    const [user, setUser] = useState<User | null>(session.getUser());
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});

    const toggleDropdown = (name: string) => {
        setOpenDropdowns((prev) => ({ ...prev, [name]: !prev[name] }));
    };

    useEffect(() => {
        authService.getMe().then((res) => {
            if (res.success && res.data) {
                setUser(res.data);
            }
        });
    }, []);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await authService.logout();
        } catch {
            session.clear();
        } finally {
            navigate("/login", { replace: true });
        }
    };

    const navGroups: Array<{
        label?: string;
        items: Array<{
            name: string;
            path?: string;
            icon: any;
            subItems?: Array<{ name: string; path: string }>;
        }>;
    }> = [
        {
            items: [
                { name: "Bảng điều khiển", path: "/dashboard/admin", icon: Home },
                {
                    name: "Phân hệ nghiệp vụ",
                    icon: Box,
                    subItems: [
                        { name: "Quản lý Bệnh nhân", path: "/residents" },
                        { name: "Tiếp đón Bệnh nhân", path: "/residents/reception" },
                        { name: "Lịch trực Bác sĩ", path: "/doctor-schedule" },
                        { name: "Cấp phát thuốc (eMAR)", path: "/emar" },
                        { name: "Phác đồ điều trị", path: "/care-plans" },
                        { name: "Hồ sơ nhập viện", path: "/admissions/new" },
                        { name: "Khám & Đánh giá", path: "/assessments/history" },
                        { name: "Y lệnh chăm sóc", path: "/care-tasks/today" },
                        { name: "Viện phí & BHYT", path: "/billing/cost-panel" },
                        { name: "Sự cố y khoa", path: "/incidents" },
                    ],
                },
            ],
        },
        {
            label: "QUẢN LÝ TÀI KHOẢN & PHÂN QUYỀN",
            items: [
                { name: "Nhân viên & Bác sĩ", path: "/admin/users", icon: UserIcon },
                { name: "Vai trò & Quyền hạn", path: "/admin/roles", icon: Shield },
            ],
        },
        {
            label: "CƠ SỞ & CẤU HÌNH BỆNH VIỆN",
            items: [
                { name: "Cơ sở bệnh viện", path: "/admin/facility", icon: Building2 },
                { name: "Bảng giá điều trị", path: "/admin/loc-rates", icon: Banknote },
                { name: "Định mức nhân sự", path: "/admin/staffing", icon: Clock },
                { name: "Trang thiết bị y tế", path: "/admin/equipment", icon: Box },
                { name: "Mức độ sự cố y khoa", path: "/admin/incident-severity", icon: AlertTriangle },
                { name: "Cấu hình SLA xử lý", path: "/admin/sla-config", icon: Settings },
            ],
        },
        {
            label: "DỮ LIỆU & KHỞI TẠO",
            items: [{ name: "Dữ liệu mẫu", path: "/admin/data", icon: Database }],
        },
        {
            label: "NHẬT KÝ & BẢO MẬT",
            items: [{ name: "Nhật ký hệ thống", path: "/admin/audit", icon: FileText }],
        },
    ];

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-[#F8FAFC]">
            {/* ── Sidebar ──────────────────────────────────────────────────────── */}
            <aside className="z-20 flex h-full w-[260px] flex-shrink-0 flex-col border-r border-slate-200 bg-white">
                {/* Logo */}
                <div className="flex h-16 flex-shrink-0 items-center border-b border-transparent px-6">
                    <div className="flex items-center gap-2.5">
                        <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-black text-sm">
                                +
                            </div>
                            <span className="text-xl font-bold tracking-tight text-slate-900">BV-HMS</span>
                        </div>
                        <span className="w-32 text-[10px] leading-tight font-medium text-slate-500">Quản lý Bệnh viện Đa khoa</span>
                    </div>
                </div>

                {/* Navigation */}
                <div className="no-scrollbar flex-1 overflow-y-auto py-4">
                    <div className="flex flex-col gap-6 px-4">
                        {navGroups.map((group, idx) => (
                            <div key={idx} className="flex flex-col gap-1">
                                {group.label && <h3 className="mb-1 px-3 text-[11px] font-bold tracking-wider text-slate-400 uppercase">{group.label}</h3>}
                                {group.items.map((item) => {
                                    if (item.subItems) {
                                        const isOpen = openDropdowns[item.name] || false;
                                        const hasActiveSub = item.subItems.some((sub: any) => location.pathname.startsWith(sub.path));

                                        return (
                                            <div key={item.name} className="flex flex-col">
                                                <button
                                                    onClick={() => toggleDropdown(item.name)}
                                                    className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                                        hasActiveSub ? "bg-blue-50 text-blue-600" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <item.icon className={`h-4 w-4 ${hasActiveSub ? "text-blue-600" : "text-slate-400"}`} />
                                                        {item.name}
                                                    </div>
                                                    <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                                                </button>

                                                {isOpen && (
                                                    <div className="mt-1 flex flex-col gap-1 pl-10">
                                                        {item.subItems.map((sub: any) => {
                                                            const isSubActive = location.pathname.startsWith(sub.path);
                                                            return (
                                                                <Link
                                                                    key={sub.name}
                                                                    to={sub.path}
                                                                    className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                                                                        isSubActive ? "bg-blue-50 text-blue-600" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                                                                    }`}
                                                                >
                                                                    {sub.name}
                                                                </Link>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }

                                    const isActive = item.path ? location.pathname.startsWith(item.path) : false;
                                    return (
                                        <Link
                                            key={item.name}
                                            to={item.path!}
                                            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                                isActive ? "bg-blue-50 text-blue-600" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                            }`}
                                        >
                                            <item.icon className={`h-4 w-4 ${isActive ? "text-blue-600" : "text-slate-400"}`} />
                                            {item.name}
                                        </Link>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Logout at bottom */}
                <div className="flex-shrink-0 border-t border-slate-100 p-4">
                    <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                        <LogOut className="h-4 w-4 text-slate-400" />
                        {isLoggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
                    </button>
                </div>
            </aside>

            {/* ── Main Content Area ────────────────────────────────────────────── */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Top Header */}
                <header className="z-10 flex h-16 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-8">
                    <div>{/* Header left empty or can have page title */}</div>

                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-4 text-slate-400">
                            <button className="transition-colors hover:text-slate-600">
                                <Bell className="h-5 w-5" />
                            </button>
                            <button className="transition-colors hover:text-slate-600">
                                <HelpCircle className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="h-8 w-px bg-slate-200"></div>

                        {user && (
                            <div className="group flex cursor-pointer items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-slate-100 bg-slate-50 text-sm font-bold text-slate-600 transition-colors group-hover:border-blue-100">
                                    <UserIcon className="h-4 w-4" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-slate-700">
                                        {user.firstName} {user.lastName}
                                    </span>
                                    <span className="text-[11px] font-medium text-slate-500">{user.roleName ?? "System Admin"}</span>
                                </div>
                                <ChevronDown className="ml-1 h-4 w-4 text-slate-400 group-hover:text-slate-600" />
                            </div>
                        )}
                    </div>
                </header>

                {/* Page Content */}
                <main className="no-scrollbar flex-1 overflow-y-auto p-8">{children}</main>
            </div>
        </div>
    );
}
