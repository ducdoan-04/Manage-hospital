import { Link, useParams } from "react-router-dom";
import { APP_ROUTES } from "../../constants/appRoutes";
import { ActivityTimeline } from "./components/activityTimeline";
import { CareAreaViewCard } from "./components/careAreaViewCard";
import { CostEstimateCard } from "./components/carePlanSidePanels";
import { ReviewCycleCard } from "./components/reviewCycleCard";
import { AssignedTasksTable } from "./components/assignedTasksTable";
import { useCarePlan } from "./services/apiHooks";

export function CarePlanPage() {
  const { id } = useParams<{ id: string }>();

  // Use React Query instead of manual fetch + useEffect
  const { data: carePlan, isLoading, isError } = useCarePlan(id);

  if (isLoading) return <div className="p-8 text-center text-slate-500">Đang tải kế hoạch điều trị...</div>;
  if (isError || !carePlan) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500 mb-4">Không thể tải kế hoạch điều trị. Vui lòng thử lại.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md bg-[#0F766E] px-4 py-2 text-sm font-medium text-white hover:bg-[#115E59]"
        >
          Thử lại
        </button>
      </div>
    );
  }

  const residentName = carePlan.resident
    ? `${carePlan.resident.firstName} ${carePlan.resident.lastName}`
    : "Người bệnh chưa xác định";

  // Map backend goals to UI care areas
  const mappedCareAreas = carePlan.goals?.map((g: any, index: number) => {
    let parsed: any = {};
    try {
      parsed = JSON.parse(g.description);
      if (!parsed.goal) throw new Error("not json");
    } catch {
      parsed = { goal: g.description, title: `Lĩnh vực chăm sóc ${index + 1}` };
    }
    return {
      title: parsed.title || `Lĩnh vực chăm sóc ${index + 1}`,
      badge: { text: "Đang áp dụng", variant: "green" as const },
      goal: parsed.goal,
      measure: parsed.measure,
      target: parsed.target,
    };
  }) || [];

  const tasks = carePlan.interventions?.map((i: any) => ({
    task: i.description,
    freq: "Hàng ngày",
    owner: i.assignedRole || "Điều dưỡng",
  })) || [];

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
              <span>Chi tiết</span>
              <span>&gt;</span>
              <span>{residentName}</span>
            </div>
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold text-slate-900">
                Kế hoạch Điều trị — {residentName}
              </h1>
              <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 uppercase">
                {carePlan.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Phòng P-204 · Cấp độ chăm sóc III · Ngày lập: {new Date(carePlan.createdAt).toLocaleDateString('vi-VN')}
            </p>
          </div>

          <div className="mb-8 border-b border-slate-200">
            <nav className="-mb-px flex space-x-8">
              <button type="button" className="border-b-2 border-[#0F766E] px-1 py-4 text-sm font-bold text-[#0F766E]">
                Tổng quan
              </button>
              <button type="button" className="border-b-2 border-transparent px-1 py-4 text-sm font-medium text-slate-500 hover:border-slate-300 hover:text-slate-700">
                Lịch sử hoạt động
              </button>
              <button type="button" className="border-b-2 border-transparent px-1 py-4 text-sm font-medium text-slate-500 hover:border-slate-300 hover:text-slate-700">
                Dự toán chi phí
              </button>
            </nav>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
            <div className="min-w-0">
              <div className="mb-4 text-sm font-bold text-slate-700">Mục tiêu & Chuyên khoa Điều trị</div>

              {mappedCareAreas.length > 0
                ? mappedCareAreas.map((area: any, idx: number) => (
                    <CareAreaViewCard key={idx} {...area} />
                  ))
                : <div className="text-sm text-slate-500 italic mb-4">Chưa có mục tiêu điều trị nào được xác định.</div>}

              <ActivityTimeline tasks={tasks} />
            </div>

            <div className="min-w-0 space-y-6">
              <CostEstimateCard />
              <ReviewCycleCard />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

