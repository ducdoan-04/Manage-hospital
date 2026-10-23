import type {
  CareLevel,
  CognitiveStatus,
  FallRisk,
  Gender,
  MobilityStatus,
  ResidentStatus,
} from "./types";

export const RESIDENT_STATUS_LABEL: Record<ResidentStatus, string> = {
  pending: "Chờ tiếp nhận",
  under_evaluation: "Đang khám / Đánh giá",
  admitted: "Đang điều trị nội trú",
  discharged: "Đã xuất viện",
};

export const CARE_LEVEL_LABEL: Record<CareLevel, string> = {
  independent: "Điều trị ban ngày / Tự chủ",
  assisted_living: "Chăm sóc cấp 3 (Hỗ trợ 1 phần)",
  memory_care: "Khoa Thần kinh / Tâm thần",
  skilled_nursing: "Chăm sóc cấp 1 (Hồi sức tích cực)",
};

export const GENDER_LABEL: Record<Gender, string> = {
  male: "Nam",
  female: "Nữ",
  other: "Khác",
};

export const MOBILITY_STATUS_LABEL: Record<MobilityStatus, string> = {
  independent: "Tự đi lại bình thường",
  walker: "Cần khung tập đi / người dìu",
  wheelchair: "Di chuyển bằng xe lăn",
  bed_bound: "Bất động tại giường bệnh",
};

export const COGNITIVE_STATUS_LABEL: Record<CognitiveStatus, string> = {
  alert_oriented: "Tỉnh táo, tiếp xúc tốt",
  mild_impairment: "Suy giảm nhận thức nhẹ",
  moderate_impairment: "Lú lẫn / Nhầm lẫn vừa",
  severe_impairment: "Mê man / Suy giảm nặng",
};

export const FALL_RISK_LABEL: Record<FallRisk, string> = {
  low: "Thấp",
  medium: "Trung bình",
  high: "Cao",
};
