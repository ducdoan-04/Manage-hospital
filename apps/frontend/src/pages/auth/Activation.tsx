import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authService } from "../../services/auth";
import { Lock, Mail, Phone, Check, X, ShieldAlert, ArrowLeft, CheckCircle2 } from "lucide-react";

export function Activation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const email = searchParams.get("email")?.trim() ?? "";
  const activationCode = searchParams.get("code")?.trim() ?? "";
  const hasValidInvite = Boolean(email && activationCode);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  const [errors, setErrors] = useState<{
    password?: string;
    confirmPassword?: string;
    phoneNumber?: string;
    api?: string;
  }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Password rules validation
  const rules = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[\W_]/.test(password),
  };

  const isPasswordStrong = Object.values(rules).every(Boolean);

  const validatePhone = (phone: string) => {
    // E.164 format: Optional plus sign, followed by 7 to 15 digits
    const e164Regex = /^\+?[1-9]\d{1,14}$/;
    return e164Regex.test(phone.replace(/\s+/g, ""));
  };

  const handleValidation = () => {
    const newErrors: typeof errors = {};

    if (!password) {
      newErrors.password = "Vui lòng nhập mật khẩu";
    } else if (!isPasswordStrong) {
      newErrors.password = "Mật khẩu chưa đáp ứng đầy đủ yêu cầu bảo mật";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Vui lòng xác nhận lại mật khẩu";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Mật khẩu xác nhận không khớp";
    }

    if (!phoneNumber.trim()) {
      newErrors.phoneNumber = "Vui lòng nhập số điện thoại";
    } else if (!validatePhone(phoneNumber)) {
      newErrors.phoneNumber = "Số điện thoại không hợp lệ. Vui lòng nhập theo chuẩn E.164 (ví dụ: +84912345678)";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasValidInvite) {
      setErrors({ api: "Liên kết kích hoạt không hợp lệ hoặc đã hết hạn. Vui lòng liên hệ Quản trị viên để nhận mã mới." });
      return;
    }

    if (!handleValidation()) return;

    setIsLoading(true);
    setErrors({});

    try {
      const response = await authService.activate(email, activationCode, password, phoneNumber);

      if (response.success) {
        setIsSuccess(true);
      } else {
        setErrors({ api: response.message || "Kích hoạt tài khoản thất bại. Liên kết có thể đã hết hạn." });
      }
    } catch (err) {
      setErrors({ api: "Không thể kết nối đến máy chủ xác thực. Vui lòng thử lại sau." });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans antialiased">
        <div className="w-full max-w-md bg-white border border-slate-100 rounded-[24px] shadow-xl p-8 flex flex-col items-center text-center">
          <div className="h-16 w-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 mb-6 shadow-inner animate-bounce">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Kích hoạt tài khoản thành công</h2>
          <p className="text-slate-500 text-sm mb-6 leading-relaxed">
            Tài khoản nhân viên y tế của bạn đã được kích hoạt thành công. Bạn có thể đăng nhập bằng email hoặc số điện thoại.
          </p>
          <button
            onClick={() => navigate("/login")}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-all cursor-pointer active:scale-95"
          >
            Đến trang Đăng nhập
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-slate-100 to-blue-50 p-4 md:p-8 font-sans antialiased">
      <div className="w-full max-w-5xl bg-white border border-slate-100 rounded-[32px] shadow-2xl overflow-hidden flex flex-col lg:flex-row min-h-[640px]">
        
        {/* Left Side: Illustration Panel */}
        <div className="w-full lg:w-1/2 bg-blue-50/50 p-8 md:p-12 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black text-lg">+</div>
              <span className="font-bold text-slate-800 tracking-tight text-lg">MedCare Hospital</span>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 leading-tight mb-4">
              Hệ thống Quản lý Bệnh viện Đa khoa
            </h1>
            <p className="text-slate-500 text-sm leading-relaxed max-w-md">
              Nền tảng quản trị lâm sàng và nghiệp vụ y tế hiện đại, bảo mật cao cấp dành riêng cho đội ngũ y bác sĩ, điều dưỡng và nhân viên y tế.
            </p>
          </div>

          <div className="my-8 flex justify-center items-center">
            <img 
              src="/activation_illustration.jpg" 
              alt="Account Activation Process"
              className="max-h-[300px] w-auto object-contain rounded-2xl shadow-sm mix-blend-multiply"
            />
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold text-slate-400">
            <span>Tiêu chuẩn An toàn Dữ liệu Y tế</span>
            <span>•</span>
            <span>Xác thực OTP 2 Lớp (2FA)</span>
          </div>
        </div>

        {/* Right Side: Form Panel */}
        <div className="w-full lg:w-1/2 p-8 md:p-12 flex flex-col justify-center">
          <div className="mb-6">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Kích hoạt Tài khoản Nhân viên</h2>
            <p className="text-slate-500 text-sm mt-1">
              Hoàn tất thiết lập thông tin cá nhân để bắt đầu làm việc trên hệ thống.
            </p>
          </div>

          {/* Invitation validation check */}
          {!hasValidInvite && (
            <div className="mb-6 flex items-start gap-3 bg-rose-50 border border-rose-100 rounded-2xl p-4 text-rose-700">
              <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5 text-rose-500" />
              <div>
                <h4 className="font-bold text-sm">Liên kết không hợp lệ hoặc đã hết hạn</h4>
                <p className="text-xs text-rose-600/90 mt-0.5">
                  Đường dẫn kích hoạt thiếu tham số cần thiết hoặc đã quá hạn sử dụng. Vui lòng kiểm tra email kích hoạt hoặc liên hệ Quản trị viên phòng CNTT.
                </p>
              </div>
            </div>
          )}

          {errors.api && (
            <div className="mb-6 flex items-start gap-3 bg-rose-50 border border-rose-100 rounded-2xl p-4 text-rose-700">
              <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5 text-rose-500" />
              <p className="text-xs font-medium leading-relaxed">{errors.api}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email (Read-Only) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">Địa chỉ Email</label>
              <div className="relative">
                <input
                  type="email"
                  readOnly
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pl-10 text-sm text-slate-500 outline-none cursor-not-allowed"
                  value={email || "Chưa có email mời"}
                />
                <Mail className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 bg-slate-200/50 px-2 py-0.5 rounded-full">
                  Chỉ đọc
                </span>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">Mật khẩu mới</label>
              <div className="relative">
                <input
                  type="password"
                  className={`w-full rounded-xl border px-4 py-3 pl-10 text-sm transition-all outline-none focus:ring-2 ${
                    errors.password ? "border-rose-300 focus:ring-rose-100" : "border-slate-200 focus:border-blue-500 focus:ring-blue-100"
                  }`}
                  placeholder="Nhập mật khẩu an toàn"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading || !hasValidInvite}
                />
                <Lock className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
              {errors.password && <p className="text-[10px] font-bold text-rose-500">{errors.password}</p>}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">Xác nhận mật khẩu</label>
              <div className="relative">
                <input
                  type="password"
                  className={`w-full rounded-xl border px-4 py-3 pl-10 text-sm transition-all outline-none focus:ring-2 ${
                    errors.confirmPassword ? "border-rose-300 focus:ring-rose-100" : "border-slate-200 focus:border-blue-500 focus:ring-blue-100"
                  }`}
                  placeholder="Nhập lại mật khẩu"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading || !hasValidInvite}
                />
                <Lock className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
              {errors.confirmPassword && <p className="text-[10px] font-bold text-rose-500">{errors.confirmPassword}</p>}
            </div>

            {/* Password Requirements Panel */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Yêu cầu bảo mật mật khẩu</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="flex items-center gap-2">
                  <div className={`h-4.5 w-4.5 rounded-full flex items-center justify-center transition-all ${rules.length ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"}`}>
                    <Check className="h-3 w-3 stroke-[3]" />
                  </div>
                  <span className={`text-xs ${rules.length ? "text-slate-800 font-semibold" : "text-slate-400"}`}>Tối thiểu 8 ký tự</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`h-4.5 w-4.5 rounded-full flex items-center justify-center transition-all ${rules.uppercase ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"}`}>
                    <Check className="h-3 w-3 stroke-[3]" />
                  </div>
                  <span className={`text-xs ${rules.uppercase ? "text-slate-800 font-semibold" : "text-slate-400"}`}>1 Ký tự in hoa</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`h-4.5 w-4.5 rounded-full flex items-center justify-center transition-all ${rules.lowercase ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"}`}>
                    <Check className="h-3 w-3 stroke-[3]" />
                  </div>
                  <span className={`text-xs ${rules.lowercase ? "text-slate-800 font-semibold" : "text-slate-400"}`}>1 Ký tự thường</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`h-4.5 w-4.5 rounded-full flex items-center justify-center transition-all ${rules.number ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"}`}>
                    <Check className="h-3 w-3 stroke-[3]" />
                  </div>
                  <span className={`text-xs ${rules.number ? "text-slate-800 font-semibold" : "text-slate-400"}`}>1 Chữ số</span>
                </div>
                <div className="flex items-center gap-2 md:col-span-2">
                  <div className={`h-4.5 w-4.5 rounded-full flex items-center justify-center transition-all ${rules.special ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"}`}>
                    <Check className="h-3 w-3 stroke-[3]" />
                  </div>
                  <span className={`text-xs ${rules.special ? "text-slate-800 font-semibold" : "text-slate-400"}`}>1 Ký tự đặc biệt (!@#$%^&...)</span>
                </div>
              </div>
            </div>

            {/* Phone Number */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">Số điện thoại di động</label>
              <div className="relative">
                <input
                  type="text"
                  className={`w-full rounded-xl border px-4 py-3 pl-10 text-sm transition-all outline-none focus:ring-2 ${
                    errors.phoneNumber ? "border-rose-300 focus:ring-rose-100" : "border-slate-200 focus:border-blue-500 focus:ring-blue-100"
                  }`}
                  placeholder="+84912345678"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={isLoading || !hasValidInvite}
                />
                <Phone className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
              {errors.phoneNumber ? (
                <p className="text-[10px] font-bold text-rose-500">{errors.phoneNumber}</p>
              ) : (
                <p className="text-[10px] text-slate-400 font-medium">Định dạng E.164 (ví dụ: +84912345678) - dùng nhận mã xác thực OTP 2 bước</p>
              )}
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading || !hasValidInvite}
              className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-md shadow-blue-500/10 hover:bg-blue-700 transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
            >
              {isLoading ? "Đang kích hoạt tài khoản..." : "Kích hoạt tài khoản"}
            </button>
          </form>

          {/* Secondary Link: Back to Login */}
          <div className="mt-6 text-center">
            <button
              onClick={() => navigate("/login")}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Quay lại Đăng nhập
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
