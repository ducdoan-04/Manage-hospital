import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { APP_ROUTES } from "../../constants/appRoutes";
import { AssignedTasksTable } from "./components/assignedTasksTable";
import type { TaskItem } from "./components/assignedTasksTable";
import { CareAreaCard } from "./components/careAreaCard";
import { CostEstimateCard, PlanStatusCard } from "./components/carePlanSidePanels";
import { LocGateBanner } from "./components/locGateBanner";
import {
  useCarePlan,
  useResidents,
  useCreateCarePlan,
  useUpdateCarePlan,
  useCheckLocGate,
} from "./services/apiHooks";

type CareArea = {
  id: string;
  title: string;
  badge: { text: string; variant: "blue" | "gray" };
  goal: string;
  measure: string;
  target: string;
  tasks: string[];
};

export function CreateCarePlanPage() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  const navigate = useNavigate();

  const { data: residents = [], isLoading: isLoadingResidents } = useResidents();
  const { data: existingPlan, isLoading: isLoadingPlan } = useCarePlan(id);

  const createMutation = useCreateCarePlan();
  const updateMutation = useUpdateCarePlan();
  const checkLocGateMutation = useCheckLocGate();
  const isLocConfirmed = true;

  const [residentId, setResidentId] = useState("");
  const [careAreas, setCareAreas] = useState<CareArea[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locWarning, setLocWarning] = useState<string | null>(null);

  // Set default resident when list loads (create mode)
  useEffect(() => {
    if (!isEditMode && residents.length > 0 && !residentId) {
      setResidentId(residents[0].id);
    }
  }, [residents, isEditMode, residentId]);

  // Pre-fill form when editing
  useEffect(() => {
    if (isEditMode && existingPlan) {
      setResidentId(existingPlan.residentId);
      setCareAreas(
        (existingPlan.goals || []).map((g: any, idx: number) => {
          let parsed: any = {};
          try {
            parsed = JSON.parse(g.description);
            if (!parsed.goal) throw new Error("not json");
          } catch {
            parsed = { goal: g.description, title: `Care Area ${idx + 1}`, measure: "", target: "" };
          }
          return {
            id: g.id || Date.now().toString() + Math.random(),
            title: parsed.title || `Care Area ${idx + 1}`,
            badge: { text: "Active", variant: "blue" as const },
            goal: parsed.goal || "",
            measure: parsed.measure || "",
            target: parsed.target || "",
            tasks: [],
          };
        }),
      );
      setTasks(
        (existingPlan.interventions || []).map((i: any) => ({
          task: i.description,
          freq: "Daily",
          owner: i.assignedRole || "CNA",
        })),
      );
    }
  }, [isEditMode, existingPlan]);

  const handleAddArea = () => {
    setCareAreas([
      ...careAreas,
      {
        id: Date.now().toString(),
        title: "",
        badge: { text: "Manual", variant: "gray" as const },
        goal: "",
        measure: "",
        target: "",
        tasks: [],
      },
    ]);
  };

  const handleRemoveArea = (areaId: string) => {
    setCareAreas(careAreas.filter((a) => a.id !== areaId));
  };

  const handleAreaChange = (areaId: string, field: string, value: any) => {
    setCareAreas(careAreas.map((a) => (a.id === areaId ? { ...a, [field]: value } : a)));
  };

  const handleSubmit = async (targetStatus: string) => {
    // Basic validation
    if (!residentId) {
      alert("Vui lòng chọn người bệnh.");
      return;
    }
    if (careAreas.length === 0) {
      alert("Vui lòng thêm ít nhất một Mục tiêu Chăm sóc.");
      return;
    }
    if (careAreas.some((a) => !a.goal.trim())) {
      alert("Vui lòng nhập Mục tiêu cụ thể cho tất cả các lĩnh vực chăm sóc.");
      return;
    }

    setIsSubmitting(true);
    setLocWarning(null);

    try {
      const payload = {
        residentId,
        status: targetStatus === "Pending Review" ? "PENDING_REVIEW" : "DRAFT",
        goals: careAreas.map((c) => ({
          description: JSON.stringify({
            title: c.title,
            goal: c.goal,
            measure: c.measure,
            target: c.target,
          }),
        })),
        interventions: tasks
          .filter((t) => t.task.trim())
          .map((t) => ({ description: t.task, assignedRole: t.owner })),
      };

      // Check LOC Gate before submitting for review
      if (targetStatus === "Pending Review") {
        const checkRes: any = await checkLocGateMutation.mutateAsync(payload);
        if (!checkRes.success) {
          const warning = checkRes.message + (checkRes.data?.length ? ": " + checkRes.data.join(", ") : "");
          setLocWarning(warning);
          alert("Kiểm tra Tiêu chuẩn Phân loại Chăm sóc chưa đạt: " + checkRes.message);
          setIsSubmitting(false);
          return;
        }
      }

      if (isEditMode && id) {
        await updateMutation.mutateAsync({ id, payload });
      } else {
        await createMutation.mutateAsync(payload);
      }

      navigate(APP_ROUTES.CARE_PLANS);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Đã xảy ra lỗi không xác định.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const locRate = 350000;
  const roomRate = 250000;
  const tier = careAreas.length > 3 ? "Cấp độ III" : careAreas.length > 1 ? "Cấp độ II" : "Cấp độ I";

  if (isLoadingResidents || (isEditMode && isLoadingPlan)) {
    return <div className="p-8 text-center text-slate-500">Đang tải dữ liệu...</div>;
  }

  return (
    <div className="flex h-[calc(100vh-80px)] flex-col bg-slate-50/50">
      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="mx-auto max-w-6xl">

          {locWarning && (
            <div className="mb-6 flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 p-4 text-orange-700">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-orange-700 text-xs font-bold">!</span>
              <span className="text-sm font-bold">{locWarning}</span>
            </div>
          )}

          <div className="mb-6">
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <Link to={APP_ROUTES.CARE_PLANS} className="hover:underline">
                Kế hoạch Điều trị
              </Link>
              <span>&gt;</span>
              <span>{isEditMode ? "Chỉnh sửa Kế hoạch" : "Tạo Kế hoạch Mới"}</span>
            </div>
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold text-slate-900">
                {isEditMode ? "Chỉnh sửa Kế hoạch Điều trị" : "Tạo Kế hoạch Điều trị Mới"}
              </h1>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                Bản nháp
              </span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <label className="text-sm font-bold text-slate-700">Người bệnh:</label>
              <select
                value={residentId}
                onChange={(e) => setResidentId(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-[#0F766E]"
              >
                <option value="" disabled>Chọn Người bệnh</option>
                {(residents as any[]).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.firstName} {r.lastName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
            <div className="min-w-0">
              <LocGateBanner tier={tier} />

              <div className="mb-4 text-sm font-bold text-slate-700">
                Lĩnh vực Chăm sóc & Can thiệp Y tế (Kế hoạch Điều trị Toàn diện)
              </div>

              {careAreas.map((area) => (
                <CareAreaCard
                  key={area.id}
                  {...area}
                  onRemove={() => handleRemoveArea(area.id)}
                  onChange={(field, val) => handleAreaChange(area.id, field, val)}
                />
              ))}

              <button
                type="button"
                onClick={handleAddArea}
                className="mt-2 flex h-10 w-full items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                + Thêm Lĩnh vực Chăm sóc
              </button>

              <AssignedTasksTable tasks={tasks} onChange={setTasks} />
            </div>

            <div className="min-w-0 space-y-6">
              <CostEstimateCard tier={tier} locRate={locRate} roomRate={roomRate} />
              <PlanStatusCard />
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white p-4">
        <div className="mx-auto flex max-w-6xl justify-end gap-4">
          <button
            type="button"
            onClick={() => handleSubmit("Draft")}
            disabled={isSubmitting}
            className="h-10 rounded-md border border-slate-200 bg-white px-6 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Lưu bản nháp
          </button>
          <button
            type="button"
            onClick={() => handleSubmit("Pending Review")}
            disabled={isSubmitting}
            className="h-10 rounded-md bg-[#0F766E] px-6 text-sm font-bold !text-white hover:bg-[#115E59] disabled:opacity-50"
          >
            {isSubmitting ? "Đang gửi..." : "Gửi Trưởng khoa Duyệt"}
          </button>
        </div>
      </footer>
    </div>
  );
}

