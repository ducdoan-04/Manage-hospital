import { useMutation, useQuery } from "@tanstack/react-query";
import { LockKeyhole } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { incidentsService } from "../../services/incidents";
import { LoadingState, Notice, Panel, PrimaryButton, SecondaryButton, WorkflowPage } from "../../components/workflow/WorkflowUi";

export default function ChartLockConfirmation() {
    const navigate = useNavigate();
    const { id = "" } = useParams();
    const query = useQuery({ queryKey: ["incident", id], queryFn: () => incidentsService.getIncidentById(id), enabled: Boolean(id) });
    const mutation = useMutation({ mutationFn: () => incidentsService.lockChart(id, "Incident investigation requires chart integrity"), onSuccess: () => query.refetch() });
    if (query.isLoading || !query.data)
        return (
            <WorkflowPage title="Xác Nhận Phong Tỏa Bệnh Án">
                <Panel>
                    <LoadingState />
                </Panel>
            </WorkflowPage>
        );
    const incident = query.data;
    return (
        <WorkflowPage breadcrumb="Sự cố Y khoa  >  Phong Tỏa Bệnh Án" title="Xác Nhận Phong Tỏa Hồ Sơ Bệnh Án" description={`Sự cố y khoa #${incident.id}`}>
            {(query.error || mutation.error) && (
                <div className="mb-4">
                    <Notice type="error">{String(query.error ?? mutation.error)}</Notice>
                </div>
            )}
            <div className="mx-auto max-w-3xl">
                <Panel>
                    <div className="flex flex-col items-center py-8 text-center">
                        <div className="mb-5 rounded-full bg-red-100 p-5 text-red-600">
                            <LockKeyhole className="h-12 w-12" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900">
                            {incident.resident.isChartLocked ? "Hồ sơ bệnh án đã được phong tỏa an toàn" : "Yêu cầu phong tỏa bệnh án phục vụ xác minh"}
                        </h2>
                        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                            Hồ sơ bệnh án của người bệnh <strong>{incident.resident.fullName}</strong> hiện {incident.resident.isChartLocked ? "đang ở trạng thái đóng băng" : "chưa bị phong tỏa"}. Trong thời gian bị khóa, mọi thao tác chỉnh sửa thông tin hành chính, phiếu chăm sóc và y lệnh lâm sàng sẽ tạm ngưng cho đến khi Lãnh đạo Khoa / DON phê duyệt mở khóa.
                        </p>
                        <div className="mt-6 grid w-full gap-3 rounded-lg bg-slate-50 p-5 text-left text-sm sm:grid-cols-2">
                            <div>
                                <span className="text-slate-500">Mã Sự Cố</span>
                                <strong className="block text-slate-900">#{incident.id}</strong>
                            </div>
                            <div>
                                <span className="text-slate-500">Thời Điểm Ghi Nhận</span>
                                <strong className="block text-slate-900">{new Date(incident.reportedAt).toLocaleString('vi-VN')}</strong>
                            </div>
                            <div>
                                <span className="text-slate-500">Mức Độ Rủi Ro</span>
                                <strong className="block text-slate-900">{incident.severity.name}</strong>
                            </div>
                            <div>
                                <span className="text-slate-500">Trạng Thái Bệnh Án</span>
                                <strong className="block text-red-600">{incident.resident.isChartLocked ? "ĐÃ PHONG TỎA (LOCKED)" : "CHƯA KHÓA"}</strong>
                            </div>
                        </div>
                        <div className="mt-6 flex gap-3">
                            {!incident.resident.isChartLocked && (
                                <PrimaryButton className="bg-red-600 hover:bg-red-700" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
                                    {mutation.isPending ? "Đang phong tỏa..." : "Xác Nhận Phong Tỏa"}
                                </PrimaryButton>
                            )}
                            <SecondaryButton onClick={() => navigate(`/incidents/${id}`)}>Quay Lại Chi Tiết Sự Cố</SecondaryButton>
                        </div>
                    </div>
                </Panel>
            </div>
        </WorkflowPage>
    );
}

