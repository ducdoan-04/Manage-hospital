import type { DoctorSchedule } from "./types";

export const getMockSchedules = (_year: number, _month: number): Record<number, DoctorSchedule[]> => {
  return {
    1: [
      { id: "01", doctorId: "d4", doctorName: "BS. CKII. Nguyễn Văn Hùng", time: "08:00", colorVariant: "blue" },
      { id: "02", doctorId: "d5", doctorName: "ThS. BS. Trần Thị Mai", time: "09:30", colorVariant: "teal" },
    ],
    3: [
      { id: "1", doctorId: "d1", doctorName: "BSCKI. Lê Hoàng Nam", time: "08:30", colorVariant: "teal" },
      { id: "2", doctorId: "d2", doctorName: "ThS. BS. Phạm Quốc Bảo", time: "13:30", colorVariant: "blue" },
    ],
    4: [
      { id: "3", doctorId: "d3", doctorName: "BSCKII. Đỗ Thị Bích Ngọc", time: "14:00", colorVariant: "blue" },
      { id: "4", doctorId: "d4", doctorName: "BS. CKII. Nguyễn Văn Hùng", time: "15:30", colorVariant: "teal" },
    ],
    5: [
      { id: "5", doctorId: "d5", doctorName: "ThS. BS. Trần Thị Mai", time: "16:00", description: "Quản lý mạn tính Tăng huyết áp - BN. Nguyễn Thị Mai (P-204)", colorVariant: "teal" },
    ],
    6: [
      { id: "6", doctorId: "d4", doctorName: "BS. CKII. Nguyễn Văn Hùng", time: "10:00", description: "Khám cấp cứu & sốt siêu vi cấp tính - BN. Trần Văn Nam (P-102)", colorVariant: "blue" },
    ],
    7: [
      { id: "71", doctorId: "d1", doctorName: "BSCKI. Lê Hoàng Nam", time: "09:00", colorVariant: "teal" },
      { id: "72", doctorId: "d2", doctorName: "ThS. BS. Phạm Quốc Bảo", time: "10:30", colorVariant: "blue" },
    ],
    9: [
      { id: "91", doctorId: "d3", doctorName: "BSCKII. Đỗ Thị Bích Ngọc", time: "11:00", colorVariant: "blue" },
      { id: "92", doctorId: "d4", doctorName: "BS. CKII. Nguyễn Văn Hùng", time: "13:30", colorVariant: "teal" },
    ],
    11: [
      { id: "101", doctorId: "d5", doctorName: "ThS. BS. Trần Thị Mai", time: "14:00", description: "Tái khám hen phế quản & chức năng hô hấp - BN. Lê Thị Lan (P-301)", colorVariant: "teal" },
    ],
    12: [
      { id: "111", doctorId: "d1", doctorName: "BSCKI. Lê Hoàng Nam", time: "15:00", description: "Hội chẩn da liễu dị ứng & phản ứng thuốc - BN. Hoàng Minh Tuấn", colorVariant: "teal" },
    ],
    14: [
      { id: "131", doctorId: "d2", doctorName: "ThS. BS. Phạm Quốc Bảo", time: "16:00", description: "Tư vấn sức khỏe phòng ngừa tim mạch - BN. Đặng Thị Dung", colorVariant: "teal" },
    ],
    15: [
      { id: "151", doctorId: "d4", doctorName: "BS. CKII. Nguyễn Văn Hùng", time: "09:00", description: "Khám nội tổng quát định kỳ - BN. Vũ Minh Tâm", colorVariant: "blue" },
    ],
    17: [
      { id: "171", doctorId: "d5", doctorName: "ThS. BS. Trần Thị Mai", time: "10:00", description: "Theo dõi đường huyết Đái tháo đường Type 2 - BN. Phạm Thị Loan", colorVariant: "teal" },
    ],
    18: [
      { id: "181", doctorId: "d1", doctorName: "BSCKI. Lê Hoàng Nam", time: "11:00", description: "Khám viêm phế quản cấp & hạ sốt - BN. Đỗ Văn Quý", colorVariant: "blue" },
    ],
    20: [
      { id: "201", doctorId: "d2", doctorName: "ThS. BS. Phạm Quốc Bảo", time: "13:30", description: "Hội chẩn đa chuyên khoa điều trị - BN. Nguyễn Thị Mai", colorVariant: "teal" },
    ],
    22: [
      { id: "221", doctorId: "d3", doctorName: "BSCKII. Đỗ Thị Bích Ngọc", time: "14:00", description: "Khám thoái hóa khớp & phục hồi chức năng - BN. Vũ Văn Hải", colorVariant: "blue" },
    ],
    23: [
      { id: "231", doctorId: "d4", doctorName: "BS. CKII. Nguyễn Văn Hùng", time: "15:30", description: "Tái khám sau phẫu thuật ngoại khoa - BN. Bùi Thị Hiền", colorVariant: "blue" },
    ],
    26: [
      { id: "251", doctorId: "d5", doctorName: "ThS. BS. Trần Thị Mai", time: "16:00", description: "Điều chỉnh liều thuốc hạ áp - BN. Nguyễn Thị Lan", colorVariant: "teal" },
    ],
    27: [
      { id: "261", doctorId: "d1", doctorName: "BSCKI. Lê Hoàng Nam", time: "09:00", description: "Điều trị viêm nhiễm khuẩn đường hô hấp - BN. Mai Văn Tuấn", colorVariant: "blue" },
    ],
    28: [
      { id: "271", doctorId: "d2", doctorName: "ThS. BS. Phạm Quốc Bảo", time: "10:00", description: "Tư vấn dinh dưỡng lâm sàng - BN. Hoàng Thị Thu", colorVariant: "teal" },
    ],
    29: [
      { id: "281", doctorId: "d3", doctorName: "BSCKII. Đỗ Thị Bích Ngọc", time: "11:00", description: "Đánh giá tương tác thuốc người cao tuổi - BN. Lê Văn Cường", colorVariant: "blue" },
    ],
    31: [
      { id: "301", doctorId: "d4", doctorName: "BS. CKII. Nguyễn Văn Hùng", time: "13:30", description: "Kiểm tra xuất viện & hướng dẫn dùng thuốc - BN. Đào Văn Phúc", colorVariant: "teal" },
    ],
  };
};

