import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    User as UserIcon,
    ChevronDown,
    Mail,
    Phone,
    Building2,
    BadgeCheck,
    LogOut,
    Shield,
    IdCard,
    ExternalLink,
    X,
    Lock
} from "lucide-react";
import { session } from "../utils/session";
import { authService } from "../services/auth";
import type { User } from "../types/auth";

interface UserAccountMenuProps {
    variant?: "admin" | "clinical";
}

export function UserAccountMenu({ variant = "admin" }: UserAccountMenuProps) {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Retrieve user from session store or fallback
    const user: User | null = session.getUser();

    const firstName = user?.firstName || "Quản trị";
    const lastName = user?.lastName || "Viên";
    const fullName = `${firstName} ${lastName}`.trim();
    const email = user?.email || "admin@facility.org";
    const roleName = user?.roleName || (variant === "admin" ? "Quản trị viên Hệ thống (System Admin)" : "Bác sĩ Chuyên khoa");
    const employeeCode = user?.employeeCode || "EMP-001";
    
    // Format phone to +84 Vietnamese standard
    let phoneDisplay = user?.phoneNumber || "+84 912 345 678";
    if (phoneDisplay.startsWith("+84") && phoneDisplay.length === 12) {
        phoneDisplay = `+84 ${phoneDisplay.slice(3, 6)} ${phoneDisplay.slice(6, 9)} ${phoneDisplay.slice(9)}`;
    } else if (phoneDisplay.startsWith("0") && phoneDisplay.length === 10) {
        phoneDisplay = `+84 ${phoneDisplay.slice(1, 4)} ${phoneDisplay.slice(4, 7)} ${phoneDisplay.slice(7)}`;
    }

    const facilityName = "Bệnh viện Đa khoa Quốc tế MedCare";

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    const handleLogout = async () => {
        setIsOpen(false);
        try {
            await authService.logout();
        } catch {
            session.clear();
        }
        navigate("/login", { replace: true });
    };

    const initials = `${firstName[0] || "A"}${lastName[0] || "D"}`.toUpperCase();

    return (
        <div className="relative" ref={menuRef}>
            {/* ── Trigger Chip ── */}
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                aria-expanded={isOpen}
                aria-haspopup="true"
                className="group flex cursor-pointer items-center gap-3 rounded-full border border-slate-200/80 bg-white px-3 py-1.5 shadow-sm transition-all hover:border-blue-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                title="Bấm để xem thông tin tài khoản"
            >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-sm font-bold text-white shadow-sm ring-2 ring-white">
                    {initials}
                </div>
                <div className="flex flex-col text-left">
                    <span className="text-sm font-bold text-slate-800 group-hover:text-blue-700 transition-colors">
                        {fullName}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500">{roleName}</span>
                </div>
                <ChevronDown
                    className={`ml-1 h-4 w-4 text-slate-400 transition-transform duration-200 group-hover:text-slate-700 ${
                        isOpen ? "rotate-180 text-blue-600" : ""
                    }`}
                />
            </button>

            {/* ── Interactive Dropdown Card ── */}
            {isOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-84 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xl ring-1 ring-black/5 animate-in fade-in-50 zoom-in-95">
                    {/* Header with Avatar & Status */}
                    <div className="flex items-center gap-3.5 border-b border-slate-100 pb-3.5">
                        <div className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-base font-bold text-white shadow-md">
                            {initials}
                            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 ring-1 ring-emerald-400" title="Đang hoạt động" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h4 className="truncate text-base font-bold text-slate-900">{fullName}</h4>
                            <p className="truncate text-xs font-medium text-slate-500">{email}</p>
                            <div className="mt-1 flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 ring-1 ring-inset ring-blue-700/10">
                                    <BadgeCheck className="h-3 w-3 text-blue-600" />
                                    {roleName}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Account Information List */}
                    <div className="my-3 space-y-2 rounded-xl bg-slate-50/80 p-3 text-xs text-slate-600">
                        <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 font-medium text-slate-500">
                                <IdCard className="h-3.5 w-3.5 text-slate-400" /> Mã nhân viên
                            </span>
                            <span className="font-semibold text-slate-900">{employeeCode}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 font-medium text-slate-500">
                                <Phone className="h-3.5 w-3.5 text-slate-400" /> Số điện thoại
                            </span>
                            <span className="font-semibold text-blue-600">{phoneDisplay}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 font-medium text-slate-500">
                                <Building2 className="h-3.5 w-3.5 text-slate-400" /> Cơ sở làm việc
                            </span>
                            <span className="max-w-[140px] truncate font-semibold text-slate-900" title={facilityName}>
                                {facilityName}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 font-medium text-slate-500">
                                <Shield className="h-3.5 w-3.5 text-slate-400" /> Xác thực 2 bước (2FA)
                            </span>
                            <span className="font-semibold text-emerald-600">Đã kích hoạt</span>
                        </div>
                    </div>

                    {/* Action Items */}
                    <div className="space-y-1 pt-1">
                        <button
                            type="button"
                            onClick={() => {
                                setIsOpen(false);
                                setShowModal(true);
                            }}
                            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-blue-600"
                        >
                            <span className="flex items-center gap-2">
                                <UserIcon className="h-4 w-4 text-slate-400" />
                                Xem chi tiết hồ sơ tài khoản
                            </span>
                            <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setIsOpen(false);
                                navigate("/admin/users");
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-blue-600"
                        >
                            <Lock className="h-4 w-4 text-slate-400" />
                            Quản lý phân quyền & tài khoản
                        </button>

                        <div className="my-1.5 border-t border-slate-100" />

                        <button
                            type="button"
                            onClick={handleLogout}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
                        >
                            <LogOut className="h-4 w-4 text-red-500" />
                            Đăng xuất hệ thống
                        </button>
                    </div>
                </div>
            )}

            {/* ── Detailed Account Info Modal ── */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in-50">
                    <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95">
                        {/* Modal Header */}
                        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-lg font-bold text-white shadow-md">
                                    {initials}
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">Thông tin Tài khoản Cán bộ Y tế</h3>
                                    <p className="text-xs text-slate-500">Hệ thống Quản lý Bệnh viện Đa khoa Quốc tế MedCare</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Modal Body: Information Grid */}
                        <div className="mt-5 space-y-4 text-sm">
                            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 space-y-3">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Thông tin định danh</h4>
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div>
                                        <span className="block text-slate-500 font-medium">Họ và tên:</span>
                                        <span className="font-bold text-slate-800 text-sm">{fullName}</span>
                                    </div>
                                    <div>
                                        <span className="block text-slate-500 font-medium">Mã nhân viên:</span>
                                        <span className="font-bold text-slate-800 text-sm">{employeeCode}</span>
                                    </div>
                                    <div>
                                        <span className="block text-slate-500 font-medium">Email công vụ:</span>
                                        <span className="font-semibold text-slate-800 break-all">{email}</span>
                                    </div>
                                    <div>
                                        <span className="block text-slate-500 font-medium">Số điện thoại (+84):</span>
                                        <span className="font-semibold text-blue-600">{phoneDisplay}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 space-y-3">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Vị trí công tác & Bảo mật</h4>
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div>
                                        <span className="block text-slate-500 font-medium">Vai trò chuyên môn:</span>
                                        <span className="inline-flex mt-0.5 items-center gap-1 rounded bg-blue-100/80 px-2 py-0.5 font-bold text-blue-800">
                                            {roleName}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="block text-slate-500 font-medium">Trạng thái:</span>
                                        <span className="inline-flex mt-0.5 items-center gap-1 rounded bg-emerald-100/80 px-2 py-0.5 font-bold text-emerald-800">
                                            Hoạt động (ACTIVE)
                                        </span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="block text-slate-500 font-medium">Đơn vị / Cơ sở bệnh viện:</span>
                                        <span className="font-bold text-slate-800">{facilityName}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="block text-slate-500 font-medium">Bảo mật tài khoản:</span>
                                        <span className="font-medium text-slate-700">
                                            Xác thực 2 yếu tố (2FA qua SMS +84) đang kích hoạt · Mật khẩu mã hóa chuẩn bcrypt.
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                            >
                                Đóng
                            </button>
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition-colors"
                            >
                                <LogOut className="h-4 w-4" />
                                Đăng xuất
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
