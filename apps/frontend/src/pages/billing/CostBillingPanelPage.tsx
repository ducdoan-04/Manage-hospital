import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { billingService } from "../../services/billing";
import { residentsService } from "../../services/residents";
import { fieldClassName, labelClassName, LoadingState, Notice, Panel, PrimaryButton, StatusBadge, WorkflowPage } from "../../components/workflow/WorkflowUi";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });

const payerLabels: Record<string, string> = {
    medicare: "Bảo hiểm Y tế (BHYT)",
    medicaid: "Chính sách Bảo trợ Xã hội",
    privateInsurance: "Bảo hiểm Sức khỏe Thương mại",
    family: "Người bệnh / Thân nhân Tự chi trả",
};

export default function CostBillingPanelPage() {
    const queryClient = useQueryClient();
    const [searchParams] = useSearchParams();
    const residentsQuery = useQuery({ queryKey: ["resident-options"], queryFn: () => residentsService.getAll() });
    const [residentId, setResidentId] = useState(searchParams.get("residentId") ?? "");
    useEffect(() => {
        if (!residentId && residentsQuery.data?.[0]) setResidentId(residentsQuery.data[0].id);
    }, [residentId, residentsQuery.data]);
    const billingQuery = useQuery({ queryKey: ["billing-cost", residentId], queryFn: () => billingService.getResidentCost(residentId), enabled: Boolean(residentId) });
    const [rate, setRate] = useState(0);
    const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
    const [message, setMessage] = useState<string | null>(null);
    useEffect(() => {
        if (billingQuery.data) setRate(billingQuery.data.dailyRate);
    }, [billingQuery.data]);
    const mutation = useMutation({
        mutationFn: () => billingService.updateRate(residentId, billingQuery.data.activeLoc.id, { dailyRate: rate, effectiveFrom }),
        onSuccess: async () => {
            setMessage("Đơn giá mới đã được lưu thành công và sẽ áp dụng cho các kỳ viện phí tiếp theo.");
            await queryClient.invalidateQueries({ queryKey: ["billing-cost", residentId] });
        },
    });
    const data = billingQuery.data;
    return (
        <WorkflowPage
            breadcrumb="Viện phí  >  Bảng Kê Chi Phí Điều Trị"
            title="Quản lý Viện phí & Chi phí Khám Chữa Bệnh"
            description="Theo dõi cơ cấu chi trả BHYT, định mức giá ngày giường bệnh, chi tiết hóa đơn viện phí và điều chỉnh đơn giá kỳ tới."
        >
            <Panel title="Chọn Người bệnh">
                <label className={labelClassName}>
                    Người bệnh nội trú
                    <select className={fieldClassName} value={residentId} onChange={(event) => setResidentId(event.target.value)}>
                        {residentsQuery.data?.map((resident) => (
                            <option key={resident.id} value={resident.id}>
                                {resident.fullName}
                            </option>
                        ))}
                    </select>
                </label>
            </Panel>
            {message && (
                <div className="mt-4">
                    <Notice type="success">{message}</Notice>
                </div>
            )}
            {(billingQuery.error || mutation.error) && (
                <div className="mt-4">
                    <Notice type="error">{String(billingQuery.error ?? mutation.error)}</Notice>
                </div>
            )}
            <div className="mt-5">
                {billingQuery.isLoading || !data ? (
                    <Panel>
                        <LoadingState />
                    </Panel>
                ) : (
                    <div className="space-y-5">
                        <div className="grid gap-4 md:grid-cols-4">
                            <Panel title="Cấp độ Chăm sóc">
                                <StatusBadge tone={data.activeLoc ? "success" : "warning"}>{data.activeLoc?.name ?? "Chưa xác nhận"}</StatusBadge>
                                <p className="mt-2 text-xs text-slate-500">Áp dụng từ {data.activeLoc?.startDate ?? "—"}</p>
                            </Panel>
                            <Panel title="Đơn giá Ngày / Giường">
                                <p className="text-2xl font-bold text-slate-900">{money.format(data.dailyRate)}</p>
                            </Panel>
                            <Panel title="Dự toán Viện phí Tháng">
                                <p className="text-2xl font-bold text-[#0F766E]">{money.format(data.monthlyEstimate)}</p>
                            </Panel>
                            <Panel title="Trạng thái Hóa đơn">
                                <StatusBadge tone={data.status === "PAID" ? "success" : "info"}>
                                    {data.status === "PAID" ? "ĐÃ THANH TOÁN" : "CHỜ THANH TOÁN"}
                                </StatusBadge>
                            </Panel>
                        </div>
                        <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
                            <Panel title="Cơ cấu Chi trả (BHYT & Tự túc)">
                                <div className="space-y-4">
                                    {Object.entries(data.payerBreakdown).map(([payer, amount]) => {
                                        const percentage = data.total ? Math.round((Number(amount) / data.total) * 100) : 0;
                                        const label = payerLabels[payer] || payer.replace(/([A-Z])/g, " $1");
                                        return (
                                            <div key={payer}>
                                                <div className="mb-1 flex justify-between text-sm">
                                                    <span className="font-medium text-slate-700 capitalize">{label}</span>
                                                    <strong>
                                                        {money.format(Number(amount))} · {percentage}%
                                                    </strong>
                                                </div>
                                                <div className="h-2 rounded-full bg-slate-100">
                                                    <div className="h-2 rounded-full bg-[#0F766E]" style={{ width: `${percentage}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div className="flex justify-between border-t pt-4 text-lg">
                                        <strong>Tổng cộng viện phí</strong>
                                        <strong className="text-[#0F766E]">{money.format(data.total)}</strong>
                                    </div>
                                </div>
                            </Panel>
                            <Panel title="Điều chỉnh Đơn giá Kỳ tới" description="Các hóa đơn viện phí đã xuất trong quá khứ sẽ không bị tính lại.">
                                <label className={labelClassName}>
                                    Đơn vị giá mới (VNĐ / ngày)
                                    <input className={fieldClassName} type="number" min={0} step="1000" value={rate} onChange={(event) => setRate(Number(event.target.value))} />
                                </label>
                                <label className={`${labelClassName} mt-4 block`}>
                                    Thời điểm áp dụng từ
                                    <input className={fieldClassName} type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} />
                                </label>
                                <PrimaryButton className="mt-5 w-full bg-[#0F766E] hover:bg-[#115E59]" disabled={!data.activeLoc || mutation.isPending} onClick={() => mutation.mutate()}>
                                    {mutation.isPending ? "Đang lưu..." : "Lưu đơn giá mới"}
                                </PrimaryButton>
                            </Panel>
                        </div>
                        <Panel title="Lịch sử Biến động Đơn giá">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                                        <tr>
                                            <th className="px-4 py-3">Đơn giá ngày</th>
                                            <th className="px-4 py-3">Hiệu lực từ</th>
                                            <th className="px-4 py-3">Hiệu lực đến</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {data.rateHistory.map((item: any) => (
                                            <tr key={item.id}>
                                                <td className="px-4 py-4 font-semibold">{money.format(item.dailyRate)}</td>
                                                <td className="px-4 py-4">{item.effectiveFrom}</td>
                                                <td className="px-4 py-4">{item.effectiveTo ?? "Hiện hành"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Panel>
                    </div>
                )}
            </div>
        </WorkflowPage>
    );
}

