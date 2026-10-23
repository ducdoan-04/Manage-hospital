# Hướng dẫn & Thiết kế Cơ sở Dữ liệu Bệnh viện Đa khoa (MedCare HIS / EMR)

## 1. Bản thiết kế SQL chuẩn: `Database_Hospital_Official.sql`

Tệp tin [Database_Hospital_Official.sql](file:///f:/Workspace/Code%20projects/3.%20Dev/28.%20Manage%20hospital/database/Database_Hospital_Official.sql) là bản thiết kế DDL chính thức cho Hệ thống Quản lý Bệnh viện Đa khoa, bao gồm:
- **Chuẩn định danh Việt Nam:** Mã hóa Căn cước công dân (CCCD 12 số), mã thẻ Bảo hiểm Y tế (BHYT 15 ký tự), mã hồ sơ bệnh án EMR.
- **Phân hệ Khoa phòng:** Khoa Cấp cứu, Khoa Nội, Khoa Ngoại, Khoa Hồi sức tích cực, Khoa Dược lâm sàng, buồng bệnh, giường bệnh.
- **Lâm sàng & Dấu hiệu sinh tồn:** Nhiệt độ chuẩn Celsius (°C: 36.5 - 37.5°C), huyết áp, mạch, SpO2, nhịp thở.
- **Viện phí & Quyết toán BHYT:** Bóc tách quỹ BHYT chi trả, bảo hiểm bổ sung và bệnh nhân cùng chi trả theo đơn vị Việt Nam Đồng (VNĐ).
- **Cấp phát thuốc nội trú eMAR:** Y lệnh thuốc, lịch dùng thuốc theo ca và quy trình kiểm tra 5 đúng.
- **An toàn người bệnh & Sự cố y khoa:** 4 mức độ sự cố y khoa theo Bộ Y tế, quy trình báo động đỏ và tự động khóa bệnh án.

## 2. Hợp đồng thực thi (Executable Contract): Prisma ORM

Ứng dụng Backend (NestJS) sử dụng `apps/backend/prisma/schema.prisma` làm schema thực thi kết nối đến SQL Server / PostgreSQL.

```powershell
docker compose up -d
npm install
npm run db:generate
npm run db:push
npm run db:seed
```

- Tương thích 100% giữa API Backend và Frontend.
- Tự động sinh Prisma Client với đầy đủ Type definitions.
