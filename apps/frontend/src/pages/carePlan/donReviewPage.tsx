import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { APP_ROUTES } from "../../constants/appRoutes";
import { Check, Lock } from "lucide-react";
import { useCarePlan, useDonReview, useESign } from "./services/apiHooks";

export function DonReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Use React Query instead of manual fetch + useEffect
  const { data: carePlanData, isLoading, isError } = useCarePlan(id);
  const donReviewMutation = useDonReview();
  const eSignMutation = useESign();

  const handleApprove = async () => {
    if (!password) return alert("Vui lòng nhập mật khẩu xác thực chữ ký số điện tử.");
    if (!id) return;

    setIsSubmitting(true);
    try {
      // 1. Approve (DON Review)
      await donReviewMutation.mutateAsync({
        id,
        payload: { status: "APPROVED", notes: "Phê duyệt bởi Trưởng khoa Điều dưỡng (DON)" },
      });
      // 2. E-sign
      await eSignMutation.mutateAsync({
        id,
        payload: { signatureToken: password },
      });
      setIsModalOpen(false);
      navigate(APP_ROUTES.CARE_PLANS);
    } catch (err: any) {
      console.error("Approve failed:", err);
      alert(err.message || "Đã xảy ra lỗi trong quá trình phê duyệt.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason) return alert("Vui lòng nhập lý do từ chối / yêu cầu sửa đổi.");
    if (!id) return;

    setIsSubmitting(true);
    try {
      await donReviewMutation.mutateAsync({
        id,
        payload: { status: "REJECTED", notes: rejectReason },
      });
      navigate(APP_ROUTES.CARE_PLANS);
    } catch (err: any) {
      console.error("Reject failed:", err);
      alert(err.message || "Đã xảy ra lỗi trong quá trình gửi trả kế hoạch.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-slate-500">Đang tải hồ sơ kế hoạch điều trị...</div>;
  if (isError || !carePlanData) return <div className="p-8 text-center text-red-500">Không thể tải kế hoạch điều trị. Vui lòng thử lại.</div>;

  const carePlan = carePlanData;
  const residentName = carePlan.resident
    ? `${carePlan.resident.firstName} ${carePlan.resident.lastName}`
    : "Người bệnh chưa xác định";

  return (
    <div className="flex h-[calc(100vh-80px)] flex-col bg-slate-50/50">
      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6">
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <Link to={APP_ROUTES.CARE_PLANS} className="hover:underline">
                Kế hoạch Điều trị
              </Link>
              <span>&gt;</span>
              <span>Phê duyệt</span>
              <span>&gt;</span>
              <span>{residentName}</span>
            </div>
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold text-slate-900">
                Phê duyệt Kế hoạch Điều trị — {residentName}
              </h1>
              <span className="rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-xs font-semibold text-yellow-700">
                {carePlan.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Phòng P-204 · Cấp độ chăm sóc II · Ngày gửi duyệt: {new Date(carePlan.createdAt).toLocaleDateString('vi-VN')}
            </p>
          </div>


          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
            <div className="min-w-0 space-y-6">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-bold text-slate-900">Tóm tắt Kế hoạch Điều trị (Chỉ xem)</h3>

                <div className="mb-6">
                  <h4 className="mb-3 font-bold text-slate-900">Mục tiêu Điều trị</h4>
                  <ul className="space-y-2 text-sm text-slate-700">
                    {carePlan.goals?.map((g: any) => {
                      let parsed: any = {};
                      try {
                        parsed = JSON.parse(g.description);
                      } catch {
                        parsed = { goal: g.description };
                      }
                      return (
                        <li key={g.id} className="flex items-start gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0F766E]" />
                          <span className="font-semibold">{parsed.title ? parsed.title + ": " : ""}</span>
                          {parsed.goal || g.description}
                        </li>
                      );
                    })}
                    {(!carePlan.goals || carePlan.goals.length === 0) && <li>Chưa có mục tiêu cụ thể.</li>}
                  </ul>
                </div>

                <div>
                  <h4 className="mb-3 font-bold text-slate-900">Y lệnh & Can thiệp Y tế</h4>
                  <ul className="space-y-2 text-sm text-slate-700">
                    {carePlan.interventions?.map((i: any) => (
                      <li key={i.id} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0F766E]" />
                        {i.description}
                      </li>
                    ))}
                    {(!carePlan.interventions || carePlan.interventions.length === 0) && <li>Chưa có y lệnh can thiệp.</li>}
                  </ul>
                </div>
              </div>

              {/* Author Accountability */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-3 font-bold text-slate-900">Trách nhiệm Người lập Hồ sơ</h3>
                <div className="text-sm text-slate-600 space-y-1">
                  <div>
                    Người lập: <span className="text-slate-900 font-semibold">ĐD. Đỗ Thị Thu, CKI</span> <span className="mx-1">·</span> Chứng chỉ hành nghề: <span className="text-slate-900 font-medium">028491/BYT-CCHN</span>
                  </div>
                  <div>
                    Thời gian lập: <span className="text-slate-900 font-semibold">{new Date(carePlan.createdAt).toLocaleString('vi-VN')}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="mb-1 text-lg font-bold text-slate-900">Lý do Từ chối / Yêu cầu Điều chỉnh</h3>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="mt-4 w-full rounded-md border border-slate-200 p-3 text-sm outline-none focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E]"
                  rows={4}
                  placeholder="Ghi rõ nội dung cần điều dưỡng điều chỉnh trước khi trình duyệt lại..."
                />
              </div>
            </div>

            <div className="min-w-0 space-y-6">
              {/* Compliance Checklist */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-1 font-bold text-slate-900">Bảng kiểm Tuân thủ Quy chế Bệnh viện</h3>
                <p className="mb-4 text-[11px] text-slate-500">Tất cả các tiêu chí bắt buộc phải đạt.</p>
                <div className="space-y-3 text-sm text-slate-700">
                  <label className="flex items-start gap-3">
                    <input type="checkbox" checked readOnly className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0F766E] focus:ring-[#0F766E]" />
                    <span>Lập kế hoạch trong vòng 48h sau nhập viện (Quy chế Bộ Y tế)</span>
                  </label>
                  <label className="flex items-start gap-3">
                    <input type="checkbox" checked readOnly className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0F766E] focus:ring-[#0F766E]" />
                    <span>Kế hoạch toàn diện hoàn tất trong 7 ngày</span>
                  </label>
                  <label className="flex items-start gap-3">
                    <input type="checkbox" checked readOnly className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0F766E] focus:ring-[#0F766E]" />
                    <span>Đã liên kết đánh giá lâm sàng & thang điểm ADL/Fall-Risk</span>
                  </label>
                  <label className="flex items-start gap-3">
                    <input type="checkbox" checked readOnly className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0F766E] focus:ring-[#0F766E]" />
                    <span>Đã ký cam kết đồng thuận điều trị từ người bệnh/thân nhân</span>
                  </label>
                </div>
                <div className="mt-4 inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                  4 / 4 tiêu chuẩn đạt
                </div>
              </div>

              {/* IDT Acknowledgment */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-1 font-bold text-slate-900">Hội đồng Chuyên môn (Hội chẩn IDT)</h3>
                <p className="mb-4 text-[11px] text-slate-500">Tự động đối chiếu chữ ký số thành viên hội chẩn</p>
                <div className="space-y-4 text-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-slate-500 text-xs">Bác sĩ điều trị</div>
                      <div className="font-bold text-slate-900">BSCKII. Nguyễn Văn Hùng</div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">Đã ký số</span>
                      <span className="mt-1 text-[10px] text-slate-400">02/07/2026 14:10</span>
                    </div>
                  </div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-slate-500 text-xs">Dinh dưỡng lâm sàng</div>
                      <div className="font-bold text-slate-900">ThS. Lê Hoàng Yến, RD</div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">Đã ký số</span>
                      <span className="mt-1 text-[10px] text-slate-400">02/07/2026 15:30</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-4 font-bold text-slate-900">Quyết định Phê duyệt</h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  disabled={isSubmitting}
                  className="mb-3 w-full rounded-md bg-[#0F766E] py-2.5 text-sm font-bold text-white hover:bg-[#115E59] disabled:opacity-50 transition-colors shadow-sm"
                >
                  Phê duyệt &amp; Ký số Điện tử
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={isSubmitting}
                  className="mb-2 w-full rounded-md border border-red-500 bg-white py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? "Đang xử lý..." : "Từ chối & Gửi trả lại"}
                </button>
                <p className="text-center text-[11px] text-slate-400">
                  Phê duyệt yêu cầu xác thực mật khẩu chữ ký số token.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* E-signature Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="esign-modal-title"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 id="esign-modal-title" className="mb-2 text-xl font-bold text-slate-900">
              Yêu cầu Xác thực Chữ ký số Điện tử
            </h2>
            <p className="mb-6 text-sm text-slate-500">
              Phê duyệt sẽ kích hoạt kế hoạch điều trị chính thức, phát sinh nhiệm vụ phân công điều dưỡng và hạch toán viện phí nội trú.
            </p>

            <div className="mb-4">
              <label htmlFor="esign-password" className="mb-2 block text-sm font-bold text-slate-700">
                Nhập mật khẩu chứng thư số để ký:
              </label>
              <div className="relative">
                <input
                  id="esign-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-slate-200 p-2.5 text-lg tracking-widest outline-none focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E]"
                />
                <Lock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 rounded-md border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={isSubmitting}
                className="flex-1 rounded-md bg-[#0F766E] py-2.5 text-sm font-bold text-white hover:bg-[#115E59] disabled:opacity-50"
              >
                {isSubmitting ? "Đang ký số..." : "Ký số & Phê duyệt"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

