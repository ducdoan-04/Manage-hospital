import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { UnlockKeyhole } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { incidentsService } from "../../services/incidents";
import { fieldClassName, labelClassName, LoadingState, Notice, Panel, PrimaryButton, SecondaryButton, WorkflowPage } from "../../components/workflow/WorkflowUi";

export default function ChartUnlockPage() {
    const navigate = useNavigate();
    const { id = "" } = useParams();
    const query = useQuery({ queryKey: ["incident", id], queryFn: () => incidentsService.getIncidentById(id), enabled: Boolean(id) });
    const [reason, setReason] = useState("");
    const [passwordConfirm, setPasswordConfirm] = useState("");
    const mutation = useMutation({ mutationFn: () => incidentsService.unlockChart(id, reason, passwordConfirm), onSuccess: () => navigate(`/incidents/${id}`) });
    if (query.isLoading || !query.data)
        return (
            <WorkflowPage title="Mở Khóa Hồ Sơ Bệnh Án">
                <Panel>
                    <LoadingState />
                </Panel>
            </WorkflowPage>
        );
    return (
        <WorkflowPage
            breadcrumb={`Sự cố Y khoa  >  #${id}  >  Mở Khóa Bệnh Án`}
            title="Mở Khóa Hồ Sơ Bệnh Án Người Bệnh"
            description="Thẩm quyền Lãnh đạo khoa / Giám đốc điều dưỡng. Ghi nhận lý do mở khóa và xác nhận mật khẩu tài khoản."
        >
            {(query.error || mutation.error) && (
                <div className="mb-4">
                    <Notice type="error">{String(query.error ?? mutation.error)}</Notice>
                </div>
            )}
            <div className="mx-auto max-w-2xl">
                <Panel>
                    <div className="mb-6 flex items-start gap-4 rounded-lg bg-emerald-50 p-4">
                        <UnlockKeyhole className="h-8 w-8 text-emerald-600" />
                        <div>
                            <h2 className="font-bold text-slate-900">{query.data.resident.fullName}</h2>
                            <p className="text-sm text-slate-600">
                                Sự cố mã #{query.data.id} · Trạng thái hiện tại: {query.data.resident.isChartLocked ? "Đang bị khóa" : "Đã mở khóa"}
                            </p>
                        </div>
                    </div>
                    <div className="space-y-5">
                        <label className={labelClassName}>
                            Lý do mở khóa bệnh án *
                            <textarea
                                className={`${fieldClassName} min-h-28`}
                                value={reason}
                                onChange={(event) => setReason(event.target.value)}
                                placeholder="Quá trình xác minh nguyên nhân đã hoàn tất và tài liệu bổ sung đã được thẩm tra..."
                            />
                        </label>
                        <label className={labelClassName}>
                            Mật khẩu xác thực Chữ ký số *
                            <input
                                className={fieldClassName}
                                type="password"
                                value={passwordConfirm}
                                onChange={(event) => setPasswordConfirm(event.target.value)}
                                autoComplete="current-password"
                            />
                        </label>
                        <Notice type="warning">Mở khóa sẽ khôi phục quyền ghi chép và tạo nhật ký kiểm toán vĩnh viễn. Hành động này không đồng nghĩa với việc đóng sự cố.</Notice>
                        <div className="flex justify-end gap-3">
                            <SecondaryButton onClick={() => navigate(-1)}>Hủy bỏ</SecondaryButton>
                            <PrimaryButton
                                className="bg-[#0F766E] hover:bg-[#115E59]"
                                disabled={!query.data.resident.isChartLocked || !reason.trim() || !passwordConfirm || mutation.isPending}
                                onClick={() => mutation.mutate()}
                            >
                                {mutation.isPending ? "Đang mở khóa..." : "Xác Nhận Mở Khóa"}
                            </PrimaryButton>
                        </div>
                    </div>
                </Panel>
            </div>
        </WorkflowPage>
    );
}

