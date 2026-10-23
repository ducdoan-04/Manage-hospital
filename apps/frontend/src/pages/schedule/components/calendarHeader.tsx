import React from "react";
import { ChevronLeft, ChevronRight, Plus, SlidersHorizontal, ChevronDown } from "lucide-react";
import dayjs from "dayjs";
import type { ViewMode } from "../types";

interface CalendarHeaderProps {
  currentMonth: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  viewMode: ViewMode;
  onViewModeChange: (view: ViewMode) => void;
  onAddClick: () => void;
}

export const CalendarHeader = ({
  currentMonth,
  onPrevMonth,
  onNextMonth,
  viewMode,
  onViewModeChange,
  onAddClick,
}: CalendarHeaderProps) => {
  const monthNum = dayjs(currentMonth).month() + 1;
  const yearNum = dayjs(currentMonth).year();
  const monthName = `Tháng ${monthNum}, ${yearNum}`;

  const viewModeLabels: Record<ViewMode, string> = {
    Day: "Ngày",
    Week: "Tuần",
    Month: "Tháng",
  };

  return (
    <div className="mb-4 flex items-center justify-between px-2">
      <div className="flex items-center gap-2 md:gap-4">
        <div className="text-[18px] md:text-[22px] font-bold text-slate-900 m-0 leading-none">{monthName}</div>
        <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
          <button
            onClick={onPrevMonth}
            className="flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white hover:text-slate-900 hover:shadow-sm"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={onNextMonth}
            className="flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white hover:text-slate-900 hover:shadow-sm"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {/* Mobile-only Filter Icon */}
        <button className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50">
          <SlidersHorizontal className="h-4 w-4" />
        </button>

        {/* Desktop-only Segmented Control */}
        <div className="hidden md:flex items-center rounded-lg bg-slate-100 p-1">
          {(["Day", "Week", "Month"] as ViewMode[]).map((view) => (
            <button
              key={view}
              onClick={() => onViewModeChange(view)}
              className={`rounded-md px-4 py-1.5 text-[13px] font-medium transition-colors ${
                viewMode === view
                  ? "bg-[#1E293B] text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-200 hover:text-slate-900"
              }`}
            >
              {viewModeLabels[view]}
            </button>
          ))}
        </div>

        {/* Desktop-only All Agenda */}
        <button className="hidden md:flex items-center gap-2 px-1 py-1.5 text-[13px] font-medium text-slate-600 transition-colors hover:text-slate-900">
          Tất cả lịch trực <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </button>

        {/* Add Schedule Button */}
        <button 
          onClick={onAddClick}
          className="flex h-8 w-8 md:h-auto md:w-auto items-center justify-center gap-1.5 rounded-lg bg-[#0F766E] hover:bg-[#115E59] md:px-4 md:py-2 text-[13px] font-medium text-white transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" /> <span className="hidden md:inline">Thêm ca trực</span>
        </button>
      </div>
    </div>
  );
};

