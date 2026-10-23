import React, { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/authUi/input";
import { Label } from "@/components/authUi/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/authUi/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userService } from "@/services/user";
import { roleService } from "@/services/role";
import { facilityService } from "@/services/facility";

const userSchema = z.object({
    firstName: z.string().min(1, "Vui lòng nhập tên"),
    lastName: z.string().min(1, "Vui lòng nhập họ và tên đệm"),
    email: z.string().min(1, "Vui lòng nhập email").email("Email không đúng định dạng chuẩn"),
    phone: z
        .string()
        .optional()
        .refine((val) => !val || /^(\+84|0)[35789]\d{8}$/.test(val.replace(/[\s\-.()]/g, "")), {
            message: "Số điện thoại phải đúng định dạng chuẩn Việt Nam (+84 hoặc đầu 0, VD: +84 912 345 678 hoặc 0912345678)",
        }),
    role: z.string().min(1, "Vui lòng chọn vai trò y tế"),
    facilityId: z.string().optional(),
});

type UserFormValues = z.infer<typeof userSchema>;

export default function UserForm() {
    const { id } = useParams();
    const isEditMode = Boolean(id);
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [errorMsg, setErrorMsg] = useState("");

    const { data: roles } = useQuery({
        queryKey: ["roles"],
        queryFn: () => roleService.getRoles(),
    });

    const { data: facilities } = useQuery({
        queryKey: ["facilities"],
        queryFn: () => facilityService.getFacilities(),
    });

    const { data: userData, isLoading: isUserLoading } = useQuery({
        queryKey: ["user", id],
        queryFn: () => userService.getUserById(id!),
        enabled: isEditMode,
    });

    const {
        register,
        handleSubmit,
        control,
        reset,
        formState: { errors },
    } = useForm<UserFormValues>({
        resolver: zodResolver(userSchema),
        defaultValues: {
            firstName: "",
            lastName: "",
            email: "",
            phone: "",
            role: "",
            facilityId: "None",
        },
    });

    useEffect(() => {
        if (isEditMode && userData) {
            const primaryFacility = userData.facilities?.find((f: any) => f.isPrimary)?.facilityId || "None";
            reset({
                firstName: userData.firstName,
                lastName: userData.lastName,
                email: userData.email,
                phone: userData.phoneNumber || "",
                role: userData.roleId?.toString() || "",
                facilityId: primaryFacility,
            });
        }
    }, [isEditMode, userData, reset]);

    const mutation = useMutation({
        mutationFn: (data: any) => (isEditMode ? userService.updateUser(id!, data) : userService.createUser(data)),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
            navigate("/admin/users", { replace: true });
        },
        onError: (err: any) => {
            setErrorMsg(err.message || "Đã xảy ra lỗi khi lưu thông tin");
        },
    });

    const onSubmit = async (data: UserFormValues) => {
        setErrorMsg("");
        let phoneFormatted = data.phone?.trim();
        if (phoneFormatted) {
            phoneFormatted = phoneFormatted.replace(/[\s\-.()]/g, "");
            if (phoneFormatted.startsWith("0")) {
                phoneFormatted = "+84" + phoneFormatted.slice(1);
            } else if (phoneFormatted.startsWith("84")) {
                phoneFormatted = "+" + phoneFormatted;
            } else if (!phoneFormatted.startsWith("+84") && !phoneFormatted.startsWith("+")) {
                phoneFormatted = "+84" + phoneFormatted;
            }
        }
        const payload = {
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            phoneNumber: phoneFormatted || undefined,
            roleId: parseInt(data.role, 10),
            status: isEditMode ? userData?.status : "INACTIVE",
            facilityId: data.facilityId === "None" ? undefined : data.facilityId,
        };
        mutation.mutate(payload as any);
    };

    const statusValue = isEditMode ? userData?.status || "Đang tải..." : "INACTIVE";

    if ((isEditMode && isUserLoading) || !roles || !facilities) {
        return <div className="p-8 text-center text-slate-500">Đang tải dữ liệu...</div>;
    }

    return (
        <div className="mx-auto max-w-5xl">
            <div className="mb-6">
                <div className="mb-1 text-sm font-medium text-slate-500">
                    <Link to="/admin/users" className="hover:text-slate-700">
                        Quản trị
                    </Link>{" "}
                    &gt;{" "}
                    <Link to="/admin/users" className="hover:text-slate-700">
                        Nhân viên y tế
                    </Link>{" "}
                    &gt; <span className="text-slate-900">{isEditMode ? "Chỉnh sửa tài khoản" : "Thêm người dùng mới"}</span>
                </div>
                <h1 className="mb-2 text-3xl font-bold tracking-tight text-slate-900">
                    {isEditMode ? "Chỉnh sửa tài khoản Cán bộ Y tế" : "Thêm Cán bộ Y tế Mới"}
                </h1>
                {!isEditMode && <p className="text-sm text-slate-500">Tài khoản mới sẽ ở trạng thái chờ kích hoạt qua email / số điện thoại (+84)</p>}
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {errorMsg && <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-600">{errorMsg}</div>}
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                    {/* ── Left Card (Account Details) ── */}
                    <Card className="border-slate-200 shadow-sm lg:col-span-2">
                        <CardContent className="p-6">
                            <h2 className="mb-6 text-lg font-bold text-slate-900">Thông tin tài khoản</h2>

                            <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
                                {/* First Name */}
                                <div>
                                    <Label className="mb-2 block font-semibold text-slate-700">
                                        Tên (First Name) <span className="text-red-500">*</span>
                                    </Label>
                                    <Input {...register("firstName")} placeholder="VD: An, Mai, Dũng" className={errors.firstName ? "border-red-500 focus:ring-red-100" : ""} />
                                    {errors.firstName && <p className="mt-1.5 text-sm font-medium text-red-500">{errors.firstName.message}</p>}
                                </div>

                                {/* Last Name */}
                                <div>
                                    <Label className="mb-2 block font-semibold text-slate-700">
                                        Họ và tên đệm (Last Name) <span className="text-red-500">*</span>
                                    </Label>
                                    <Input {...register("lastName")} placeholder="VD: Nguyễn Văn, Trần Thị" className={errors.lastName ? "border-red-500 focus:ring-red-100" : ""} />
                                    {errors.lastName && <p className="mt-1.5 text-sm font-medium text-red-500">{errors.lastName.message}</p>}
                                </div>

                                {/* Email */}
                                <div>
                                    <Label className="mb-2 block font-semibold text-slate-700">
                                        Email y tế <span className="text-red-500">*</span>
                                    </Label>
                                    <Input {...register("email")} placeholder="bs.nguyenvanan@medcare.vn" className={errors.email ? "border-red-500 focus:ring-red-100" : ""} />
                                    {errors.email && <p className="mt-1.5 text-sm font-medium text-red-500">{errors.email.message}</p>}
                                </div>

                                {/* Phone */}
                                <div>
                                    <Label className="mb-2 block font-semibold text-slate-700">Số điện thoại (+84 chuẩn E.164)</Label>
                                    <Input {...register("phone")} placeholder="+84 912 345 678" className={errors.phone ? "border-red-500 focus:ring-red-100" : ""} />
                                    {errors.phone ? (
                                        <p className="mt-1.5 text-sm font-medium text-red-500">{errors.phone.message}</p>
                                    ) : (
                                        <p className="mt-1.5 text-xs text-slate-500">Chuẩn Việt Nam: +84912345678 (hoặc 0912345678 để nhận OTP 2FA qua SMS).</p>
                                    )}
                                </div>

                                {/* Role */}
                                <div>
                                    <Label className="mb-2 block font-semibold text-slate-700">
                                        Vai trò y tế <span className="text-red-500">*</span>
                                    </Label>
                                    <Controller
                                        control={control}
                                        name="role"
                                        render={({ field }) => (
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <SelectTrigger className={errors.role ? "border-red-500 focus:ring-red-100" : ""}>
                                                    <SelectValue placeholder="Chọn vai trò..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {roles?.map((r: any) => (
                                                        <SelectItem key={r.id} value={r.id.toString()}>
                                                            {r.roleName}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                    {errors.role && <p className="mt-1.5 text-sm font-medium text-red-500">{errors.role.message}</p>}
                                </div>

                                {/* Status */}
                                <div>
                                    <Label className="mb-2 block font-semibold text-slate-700">Trạng thái tài khoản</Label>
                                    <Input value={statusValue} disabled className="bg-slate-50 font-medium text-slate-500" />
                                    <p className="mt-1.5 text-xs text-slate-500">
                                        {isEditMode ? "Trạng thái tài khoản hiện tại trong hệ thống." : "Hệ thống tự động kích hoạt sau khi xác thực 2 bước (2FA)."}
                                    </p>
                                </div>

                                {/* Assigned Facility */}
                                <div>
                                    <Label className="mb-2 block font-semibold text-slate-700">Cơ sở khám chữa bệnh</Label>
                                    <Controller
                                        control={control}
                                        name="facilityId"
                                        render={({ field }) => (
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Mặc định" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="None">Chưa phân công</SelectItem>
                                                    {facilities?.map((f: any) => (
                                                        <SelectItem key={f.id} value={f.id}>
                                                            {f.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>
                            </div>

                            <div className="border-t border-slate-100 pt-6">
                                <p className="text-xs text-slate-400">
                                    Quy chuẩn an toàn y tế: Email phải là duy nhất; Số điện thoại phải đúng định dạng chuẩn E.164 Việt Nam (+84) để nhận mã xác thực OTP bảo mật.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* ── Right Card (What happens next) ── */}
                    <Card className="h-fit border-slate-200 shadow-sm">
                        <CardContent className="p-6">
                            <h2 className="mb-6 text-lg font-bold text-slate-900">Quy trình kích hoạt</h2>

                            <div className="mb-6 space-y-4 text-sm text-slate-700">
                                <p>1. Cán bộ y tế nhận email / SMS kích hoạt</p>
                                <p>2. Đặt mật khẩu và xác thực số điện thoại (+84)</p>
                                <p>3. Kích hoạt bảo mật xác thực 2 bước (2FA)</p>
                                <p>4. Tài khoản chuyển trạng thái Hoạt động (ACTIVE)</p>
                            </div>

                            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                                <p className="text-sm font-semibold text-blue-700">Đăng nhập hỗ trợ bằng cả Email hoặc Số điện thoại (+84) đã đăng ký.</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* ── Bottom Action Bar ── */}
                <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-6 pb-10">
                    <Button type="button" variant="outline" className="border-slate-300 px-6 text-slate-700 hover:bg-slate-50" onClick={() => navigate("/admin/users")}>
                        Hủy
                    </Button>
                    <Button type="submit" disabled={mutation.isPending} className="bg-blue-600 px-6 text-white hover:bg-blue-700 font-bold">
                        {mutation.isPending ? "Đang lưu..." : isEditMode ? "Cập nhật người dùng" : "Thêm người dùng"}
                    </Button>
                </div>
            </form>
        </div>
    );
}
