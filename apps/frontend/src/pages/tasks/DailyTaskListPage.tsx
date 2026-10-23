import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { careTasksService } from "../../services/careTasks";
import { EmptyState, LoadingState, Notice, Panel, PrimaryButton, SecondaryButton, StatusBadge, WorkflowPage } from "../../components/workflow/WorkflowUi";

export default function DailyTaskListPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [status, setStatus] = useState("ALL");
    const query = useQuery({ queryKey: ["care-tasks-today", status], queryFn: () => careTasksService.getToday({ status }) });
    const completeMutation = useMutation({
        mutationFn: (id: string) => careTasksService.complete(id, {}),
        onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["care-tasks-today"] }),
    });

    return (
        <WorkflowPage breadcrumb="Kế hoạch Điều trị  >  Y lệnh Chăm sóc" title="Danh sách Y lệnh Chăm sóc Hôm nay" description="Các y lệnh và hoạt động chăm sóc điều dưỡng trong ca trực theo khung giờ.">
            {completeMutation.error && (
                <div className="mb-4">
                    <Notice type="error">{String(completeMutation.error)}</Notice>
                </div>
            )}
            <Panel
                title="Bộ lọc Ca trực & Trạng thái"
                actions={
                    <div className="flex flex-wrap gap-2">
                        {[
                            { key: "ALL", label: "TẤT CẢ" },
                            { key: "PENDING", label: "CHỜ THỰC HIỆN" },
                            { key: "IN_PROGRESS", label: "ĐANG THỰC HIỆN" },
                            { key: "COMPLETED", label: "ĐÃ HOÀN THÀNH" },
                        ].map((item) => (
                            <button
                                key={item.key}
                                onClick={() => setStatus(item.key)}
                                className={`rounded-full px-3 py-1.5 text-xs font-bold ${status === item.key ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                }
            >
                {query.isLoading ? (
                    <LoadingState />
                ) : !query.data?.length ? (
                    <EmptyState label="Không có y lệnh chăm sóc nào phù hợp với bộ lọc hôm nay." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                                <tr>
                                    <th className="px-4 py-3">Bệnh nhân</th>
                                    <th className="px-4 py-3">Buồng / Giường</th>
                                    <th className="px-4 py-3">Y lệnh / Hoạt động</th>
                                    <th className="px-4 py-3">Giờ thực hiện</th>
                                    <th className="px-4 py-3">Trạng thái</th>
                                    <th className="px-4 py-3 text-right">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {query.data.map((task) => (
                                    <tr key={task.id}>
                                        <td className="px-4 py-4 font-semibold">{task.resident?.fullName ?? "Bệnh nhân chưa định danh"}</td>
                                        <td className="px-4 py-4">{task.resident?.roomNumber ?? "—"}</td>
                                        <td className="px-4 py-4">
                                            <span className="font-medium">{task.taskType}</span>
                                            <span className="block text-xs text-slate-500">{task.intervention?.description}</span>
                                        </td>
                                        <td className="px-4 py-4">{new Date(task.scheduledTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                                        <td className="px-4 py-4">
                                            <StatusBadge tone={task.status === "COMPLETED" ? "success" : task.abnormal ? "danger" : "warning"}>
                                                {task.status === "COMPLETED" ? "ĐÃ HOÀN THÀNH" : task.status === "IN_PROGRESS" ? "ĐANG THỰC HIỆN" : "CHỜ XỬ LÝ"}
                                            </StatusBadge>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                {task.taskType.toLowerCase().includes("vital") && task.resident && (
                                                    <PrimaryButton onClick={() => navigate(`/care-tasks/${task.id}/vitals?residentId=${task.resident!.id}`)}>
                                                        Ghi Chỉ số Sinh tồn
                                                    </PrimaryButton>
                                                )}
                                                {task.status !== "COMPLETED" && !task.taskType.toLowerCase().includes("vital") && (
                                                    <SecondaryButton disabled={completeMutation.isPending} onClick={() => completeMutation.mutate(task.id)}>
                                                        Hoàn thành
                                                    </SecondaryButton>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Panel>
        </WorkflowPage>
    );
}
