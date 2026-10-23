# Hệ thống Quản lý Bệnh viện Đa khoa — MedCare Hospital Management System (HIS / EMR)

Đồ án Hệ thống Quản lý Bệnh viện Đa khoa toàn diện bằng tiếng Việt, hỗ trợ chuẩn hóa quy trình tiếp nhận người bệnh, quản lý bệnh án điện tử (EMR), phác đồ điều trị, cấp phát thuốc nội trú eMAR, quản lý buồng giường, sự cố y khoa và viện phí BHYT.

Mô hình kiến trúc Monorepo với Frontend bằng React/Vite/Tailwind và Backend bằng NestJS/Prisma ORM.

---

## Các phân hệ chuyên môn chính

1. **Tiếp nhận & Sàng lọc Cấp cứu (Triage & Admissions):**
   - Phân luồng cấp cứu theo thang điểm nguy cơ y tế.
   - Tiếp đón bệnh nhân nội trú, tạo mã bệnh án điện tử, quét mã CCCD và xác thực thẻ BHYT.
   - Cam kết viện phí, ký xác nhận điều trị nội trú.

2. **Hồ sơ Bệnh nhân 360° & Đánh giá Lâm sàng (EMR & Assessments):**
   - Hồ sơ bệnh án điện tử chi tiết: tiền sử bệnh lý, dị ứng, cơ chế bảo hiểm (BHYT / Tự chi trả / Bảo hiểm thương mại).
   - Đánh giá lâm sàng ban đầu, phân loại mức độ chăm sóc (Cấp độ 1 đến Cấp độ 4).
   - Biểu đồ theo dõi dấu hiệu sinh tồn tại giường (Mạch, Huyết áp, SpO2, Nhiệt độ, Nhịp thở) với ngưỡng cảnh báo bất thường tự động.

3. **Kế hoạch Điều trị & Chăm sóc Đa chuyên khoa (Care Plan & IDT):**
   - Thiết lập mục tiêu điều trị, can thiệp điều dưỡng và chỉ định chuyên môn.
   - Quy trình phê duyệt nghiêm ngặt: Điều dưỡng trưởng (DON) thẩm định và ký duyệt.
   - Hội chẩn liên chuyên khoa (IDT) với chữ ký điện tử xác thực từ Bác sĩ điều trị, Điều dưỡng và Chuyên gia dinh dưỡng.

4. **Quản lý Cấp phát Thuốc Nội trú (eMAR - Electronic Medication Administration Record):**
   - Quy trình cấp phát thuốc chuẩn 5 đúng, kiểm soát lịch dùng thuốc theo ca.
   - Đối chiếu chỉ định thuốc, kiểm tra tương tác thuốc và dị ứng trước khi cấp phát.
   - Cảnh báo thuốc quá hạn dùng, thuốc cần bảo quản đặc biệt, ghi nhận thời gian thực và chữ ký điều dưỡng thực hiện.

5. **Quản lý Buồng giường & Khoa phòng (Bed Census & Departments):**
   - Sơ đồ buồng giường theo thời gian thực (Khoa Cấp cứu, Khoa Nội, Khoa Ngoại - Phẫu thuật).
   - Phân loại phòng: Phòng VIP (đơn), Phòng tiêu chuẩn (đôi), Phòng điều trị chung.
   - Quản lý công suất giường bệnh, trạng thái bảo trì và quy trình nhập/chuyển viện.

6. **Quản lý Sự cố Y khoa & Báo động Đỏ (Incident Management & Patient Safety):**
   - Báo cáo sự cố y khoa theo phân cấp 4 mức độ của Bộ Y tế.
   - Cơ chế tự động khóa hồ sơ bệnh án đối với sự cố nghiêm trọng/nguy kịch để bảo toàn chứng cứ y khoa.
   - Theo dõi thời hạn SLA xử lý, báo cáo cơ quan quản lý (Sở Y tế / Bộ Y tế) và quy trình mở khóa bệnh án có lưu vết kiểm toán.

7. **Quản lý Viện phí & Quyết toán BHYT (Billing & Health Insurance):**
   - Tính toán viện phí theo định mức Việt Nam Đồng (VNĐ).
   - Tách bạch cấu phần thanh toán: Quỹ BHYT chi trả, Bảo hiểm bổ sung và Đồng chi trả của người bệnh.
   - Bảng kê chi phí khám chữa bệnh nội trú minh bạch.

---

## Công nghệ sử dụng

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons, React Query, Zustand, Axios.
- **Backend:** NestJS, Prisma ORM, TypeScript, class-validator, JWT Authentication, Bcrypt.
- **Cơ sở dữ liệu:** SQL Server 2022 Express / PostgreSQL qua Docker.
- **Tiêu chuẩn dữ liệu:**
  - Tiền tệ: Việt Nam Đồng (VNĐ - ₫).
  - Múi giờ: `Asia/Ho_Chi_Minh` (GMT+7).
  - Định danh công dân: Căn cước công dân (CCCD).
  - Chế độ thanh toán: Bảo hiểm Y tế (BHYT) & Bảo trợ Xã hội.

---

## Cấu trúc thư mục

```text
MockProject_Group6/
├── apps/
│   ├── frontend/         # Ứng dụng Giao diện React / Vite (Tiếng Việt)
│   └── backend/          # Dịch vụ API NestJS & Prisma ORM
├── packages/             # Thư viện dùng chung
├── database/             # Script SQL tham chiếu & migrations
├── docs/                 # Tài liệu quy trình nghiệp vụ y tế
├── docker-compose.yml    # Cấu hình container Database
└── package.json          # Quản lý npm workspaces monorepo
```

---

## Hướng dẫn cài đặt & Khởi chạy nhanh

### Yêu cầu môi trường
- Node.js LTS v20 hoặc v24
- Docker & Docker Compose (cho Database)

### Các bước cài đặt

1. **Cài đặt thư viện dependencies:**
```powershell
npm install
```

2. **Khởi động cơ sở dữ liệu:**
```powershell
docker compose up -d
npm run db:generate
npm run db:push
npm run db:seed
```

3. **Chạy ứng dụng chế độ phát triển (Development):**
```powershell
# Chạy đồng thời cả Frontend và Backend:
npm run dev

# Hoặc chạy riêng biệt từng ứng dụng:
npm run dev:backend   # API chạy tại: http://localhost:3000 (Swagger: /api/docs)
npm run dev:frontend  # Giao diện chạy tại: http://localhost:3001
```

---

## Danh mục tuyến đường chính (Routes)

| Đường dẫn (URL) | Mô tả phân hệ |
| :--- | :--- |
| `/` | Trang chủ giới thiệu Hệ thống Bệnh viện Đa khoa MedCare |
| `/login` | Đăng nhập cán bộ y tế |
| `/verify-otp` | Xác thực 2 bước (2FA OTP) |
| `/activate` | Kích hoạt tài khoản nhân viên y tế mới |
| `/dashboard` | Bảng điều khiển trung tâm (theo vai trò Giám đốc, Bác sĩ, Điều dưỡng) |
| `/residents` | Danh sách & Quản lý Bệnh nhân Toàn viện |
| `/admissions/new` | Tiếp nhận & Đăng ký Bệnh nhân Nội trú |
| `/admissions/pre-screening` | Sàng lọc & Phân luồng Cấp cứu ban đầu |
| `/assessments/new` | Phiếu Đánh giá Lâm sàng Ban đầu |
| `/care-plans` | Danh mục Kế hoạch Điều trị & Chăm sóc |
| `/care-tasks/today` | Danh sách Y lệnh & Chăm sóc Thường quy theo Ca |
| `/emar` | Phiếu Công khai & Cấp phát Thuốc Nội trú (eMAR) |
| `/schedule` | Lịch trực & Khám bệnh của Bác sĩ / Điều dưỡng |
| `/billing/cost-panel` | Quản lý Viện phí, Biểu giá Giường & Quyết toán BHYT |
| `/incidents` | Sổ theo dõi Sự cố Y khoa Toàn viện |
| `/incidents/report` | Báo cáo Sự cố Y khoa Khẩn cấp |
| `/admin/facility` | Cấu hình Thông tin Bệnh viện, Buồng & Giường bệnh |
| `/admin/loc-rates` | Bảng Định mức Viện phí theo Cấp độ Chăm sóc |
| `/admin/incident-severity` | Cấu hình Phân cấp Mức độ Sự cố Y khoa |
| `/admin/sla-config` | Quy định Thời hạn Báo cáo Sự cố (SLA) |
| `/admin/users` | Quản lý Tài khoản Cán bộ & Nhân viên Y tế |
