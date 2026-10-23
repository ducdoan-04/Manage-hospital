import type { CarePlanStatus } from "./types";

export const CARE_PLAN_STATUS_LABEL: Record<CarePlanStatus, string> = {
  draft: "Bản nháp",
  active: "Đang áp dụng",
  pending_review: "Chờ trưởng khoa duyệt",
  review_due: "Đến hạn tái đánh giá",
  needs_update: "Cần điều chỉnh phác đồ",
  approved: "Đã phê duyệt",
  signed: "Đã ký số xác nhận",
  rejected: "Từ chối phê duyệt",
};

