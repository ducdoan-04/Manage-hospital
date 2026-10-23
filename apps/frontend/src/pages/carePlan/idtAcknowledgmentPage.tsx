import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { APP_ROUTES } from "../../constants/appRoutes";
import { useCarePlan, useIdtAck } from "./services/apiHooks";

export function IdtAcknowledgmentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: carePlan, isLoading, isError } = useCarePlan(id);
  const idtAckMutation = useIdtAck();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAck = async () => {
    if (!id) return;
    setIsSubmitting(true);
    try {
      await idtAckMutation.mutateAsync({
        id,
        payload: { notes: "Thành viên Hội đồng Chuyên môn (IDT) đã ký xác nhận kế hoạch" }
      });
      navigate(APP_ROUTES.CARE_PLANS);
    } catch (err: any) {
      alert(err.message || "Đã xảy ra lỗi trong quá trình ký xác nhận.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-slate-500">Đang tải hồ sơ...</div>;
  if (isError || !carePlan) return <div className="p-8 text-center text-red-500">Không thể tải kế hoạch điều trị.</div>;

  const residentName = carePlan.resident ? `${carePlan.resident.firstName} ${carePlan.resident.lastName}` : "Chưa xác định";

  return (
    <div className="flex h-[calc(100vh-80px)] flex-col bg-slate-50/50">
      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6">
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <span className="cursor-pointer hover:underline">Chờ Hội Đồng Xác Nhận</span>
              <span>&gt;</span>
              <span>{residentName}</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900">
              Ký Xác nhận Kế hoạch Điều trị (Hội đồng IDT) — {residentName}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Ngày lập: {new Date(carePlan.createdAt).toLocaleDateString('vi-VN')} · Trạng thái: {carePlan.status}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
            <div className="min-w-0">
              <div className="mb-6 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <span className="text-sm text-slate-600">Chế độ chỉ đọc — nội dung kế hoạch điều trị không thể chỉnh sửa tại màn hình này.</span>
                <span className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                  Chỉ xem
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
                <h3 className="mb-4 text-lg font-bold text-slate-900">Mục tiêu & Y lệnh Can thiệp</h3>
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
                  </ul>
                </div>
                <div>
                  <h4 className="mb-3 font-bold text-slate-900">Y lệnh Can thiệp</h4>
                  <ul className="space-y-2 text-sm text-slate-700">
                    {carePlan.interventions?.map((i: any) => (
                      <li key={i.id} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0F766E]" />
                        {i.description}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="min-w-0 space-y-6">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-4 font-bold text-slate-900">Vai trò Của Bạn</h3>
                <div className="space-y-1">
                  <div className="font-bold text-slate-900">Thành viên Hội đồng Chuyên môn (IDT)</div>
                  <div className="text-xs text-slate-500">Bạn đang tiến hành thẩm tra &amp; ký số xác nhận kế hoạch.</div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-2 font-bold text-slate-900">Xác nhận IDT</h3>
                <p className="mb-4 text-xs text-slate-500">
                  Chữ ký số của bạn sẽ được lưu vết bất biến trong bệnh án điện tử và gửi tới Trưởng khoa Điều dưỡng.
                </p>
                <button 
                  onClick={handleAck}
                  disabled={isSubmitting}
                  className="mb-4 w-full rounded-md bg-[#0F766E] py-2.5 text-sm font-bold text-white hover:bg-[#115E59] disabled:opacity-50 transition-colors shadow-sm"
                >
                  {isSubmitting ? "Đang xử lý..." : "Xác nhận & Ký số Điện tử"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

