-- ====================================================================================================
-- HỆ THỐNG QUẢN LÝ BỆNH VIỆN ĐA KHOA (MEDCARE HOSPITAL MANAGEMENT SYSTEM - HIS / EMR)
-- Database Architecture: Microsoft SQL Server 2022+ / Azure SQL Database
-- Tiêu chuẩn: Bộ Y tế Việt Nam, Bệnh án điện tử EMR, Quản lý BHYT & An toàn người bệnh
-- Đơn vị tiền tệ: Việt Nam Đồng (VNĐ) | Múi giờ: Asia/Ho_Chi_Minh (GMT+7)
-- ====================================================================================================

SET NOCOUNT ON;
GO

-- ----------------------------------------------------------------------------------------------------
-- 0. TỰ ĐỘNG KHỞI TẠO VÀ CHUYỂN SANG CƠ SỞ DỮ LIỆU: HospitalManagement
-- ----------------------------------------------------------------------------------------------------

IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'HospitalManagement')
BEGIN
    CREATE DATABASE [HospitalManagement] COLLATE Vietnamese_CI_AS;
END
GO

USE [HospitalManagement];
GO

-- ----------------------------------------------------------------------------------------------------
-- 1. PHÂN HỆ NGƯỜI DÙNG, VAI TRÒ & PHÂN QUYỀN TRUY CẬP (RBAC & SECURITY)
-- ----------------------------------------------------------------------------------------------------

IF OBJECT_ID('dbo.role_permissions', 'U') IS NOT NULL DROP TABLE dbo.role_permissions;
IF OBJECT_ID('dbo.permissions', 'U') IS NOT NULL DROP TABLE dbo.permissions;
IF OBJECT_ID('dbo.user_facilities', 'U') IS NOT NULL DROP TABLE dbo.user_facilities;
IF OBJECT_ID('dbo.users', 'U') IS NOT NULL DROP TABLE dbo.users;
IF OBJECT_ID('dbo.roles', 'U') IS NOT NULL DROP TABLE dbo.roles;
GO

CREATE TABLE [roles] (
  [id] BIGINT IDENTITY(1,1) PRIMARY KEY,
  [role_name] NVARCHAR(100) UNIQUE NOT NULL, -- 'Bác sĩ điều trị', 'Điều dưỡng viên', 'Điều dưỡng trưởng (DON)', 'Hộ lý / Kỹ thuật viên', 'Dược sĩ lâm sàng', 'Quản trị hệ thống', 'Kế toán viện phí'
  [description] NVARCHAR(500),
  [is_deleted] BIT NOT NULL DEFAULT (0),
  [created_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET()),
  [updated_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET())
);
GO

CREATE TABLE [permissions] (
  [id] BIGINT IDENTITY(1,1) PRIMARY KEY,
  [action_code] NVARCHAR(100) UNIQUE NOT NULL, -- e.g. 'EMR_VIEW', 'EMR_EDIT', 'PRESCRIPTION_CREATE', 'DON_APPROVAL', 'INCIDENT_REPORT'
  [is_phi_sensitive] BIT NOT NULL DEFAULT (0), -- Cờ đánh dấu quyền truy cập dữ liệu bệnh án nhạy cảm
  [created_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET())
);
GO

CREATE TABLE [role_permissions] (
  [role_id] BIGINT NOT NULL,
  [permission_id] BIGINT NOT NULL,
  PRIMARY KEY ([role_id], [permission_id])
);
GO

CREATE TABLE [users] (
  [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [employee_code] NVARCHAR(50) UNIQUE NOT NULL, -- Mã cán bộ y tế (VD: BS-001, DD-042)
  [email] NVARCHAR(255) UNIQUE NOT NULL,
  [password_hash] NVARCHAR(300) NOT NULL,
  [first_name] NVARCHAR(100) NOT NULL, -- Tên (VD: Hùng, Mai, Hà)
  [middle_name] NVARCHAR(100),        -- Tên đệm (VD: Văn, Thị)
  [last_name] NVARCHAR(100) NOT NULL,  -- Họ (VD: Nguyễn, Trần, Lê)
  [license_number] NVARCHAR(100),     -- Số chứng chỉ hành nghề khám chữa bệnh (CCHN)
  [phone_number] NVARCHAR(20),        -- Số điện thoại liên hệ (chuẩn E.164: +84...)
  [status] VARCHAR(20) NOT NULL CHECK (status IN ('ACTIVE','INACTIVE','LOCKED','PENDING')) DEFAULT 'ACTIVE',
  [mfa_enabled] BIT NOT NULL DEFAULT (0), -- Xác thực 2 bước 2FA OTP
  [mfa_verified_at] DATETIMEOFFSET(0),
  [last_login_at] DATETIMEOFFSET(0),
  [role_id] BIGINT NOT NULL,
  [is_deleted] BIT NOT NULL DEFAULT (0),
  [deleted_at] DATETIMEOFFSET(0),
  [created_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET()),
  [updated_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET())
);
GO

-- ----------------------------------------------------------------------------------------------------
-- 2. PHÂN HỆ CƠ SỞ Y TẾ, KHOA PHÒNG & BUỒNG GIƯỜNG NỘI TRÚ (DEPARTMENTS, ROOMS & BEDS)
-- ----------------------------------------------------------------------------------------------------

IF OBJECT_ID('dbo.beds', 'U') IS NOT NULL DROP TABLE dbo.beds;
IF OBJECT_ID('dbo.rooms', 'U') IS NOT NULL DROP TABLE dbo.rooms;
IF OBJECT_ID('dbo.departments', 'U') IS NOT NULL DROP TABLE dbo.departments;
IF OBJECT_ID('dbo.facility_room_rates', 'U') IS NOT NULL DROP TABLE dbo.facility_room_rates;
IF OBJECT_ID('dbo.facility_clinical_capabilities', 'U') IS NOT NULL DROP TABLE dbo.facility_clinical_capabilities;
IF OBJECT_ID('dbo.staffing_configs', 'U') IS NOT NULL DROP TABLE dbo.staffing_configs;
IF OBJECT_ID('dbo.facilities', 'U') IS NOT NULL DROP TABLE dbo.facilities;
IF OBJECT_ID('dbo.addresses', 'U') IS NOT NULL DROP TABLE dbo.addresses;
GO

CREATE TABLE [addresses] (
  [id] BIGINT IDENTITY(1,1) PRIMARY KEY,
  [street_line1] NVARCHAR(200) NOT NULL, -- Số nhà, ngõ ngách, tên đường
  [street_line2] NVARCHAR(200),        -- Thôn xóm / Khu đô thị
  [ward] NVARCHAR(100),                -- Phường / Xã
  [district] NVARCHAR(100),            -- Quận / Huyện
  [city] NVARCHAR(100) NOT NULL,       -- Tỉnh / Thành phố trực thuộc Trung ương
  [postal_code] VARCHAR(20),
  [address_type] VARCHAR(20) NOT NULL CHECK (address_type IN ('HOME','WORK','FACILITY','BILLING')) DEFAULT 'HOME',
  [is_deleted] BIT NOT NULL DEFAULT (0),
  [created_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET()),
  [updated_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET())
);
GO

CREATE TABLE [facilities] (
  [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [facility_code] NVARCHAR(50) UNIQUE NOT NULL, -- Mã bệnh viện (VD: BV-MEDCARE-01)
  [name] NVARCHAR(200) NOT NULL,                -- Bệnh viện Đa khoa Quốc tế MedCare
  [license_number] NVARCHAR(100) NOT NULL,      -- Giấy phép hoạt động khám chữa bệnh số của Bộ Y tế
  [target_state] NVARCHAR(100) NOT NULL,        -- Địa bàn quản lý: Hà Nội / TP.HCM / Đà Nẵng
  [address_id] BIGINT,
  [phone_number] NVARCHAR(20),
  [timezone] NVARCHAR(100) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh (GMT+7)',
  [is_deleted] BIT NOT NULL DEFAULT (0),
  [created_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET()),
  [updated_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET())
);
GO

CREATE TABLE [user_facilities] (
  [user_id] UNIQUEIDENTIFIER NOT NULL,
  [facility_id] UNIQUEIDENTIFIER NOT NULL,
  [is_primary] BIT NOT NULL DEFAULT (1),
  PRIMARY KEY ([user_id], [facility_id])
);
GO

CREATE TABLE [departments] (
  [id] BIGINT IDENTITY(1,1) PRIMARY KEY,
  [department_code] NVARCHAR(50) UNIQUE NOT NULL, -- KCC (Cấp cứu), KNOI (Nội tổng hợp), KNGOAI (Ngoại chấn thương), KICU (Hồi sức tích cực), KDUOC (Dược lâm sàng)
  [department_name] NVARCHAR(200) NOT NULL,
  [location_floor] NVARCHAR(50),                  -- Tầng 1 Khu A, Tầng 3 Khu B
  [facility_id] UNIQUEIDENTIFIER NOT NULL,
  [head_doctor_id] UNIQUEIDENTIFIER,              -- Trưởng khoa
  [head_nurse_id] UNIQUEIDENTIFIER,               -- Điều dưỡng trưởng khoa
  [is_active] BIT NOT NULL DEFAULT (1),
  [created_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET())
);
GO

CREATE TABLE [rooms] (
  [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [room_number] NVARCHAR(20) NOT NULL, -- P-101, P-102, ICU-01, CC-02
  [room_type] NVARCHAR(50) NOT NULL,   -- 'Phòng đơn VIP', 'Phòng đôi tiêu chuẩn', 'Phòng hồi sức cấp cứu', 'Phòng cách ly áp lực âm'
  [facility_id] UNIQUEIDENTIFIER NOT NULL,
  [department_id] BIGINT,
  [is_deleted] BIT NOT NULL DEFAULT (0),
  CONSTRAINT [uq_room_per_facility] UNIQUE ([facility_id], [room_number])
);
GO

CREATE TABLE [beds] (
  [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [bed_number] NVARCHAR(20) NOT NULL,  -- Giường A, Giường B, Giường 01...
  [status] VARCHAR(20) NOT NULL CHECK (status IN ('AVAILABLE','OCCUPIED','MAINTENANCE','RESERVED')) DEFAULT 'AVAILABLE',
  [room_id] UNIQUEIDENTIFIER NOT NULL,
  CONSTRAINT [uq_bed_per_room] UNIQUE ([room_id], [bed_number])
);
GO

CREATE TABLE [facility_room_rates] (
  [id] BIGINT IDENTITY(1,1) PRIMARY KEY,
  [facility_id] UNIQUEIDENTIFIER NOT NULL,
  [room_type] NVARCHAR(50) NOT NULL,
  [daily_rate] DECIMAL(18,2) NOT NULL, -- Giá ngày giường nội trú tính bằng VNĐ (VD: 500.000 ₫/ngày)
  [effective_from] DATE NOT NULL,
  [effective_to] DATE,
  CONSTRAINT [uq_facility_room_rate] UNIQUE ([facility_id], [room_type])
);
GO

CREATE TABLE [facility_clinical_capabilities] (
  [id] BIGINT IDENTITY(1,1) PRIMARY KEY,
  [facility_id] UNIQUEIDENTIFIER NOT NULL,
  [capability] NVARCHAR(200) NOT NULL, -- VD: 'Hồi sức cấp cứu & Thở máy', 'Phẫu thuật ngoại khoa nội soi', 'Dược lâm sàng & Truyền dịch tĩnh mạch'
  [supported] BIT NOT NULL DEFAULT (1),
  [note] NVARCHAR(500),
  CONSTRAINT [uq_facility_clinical_capability] UNIQUE ([facility_id], [capability])
);
GO

CREATE TABLE [staffing_configs] (
  [id] BIGINT IDENTITY(1,1) PRIMARY KEY,
  [facility_id] UNIQUEIDENTIFIER NOT NULL,
  [min_hrs_per_resident_day] DECIMAL(5,2) NOT NULL DEFAULT (3.5), -- Tỷ lệ giờ chăm sóc chuẩn / bệnh nhân / ngày
  [warn_below_percentage] INT NOT NULL DEFAULT (90),              -- Ngưỡng cảnh báo thiếu hụt định biên (%)
  [shift_breakdown_json] NVARCHAR(2000),                          -- Cấu hình định biên theo Ca Sáng, Ca Chiều, Ca Đêm
  [created_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET())
);
GO

-- ----------------------------------------------------------------------------------------------------
-- 3. PHÂN HỆ PHÂN TẦNG CHĂM SÓC (LEVEL OF CARE - LOC TIERS)
-- ----------------------------------------------------------------------------------------------------

IF OBJECT_ID('dbo.care_level_rates', 'U') IS NOT NULL DROP TABLE dbo.care_level_rates;
IF OBJECT_ID('dbo.care_levels', 'U') IS NOT NULL DROP TABLE dbo.care_levels;
GO

CREATE TABLE [care_levels] (
  [id] BIGINT IDENTITY(1,1) PRIMARY KEY,
  [level_code] VARCHAR(30) UNIQUE NOT NULL CHECK (level_code IN
                        ('INDEPENDENT_LIVING','ASSISTED_LIVING','MEMORY_CARE','SKILLED_NURSING','HOSPICE')),
  [level_name] NVARCHAR(100) NOT NULL, -- 'Cấp độ 1 - Tự chủ', 'Cấp độ 2 - Hỗ trợ một phần', 'Cấp độ 3 - Chăm sóc tích cực', 'Cấp độ 4 - Chăm sóc toàn diện'
  [score_min] INT NOT NULL DEFAULT (0),
  [score_max] INT NOT NULL DEFAULT (100),
  [is_deleted] BIT NOT NULL DEFAULT (0)
);
GO

CREATE TABLE [care_level_rates] (
  [id] BIGINT IDENTITY(1,1) PRIMARY KEY,
  [care_level_id] BIGINT NOT NULL,
  [facility_id] UNIQUEIDENTIFIER NOT NULL,
  [daily_rate] DECIMAL(18,2) NOT NULL, -- Định mức chăm sóc lâm sàng theo cấp độ (VNĐ/ngày)
  [effective_from] DATE NOT NULL,
  [effective_to] DATE
);
GO

-- ----------------------------------------------------------------------------------------------------
-- 4. PHÂN HỆ QUẢN LÝ BỆNH NHÂN, BẢO HIỂM Y TẾ & TIẾP NHẬN (PATIENTS & ADMISSIONS)
-- ----------------------------------------------------------------------------------------------------

IF OBJECT_ID('dbo.resident_sensitive_info', 'U') IS NOT NULL DROP TABLE dbo.resident_sensitive_info;
IF OBJECT_ID('dbo.resident_care_level_history', 'U') IS NOT NULL DROP TABLE dbo.resident_care_level_history;
IF OBJECT_ID('dbo.resident_contacts', 'U') IS NOT NULL DROP TABLE dbo.resident_contacts;
IF OBJECT_ID('dbo.contacts', 'U') IS NOT NULL DROP TABLE dbo.contacts;
IF OBJECT_ID('dbo.resident_insurance_policies', 'U') IS NOT NULL DROP TABLE dbo.resident_insurance_policies;
IF OBJECT_ID('dbo.insurance_providers', 'U') IS NOT NULL DROP TABLE dbo.insurance_providers;
IF OBJECT_ID('dbo.admissions', 'U') IS NOT NULL DROP TABLE dbo.admissions;
IF OBJECT_ID('dbo.pre_admission_screenings', 'U') IS NOT NULL DROP TABLE dbo.pre_admission_screenings;
IF OBJECT_ID('dbo.residents', 'U') IS NOT NULL DROP TABLE dbo.residents;
GO

CREATE TABLE [residents] (
  [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [medical_record_number] NVARCHAR(50) UNIQUE, -- Mã số bệnh án EMR (VD: BA-2026-0042)
  [first_name] NVARCHAR(100) NOT NULL,         -- Tên bệnh nhân (VD: Hùng, Anh, Trang)
  [middle_name] NVARCHAR(100),                -- Tên đệm (VD: Văn, Thị)
  [last_name] NVARCHAR(100) NOT NULL,          -- Họ bệnh nhân (VD: Nguyễn, Trần, Lê)
  [date_of_birth] DATE NOT NULL,
  [gender] VARCHAR(20) CHECK (gender IN ('MALE','FEMALE','OTHER','UNDISCLOSED')),
  [marital_status] NVARCHAR(50),              -- Độc thân, Đã kết hôn, Ly hôn...
  [ethnicity] NVARCHAR(50) DEFAULT N'Kinh',   -- Dân tộc
  [occupation] NVARCHAR(100),                 -- Nghề nghiệp
  [status] VARCHAR(20) NOT NULL CHECK (status IN ('PENDING','ACTIVE','DISCHARGED','TRANSFERRED','DECEASED')) DEFAULT 'PENDING',
  [is_chart_locked] BIT NOT NULL DEFAULT (0),  -- Cờ khóa hồ sơ bệnh án khi có sự cố y khoa nghiêm trọng
  [address_id] BIGINT,
  [bed_id] UNIQUEIDENTIFIER,
  [is_deleted] BIT NOT NULL DEFAULT (0),
  [deleted_at] DATETIMEOFFSET(0),
  [created_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET()),
  [updated_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET())
);
GO

CREATE TABLE [resident_sensitive_info] (
  [id] BIGINT IDENTITY(1,1) PRIMARY KEY,
  [resident_id] UNIQUEIDENTIFIER UNIQUE NOT NULL,
  [cccd_encrypted] VARCHAR(512),              -- Mã số CCCD gắn chip (12 chữ số) mã hóa AES-256
  [ssn_encrypted] VARCHAR(512),               -- Tương thích lưu trữ định danh
  [health_insurance_card_number_encrypted] VARCHAR(512), -- Mã số thẻ BHYT (15 ký tự chuẩn Bộ Y tế) mã hóa
  [primary_insurance_id_encrypted] VARCHAR(512),
  [medical_record_number_encrypted] VARCHAR(512),
  [bank_account_encrypted] VARCHAR(512),
  [created_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET()),
  [updated_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET())
);
GO

CREATE TABLE [resident_care_level_history] (
  [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [resident_id] UNIQUEIDENTIFIER NOT NULL,
  [care_level_id] BIGINT NOT NULL,
  [start_date] DATE NOT NULL,
  [end_date] DATE
);
GO

CREATE TABLE [contacts] (
  [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [first_name] NVARCHAR(100) NOT NULL,
  [middle_name] NVARCHAR(100),
  [last_name] NVARCHAR(100) NOT NULL,
  [phone_primary] NVARCHAR(20) NOT NULL,
  [phone_secondary] NVARCHAR(20),
  [email] NVARCHAR(255),
  [address_id] BIGINT,
  [is_deleted] BIT NOT NULL DEFAULT (0),
  [created_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET()),
  [updated_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET())
);
GO

CREATE TABLE [resident_contacts] (
  [id] BIGINT IDENTITY(1,1) PRIMARY KEY,
  [resident_id] UNIQUEIDENTIFIER NOT NULL,
  [contact_id] UNIQUEIDENTIFIER NOT NULL,
  [relationship_type] NVARCHAR(50) NOT NULL, -- 'Bố/Mẹ', 'Vợ/Chồng', 'Con', 'Người giám hộ hợp pháp', 'Người bảo lãnh viện phí'
  [is_guarantor] BIT NOT NULL DEFAULT (0),
  [is_emergency_contact] BIT NOT NULL DEFAULT (0),
  [is_primary] BIT NOT NULL DEFAULT (0),
  [financial_responsibility_pct] DECIMAL(5,2) CHECK (financial_responsibility_pct BETWEEN 0 AND 100),
  [created_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET()),
  [updated_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET()),
  CONSTRAINT [uq_resident_contact] UNIQUE ([resident_id], [contact_id], [relationship_type])
);
GO

CREATE TABLE [pre_admission_screenings] (
  [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [resident_id] UNIQUEIDENTIFIER NOT NULL,
  [screened_by] UNIQUEIDENTIFIER NOT NULL,
  [triage_level] VARCHAR(20) CHECK (triage_level IN ('RESUSCITATION','EMERGENT','URGENT','LESS_URGENT','NON_URGENT')), -- Thang phân loại cấp cứu Triage 1-5
  [status] VARCHAR(20) NOT NULL CHECK (status IN ('DRAFT','COMPLETED','REJECTED')),
  [notes] NVARCHAR(1000),
  [created_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET())
);
GO

CREATE TABLE [admissions] (
  [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [resident_id] UNIQUEIDENTIFIER NOT NULL,
  [facility_id] UNIQUEIDENTIFIER NOT NULL,
  [department_id] BIGINT,                    -- Khoa tiếp nhận nội trú ban đầu
  [admission_date] DATE NOT NULL,
  [discharge_date] DATE,
  [discharge_reason] NVARCHAR(255),          -- 'Khỏi bệnh ra viện', 'Chuyển tuyến điều trị', 'Xin về', 'Tử vong'
  [attending_physician_id] UNIQUEIDENTIFIER, -- Bác sĩ điều trị chính
  [created_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET())
);
GO

CREATE TABLE [insurance_providers] (
  [id] BIGINT IDENTITY(1,1) PRIMARY KEY,
  [provider_name] NVARCHAR(200) NOT NULL,    -- 'Bảo hiểm Xã hội Việt Nam (BHYT)', 'Bảo hiểm Bảo Việt', 'Bảo hiểm Dai-ichi Life'...
  [provider_type] VARCHAR(30) NOT NULL CHECK (provider_type IN ('BHYT','MEDICARE','MEDICAID','COMMERCIAL','PRIVATE','OTHER'))
);
GO

CREATE TABLE [resident_insurance_policies] (
  [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [resident_id] UNIQUEIDENTIFIER NOT NULL,
  [insurance_provider_id] BIGINT NOT NULL,
  [policy_number_encrypted] VARCHAR(512) NOT NULL, -- Mã thẻ BHYT mã hóa
  [group_number] NVARCHAR(100),                   -- Mã nơi đăng ký KCB ban đầu (VD: 01-042)
  [benefit_percentage] INT DEFAULT 80,            -- Tỷ lệ hưởng BHYT: 80%, 95%, 100%
  [effective_from] DATE NOT NULL,
  [effective_to] DATE,
  [is_primary] BIT NOT NULL DEFAULT (1),
  [is_deleted] BIT NOT NULL DEFAULT (0),
  [created_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET())
);
GO

-- ----------------------------------------------------------------------------------------------------
-- 5. PHÂN HỆ LÂM SÀNG, DẤU HIỆU SINH TỒN & BỆNH ÁN ĐIỆN TỬ (CLINICAL & EMR)
-- ----------------------------------------------------------------------------------------------------

IF OBJECT_ID('dbo.vital_signs', 'U') IS NOT NULL DROP TABLE dbo.vital_signs;
IF OBJECT_ID('dbo.assessment_details', 'U') IS NOT NULL DROP TABLE dbo.assessment_details;
IF OBJECT_ID('dbo.assessment_metrics', 'U') IS NOT NULL DROP TABLE dbo.assessment_metrics;
IF OBJECT_ID('dbo.assessments', 'U') IS NOT NULL DROP TABLE dbo.assessments;
IF OBJECT_ID('dbo.clinical_records', 'U') IS NOT NULL DROP TABLE dbo.clinical_records;
GO

CREATE TABLE [clinical_records] (
  [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [resident_id] UNIQUEIDENTIFIER NOT NULL,
  [recorded_by] UNIQUEIDENTIFIER NOT NULL,
  [record_type] VARCHAR(50) NOT NULL CHECK (record_type IN ('PROGRESS_NOTE','DIAGNOSIS','LAB_RESULT','CONSULTATION','SURGICAL_NOTE')),
  [icd10_code] VARCHAR(20),                -- Mã chẩn đoán bệnh theo ICD-10 của WHO/Bộ Y tế (VD: I10, E11, J18)
  [description] NVARCHAR(MAX) NOT NULL,    -- Diễn biến lâm sàng & Y lệnh điều trị
  [is_deleted] BIT NOT NULL DEFAULT (0),
  [created_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET()),
  [updated_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET())
);
GO

CREATE TABLE [vital_signs] (
  [id] BIGINT IDENTITY(1,1) PRIMARY KEY,
  [resident_id] UNIQUEIDENTIFIER NOT NULL,
  [recorded_by] UNIQUEIDENTIFIER NOT NULL,
  [blood_pressure_systolic] SMALLINT,      -- Huyết áp tâm thu (mmHg: 90 - 140)
  [blood_pressure_diastolic] SMALLINT,     -- Huyết áp tâm trương (mmHg: 60 - 90)
  [heart_rate_bpm] SMALLINT,               -- Mạch / Tần số tim (lần/phút: 60 - 100)
  [respiratory_rate] SMALLINT,             -- Nhịp thở (lần/phút: 16 - 20)
  [temperature_celsius] DECIMAL(4,1),      -- Nhiệt độ cơ thể chuẩn y tế Việt Nam (°C: 36.5 - 37.5)
  [temperature_fahrenheit] DECIMAL(4,1),   -- Tương thích ngược hệ Fahrenheit
  [spo2_percentage] TINYINT CHECK (spo2_percentage BETWEEN 0 AND 100), -- Độ bão hòa oxy máu SpO2 (%)
  [pain_scale] TINYINT CHECK (pain_scale BETWEEN 0 AND 10),            -- Thang điểm đau VAS (0-10)
  [notes] NVARCHAR(500),                   -- Ghi chú bất thường tại giường bệnh
  [is_abnormal] BIT NOT NULL DEFAULT (0),  -- Cờ cảnh báo bất thường lâm sàng
  [recorded_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET())
);
GO

CREATE TABLE [assessments] (
  [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [resident_id] UNIQUEIDENTIFIER NOT NULL,
  [assessed_by] UNIQUEIDENTIFIER NOT NULL,
  [suggested_care_level_id] BIGINT NOT NULL,
  [confirmed_care_level_id] BIGINT NOT NULL,
  [adl_total_score] INT NOT NULL,          -- Tổng điểm sinh hoạt hằng ngày (ADL/IADL)
  [braden_score] INT,                      -- Thang điểm nguy cơ loét tì đè Braden
  [morse_fall_score] INT,                  -- Thang điểm nguy cơ té ngã Morse
  [is_overridden] BIT NOT NULL DEFAULT (0),
  [override_reason] NVARCHAR(500),
  [created_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET())
);
GO

CREATE TABLE [assessment_metrics] (
  [id] BIGINT IDENTITY(1,1) PRIMARY KEY,
  [category] VARCHAR(50) NOT NULL CHECK (category IN ('ADL','IADL','BRADEN','MORSE','NUTRITION')),
  [metric_name] NVARCHAR(100) NOT NULL     -- Ăn uống, Vệ sinh cá nhân, Di chuyển tại giường, Đi lại...
);
GO

CREATE TABLE [assessment_details] (
  [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [assessment_id] UNIQUEIDENTIFIER NOT NULL,
  [metric_id] BIGINT NOT NULL,
  [score] INT NOT NULL,
  [notes] NVARCHAR(500)
);
GO

-- ----------------------------------------------------------------------------------------------------
-- 6. PHÂN HỆ PHÁC ĐỒ ĐIỀU TRỊ & KẾ HOẠCH CHĂM SÓC ĐA CHUYÊN KHOA (CARE PLANS & IDT)
-- ----------------------------------------------------------------------------------------------------

IF OBJECT_ID('dbo.care_tasks', 'U') IS NOT NULL DROP TABLE dbo.care_tasks;
IF OBJECT_ID('dbo.care_interventions', 'U') IS NOT NULL DROP TABLE dbo.care_interventions;
IF OBJECT_ID('dbo.care_goals', 'U') IS NOT NULL DROP TABLE dbo.care_goals;
IF OBJECT_ID('dbo.care_plan_reviews', 'U') IS NOT NULL DROP TABLE dbo.care_plan_reviews;
IF OBJECT_ID('dbo.care_plan_signatures', 'U') IS NOT NULL DROP TABLE dbo.care_plan_signatures;
IF OBJECT_ID('dbo.idt_acknowledgments', 'U') IS NOT NULL DROP TABLE dbo.idt_acknowledgments;
IF OBJECT_ID('dbo.care_plans', 'U') IS NOT NULL DROP TABLE dbo.care_plans;
GO

CREATE TABLE [care_plans] (
  [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [resident_id] UNIQUEIDENTIFIER NOT NULL,
  [created_by] UNIQUEIDENTIFIER,
  [status] VARCHAR(20) NOT NULL CHECK (status IN ('DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','ACTIVE','RESOLVED','DISCONTINUED')) DEFAULT 'DRAFT',
  [significant_change_flag] BIT NOT NULL DEFAULT (0),
  [is_deleted] BIT NOT NULL DEFAULT (0),
  [created_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET()),
  [updated_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET())
);
GO

CREATE TABLE [care_goals] (
  [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [care_plan_id] UNIQUEIDENTIFIER NOT NULL,
  [description] NVARCHAR(500) NOT NULL, -- Mục tiêu lâm sàng (VD: Ổn định huyết áp <130/80 mmHg, Phục hồi vận động tự chủ)
  [target_date] DATE,
  [status] VARCHAR(20) NOT NULL CHECK (status IN ('IN_PROGRESS','ACHIEVED','NOT_MET')) DEFAULT 'IN_PROGRESS'
);
GO

CREATE TABLE [care_interventions] (
  [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [care_plan_id] UNIQUEIDENTIFIER NOT NULL,
  [assigned_role] VARCHAR(50) NOT NULL, -- 'Nurse (RN/LPN)', 'CNA', 'Physician', 'Dietary'
  [description] NVARCHAR(500) NOT NULL  -- Can thiệp điều dưỡng: Thay băng vô khuẩn mỗi ngày, Xoay trở chống loét mỗi 2 giờ
);
GO

CREATE TABLE [care_tasks] (
  [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [care_intervention_id] UNIQUEIDENTIFIER NOT NULL,
  [assigned_cna_id] UNIQUEIDENTIFIER,
  [task_type] VARCHAR(50) NOT NULL,
  [status] VARCHAR(20) NOT NULL CHECK (status IN ('PENDING','IN_PROGRESS','COMPLETED','MISSED','CANCELLED')) DEFAULT 'PENDING',
  [is_abnormal_flagged] BIT NOT NULL DEFAULT (0),
  [scheduled_time] DATETIMEOFFSET(0) NOT NULL,
  [completed_at] DATETIMEOFFSET(0)
);
GO

CREATE TABLE [care_plan_reviews] (
  [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [care_plan_id] UNIQUEIDENTIFIER NOT NULL,
  [reviewer_id] UNIQUEIDENTIFIER NOT NULL, -- Điều dưỡng trưởng (DON)
  [status] VARCHAR(20) NOT NULL CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  [notes] NVARCHAR(500),
  [reviewed_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET())
);
GO

CREATE TABLE [care_plan_signatures] (
  [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [care_plan_id] UNIQUEIDENTIFIER NOT NULL,
  [signer_id] UNIQUEIDENTIFIER NOT NULL,
  [signature_token] NVARCHAR(512) NOT NULL, -- Khóa xác thực chữ ký số điện tử
  [signed_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET())
);
GO

CREATE TABLE [idt_acknowledgments] (
  [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [care_plan_id] UNIQUEIDENTIFIER NOT NULL,
  [user_id] UNIQUEIDENTIFIER NOT NULL,      -- Thành viên hội chẩn đa chuyên khoa (Bác sĩ, Dược sĩ, Dinh dưỡng)
  [notes] NVARCHAR(500),
  [acknowledged_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET())
);
GO

-- ----------------------------------------------------------------------------------------------------
-- 7. PHÂN HỆ CẤP PHÁT THUỐC NỘI TRÚ (eMAR - MEDICATION ADMINISTRATION)
-- ----------------------------------------------------------------------------------------------------

IF OBJECT_ID('dbo.medication_logs', 'U') IS NOT NULL DROP TABLE dbo.medication_logs;
IF OBJECT_ID('dbo.medication_schedules', 'U') IS NOT NULL DROP TABLE dbo.medication_schedules;
IF OBJECT_ID('dbo.medication_orders', 'U') IS NOT NULL DROP TABLE dbo.medication_orders;
GO

CREATE TABLE [medication_orders] (
  [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [resident_id] UNIQUEIDENTIFIER NOT NULL,
  [prescribed_by] UNIQUEIDENTIFIER NOT NULL, -- Bác sĩ kê đơn
  [drug_name] NVARCHAR(200) NOT NULL,        -- Tên hoạt chất & biệt dược: Augmentin, Amlodipine, Paracetamol, Ceftriaxone
  [dosage] NVARCHAR(100) NOT NULL,           -- Liều dùng: 1g, 5mg, 500mg viên sủi, 1g lọ tiêm
  [route] VARCHAR(30) NOT NULL,              -- Đường dùng: 'PO' (Uống), 'IV' (Tiêm tĩnh mạch), 'IM' (Tiêm bắp), 'SC' (Tiêm dưới da)
  [frequency] NVARCHAR(100) NOT NULL,        -- Tần suất: 2 lần/ngày sau ăn, 1 lần buổi tối, khi sốt > 38.5°C
  [is_controlled_substance] BIT NOT NULL DEFAULT (0), -- Thuốc gây nghiện / Hướng tâm thần (quản lý đặc biệt)
  [status] VARCHAR(20) NOT NULL CHECK (status IN ('ACTIVE','DISCONTINUED','ON_HOLD','COMPLETED')) DEFAULT 'ACTIVE',
  [is_deleted] BIT NOT NULL DEFAULT (0),
  [created_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET()),
  [updated_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET())
);
GO

CREATE TABLE [medication_schedules] (
  [id] BIGINT IDENTITY(1,1) PRIMARY KEY,
  [order_id] UNIQUEIDENTIFIER NOT NULL,
  [scheduled_time] TIME NOT NULL,            -- Giờ y lệnh dùng thuốc: 08:00, 12:00, 18:00, 21:00
  [is_active] BIT NOT NULL DEFAULT (1)
);
GO

CREATE TABLE [medication_logs] (
  [id] BIGINT IDENTITY(1,1) PRIMARY KEY,
  [order_id] UNIQUEIDENTIFIER NOT NULL,
  [administered_by] UNIQUEIDENTIFIER NOT NULL, -- Điều dưỡng cấp phát thuốc
  [witnessed_by] UNIQUEIDENTIFIER,             -- Điều dưỡng đối chiếu kép (với thuốc độc/gây nghiện)
  [status] VARCHAR(20) NOT NULL CHECK (status IN ('ADMINISTERED','REFUSED','HELD','MISSED','NOT_AVAILABLE')),
  [is_clinically_justified] BIT NOT NULL DEFAULT (0),
  [override_reason] NVARCHAR(500),             -- Lý do không dùng thuốc (Người bệnh từ chối, Huyết áp thấp...)
  [logged_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET())
);
GO

-- ----------------------------------------------------------------------------------------------------
-- 8. PHÂN HỆ SỰ CỐ Y KHOA & BÁO ĐỘNG ĐỎ AN TOÀN NGƯỜI BỆNH (INCIDENT MANAGEMENT)
-- ----------------------------------------------------------------------------------------------------

IF OBJECT_ID('dbo.incident_timelines', 'U') IS NOT NULL DROP TABLE dbo.incident_timelines;
IF OBJECT_ID('dbo.chart_lock_events', 'U') IS NOT NULL DROP TABLE dbo.chart_lock_events;
IF OBJECT_ID('dbo.incidents', 'U') IS NOT NULL DROP TABLE dbo.incidents;
IF OBJECT_ID('dbo.sla_configs', 'U') IS NOT NULL DROP TABLE dbo.sla_configs;
IF OBJECT_ID('dbo.incident_severities', 'U') IS NOT NULL DROP TABLE dbo.incident_severities;
GO

CREATE TABLE [incident_severities] (
  [id] BIGINT IDENTITY(1,1) PRIMARY KEY,
  [level_name] NVARCHAR(50) NOT NULL, -- 'Minor' (Nhẹ), 'Moderate' (Trung bình), 'Major' (Nghiêm trọng), 'Critical' (Nguy kịch)
  [chart_lock_trigger] BIT NOT NULL DEFAULT (0), -- Kích hoạt tự động khóa bệnh án bảo toàn hồ sơ
  [description] NVARCHAR(500)
);
GO

CREATE TABLE [sla_configs] (
  [id] BIGINT IDENTITY(1,1) PRIMARY KEY,
  [severity_id] BIGINT NOT NULL,
  [sla_window_hrs] INT NOT NULL,       -- Thời hạn xử lý & báo cáo (VD: Mức 1: 72h, Mức 4: 2h báo động đỏ)
  [external_report_required] BIT NOT NULL DEFAULT (1), -- Báo cáo Sở Y tế / Cục Quản lý Khám chữa bệnh
  [regulatory_body] NVARCHAR(200)      -- Cơ quan tiếp nhận báo cáo
);
GO

CREATE TABLE [incidents] (
  [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [resident_id] UNIQUEIDENTIFIER NOT NULL,
  [severity_id] BIGINT NOT NULL,
  [reported_by] UNIQUEIDENTIFIER NOT NULL,
  [incident_type] VARCHAR(50) NOT NULL CHECK (incident_type IN ('FALL','MEDICATION_ERROR','ALTERCATION','SKIN_TEAR','INFECTION','EQUIPMENT_FAILURE','OTHER')),
  [description] NVARCHAR(MAX),
  [immediate_actions] NVARCHAR(MAX),   -- Xử trí y tế tức thì tại chỗ
  [sla_deadline] DATETIMEOFFSET(0) NOT NULL,
  [status] VARCHAR(20) NOT NULL CHECK (status IN ('OPEN','UNDER_INVESTIGATION','RESOLVED','CLOSED')) DEFAULT 'OPEN',
  [reported_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET())
);
GO

CREATE TABLE [chart_lock_events] (
  [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [incident_id] UNIQUEIDENTIFIER NOT NULL,
  [locked_by_system] BIT NOT NULL DEFAULT (1),
  [lock_reason] NVARCHAR(MAX),
  [locked_by] UNIQUEIDENTIFIER,
  [unlocked_by] UNIQUEIDENTIFIER,     -- Giám đốc bệnh viện / Lãnh đạo thẩm quyền mở khóa
  [unlock_reason] NVARCHAR(MAX),
  [event_time] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET())
);
GO

CREATE TABLE [incident_timelines] (
  [id] BIGINT IDENTITY(1,1) PRIMARY KEY,
  [incident_id] UNIQUEIDENTIFIER NOT NULL,
  [action] NVARCHAR(MAX),
  [reason] NVARCHAR(MAX),
  [actor] UNIQUEIDENTIFIER,
  [createdAt] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET())
);
GO

-- ----------------------------------------------------------------------------------------------------
-- 9. PHÂN HỆ VIỆN PHÍ & QUYẾT TOÁN BHYT (HOSPITAL BILLING & HEALTH INSURANCE)
-- ----------------------------------------------------------------------------------------------------

IF OBJECT_ID('dbo.payments', 'U') IS NOT NULL DROP TABLE dbo.payments;
IF OBJECT_ID('dbo.invoice_line_items', 'U') IS NOT NULL DROP TABLE dbo.invoice_line_items;
IF OBJECT_ID('dbo.invoices', 'U') IS NOT NULL DROP TABLE dbo.invoices;
GO

CREATE TABLE [invoices] (
  [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [resident_id] UNIQUEIDENTIFIER NOT NULL,
  [billing_period_start] DATE NOT NULL,
  [billing_period_end] DATE NOT NULL,
  [total_amount] DECIMAL(18,2) NOT NULL,                     -- Tổng chi phí khám chữa bệnh (VNĐ)
  [bhyt_covered_amount] DECIMAL(18,2) NOT NULL DEFAULT (0),  -- Quỹ BHYT chi trả
  [medicare_covered_amount] DECIMAL(18,2) NOT NULL DEFAULT (0), -- Tương thích
  [bhxh_covered_amount] DECIMAL(18,2) NOT NULL DEFAULT (0),  -- Chính sách bảo trợ xã hội
  [medicaid_covered_amount] DECIMAL(18,2) NOT NULL DEFAULT (0), -- Tương thích
  [private_insurance_covered_amount] DECIMAL(18,2) NOT NULL DEFAULT (0), -- Bảo hiểm sức khỏe thương mại chi trả
  [patient_responsibility_amount] DECIMAL(18,2) NOT NULL DEFAULT (0),    -- Người bệnh cùng chi trả (Đồng chi trả)
  [status] VARCHAR(20) NOT NULL CHECK (status IN ('DRAFT','SENT','PARTIALLY_PAID','PAID','OVERDUE','VOID')) DEFAULT 'DRAFT',
  [due_date] DATE NOT NULL,
  [is_deleted] BIT NOT NULL DEFAULT (0),
  [created_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET()),
  [updated_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET())
);
GO

CREATE TABLE [invoice_line_items] (
  [id] BIGINT IDENTITY(1,1) PRIMARY KEY,
  [invoice_id] UNIQUEIDENTIFIER NOT NULL,
  [description] NVARCHAR(255) NOT NULL, -- Tên dịch vụ: Ngày giường nội trú, Tiền thuốc, Phẫu thuật, Xét nghiệm máu...
  [item_type] VARCHAR(30) NOT NULL CHECK (item_type IN ('ROOM_BOARD','CARE_LEVEL','MEDICATION','THERAPY','SURGERY','LABORATORY','OTHER')),
  [quantity] INT NOT NULL DEFAULT (1),
  [unit_price] DECIMAL(18,2) NOT NULL DEFAULT (0),
  [amount] DECIMAL(18,2) NOT NULL
);
GO

CREATE TABLE [payments] (
  [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [invoice_id] UNIQUEIDENTIFIER NOT NULL,
  [payer_type] VARCHAR(30) NOT NULL CHECK (payer_type IN ('BHYT','BAO_TRO_XA_HOI','BAO_HIEM_THUONG_MAI','BENH_NHAN_TU_TRA','MEDICARE','MEDICAID','PRIVATE_INSURANCE','FAMILY')),
  [payment_method] VARCHAR(30) NOT NULL CHECK (payment_method IN ('CHUYEN_KHOAN','TIEN_MAT','THE_NGAN_HANG','VI_DIEN_TU','CREDIT_CARD','ACH','CHECK','CASH','INSURANCE_DIRECT')),
  [amount] DECIMAL(18,2) NOT NULL,
  [payment_token_encrypted] VARCHAR(512),
  [received_by] UNIQUEIDENTIFIER NOT NULL, -- Kế toán viện phí / Thủ quỹ tiếp nhận
  [paid_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET())
);
GO

-- ----------------------------------------------------------------------------------------------------
-- 10. PHÂN HỆ CA TRỰC Y BÁC SĨ & ĐIỀU DƯỠNG (SHIFTS & SCHEDULES)
-- ----------------------------------------------------------------------------------------------------

IF OBJECT_ID('dbo.shift_assignments', 'U') IS NOT NULL DROP TABLE dbo.shift_assignments;
IF OBJECT_ID('dbo.shifts', 'U') IS NOT NULL DROP TABLE dbo.shifts;
GO

CREATE TABLE [shifts] (
  [id] BIGINT IDENTITY(1,1) PRIMARY KEY,
  [facility_id] UNIQUEIDENTIFIER NOT NULL,
  [shift_name] NVARCHAR(50) NOT NULL, -- 'Ca Sáng' (07:00 - 15:00), 'Ca Chiều' (15:00 - 23:00), 'Ca Đêm' (23:00 - 07:00)
  [start_time] TIME NOT NULL,
  [end_time] TIME NOT NULL
);
GO

CREATE TABLE [shift_assignments] (
  [id] BIGINT IDENTITY(1,1) PRIMARY KEY,
  [shift_id] BIGINT NOT NULL,
  [user_id] UNIQUEIDENTIFIER NOT NULL, -- Cán bộ y tế được phân công ca trực
  [work_date] DATE NOT NULL,
  [status] VARCHAR(20) NOT NULL CHECK (status IN ('SCHEDULED','CONFIRMED','CALLED_OUT','COMPLETED')) DEFAULT 'SCHEDULED',
  [clock_in_at] DATETIMEOFFSET(0),
  [clock_out_at] DATETIMEOFFSET(0),
  CONSTRAINT [uq_shift_assignment] UNIQUE ([shift_id], [user_id], [work_date])
);
GO

-- ----------------------------------------------------------------------------------------------------
-- 11. PHÂN HỆ TRANG THIẾT BỊ & VẬT TƯ TIÊU HAO Y TẾ (EQUIPMENT & CONSUMABLES)
-- ----------------------------------------------------------------------------------------------------

IF OBJECT_ID('dbo.consumable_supplies', 'U') IS NOT NULL DROP TABLE dbo.consumable_supplies;
IF OBJECT_ID('dbo.durable_medical_equipment', 'U') IS NOT NULL DROP TABLE dbo.durable_medical_equipment;
IF OBJECT_ID('dbo.inventory_categories', 'U') IS NOT NULL DROP TABLE dbo.inventory_categories;
GO

CREATE TABLE [inventory_categories] (
  [id] BIGINT IDENTITY(1,1) PRIMARY KEY,
  [category_name] NVARCHAR(100) UNIQUE NOT NULL, -- 'Máy thở & Thiết bị hô hấp', 'Bơm tiêm & Dây truyền', 'Bông băng & Khử khuẩn'
  [description] NVARCHAR(500),
  [created_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET())
);
GO

CREATE TABLE [durable_medical_equipment] (
  [id] BIGINT IDENTITY(1,1) PRIMARY KEY,
  [item_name] NVARCHAR(200) NOT NULL,
  [category_id] BIGINT NOT NULL,
  [asset_tag] VARCHAR(50) UNIQUE NOT NULL,      -- Mã tài sản cố định (VD: TBYT-VENT-001)
  [status] VARCHAR(30) NOT NULL CHECK ([status] IN ('AVAILABLE', 'IN_SERVICE', 'UNDER_MAINTENANCE', 'RETIRED')) DEFAULT 'AVAILABLE',
  [facility_id] BIGINT NOT NULL,
  [assigned_to_user] BIGINT,
  [assigned_to_resident] BIGINT,
  [unit_value] DECIMAL(18,2) NOT NULL DEFAULT (0),
  [is_deleted] BIT NOT NULL DEFAULT (0),
  [created_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET()),
  [updated_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET())
);
GO

CREATE TABLE [consumable_supplies] (
  [id] BIGINT IDENTITY(1,1) PRIMARY KEY,
  [item_name] NVARCHAR(200) NOT NULL,
  [category_id] BIGINT NOT NULL,
  [facility_id] BIGINT NOT NULL,
  [stock_on_hand] INT NOT NULL CHECK ([stock_on_hand] >= 0) DEFAULT (0),
  [total] INT NOT NULL CHECK ([total] >= 0) DEFAULT (0),
  [reorder_threshold] INT NOT NULL CHECK ([reorder_threshold] >= 0) DEFAULT (0),
  [unit_cost] DECIMAL(18,2) NOT NULL DEFAULT (0),
  [private_pay_rate] DECIMAL(18,2) NOT NULL DEFAULT (0),
  [status] VARCHAR(20) NOT NULL CHECK ([status] IN ('OK', 'LOW_STOCK', 'OUT_OF_STOCK')) DEFAULT 'OK',
  [is_deleted] BIT NOT NULL DEFAULT (0),
  [created_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET()),
  [updated_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET())
);
GO

-- ----------------------------------------------------------------------------------------------------
-- 12. PHÂN HỆ NHẬT KÝ KIỂM TOÁN & THÔNG BÁO (AUDIT TRAILS & NOTIFICATIONS)
-- ----------------------------------------------------------------------------------------------------

IF OBJECT_ID('dbo.notifications', 'U') IS NOT NULL DROP TABLE dbo.notifications;
IF OBJECT_ID('dbo.phi_access_logs', 'U') IS NOT NULL DROP TABLE dbo.phi_access_logs;
IF OBJECT_ID('dbo.audit_logs', 'U') IS NOT NULL DROP TABLE dbo.audit_logs;
GO

CREATE TABLE [audit_logs] (
  [id] BIGINT IDENTITY(1,1) PRIMARY KEY,
  [table_name] NVARCHAR(100) NOT NULL,
  [record_id] NVARCHAR(100) NOT NULL,
  [action] VARCHAR(20) NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  [old_data] NVARCHAR(MAX),
  [new_data] NVARCHAR(MAX),
  [performed_by] UNIQUEIDENTIFIER NOT NULL,
  [performed_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET()),
  [ip_address] VARCHAR(45)
);
GO

CREATE TABLE [phi_access_logs] (
  [id] BIGINT IDENTITY(1,1) PRIMARY KEY,
  [table_name] NVARCHAR(100) NOT NULL,
  [record_id] NVARCHAR(100) NOT NULL,
  [accessed_by] UNIQUEIDENTIFIER NOT NULL,
  [access_type] VARCHAR(20) NOT NULL CHECK (access_type IN ('VIEW','PRINT','EXPORT','DOWNLOAD')),
  [access_reason] NVARCHAR(255),
  [ip_address] VARCHAR(45),
  [accessed_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET())
);
GO

CREATE TABLE [notifications] (
  [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [user_id] UNIQUEIDENTIFIER NOT NULL,
  [title] NVARCHAR(255) NOT NULL,
  [type] VARCHAR(50) NOT NULL,
  [is_read] BIT NOT NULL DEFAULT (0),
  [created_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET())
);
GO

-- ----------------------------------------------------------------------------------------------------
-- 13. KHÓA NGOẠI (FOREIGN KEY CONSTRAINTS)
-- ----------------------------------------------------------------------------------------------------

ALTER TABLE [users] ADD CONSTRAINT [FK_users_role] FOREIGN KEY ([role_id]) REFERENCES [roles] ([id]);
ALTER TABLE [role_permissions] ADD CONSTRAINT [FK_role_permissions_role] FOREIGN KEY ([role_id]) REFERENCES [roles] ([id]);
ALTER TABLE [role_permissions] ADD CONSTRAINT [FK_role_permissions_perm] FOREIGN KEY ([permission_id]) REFERENCES [permissions] ([id]);
ALTER TABLE [user_facilities] ADD CONSTRAINT [FK_user_fac_user] FOREIGN KEY ([user_id]) REFERENCES [users] ([id]);
ALTER TABLE [user_facilities] ADD CONSTRAINT [FK_user_fac_facility] FOREIGN KEY ([facility_id]) REFERENCES [facilities] ([id]);
ALTER TABLE [facilities] ADD CONSTRAINT [FK_facility_address] FOREIGN KEY ([address_id]) REFERENCES [addresses] ([id]);
ALTER TABLE [departments] ADD CONSTRAINT [FK_dept_facility] FOREIGN KEY ([facility_id]) REFERENCES [facilities] ([id]);
ALTER TABLE [rooms] ADD CONSTRAINT [FK_rooms_facility] FOREIGN KEY ([facility_id]) REFERENCES [facilities] ([id]);
ALTER TABLE [rooms] ADD CONSTRAINT [FK_rooms_dept] FOREIGN KEY ([department_id]) REFERENCES [departments] ([id]);
ALTER TABLE [beds] ADD CONSTRAINT [FK_beds_room] FOREIGN KEY ([room_id]) REFERENCES [rooms] ([id]);
ALTER TABLE [facility_room_rates] ADD CONSTRAINT [FK_fac_rates_fac] FOREIGN KEY ([facility_id]) REFERENCES [facilities] ([id]);
ALTER TABLE [facility_clinical_capabilities] ADD CONSTRAINT [FK_fac_cap_fac] FOREIGN KEY ([facility_id]) REFERENCES [facilities] ([id]);
ALTER TABLE [staffing_configs] ADD CONSTRAINT [FK_staffing_facility] FOREIGN KEY ([facility_id]) REFERENCES [facilities] ([id]);
ALTER TABLE [care_level_rates] ADD CONSTRAINT [FK_clr_level] FOREIGN KEY ([care_level_id]) REFERENCES [care_levels] ([id]);
ALTER TABLE [care_level_rates] ADD CONSTRAINT [FK_clr_facility] FOREIGN KEY ([facility_id]) REFERENCES [facilities] ([id]);
ALTER TABLE [residents] ADD CONSTRAINT [FK_resident_address] FOREIGN KEY ([address_id]) REFERENCES [addresses] ([id]);
ALTER TABLE [residents] ADD CONSTRAINT [FK_resident_bed] FOREIGN KEY ([bed_id]) REFERENCES [beds] ([id]);
ALTER TABLE [resident_sensitive_info] ADD CONSTRAINT [FK_rsi_resident] FOREIGN KEY ([resident_id]) REFERENCES [residents] ([id]);
ALTER TABLE [resident_care_level_history] ADD CONSTRAINT [FK_rclh_resident] FOREIGN KEY ([resident_id]) REFERENCES [residents] ([id]);
ALTER TABLE [resident_care_level_history] ADD CONSTRAINT [FK_rclh_level] FOREIGN KEY ([care_level_id]) REFERENCES [care_levels] ([id]);
ALTER TABLE [contacts] ADD CONSTRAINT [FK_contacts_address] FOREIGN KEY ([address_id]) REFERENCES [addresses] ([id]);
ALTER TABLE [resident_contacts] ADD CONSTRAINT [FK_rc_resident] FOREIGN KEY ([resident_id]) REFERENCES [residents] ([id]);
ALTER TABLE [resident_contacts] ADD CONSTRAINT [FK_rc_contact] FOREIGN KEY ([contact_id]) REFERENCES [contacts] ([id]);
ALTER TABLE [pre_admission_screenings] ADD CONSTRAINT [FK_pas_resident] FOREIGN KEY ([resident_id]) REFERENCES [residents] ([id]);
ALTER TABLE [pre_admission_screenings] ADD CONSTRAINT [FK_pas_screener] FOREIGN KEY ([screened_by]) REFERENCES [users] ([id]);
ALTER TABLE [admissions] ADD CONSTRAINT [FK_adm_resident] FOREIGN KEY ([resident_id]) REFERENCES [residents] ([id]);
ALTER TABLE [admissions] ADD CONSTRAINT [FK_adm_facility] FOREIGN KEY ([facility_id]) REFERENCES [facilities] ([id]);
ALTER TABLE [resident_insurance_policies] ADD CONSTRAINT [FK_rip_resident] FOREIGN KEY ([resident_id]) REFERENCES [residents] ([id]);
ALTER TABLE [resident_insurance_policies] ADD CONSTRAINT [FK_rip_provider] FOREIGN KEY ([insurance_provider_id]) REFERENCES [insurance_providers] ([id]);
ALTER TABLE [clinical_records] ADD CONSTRAINT [FK_cr_resident] FOREIGN KEY ([resident_id]) REFERENCES [residents] ([id]);
ALTER TABLE [clinical_records] ADD CONSTRAINT [FK_cr_recorder] FOREIGN KEY ([recorded_by]) REFERENCES [users] ([id]);
ALTER TABLE [vital_signs] ADD CONSTRAINT [FK_vs_resident] FOREIGN KEY ([resident_id]) REFERENCES [residents] ([id]);
ALTER TABLE [vital_signs] ADD CONSTRAINT [FK_vs_recorder] FOREIGN KEY ([recorded_by]) REFERENCES [users] ([id]);
ALTER TABLE [assessments] ADD CONSTRAINT [FK_asm_resident] FOREIGN KEY ([resident_id]) REFERENCES [residents] ([id]);
ALTER TABLE [assessments] ADD CONSTRAINT [FK_asm_assessor] FOREIGN KEY ([assessed_by]) REFERENCES [users] ([id]);
ALTER TABLE [assessments] ADD CONSTRAINT [FK_asm_sug_level] FOREIGN KEY ([suggested_care_level_id]) REFERENCES [care_levels] ([id]);
ALTER TABLE [assessments] ADD CONSTRAINT [FK_asm_conf_level] FOREIGN KEY ([confirmed_care_level_id]) REFERENCES [care_levels] ([id]);
ALTER TABLE [assessment_details] ADD CONSTRAINT [FK_asd_asm] FOREIGN KEY ([assessment_id]) REFERENCES [assessments] ([id]);
ALTER TABLE [assessment_details] ADD CONSTRAINT [FK_asd_metric] FOREIGN KEY ([metric_id]) REFERENCES [assessment_metrics] ([id]);
ALTER TABLE [care_plans] ADD CONSTRAINT [FK_cp_resident] FOREIGN KEY ([resident_id]) REFERENCES [residents] ([id]);
ALTER TABLE [care_plans] ADD CONSTRAINT [FK_cp_creator] FOREIGN KEY ([created_by]) REFERENCES [users] ([id]);
ALTER TABLE [care_goals] ADD CONSTRAINT [FK_cg_careplan] FOREIGN KEY ([care_plan_id]) REFERENCES [care_plans] ([id]);
ALTER TABLE [care_interventions] ADD CONSTRAINT [FK_ci_careplan] FOREIGN KEY ([care_plan_id]) REFERENCES [care_plans] ([id]);
ALTER TABLE [care_tasks] ADD CONSTRAINT [FK_ct_intervention] FOREIGN KEY ([care_intervention_id]) REFERENCES [care_interventions] ([id]);
ALTER TABLE [care_tasks] ADD CONSTRAINT [FK_ct_assignee] FOREIGN KEY ([assigned_cna_id]) REFERENCES [users] ([id]);
ALTER TABLE [care_plan_reviews] ADD CONSTRAINT [FK_cpr_careplan] FOREIGN KEY ([care_plan_id]) REFERENCES [care_plans] ([id]);
ALTER TABLE [care_plan_reviews] ADD CONSTRAINT [FK_cpr_reviewer] FOREIGN KEY ([reviewer_id]) REFERENCES [users] ([id]);
ALTER TABLE [care_plan_signatures] ADD CONSTRAINT [FK_cps_careplan] FOREIGN KEY ([care_plan_id]) REFERENCES [care_plans] ([id]);
ALTER TABLE [care_plan_signatures] ADD CONSTRAINT [FK_cps_signer] FOREIGN KEY ([signer_id]) REFERENCES [users] ([id]);
ALTER TABLE [idt_acknowledgments] ADD CONSTRAINT [FK_idt_careplan] FOREIGN KEY ([care_plan_id]) REFERENCES [care_plans] ([id]);
ALTER TABLE [idt_acknowledgments] ADD CONSTRAINT [FK_idt_user] FOREIGN KEY ([user_id]) REFERENCES [users] ([id]);
ALTER TABLE [medication_orders] ADD CONSTRAINT [FK_mo_resident] FOREIGN KEY ([resident_id]) REFERENCES [residents] ([id]);
ALTER TABLE [medication_orders] ADD CONSTRAINT [FK_mo_prescriber] FOREIGN KEY ([prescribed_by]) REFERENCES [users] ([id]);
ALTER TABLE [medication_schedules] ADD CONSTRAINT [FK_ms_order] FOREIGN KEY ([order_id]) REFERENCES [medication_orders] ([id]);
ALTER TABLE [medication_logs] ADD CONSTRAINT [FK_ml_order] FOREIGN KEY ([order_id]) REFERENCES [medication_orders] ([id]);
ALTER TABLE [medication_logs] ADD CONSTRAINT [FK_ml_admin] FOREIGN KEY ([administered_by]) REFERENCES [users] ([id]);
ALTER TABLE [medication_logs] ADD CONSTRAINT [FK_ml_witness] FOREIGN KEY ([witnessed_by]) REFERENCES [users] ([id]);
ALTER TABLE [sla_configs] ADD CONSTRAINT [FK_sla_severity] FOREIGN KEY ([severity_id]) REFERENCES [incident_severities] ([id]);
ALTER TABLE [incidents] ADD CONSTRAINT [FK_inc_resident] FOREIGN KEY ([resident_id]) REFERENCES [residents] ([id]);
ALTER TABLE [incidents] ADD CONSTRAINT [FK_inc_severity] FOREIGN KEY ([severity_id]) REFERENCES [incident_severities] ([id]);
ALTER TABLE [incidents] ADD CONSTRAINT [FK_inc_reporter] FOREIGN KEY ([reported_by]) REFERENCES [users] ([id]);
ALTER TABLE [chart_lock_events] ADD CONSTRAINT [FK_cle_incident] FOREIGN KEY ([incident_id]) REFERENCES [incidents] ([id]);
ALTER TABLE [chart_lock_events] ADD CONSTRAINT [FK_cle_unlocked_by] FOREIGN KEY ([unlocked_by]) REFERENCES [users] ([id]);
ALTER TABLE [incident_timelines] ADD CONSTRAINT [FK_it_incident] FOREIGN KEY ([incident_id]) REFERENCES [incidents] ([id]);
ALTER TABLE [invoices] ADD CONSTRAINT [FK_inv_resident] FOREIGN KEY ([resident_id]) REFERENCES [residents] ([id]);
ALTER TABLE [invoice_line_items] ADD CONSTRAINT [FK_ili_invoice] FOREIGN KEY ([invoice_id]) REFERENCES [invoices] ([id]);
ALTER TABLE [payments] ADD CONSTRAINT [FK_pay_invoice] FOREIGN KEY ([invoice_id]) REFERENCES [invoices] ([id]);
ALTER TABLE [payments] ADD CONSTRAINT [FK_pay_receiver] FOREIGN KEY ([received_by]) REFERENCES [users] ([id]);
ALTER TABLE [shifts] ADD CONSTRAINT [FK_shifts_facility] FOREIGN KEY ([facility_id]) REFERENCES [facilities] ([id]);
ALTER TABLE [shift_assignments] ADD CONSTRAINT [FK_sa_shift] FOREIGN KEY ([shift_id]) REFERENCES [shifts] ([id]);
ALTER TABLE [shift_assignments] ADD CONSTRAINT [FK_sa_user] FOREIGN KEY ([user_id]) REFERENCES [users] ([id]);
ALTER TABLE [durable_medical_equipment] ADD CONSTRAINT [FK_dme_cat] FOREIGN KEY ([category_id]) REFERENCES [inventory_categories] ([id]);
ALTER TABLE [consumable_supplies] ADD CONSTRAINT [FK_cs_cat] FOREIGN KEY ([category_id]) REFERENCES [inventory_categories] ([id]);
ALTER TABLE [audit_logs] ADD CONSTRAINT [FK_audit_user] FOREIGN KEY ([performed_by]) REFERENCES [users] ([id]);
ALTER TABLE [phi_access_logs] ADD CONSTRAINT [FK_phi_user] FOREIGN KEY ([accessed_by]) REFERENCES [users] ([id]);
ALTER TABLE [notifications] ADD CONSTRAINT [FK_notif_user] FOREIGN KEY ([user_id]) REFERENCES [users] ([id]);
GO

-- ----------------------------------------------------------------------------------------------------
-- 14. CHỈ MỤC TỐI ƯU HÓA HIỆU NĂNG TRUY VẤN (INDEXES)
-- ----------------------------------------------------------------------------------------------------

CREATE INDEX [idx_users_role_id] ON [users] ([role_id]);
CREATE INDEX [idx_users_status] ON [users] ([status]);
CREATE INDEX [idx_residents_status] ON [residents] ([status]);
CREATE INDEX [idx_residents_bed_id] ON [residents] ([bed_id]);
CREATE INDEX [idx_residents_dob] ON [residents] ([date_of_birth]);
CREATE INDEX [idx_residents_name] ON [residents] ([last_name], [first_name]);
CREATE INDEX [idx_vital_signs_resident_date] ON [vital_signs] ([resident_id], [recorded_at] DESC);
CREATE INDEX [idx_medication_logs_order_date] ON [medication_logs] ([order_id], [logged_at] DESC);
CREATE INDEX [idx_invoices_resident_id] ON [invoices] ([resident_id]);
CREATE INDEX [idx_care_tasks_assigned_cna] ON [care_tasks] ([assigned_cna_id], [scheduled_time]);
CREATE INDEX [idx_incidents_resident_status] ON [incidents] ([resident_id], [status]);
GO

-- ----------------------------------------------------------------------------------------------------
-- 15. PHÂN HỆ TRỢ LÝ Y TẾ THÔNG MINH (AI CLINICAL COPILOT & CDSS)
-- ----------------------------------------------------------------------------------------------------

CREATE TABLE [ai_clinical_alerts] (
  [id] BIGINT IDENTITY(1,1) PRIMARY KEY,
  [resident_id] BIGINT NOT NULL,
  [triggered_by_user_id] UNIQUEIDENTIFIER,
  [alert_type] VARCHAR(50) NOT NULL CHECK (alert_type IN ('DRUG_INTERACTION','ALLERGY_WARNING','SEPSIS_NEWS2','BHYT_AUDIT','ICD_SUGGESTION','DOSAGE_WARNING')),
  [severity] VARCHAR(20) NOT NULL CHECK (severity IN ('INFO','WARNING','CRITICAL','FATAL')),
  [title] NVARCHAR(255) NOT NULL,
  [message_content] NVARCHAR(MAX) NOT NULL,
  [source_evidence] NVARCHAR(500), -- VD: Dược thư Quốc gia Việt Nam, Quyết định BYT
  [doctor_action] VARCHAR(20) NOT NULL CHECK (doctor_action IN ('PENDING','ACCEPTED','OVERRIDDEN','DISMISSED')) DEFAULT 'PENDING',
  [override_reason] NVARCHAR(500),
  [created_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET())
);
GO

CREATE TABLE [ai_chat_conversations] (
  [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [user_id] UNIQUEIDENTIFIER NOT NULL,
  [session_title] NVARCHAR(255) NOT NULL,
  [context_type] VARCHAR(50) NOT NULL CHECK (context_type IN ('GENERAL_QUERY','RESIDENT_EMR','PRESCRIPTION_AUDIT','BHYT_CHECK','PATIENT_EDUCATION')) DEFAULT 'GENERAL_QUERY',
  [created_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET())
);
GO

CREATE TABLE [ai_chat_messages] (
  [id] BIGINT IDENTITY(1,1) PRIMARY KEY,
  [conversation_id] UNIQUEIDENTIFIER NOT NULL,
  [sender_role] VARCHAR(20) NOT NULL CHECK (sender_role IN ('USER','ASSISTANT','SYSTEM')),
  [content] NVARCHAR(MAX) NOT NULL,
  [tokens_used] INT DEFAULT (0),
  [referenced_documents] NVARCHAR(MAX),
  [created_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET())
);
GO

CREATE TABLE [ai_news2_logs] (
  [id] BIGINT IDENTITY(1,1) PRIMARY KEY,
  [resident_id] BIGINT NOT NULL,
  [vital_sign_id] BIGINT,
  [total_score] INT NOT NULL,
  [risk_level] VARCHAR(20) NOT NULL CHECK (risk_level IN ('LOW','MEDIUM','HIGH')),
  [sepsis_risk_flag] BIT NOT NULL DEFAULT (0),
  [clinical_recommendation] NVARCHAR(MAX) NOT NULL,
  [evaluated_at] DATETIMEOFFSET(0) NOT NULL DEFAULT (SYSDATETIMEOFFSET())
);
GO

-- Ràng buộc khóa ngoại Module 15
ALTER TABLE [ai_clinical_alerts] ADD CONSTRAINT [FK_ai_alert_resident] FOREIGN KEY ([resident_id]) REFERENCES [residents] ([id]);
ALTER TABLE [ai_clinical_alerts] ADD CONSTRAINT [FK_ai_alert_user] FOREIGN KEY ([triggered_by_user_id]) REFERENCES [users] ([id]);
ALTER TABLE [ai_chat_conversations] ADD CONSTRAINT [FK_ai_conv_user] FOREIGN KEY ([user_id]) REFERENCES [users] ([id]);
ALTER TABLE [ai_chat_messages] ADD CONSTRAINT [FK_ai_msg_conv] FOREIGN KEY ([conversation_id]) REFERENCES [ai_chat_conversations] ([id]) ON DELETE CASCADE;
ALTER TABLE [ai_news2_logs] ADD CONSTRAINT [FK_ai_news2_resident] FOREIGN KEY ([resident_id]) REFERENCES [residents] ([id]);
ALTER TABLE [ai_news2_logs] ADD CONSTRAINT [FK_ai_news2_vital] FOREIGN KEY ([vital_sign_id]) REFERENCES [vital_signs] ([id]);
GO

-- Chỉ mục cho Module 15
CREATE INDEX [idx_ai_alerts_resident] ON [ai_clinical_alerts] ([resident_id], [created_at] DESC);
CREATE INDEX [idx_ai_alerts_severity] ON [ai_clinical_alerts] ([severity]);
CREATE INDEX [idx_ai_messages_conv] ON [ai_chat_messages] ([conversation_id], [created_at] ASC);
CREATE INDEX [idx_ai_news2_resident] ON [ai_news2_logs] ([resident_id], [evaluated_at] DESC);
GO

