/**
 * Prisma seed script.
 * Run with:  npx prisma db seed
 * Configure in package.json:
 *   "prisma": { "seed": "ts-node prisma/seed.ts" }
 */
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;
const DEFAULT_FACILITY_CODE = "FAC-0042";

const careLevelSeed = [
  {
    levelCode: "INDEPENDENT_LIVING",
    levelName: "Cấp độ 1 - Tự chủ",
    dailyRate: 150000,
  },
  {
    levelCode: "ASSISTED_LIVING",
    levelName: "Cấp độ 2 - Hỗ trợ một phần",
    dailyRate: 250000,
  },
  {
    levelCode: "MEMORY_CARE",
    levelName: "Cấp độ 3 - Chăm sóc tích cực",
    dailyRate: 400000,
  },
  {
    levelCode: "SKILLED_NURSING",
    levelName: "Cấp độ 4 - Chăm sóc toàn diện",
    dailyRate: 600000,
  },
] as const;

const roomSeed = [
  { roomNumber: "101", roomType: "Private", bedNumber: "A", status: "AVAILABLE" },
  { roomNumber: "106", roomType: "Semi-private", bedNumber: "A", status: "OCCUPIED" },
  { roomNumber: "114", roomType: "Semi-private", bedNumber: "B", status: "OCCUPIED" },
  { roomNumber: "118", roomType: "Semi-private", bedNumber: "A", status: "OCCUPIED" },
  { roomNumber: "204", roomType: "Semi-private", bedNumber: "B", status: "OCCUPIED" },
  { roomNumber: "210", roomType: "Semi-private", bedNumber: "B", status: "OCCUPIED" },
  { roomNumber: "215", roomType: "Private", bedNumber: "A", status: "MAINTENANCE" },
  { roomNumber: "222", roomType: "Semi-private", bedNumber: "A", status: "OCCUPIED" },
] as const;

const roomRateSeed = [
  { roomType: "Private", dailyRate: 500000, effectiveFrom: "2026-01-01" },
  { roomType: "Semi-private", dailyRate: 350000, effectiveFrom: "2026-01-01" },
  { roomType: "Ward", dailyRate: 200000, effectiveFrom: "2026-01-01" },
] as const;

const clinicalCapabilitySeed = [
  { capability: "Chăm sóc vết thương / Điều trị loét tì đè", supported: true },
  { capability: "Vật lý trị liệu / Phục hồi chức năng", supported: true },
  { capability: "Sức khỏe tâm thần & Quản lý hành vi", supported: true },
  {
    capability: "Điều trị bệnh nhân béo phì nặng",
    supported: false,
    note: "Giới hạn tải trọng giường toàn viện: 150 kg (chưa trang bị giường chuyên dụng chịu tải lớn).",
  },
  { capability: "Truyền dịch IV / Quản lý phác đồ thuốc phức tạp", supported: true },
  { capability: "Thở máy & Hỗ trợ hô hấp chuyên sâu", supported: true },
  { capability: "Chăm sóc giảm nhẹ & Điều trị nâng đỡ", supported: true },
  { capability: "Cách ly kiểm soát nhiễm khuẩn (MRSA, C. diff, v.v.)", supported: true },
] as const;

function toDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

async function main() {
  const rolesData = [
    { roleName: "Admission Staff", description: "Tiếp đón bệnh nhân: sàng lọc ban đầu, tiếp nhận cấp cứu, lập hồ sơ bệnh án EMR." },
    { roleName: "Nurse (RN/LPN)", description: "Đánh giá lâm sàng, theo dõi chỉ số sinh tồn tại giường, cấp phát thuốc eMAR và thực hiện y lệnh." },
    { roleName: "CNA", description: "Hộ lý / Kỹ thuật viên: thực hiện các công việc chăm sóc thường quy và hỗ trợ người bệnh." },
    { roleName: "DON (Director of Nursing)", description: "Điều dưỡng trưởng / Trưởng phòng Kế hoạch Tổng hợp: duyệt kế hoạch chăm sóc, giám sát sự cố y khoa và quản lý buồng giường." },
    { roleName: "System Admin", description: "Quản trị hệ thống: cấu hình cơ sở y tế, định mức viện phí, tài khoản nhân viên và trang thiết bị." },
    { roleName: "Physician", description: "Bác sĩ điều trị / Hội chẩn: lập phác đồ, duyệt kế hoạch chăm sóc đa chuyên khoa và ký số bệnh án điện tử." },
    { roleName: "Dietary", description: "Chuyên gia Dinh dưỡng lâm sàng: xây dựng chế độ dinh dưỡng bệnh lý và ký xác nhận thực đơn điều trị." }
  ];

  const dbRoles: Record<string, any> = {};
  for (const r of rolesData) {
    dbRoles[r.roleName] = await prisma.role.upsert({
      where: { roleName: r.roleName },
      update: { description: r.description },
      create: r,
    });
  }

  // ── Permissions ────────────────────────────────────────────────────────────
  const modules = [
    'ADMIN_CONFIG',
    'RESIDENT_LIST',
    'PROFILE_DETAIL',
    'INITIAL_ASSESSMENT',
    'CARE_PLAN_LIST',
    'DON_REVIEW',
    'BEDSIDE_VITALS',
    'REPORT_INCIDENT',
    'INCIDENT_LIST',
    'IDT_ACKNOWLEDGMENT'
  ];

  for (const mod of modules) {
    await prisma.permission.upsert({
      where: { actionCode: `${mod}_VIEW` },
      update: {},
      create: { actionCode: `${mod}_VIEW` }
    });
    await prisma.permission.upsert({
      where: { actionCode: `${mod}_MANAGE` },
      update: {},
      create: { actionCode: `${mod}_MANAGE` }
    });
  }

  // ── Users ──────────────────────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash("Password123!", BCRYPT_ROUNDS);

  // Active admin
  await prisma.user.upsert({
    where: { email: "admin@facility.org" },
    update: {},
    create: {
      employeeCode: "EMP001",
      email: "admin@facility.org",
      passwordHash: hashedPassword,
      firstName: "John",
      lastName: "Admin",
      phoneNumber: "+15550001234",
      status: "ACTIVE",
      mfaEnabled: true,
      roleId: dbRoles["System Admin"].id,
    },
  });

  // Wuan admin
  const wuanHashedPassword = await bcrypt.hash("123123", BCRYPT_ROUNDS);
  await prisma.user.upsert({
    where: { email: "wuan1604@gmail.com" },
    update: {},
    create: {
      employeeCode: "EMP_WUAN",
      email: "wuan1604@gmail.com",
      passwordHash: wuanHashedPassword,
      firstName: "Wuan",
      lastName: "Admin",
      phoneNumber: "+15559998888",
      status: "ACTIVE",
      mfaEnabled: true,
      roleId: dbRoles["System Admin"].id,
    },
  });

  // Active nurse
  await prisma.user.upsert({
    where: { email: "j.rivera@facility.org" },
    update: {},
    create: {
      employeeCode: "EMP002",
      email: "j.rivera@facility.org",
      passwordHash: hashedPassword,
      firstName: "Julia",
      middleName: "Marie",
      lastName: "Rivera",
      phoneNumber: "+15550005678",
      status: "ACTIVE",
      mfaEnabled: true,
      roleId: dbRoles["Nurse (RN/LPN)"].id,
    },
  });

  // Active DON (Director of Nursing)
  await prisma.user.upsert({
    where: { email: "don@facility.org" },
    update: {},
    create: {
      employeeCode: "EMP_DON",
      email: "don@facility.org",
      passwordHash: hashedPassword,
      firstName: "Sarah",
      lastName: "Nguyễn",
      phoneNumber: "+84912345670",
      status: "ACTIVE",
      mfaEnabled: true,
      roleId: dbRoles["DON (Director of Nursing)"].id,
    },
  });

  // Invited (pending activation) nurse
  await prisma.user.upsert({
    where: { email: "new.nurse@facility.org" },
    update: {},
    create: {
      employeeCode: "EMP003",
      email: "new.nurse@facility.org",
      passwordHash: "",
      firstName: "New",
      lastName: "Nurse",
      status: "INACTIVE",
      mfaEnabled: false,
      licenseNumber: "ACT123", // one-time activation code
      roleId: dbRoles["Nurse (RN/LPN)"].id,
    },
  });

  const facility = await prisma.facility.upsert({
    where: { facilityCode: DEFAULT_FACILITY_CODE },
    update: {
      name: "Bệnh viện Đa khoa Quốc tế MedCare",
      licenseNumber: "BYT-BV-004821",
      targetState: "Hà Nội",
      timezone: "Asia/Ho_Chi_Minh (GMT+7)",
      phoneNumber: "+842435550142",
      isDeleted: false,
    },
    create: {
      facilityCode: DEFAULT_FACILITY_CODE,
      name: "Bệnh viện Đa khoa Quốc tế MedCare",
      licenseNumber: "BYT-BV-004821",
      targetState: "Hà Nội",
      timezone: "Asia/Ho_Chi_Minh (GMT+7)",
      phoneNumber: "+842435550142",
    },
  });

  for (const item of roomSeed) {
    const room = await prisma.rooms.upsert({
      where: {
        facility_id_room_number: {
          facility_id: facility.id,
          room_number: item.roomNumber,
        },
      },
      update: {
        room_type: item.roomType,
        is_deleted: false,
      },
      create: {
        room_number: item.roomNumber,
        room_type: item.roomType,
        facility_id: facility.id,
      },
    });

    await prisma.beds.upsert({
      where: {
        room_id_bed_number: {
          room_id: room.id,
          bed_number: item.bedNumber,
        },
      },
      update: { status: item.status },
      create: {
        bed_number: item.bedNumber,
        status: item.status,
        room_id: room.id,
      },
    });
  }

  for (const item of careLevelSeed) {
    const careLevel = await prisma.care_levels.upsert({
      where: { level_code: item.levelCode },
      update: {
        level_name: item.levelName,
        is_deleted: false,
      },
      create: {
        level_code: item.levelCode,
        level_name: item.levelName,
      },
    });

    const currentRate = await prisma.care_level_rates.findFirst({
      where: {
        care_level_id: careLevel.id,
        facility_id: facility.id,
        effective_to: null,
      },
    });

    if (currentRate) {
      await prisma.care_level_rates.update({
        where: { id: currentRate.id },
        data: {
          daily_rate: item.dailyRate,
          effective_from: toDate("2026-01-01"),
        },
      });
    } else {
      await prisma.care_level_rates.create({
        data: {
          care_level_id: careLevel.id,
          facility_id: facility.id,
          daily_rate: item.dailyRate,
          effective_from: toDate("2026-01-01"),
        },
      });
    }
  }

  for (const item of roomRateSeed) {
    await prisma.facility_room_rates.upsert({
      where: {
        facility_id_room_type: {
          facility_id: facility.id,
          room_type: item.roomType,
        },
      },
      update: {
        daily_rate: item.dailyRate,
        effective_from: toDate(item.effectiveFrom),
      },
      create: {
        facility_id: facility.id,
        room_type: item.roomType,
        daily_rate: item.dailyRate,
        effective_from: toDate(item.effectiveFrom),
      },
    });
  }

  for (const item of clinicalCapabilitySeed) {
    await prisma.facility_clinical_capabilities.upsert({
      where: {
        facility_id_capability: {
          facility_id: facility.id,
          capability: item.capability,
        },
      },
      update: {
        supported: item.supported,
        note: "note" in item ? item.note : null,
      },
      create: {
        facility_id: facility.id,
        capability: item.capability,
        supported: item.supported,
        note: "note" in item ? item.note : null,
      },
    });
  }

  const staffingConfig = await prisma.staffing_configs.findFirst({
    where: { facility_id: facility.id },
  });
  const shiftBreakdownJson = JSON.stringify([
    {
      shiftName: "Ca Sáng",
      startTime: "07:00",
      endTime: "15:00",
      requiredCnaHours: 1.5,
      requiredNurseHours: 0.9,
    },
    {
      shiftName: "Ca Chiều",
      startTime: "15:00",
      endTime: "23:00",
      requiredCnaHours: 0.7,
      requiredNurseHours: 0.5,
    },
    {
      shiftName: "Ca Đêm",
      startTime: "23:00",
      endTime: "07:00",
      requiredCnaHours: 0.5,
      requiredNurseHours: 0.3,
    },
  ]);

  if (staffingConfig) {
    await prisma.staffing_configs.update({
      where: { id: staffingConfig.id },
      data: {
        min_hrs_per_resident_day: 3.5,
        warn_below_percentage: 90,
        shift_breakdown_json: shiftBreakdownJson,
      },
    });
  } else {
    await prisma.staffing_configs.create({
      data: {
        facility_id: facility.id,
        min_hrs_per_resident_day: 3.5,
        warn_below_percentage: 90,
        shift_breakdown_json: shiftBreakdownJson,
      },
    });
  }

  console.log("[Seed] Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
