import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class DemoDataService {
    private readonly logger = new Logger(DemoDataService.name);

    constructor(private readonly prisma: PrismaService) {}

    /**
     * Helper to identify if a record is sample/demo data.
     * All sample records will have "sample" or similar pattern.
     * For Residents, we will use a specific flag or pattern.
     */
    private readonly SAMPLE_PREFIX = "Sample ";

    async getStatus() {
        const residentCount = await this.prisma.residents.count({
            where: { first_name: { startsWith: this.SAMPLE_PREFIX } },
        });

        const carePlanCount = await this.prisma.care_plans.count({
            where: { residents: { first_name: { startsWith: this.SAMPLE_PREFIX } } },
        });

        const incidentCount = await this.prisma.incidents.count({
            where: { description: { startsWith: "[Demo]" } },
        });

        const medicationCount = await this.prisma.medication_orders.count({
            where: { residents: { first_name: { startsWith: this.SAMPLE_PREFIX } } },
        });

        // Check if any sample data exists
        const hasData = residentCount > 0 || carePlanCount > 0 || incidentCount > 0 || medicationCount > 0;

        // Get last seeded timestamp (using last created resident as proxy)
        const lastResident = await this.prisma.residents.findFirst({
            where: { first_name: { startsWith: this.SAMPLE_PREFIX } },
            orderBy: { created_at: "desc" },
            select: { created_at: true },
        });

        return {
            seeded: hasData,
            status: hasData ? "COMPLETED" : "NOT_SEEDED",
            lastSeededAt: lastResident?.created_at ? lastResident.created_at.toISOString() : null,
            recordCounts: {
                residents: residentCount,
                carePlans: carePlanCount,
                incidents: incidentCount,
                medications: medicationCount,
            },
        };
    }

    async seedAll(userId: string) {
        const status = await this.getStatus();
        if (status.seeded) {
            return { success: false, message: "Demo data already exists" };
        }

        try {
            await this.prisma.$transaction(async (tx) => {
                // 1. Ensure a default Facility exists
                let facility = await tx.facility.findFirst();
                if (!facility) {
                    facility = await tx.facility.create({
                        data: {
                            facilityCode: "FAC001",
                            name: "Default Care Facility",
                            licenseNumber: "LIC123456",
                            targetState: "TX",
                        },
                    });
                }

                // Link current user to facility if not done
                const userFacility = await tx.userFacility.findFirst({
                    where: { userId, facilityId: facility.id },
                });
                if (!userFacility) {
                    await tx.userFacility.create({
                        data: {
                            userId,
                            facilityId: facility.id,
                            isPrimary: true,
                        },
                    });
                }

                // 2. Ensure rooms and beds exist
                let beds = await tx.beds.findMany({
                    where: { rooms: { facility_id: facility.id } },
                });

                if (beds.length < 20) {
                    // Create 10 rooms, 2 beds each
                    for (let r = 1; r <= 10; r++) {
                        const roomNumber = `R-${100 + r}`;
                        let room = await tx.rooms.findFirst({
                            where: { facility_id: facility.id, room_number: roomNumber },
                        });
                        if (!room) {
                            room = await tx.rooms.create({
                                data: {
                                    facility_id: facility.id,
                                    room_number: roomNumber,
                                    room_type: "Semi-Private",
                                },
                            });
                        }

                        for (const bedNumber of ["A", "B"]) {
                            const existingBed = await tx.beds.findFirst({
                                where: { room_id: room.id, bed_number: bedNumber },
                            });
                            if (!existingBed) {
                                await tx.beds.create({
                                    data: {
                                        room_id: room.id,
                                        bed_number: bedNumber,
                                        status: "AVAILABLE",
                                    },
                                });
                            }
                        }
                    }
                    // Fetch created beds
                    beds = await tx.beds.findMany({
                        where: { rooms: { facility_id: facility.id } },
                    });
                }

                // 3. Create 20 sample Vietnamese Hospital Patients & Admissions
                const vietnamesePatients = [
                    { lastName: "Nguyễn", firstName: "Văn An", birthYear: 1958, gender: "MALE" },
                    { lastName: "Trần", firstName: "Thị Mai", birthYear: 1964, gender: "FEMALE" },
                    { lastName: "Lê", firstName: "Hoàng Dũng", birthYear: 1952, gender: "MALE" },
                    { lastName: "Phạm", firstName: "Thị Hương", birthYear: 1970, gender: "FEMALE" },
                    { lastName: "Hoàng", firstName: "Văn Nam", birthYear: 1961, gender: "MALE" },
                    { lastName: "Vũ", firstName: "Thị Lan", birthYear: 1948, gender: "FEMALE" },
                    { lastName: "Đỗ", firstName: "Quốc Tuấn", birthYear: 1975, gender: "MALE" },
                    { lastName: "Bùi", firstName: "Bích Ngọc", birthYear: 1982, gender: "FEMALE" },
                    { lastName: "Đặng", firstName: "Thanh Tùng", birthYear: 1959, gender: "MALE" },
                    { lastName: "Ngô", firstName: "Hồng Hạnh", birthYear: 1968, gender: "FEMALE" },
                    { lastName: "Dương", firstName: "Minh Khôi", birthYear: 1990, gender: "MALE" },
                    { lastName: "Lý", firstName: "Thu Trang", birthYear: 1985, gender: "FEMALE" },
                    { lastName: "Mai", firstName: "Đức Thắng", birthYear: 1955, gender: "MALE" },
                    { lastName: "Đinh", firstName: "Phương Linh", birthYear: 1993, gender: "FEMALE" },
                    { lastName: "Lương", firstName: "Hữu Phước", birthYear: 1947, gender: "MALE" },
                    { lastName: "Trịnh", firstName: "Khánh Vy", birthYear: 1998, gender: "FEMALE" },
                    { lastName: "Hồ", firstName: "Thế Vinh", birthYear: 1963, gender: "MALE" },
                    { lastName: "Phan", firstName: "Cẩm Tú", birthYear: 1979, gender: "FEMALE" },
                    { lastName: "Võ", firstName: "Gia Huy", birthYear: 1988, gender: "MALE" },
                    { lastName: "Chu", firstName: "Ánh Tuyết", birthYear: 1950, gender: "FEMALE" },
                ];

                const residentsData = vietnamesePatients.map((p, idx) => ({
                    first_name: `${this.SAMPLE_PREFIX}${p.firstName}`,
                    last_name: p.lastName,
                    date_of_birth: new Date(p.birthYear, idx % 12, (idx % 28) + 1),
                    gender: p.gender,
                    status: "ACTIVE",
                    bed_id: beds[idx % beds.length].id,
                }));

                const createdResidents: Array<{ id: string; first_name: string }> = [];
                for (const res of residentsData) {
                    const resident = await tx.residents.create({
                        data: {
                            first_name: res.first_name,
                            last_name: res.last_name,
                            date_of_birth: res.date_of_birth,
                            gender: res.gender,
                            status: res.status,
                            bed_id: res.bed_id,
                            admissions: {
                                create: {
                                    facility_id: facility.id,
                                    admission_date: new Date(),
                                },
                            },
                        },
                    });
                    createdResidents.push(resident);
                }

                // 4. Create 15 Care Plans for Hospital Inpatients
                const goalsList = [
                    "Kiểm soát huyết áp mục tiêu < 130/80 mmHg",
                    "Ổn định đường huyết lúc đói < 7.0 mmol/L",
                    "Phục hồi vận động khớp gối và đi lại an toàn sau phẫu thuật",
                    "Chăm sóc vô khuẩn vết mổ ngoại khoa, tránh nhiễm trùng bệnh viện",
                    "Duy trì chỉ số SpO2 >= 96% khi thở khí phòng",
                ];
                const interventionsList = [
                    "Đo chỉ số sinh tồn và huyết áp 2 lần/ngày (08:00 và 16:00)",
                    "Thực hiện tiêm truyền tĩnh mạch theo y lệnh của bác sĩ điều trị",
                    "Chế độ dinh dưỡng bệnh lý giảm muối, hạn chế đường đơn",
                    "Tập vật lý trị liệu phục hồi chức năng 30 phút mỗi ngày",
                    "Xoay trở tư thế người bệnh mỗi 2 giờ, theo dõi loét tì đè",
                ];

                for (let i = 0; i < 15; i++) {
                    const resident = createdResidents[i];
                    await tx.care_plans.create({
                        data: {
                            resident_id: resident.id,
                            created_by: userId,
                            status: i % 2 === 0 ? "Approved" : "Draft",
                            significant_change_flag: false,
                            care_goals: {
                                create: [{ description: goalsList[i % goalsList.length], status: "IN_PROGRESS" }],
                            },
                            care_interventions: {
                                create: [{ description: interventionsList[i % interventionsList.length], assigned_role: "Nurse (RN/LPN)" }],
                            },
                        },
                    });
                }

                // 5. Ensure Incident Severities exist
                const severities = ["LOW", "MEDIUM", "HIGH"];
                const severityIds: Record<string, bigint> = {};
                for (const sev of severities) {
                    let severity = await tx.incident_severities.findFirst({
                        where: { level_name: sev },
                    });
                    if (!severity) {
                        severity = await tx.incident_severities.create({
                            data: {
                                level_name: sev,
                                chart_lock_trigger: sev === "HIGH",
                            },
                        });
                    }
                    severityIds[sev] = severity.id;
                }

                // 6. Create 8 Hospital Incidents
                const incidentTypes = ["FALL", "MEDICATION_ERROR", "BEHAVIORAL", "WOUND_ISSUE"];
                const incidentDescriptions = [
                    "Bệnh nhân trượt ngã nhẹ khi di chuyển từ giường sang xe lăn, đã kiểm tra sinh hiệu ổn định.",
                    "Chậm giờ cấp phát thuốc cữ sáng do bệnh nhân đang chụp CT Scanner, đã bổ sung cữ sau đó.",
                    "Phát hiện mẩn ngứa nhẹ sau khi tiêm kháng sinh đường tĩnh mạch, đã dừng truyền và hội chẩn bác sĩ.",
                    "Xước da nhẹ vùng cẳng tay do cọ xát thành giường, điều dưỡng đã vệ sinh sát khuẩn băng gạc.",
                ];

                for (let i = 0; i < 8; i++) {
                    const resident = createdResidents[i % createdResidents.length];
                    const severityName = i % 3 === 2 ? "HIGH" : i % 3 === 1 ? "MEDIUM" : "LOW";

                    await tx.incidents.create({
                        data: {
                            incident_type: incidentTypes[i % incidentTypes.length],
                            description: `[Demo] ${incidentDescriptions[i % incidentDescriptions.length]} (${resident.first_name})`,
                            resident_id: resident.id,
                            reported_by: userId,
                            severity_id: severityIds[severityName],
                            sla_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h deadline
                            status: "OPEN",
                        },
                    });
                }

                // 7. Create 40 Hospital Inpatient Medication Orders
                const drugs = [
                    { name: "Paracetamol 500mg viên sủi", dose: "500 mg", route: "PO (Uống)", freq: "Uống 1 viên khi sốt > 38.5°C" },
                    { name: "Augmentin 1g (Amoxicillin/Clavulanic)", dose: "1000 mg", route: "PO (Uống)", freq: "Uống 1 viên x 2 lần/ngày sau ăn" },
                    { name: "Amlodipine 5mg", dose: "5 mg", route: "PO (Uống)", freq: "Uống 1 viên buổi sáng lúc 08:00" },
                    { name: "Ceftriaxone 1g tiêm tĩnh mạch", dose: "1000 mg", route: "IV (Tiêm TM)", freq: "Tiêm tĩnh mạch chậm 1 lần/ngày lúc 08:00" },
                    { name: "Omeprazole 20mg", dose: "20 mg", route: "PO (Uống)", freq: "Uống 1 viên trước ăn sáng 30 phút" },
                    { name: "Metformin 500mg", dose: "500 mg", route: "PO (Uống)", freq: "Uống 1 viên x 2 lần/ngày cùng bữa ăn" },
                    { name: "Atorvastatin 20mg", dose: "20 mg", route: "PO (Uống)", freq: "Uống 1 viên buổi tối trước khi đi ngủ" },
                    { name: "Furosemide 40mg", dose: "40 mg", route: "PO (Uống)", freq: "Uống 1 viên buổi sáng" },
                    { name: "Berberin 100mg", dose: "100 mg", route: "PO (Uống)", freq: "Uống 2 viên x 2 lần/ngày khi đau bụng" },
                    { name: "NaCl 0.9% 500ml dịch truyền", dose: "500 ml", route: "IV (Truyền TM)", freq: "Truyền tĩnh mạch 30 giọt/phút" },
                ];

                for (let i = 0; i < 40; i++) {
                    const resident = createdResidents[i % createdResidents.length];
                    const selectedDrug = drugs[i % drugs.length];
                    await tx.medication_orders.create({
                        data: {
                            resident_id: resident.id,
                            prescribed_by: userId,
                            drug_name: selectedDrug.name,
                            dosage: selectedDrug.dose,
                            route: selectedDrug.route,
                            frequency: selectedDrug.freq,
                            status: "ACTIVE",
                        },
                    });
                }
            });

            const stats = await this.getStatus();
            return {
                success: true,
                message: "Demo data seeded successfully",
                data: {
                    usersCreated: 0,
                    residentsCreated: stats.recordCounts.residents,
                    staffCreated: 0,
                    incidentsCreated: stats.recordCounts.incidents,
                    seededAt: stats.lastSeededAt,
                },
            };
        } catch (error: any) {
            this.logger.error("Failed to seed demo data: " + error.message, error.stack);
            throw error;
        }
    }

    async loadDataset(dataset: string, userId: string) {
        // Determine target entity
        // In NestJS we can also support load individual dataset if needed
        // However, since they have dependencies (Care plans -> Residents, etc.),
        // we should seed them sequentially or collectively.
        // For simplicity, we can load individual or just route it to seedAll.
        if (dataset === "residents") {
            // Just seed everything as they are related
            return this.seedAll(userId);
        }
        return this.seedAll(userId);
    }

    async clearAll() {
        try {
            await this.prisma.$transaction(async (tx) => {
                // Clear related child entities first to avoid FK constraints

                // 1. Delete incident relation entities
                await tx.chart_lock_events.deleteMany({
                    where: { incidents: { description: { startsWith: "[Demo]" } } },
                });
                await tx.incidents.deleteMany({
                    where: { description: { startsWith: "[Demo]" } },
                });

                // 2. Delete medication relation entities
                await tx.medication_logs.deleteMany({
                    where: { medication_orders: { residents: { first_name: { startsWith: this.SAMPLE_PREFIX } } } },
                });
                await tx.medication_schedules.deleteMany({
                    where: { medication_orders: { residents: { first_name: { startsWith: this.SAMPLE_PREFIX } } } },
                });
                await tx.medication_orders.deleteMany({
                    where: { residents: { first_name: { startsWith: this.SAMPLE_PREFIX } } },
                });

                // 3. Delete Care Plan relation entities
                await tx.care_tasks.deleteMany({
                    where: { care_interventions: { care_plans: { residents: { first_name: { startsWith: this.SAMPLE_PREFIX } } } } },
                });
                await tx.care_interventions.deleteMany({
                    where: { care_plans: { residents: { first_name: { startsWith: this.SAMPLE_PREFIX } } } },
                });
                await tx.care_goals.deleteMany({
                    where: { care_plans: { residents: { first_name: { startsWith: this.SAMPLE_PREFIX } } } },
                });
                await tx.care_plan_reviews.deleteMany({
                    where: { care_plans: { residents: { first_name: { startsWith: this.SAMPLE_PREFIX } } } },
                });
                await tx.care_plan_signatures.deleteMany({
                    where: { care_plans: { residents: { first_name: { startsWith: this.SAMPLE_PREFIX } } } },
                });
                await tx.idt_acknowledgments.deleteMany({
                    where: { care_plans: { residents: { first_name: { startsWith: this.SAMPLE_PREFIX } } } },
                });
                await tx.care_plans.deleteMany({
                    where: { residents: { first_name: { startsWith: this.SAMPLE_PREFIX } } },
                });

                // 4. Delete Admissions and Residents
                await tx.admissions.deleteMany({
                    where: { residents: { first_name: { startsWith: this.SAMPLE_PREFIX } } },
                });
                await tx.clinical_records.deleteMany({
                    where: { residents: { first_name: { startsWith: this.SAMPLE_PREFIX } } },
                });
                await tx.vital_signs.deleteMany({
                    where: { residents: { first_name: { startsWith: this.SAMPLE_PREFIX } } },
                });
                await tx.resident_care_level_history.deleteMany({
                    where: { residents: { first_name: { startsWith: this.SAMPLE_PREFIX } } },
                });
                await tx.resident_contacts.deleteMany({
                    where: { residents: { first_name: { startsWith: this.SAMPLE_PREFIX } } },
                });
                await tx.resident_insurance_policies.deleteMany({
                    where: { residents: { first_name: { startsWith: this.SAMPLE_PREFIX } } },
                });
                await tx.resident_sensitive_info.deleteMany({
                    where: { residents: { first_name: { startsWith: this.SAMPLE_PREFIX } } },
                });
                await tx.pre_admission_screenings.deleteMany({
                    where: { residents: { first_name: { startsWith: this.SAMPLE_PREFIX } } },
                });

                // Remove residents
                await tx.residents.deleteMany({
                    where: { first_name: { startsWith: this.SAMPLE_PREFIX } },
                });
            });

            return { success: true, message: "Demo data cleared successfully" };
        } catch (error: any) {
            this.logger.error("Failed to clear demo data: " + error.message, error.stack);
            throw error;
        }
    }

    async clearDataset(_dataset: string) {
        // If clearing specific, we will route to clearAll since they are linked.
        return this.clearAll();
    }
}
