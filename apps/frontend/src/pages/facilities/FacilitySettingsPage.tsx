import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { Plus, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/authUi/input";
import {
    facilitiesService,
    type FacilityBedStatus,
    type FacilityClinicalCapability,
    type FacilityRoomForm,
    type FacilityRoomRate,
} from "@/services/facilities";

const roomTypeOptions = ["Private", "Semi-private", "Ward"];

const roomTypeLabels: Record<string, string> = {
    Private: "Phòng đơn VIP",
    "Semi-private": "Phòng đôi tiêu chuẩn",
    Ward: "Phòng điều trị chung (Khoa nội)",
};

const bedStatusOptions: Array<{ label: string; value: FacilityBedStatus }> = [
    { label: "Trống / Sẵn sàng", value: "AVAILABLE" },
    { label: "Đang có người bệnh", value: "OCCUPIED" },
    { label: "Bảo trì / Tạm ngưng", value: "MAINTENANCE" },
];

const usTimezoneOptions = [
    { label: "Asia/Ho_Chi_Minh (Việt Nam - GMT+7)", value: "Asia/Ho_Chi_Minh" },
    { label: "Asia/Bangkok (GMT+7)", value: "Asia/Bangkok" },
    { label: "America/New_York (Eastern)", value: "America/New_York (Eastern)" },
    { label: "America/Los_Angeles (Pacific)", value: "America/Los_Angeles (Pacific)" },
];

function toApiStatus(status: string): FacilityBedStatus {
    if (status === "Occupied" || status === "OCCUPIED") {
        return "OCCUPIED";
    }

    if (status === "Out of Service" || status === "MAINTENANCE") {
        return "MAINTENANCE";
    }

    return "AVAILABLE";
}

function getWing(roomNumber: string) {
    const numericRoom = Number.parseInt(roomNumber, 10);

    if (numericRoom >= 220) {
        return "Khu C (Ngoại - Hồi sức)";
    }

    if (numericRoom >= 200) {
        return "Khu B (Nội tổng hợp)";
    }

    return "Khu A (Cấp cứu & Lưu trú)";
}


function emptyRoom(): FacilityRoomForm {
    return {
        roomNumber: "",
        bedNumber: "A",
        roomType: "Private",
        status: "AVAILABLE",
    };
}

function getStatusSelectClass(status: FacilityBedStatus) {
    const baseClass = "h-8 rounded-full border px-3 text-xs font-bold outline-none";

    if (status === "OCCUPIED") {
        return `${baseClass} border-blue-300 bg-blue-100 text-blue-600`;
    }

    if (status === "MAINTENANCE") {
        return `${baseClass} border-slate-300 bg-slate-100 text-slate-600`;
    }

    return `${baseClass} border-emerald-300 bg-emerald-100 text-emerald-600`;
}

type FacilityTab = "general" | "rooms" | "rates" | "capabilities";
type FacilityRoomDraft = FacilityRoomForm & { clientId: string };

function createClientId() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function FacilitySettingsPage() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<FacilityTab>("rooms");
    const [message, setMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [isAddRoomOpen, setIsAddRoomOpen] = useState(false);
    const [newRoom, setNewRoom] = useState<FacilityRoomForm>(emptyRoom());
    const [formData, setFormData] = useState({
        name: "",
        licenseNumber: "",
        targetState: "",
        timezone: "",
        phoneNumber: "",
    });
    const [rooms, setRooms] = useState<FacilityRoomDraft[]>([]);
    const [roomRates, setRoomRates] = useState<FacilityRoomRate[]>([]);
    const [capabilities, setCapabilities] = useState<FacilityClinicalCapability[]>([]);

    const { data, isLoading, isError } = useQuery({
        queryKey: ["facilitySettings"],
        queryFn: () => facilitiesService.getFacilitySettings(),
    });

    useEffect(() => {
        if (!data) {
            return;
        }

        setFormData({
            name: data.name,
            licenseNumber: data.licenseNumber,
            targetState: data.targetState,
            timezone: data.timezone,
            phoneNumber: data.phoneNumber ?? "",
        });
        setRooms(
            data.rooms.map((room) => ({
                clientId: `${room.roomId}-${room.bedId}`,
                roomId: room.roomId,
                bedId: room.bedId,
                roomNumber: room.roomNumber,
                bedNumber: room.bedNumber,
                roomType: room.roomType,
                status: toApiStatus(room.status),
            })),
        );
        setRoomRates(data.roomRates);
        setCapabilities(data.capabilities);
    }, [data]);

    const mutation = useMutation({
        mutationFn: () =>
            facilitiesService.updateFacilitySettings({
                ...formData,
                rooms: rooms.map(({ clientId: _clientId, ...room }) => room),
                roomRates: roomRates.map(({ roomType, dailyRate, effectiveFrom }) => ({
                    roomType,
                    dailyRate,
                    effectiveFrom,
                })),
                capabilities: capabilities.map(({ capability, supported, note }) => ({
                    capability,
                    supported,
                    note,
                })),
            }),
        onSuccess: () => {
            setErrorMessage("");
            setMessage("Facility settings saved successfully.");
            queryClient.invalidateQueries({ queryKey: ["facilitySettings"] });
        },
        onError: (error) => {
            setMessage("");
            setErrorMessage(error instanceof Error ? error.message : "Unable to save facility settings.");
        },
    });

    const roomSummary = useMemo(() => {
        const wingCount = new Set(rooms.map((room) => getWing(room.roomNumber))).size;
        return `Đã cấu hình ${rooms.length} phòng bệnh trên ${wingCount || 0} khu điều trị`;
    }, [rooms]);

    const hasInvalidRoomRate = roomRates.some(
        (rate) => rate.roomType.trim() === "" || Number.isNaN(rate.dailyRate) || rate.dailyRate < 0 || rate.effectiveFrom.trim() === "",
    );
    const hasInvalidRoom = rooms.some(
        (room) => room.roomNumber.trim() === "" || room.bedNumber.trim() === "" || room.roomType.trim() === "",
    );
    const hasInvalidGeneral =
        formData.name.trim() === "" ||
        formData.licenseNumber.trim() === "" ||
        formData.targetState.trim() === "" ||
        formData.timezone.trim() === "";
    const cannotSave = hasInvalidGeneral || hasInvalidRoom || hasInvalidRoomRate;

    if (isLoading) {
        return <div className="p-8 text-center text-slate-500">Đang tải cấu hình cơ sở y tế...</div>;
    }

    if (isError || !data) {
        return <div className="p-8 text-center text-red-500">Không thể tải thông tin cơ sở y tế.</div>;
    }

    return (
        <div className="mx-auto max-w-6xl pb-24 font-sans">
            <div className="mb-4">
                <div className="mb-1 text-sm font-medium text-slate-500">
                    Quản trị &gt; <span className="text-slate-700">Cơ sở Y tế &amp; Phòng Bệnh</span>
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Thiết Lập Cơ Sở Y Tế</h1>
                <p className="mt-1 text-sm text-slate-500">
                    {formData.name} · Mã cơ sở: {data.facilityCode} · Địa bàn: {data.targetStateName}
                </p>
            </div>

            <div className="mb-4 flex border-b border-slate-200 text-sm font-semibold text-slate-500">
                {[
                    { id: "general", label: "Thông Tin Chung" },
                    { id: "rooms", label: "Phòng & Giường Bệnh" },
                    { id: "rates", label: "Đơn Giá Ngày Giường" },
                    { id: "capabilities", label: "Năng Lực Lâm Sàng" },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        className={`px-4 py-2 ${activeTab === tab.id ? "border-b-2 border-[#0F766E] text-[#0F766E]" : ""}`}
                        onClick={() => setActiveTab(tab.id as FacilityTab)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {message && <p className="mb-3 text-sm font-semibold text-emerald-600">{message}</p>}
            {errorMessage && <p className="mb-3 text-sm font-semibold text-red-600">{errorMessage}</p>}
            {cannotSave && (
                <p className="mb-3 text-sm font-semibold text-red-600">
                    Vui lòng điền đầy đủ tên bệnh viện, múi giờ, số giấy phép hoạt động và đơn giá phòng bệnh hợp lệ.
                </p>
            )}

            {activeTab === "general" && (
                <section className="rounded-lg border border-slate-200 bg-white p-5">
                    <h2 className="mb-4 text-lg font-bold text-slate-900">Thông Tin Pháp Lý &amp; Địa Bàn</h2>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <TextField label="Tên cơ sở khám chữa bệnh / Bệnh viện" value={formData.name} onChange={(value) => updateGeneral("name", value)} />
                        <TextField label="Mã định danh cơ sở y tế (facility_id)" value={`${data.facilityCode} (Chỉ xem)`} readOnly />
                        <SelectField
                            label="Múi giờ hệ thống"
                            value={formData.timezone}
                            options={usTimezoneOptions}
                            onChange={(value) => updateGeneral("timezone", value)}
                        />
                        <TextField label="Mã Tỉnh / Thành phố" value={formData.targetState} onChange={(value) => updateGeneral("targetState", value.toUpperCase())} maxLength={3} />
                        <TextField label="Số Giấy phép Hoạt động Khám chữa bệnh" value={formData.licenseNumber} onChange={(value) => updateGeneral("licenseNumber", value)} />
                        <TextField label="Số điện thoại đường dây nóng" value={formData.phoneNumber} onChange={(value) => updateGeneral("phoneNumber", value)} />
                    </div>
                </section>
            )}

            {activeTab === "rooms" && (
                <>
                    <div className="mb-5 flex items-center justify-between">
                        <p className="text-sm text-slate-500">{roomSummary}</p>
                        <Button variant="outline" className="h-9 gap-2 rounded-md border-[#0F766E] text-[#0F766E] hover:bg-[#F0FDFA]" onClick={openAddRoom}>
                            <Plus className="h-4 w-4" />
                            Thêm Phòng / Giường
                        </Button>
                    </div>
                        <RoomsTable rooms={rooms} originalRooms={data.rooms} onChange={updateRoom} />
                    <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
                        <SummaryCard title="Thông Tin Cơ Sở" tag="Mục 1 / 4">
                            <SummaryRow label="Tên bệnh viện" value={formData.name} />
                            <SummaryRow label="Mã cơ sở" value={`${data.facilityCode} (Chỉ xem)`} />
                            <SummaryRow label="Múi giờ" value={formData.timezone} />
                            <SummaryRow label="Tỉnh / Thành phố" value={data.targetStateName} />
                            <SummaryRow label="Số giấy phép" value={formData.licenseNumber} />
                        </SummaryCard>
                        <SummaryCard title="Đơn Giá Ngày Giường" tag="Mục 3 / 4">
                            {roomRates.map((rate) => (
                                <SummaryRow
                                    key={rate.roomType}
                                    label={roomTypeLabels[rate.roomType] || rate.roomType}
                                    value={new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(rate.dailyRate * 25000) + " / ngày"}
                                />
                            ))}
                            <p className="mt-4 text-xs leading-relaxed text-slate-400">
                                Áp dụng từ {roomRates[0]?.effectiveFrom ?? "-"} · Dữ liệu liên kết tính chi phí điều trị.
                            </p>
                        </SummaryCard>
                    </div>
                    <SummaryCard title="Năng Lực Kỹ Thuật Lâm Sàng" tag="Mục 4 / 4" className="mt-5">
                        <p className="mb-4 max-w-3xl text-sm text-slate-500">
                            Sử dụng trong quy trình Sàng lọc Tiếp nhận (Pre-screening) để kiểm tra nhu cầu lâm sàng của bệnh nhân đối chiếu với danh mục kỹ thuật bệnh viện có thể đáp ứng.
                        </p>
                        <div className="grid grid-cols-1 gap-x-12 gap-y-3 md:grid-cols-2">
                            {capabilities.map((capability) => (
                                <div key={capability.capability} className="flex items-center justify-between gap-4 text-sm text-slate-700">
                                    <span>{capability.capability}</span>
                                    <Badge variant={capability.supported ? "priority" : "muted"}>
                                        {capability.supported ? "Đáp ứng" : "Chưa hỗ trợ"}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </SummaryCard>
                </>
            )}


            {activeTab === "rates" && (
                <section className="rounded-lg border border-slate-200 bg-white p-5">
                    <h2 className="mb-4 text-lg font-bold text-slate-900">Bảng Giá Ngày Giường Nội Trú</h2>
                    <div className="space-y-3">
                        {roomRates.map((rate, index) => (
                            <div key={rate.roomType} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_180px]">
                                <select
                                    className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                                    value={rate.roomType}
                                    onChange={(event) => updateRoomRate(index, "roomType", event.target.value)}
                                >
                                    {roomTypeOptions.map((roomType) => (
                                        <option key={roomType} value={roomType}>{roomTypeLabels[roomType] || roomType}</option>
                                    ))}
                                </select>
                                <div className="relative">
                                    <span className="pointer-events-none absolute left-3 top-2.5 text-sm font-semibold text-slate-500">₫</span>
                                    <Input
                                        type="number"
                                        min="0"
                                        step="1000"
                                        className="pl-7 pr-12"
                                        value={rate.dailyRate}
                                        onChange={(event) => updateRoomRate(index, "dailyRate", Number(event.target.value))}
                                    />
                                    <span className="pointer-events-none absolute right-3 top-2.5 text-sm text-slate-400">/ngày</span>
                                </div>
                                <Input type="date" value={rate.effectiveFrom} onChange={(event) => updateRoomRate(index, "effectiveFrom", event.target.value)} />
                            </div>
                        ))}
                    </div>
                    <p className="mt-4 text-xs leading-relaxed text-slate-400">
                        Đơn giá ngày giường có hiệu lực sẽ được liên kết trực tiếp với Bảng kê Chi phí &amp; Viện phí nội trú.
                    </p>
                </section>
            )}

            {activeTab === "capabilities" && (
                <section className="rounded-lg border border-slate-200 bg-white p-5">
                    <h2 className="mb-3 text-lg font-bold text-slate-900">Danh Mục Kỹ Thuật &amp; Năng Lực Lâm Sàng</h2>
                    <p className="mb-4 max-w-3xl text-sm text-slate-500">
                        Phục vụ đối chiếu trong bước Sàng lọc Tiếp nhận (Pre-screening) để kiểm tra nhu cầu điều trị của bệnh nhân.
                    </p>
                    <div className="grid grid-cols-1 gap-x-12 gap-y-3 md:grid-cols-2">
                        {capabilities.map((capability, index) => (
                            <label key={capability.capability} className="flex items-center justify-between gap-4 text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                                <span>{capability.capability}</span>
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-slate-300 text-[#0F766E] focus:ring-[#0F766E]"
                                    checked={capability.supported}
                                    onChange={(event) => updateCapability(index, event.target.checked)}
                                />
                            </label>
                        ))}
                    </div>
                </section>
            )}

            {isAddRoomOpen && (
                <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-950/40 px-4">
                    <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-slate-900">Thêm Phòng / Giường Bệnh Mới</h2>
                            <button type="button" className="rounded-md p-1 text-slate-500 hover:bg-slate-100" onClick={() => setIsAddRoomOpen(false)}>
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <TextField label="Số phòng" value={newRoom.roomNumber} onChange={(value) => updateNewRoom("roomNumber", value)} />
                            <TextField label="Ký hiệu giường" value={newRoom.bedNumber} onChange={(value) => updateNewRoom("bedNumber", value)} />
                            <SelectField
                                label="Loại phòng bệnh"
                                value={newRoom.roomType}
                                options={roomTypeOptions.map((roomType) => ({ label: roomTypeLabels[roomType] || roomType, value: roomType }))}
                                onChange={(value) => updateNewRoom("roomType", value)}
                            />
                            <SelectField
                                label="Trạng thái giường"
                                value={newRoom.status}
                                options={bedStatusOptions}
                                onChange={(value) => updateNewRoom("status", value as FacilityBedStatus)}
                            />
                        </div>
                        <div className="mt-5 flex justify-end gap-3">
                            <Button variant="outline" className="rounded-md" onClick={() => setIsAddRoomOpen(false)}>Hủy</Button>
                            <Button className="rounded-md bg-[#0F766E] text-white hover:bg-[#115E59]" onClick={confirmAddRoom}>Lưu Phòng Bệnh</Button>
                        </div>
                    </div>
                </div>
            )}

            <div className="fixed bottom-0 left-[260px] right-0 z-10 flex justify-end gap-3 border-t border-slate-200 bg-white px-8 py-4 shadow-lg">
                <Button variant="outline" className="h-11 w-36 rounded-md" onClick={() => queryClient.invalidateQueries({ queryKey: ["facilitySettings"] })}>
                    Hủy Bỏ
                </Button>
                <Button className="h-11 w-72 rounded-md bg-[#0F766E] text-white hover:bg-[#115E59]" onClick={() => mutation.mutate()} disabled={mutation.isPending || cannotSave}>
                    {mutation.isPending ? "Đang lưu..." : "Lưu Thay Đổi"}
                </Button>
            </div>
        </div>
    );

    function updateGeneral(key: keyof typeof formData, value: string) {
        setFormData((current) => ({ ...current, [key]: value }));
    }

    function updateRoom<Key extends keyof FacilityRoomForm>(index: number, key: Key, value: FacilityRoomForm[Key]) {
        setRooms((current) => current.map((room, roomIndex) => roomIndex === index ? { ...room, [key]: value } : room));
    }

    function updateNewRoom<Key extends keyof FacilityRoomForm>(key: Key, value: FacilityRoomForm[Key]) {
        setNewRoom((current) => ({ ...current, [key]: value }));
    }

    function openAddRoom() {
        setNewRoom(emptyRoom());
        setIsAddRoomOpen(true);
    }

    function confirmAddRoom() {
        if (newRoom.roomNumber.trim() === "" || newRoom.bedNumber.trim() === "" || newRoom.roomType.trim() === "") {
            setErrorMessage("Vui lòng nhập đầy đủ số phòng, ký hiệu giường và loại phòng.");
            return;
        }

        setRooms((current) => [{ ...newRoom, clientId: createClientId() }, ...current]);
        setErrorMessage("");
        setIsAddRoomOpen(false);
    }

    function updateRoomRate<Key extends keyof FacilityRoomRate>(index: number, key: Key, value: FacilityRoomRate[Key]) {
        setRoomRates((current) => current.map((rate, rateIndex) => rateIndex === index ? { ...rate, [key]: value } : rate));
    }

    function updateCapability(index: number, supported: boolean) {
        setCapabilities((current) => current.map((capability, capabilityIndex) => capabilityIndex === index ? { ...capability, supported } : capability));
    }
}

function RoomsTable({
    rooms,
    originalRooms,
    onChange,
}: {
    rooms: FacilityRoomDraft[];
    originalRooms: Array<{ bedId: string; occupantNote: string | null }>;
    onChange: <Key extends keyof FacilityRoomForm>(index: number, key: Key, value: FacilityRoomForm[Key]) => void;
}) {
    const occupantNotes = new Map(originalRooms.map((room) => [room.bedId, room.occupantNote]));

    return (
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-500">
                    <tr>
                        <th className="px-4 py-3">Khu Điều Trị</th>
                        <th className="px-4 py-3">Số Phòng</th>
                        <th className="px-4 py-3">Giường</th>
                        <th className="px-4 py-3">Loại Phòng</th>
                        <th className="px-4 py-3">Trạng Thái</th>
                        <th className="px-4 py-3">Người Bệnh / Ghi Chú</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {rooms.map((room, index) => (
                            <tr key={room.clientId} className="text-slate-700">
                                <td className="px-4 py-3 font-medium text-slate-600">{getWing(room.roomNumber)}</td>
                                <td className="px-4 py-3">
                                    <Input className="h-9 w-24 font-bold text-slate-900" value={room.roomNumber} onChange={(event) => onChange(index, "roomNumber", event.target.value)} />
                                </td>
                                <td className="px-4 py-3">
                                    <Input className="h-9 w-20" value={room.bedNumber} onChange={(event) => onChange(index, "bedNumber", event.target.value)} />
                                </td>
                                <td className="px-4 py-3">
                                    <select
                                        className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
                                        value={room.roomType}
                                        onChange={(event) => onChange(index, "roomType", event.target.value)}
                                    >
                                        {roomTypeOptions.map((roomType) => (
                                            <option key={roomType} value={roomType}>{roomTypeLabels[roomType] || roomType}</option>
                                        ))}
                                    </select>
                                </td>
                                <td className="px-4 py-3">
                                    <select
                                        className={getStatusSelectClass(room.status)}
                                        value={room.status}
                                        onChange={(event) => onChange(index, "status", event.target.value as FacilityBedStatus)}
                                    >
                                        {bedStatusOptions.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                </td>
                                <td className="px-4 py-3">{room.bedId ? occupantNotes.get(room.bedId) ?? "-" : "-"}</td>
                            </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}


function SummaryCard({
    title,
    tag,
    children,
    className = "",
}: {
    title: string;
    tag: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <section className={`rounded-lg border border-slate-200 bg-white p-5 ${className}`}>
            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">{title}</h2>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-500">{tag}</span>
            </div>
            {children}
        </section>
    );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="mb-3 flex items-start justify-between gap-4 text-sm">
            <span className="text-slate-500">{label}</span>
            <span className="text-right font-bold text-slate-700">{value}</span>
        </div>
    );
}

function TextField({
    label,
    value,
    onChange,
    readOnly = false,
    maxLength,
}: {
    label: string;
    value: string;
    onChange?: (value: string) => void;
    readOnly?: boolean;
    maxLength?: number;
}) {
    return (
        <label className="space-y-2 text-sm">
            <span className="font-bold text-slate-600">{label}</span>
            <Input
                value={value}
                readOnly={readOnly}
                disabled={readOnly}
                maxLength={maxLength}
                onChange={(event) => onChange?.(event.target.value)}
            />
        </label>
    );
}

function SelectField({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: string;
    options: Array<{ label: string; value: string }>;
    onChange: (value: string) => void;
}) {
    return (
        <label className="space-y-2 text-sm">
            <span className="font-bold text-slate-600">{label}</span>
            <select
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                value={value}
                onChange={(event) => onChange(event.target.value)}
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </select>
        </label>
    );
}
