import { Calendar, Printer } from "lucide-react";

export const EmarControls = ({ currentDate }: { currentDate: string }) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex p-1 bg-slate-100 rounded-lg w-full sm:w-auto">
        <button className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium bg-white text-[#0F766E] rounded-md shadow-sm border border-slate-200">Hôm nay</button>
        <button className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">Ngày mai</button>
        <button className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">Lịch sử cấp thuốc</button>
      </div>
      <div className="flex items-center gap-3 px-4 w-full sm:w-auto justify-between sm:justify-end">
        <span className="text-sm font-medium text-slate-600 flex items-center gap-2">
          <Calendar className="w-4 h-4" /> {currentDate}
        </span>
        <button className="text-sm font-semibold text-[#0F766E] hover:text-[#115E59] hover:bg-[#F0FDFA] px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
          <Printer className="w-4 h-4" /> In phiếu công khai thuốc
        </button>
      </div>
    </div>
  );
};

