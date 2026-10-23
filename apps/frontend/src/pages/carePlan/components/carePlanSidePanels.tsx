type CostEstimateCardProps = {
  tier?: string;
  locRate?: number;
  roomRate?: number;
};

export function CostEstimateCard({
  tier = "Cấp độ 3 (Hỗ trợ toàn diện)",
  locRate = 350000,
  roomRate = 250000
}: CostEstimateCardProps) {
  const estimatedDaily = locRate + roomRate;
  const estimatedMonthly = estimatedDaily * 30; // 30 days/month

  const formatVnd = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
  };

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-bold text-slate-900">Dự toán Viện phí & Chi phí</h3>
        <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-medium uppercase text-slate-500">
          Chỉ xem
        </span>
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex justify-between text-slate-600">
          <span>Định mức chăm sóc ({tier})</span>
          <span className="font-semibold text-slate-900">{formatVnd(locRate)} / ngày</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>Tiền giường bệnh (Phòng đôi tiêu chuẩn)</span>
          <span className="font-semibold text-slate-900">{formatVnd(roomRate)} / ngày</span>
        </div>

        <div className="my-2 border-t border-slate-100" />

        <div className="flex justify-between text-slate-600">
          <span className="font-medium">Ước tính / ngày</span>
          <span className="font-bold text-[#0F766E]">{formatVnd(estimatedDaily)}</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span className="font-medium">Ước tính / tháng (30 ngày)</span>
          <span className="font-bold text-slate-900">{formatVnd(estimatedMonthly)}</span>
        </div>
      </div>

      <p className="mt-4 text-[11px] text-slate-400">
        Bảng dự tính tham khảo — chưa khấu trừ danh mục Bảo hiểm Y tế (BHYT).
      </p>
    </div>
  );
}

export function PlanStatusCard() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 font-bold text-slate-900">Quy trình Phê duyệt</h3>
      <p className="mb-4 text-sm text-slate-600">
        Lưu nháp giữ kế hoạch ở trạng thái Bản nháp. Gửi duyệt sẽ chuyển đến Trưởng khoa / Điều dưỡng trưởng (DON) phê duyệt và ký số Hội đồng Chuyên môn.
      </p>
      <div className="text-xs font-semibold text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
        Bản nháp → Chờ duyệt → Đã duyệt → Ký số hoàn tất
      </div>
    </div>
  );
}

