import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { CreateResidentDto } from "./dto/create-resident.dto.js";
import { ListResidentsQueryDto } from "./dto/list-residents-query.dto.js";
import { UpdateResidentStatusDto } from "./dto/update-resident-status.dto.js";
import { UpdateResidentDto } from "./dto/update-resident.dto.js";

@Injectable()
export class ResidentsService {
    constructor(private readonly prisma: PrismaService) {}

    private serializeResident(resident: any) {
        // Vietnamese naming order: Họ + Đệm + Tên
        const cleanFirstName = String(resident.first_name || "").replace(/^Sample\s+/i, "").trim();
        const fullName = [resident.last_name, resident.middle_name, cleanFirstName].filter(Boolean).join(" ");
        const roomNumber = resident.beds?.rooms?.room_number ?? undefined;

        // Trích xuất chẩn đoán chính, thuốc đang dùng, và ghi chú lâm sàng từ Bệnh án EMR (clinical_records)
        const latestEmr = resident.clinical_records?.find((r: any) => r.record_type === "EMR_AI_NOTE");
        let parsedEmr: any = null;
        if (latestEmr) {
            try {
                parsedEmr = JSON.parse(latestEmr.description);
            } catch {
                parsedEmr = { clinicalNote: latestEmr.description };
            }
        }

        const primaryDiagnosis = parsedEmr?.icd10?.[0]
            ? `${parsedEmr.icd10[0].code} - ${parsedEmr.icd10[0].nameVi}`
            : (parsedEmr?.chiefComplaint || undefined);

        const currentMedications = parsedEmr?.medications?.length
            ? parsedEmr.medications.map((m: any) => `${m.drugName} ${m.dosage || ""}`.trim()).join(", ")
            : (resident.medication_orders?.length
                ? resident.medication_orders.map((m: any) => `${m.drug_name} ${m.dosage || ""}`.trim()).join(", ")
                : undefined);

        const clinicalNotes = parsedEmr?.clinicalNote ?? undefined;

        const emrRecords = (resident.clinical_records || [])
            .filter((r: any) => r.record_type === "EMR_AI_NOTE")
            .map((r: any) => {
                let parsed: any = {};
                try {
                    parsed = JSON.parse(r.description);
                } catch {
                    parsed = { clinicalNote: r.description };
                }
                return {
                    id: r.id,
                    chiefComplaint: parsed.chiefComplaint || "",
                    clinicalNote: parsed.clinicalNote || "",
                    icd10: parsed.icd10 || [],
                    orders: parsed.orders || [],
                    medications: parsed.medications || [],
                    createdAt: r.created_at,
                };
            });

        return {
            id: resident.id,
            residentCode: `BN-${String(resident.id).slice(0, 8).toUpperCase()}`,
            fullName: fullName || "Bệnh nhân",
            dateOfBirth: resident.date_of_birth.toISOString().slice(0, 10),
            gender: String(resident.gender ?? "other").toLowerCase(),
            phone: undefined,
            address: undefined,
            admissionDate: resident.created_at.toISOString().slice(0, 10),
            roomNumber,
            careLevel: "assisted_living",
            status: this.toApiStatus(resident.status),
            assignedNurse: undefined,
            assignedDoctor: undefined,
            emergencyContactName: "Chưa cung cấp",
            emergencyContactRelationship: undefined,
            emergencyContactPhone: "Chưa cung cấp",
            emergencyContactEmail: undefined,
            primaryDiagnosis,
            allergies: undefined,
            currentMedications,
            clinicalNotes,
            emrRecords,
            mobilityStatus: undefined,
            isChartLocked: resident.is_chart_locked,
        };
    }

    private toDate(value: string) {
        return new Date(`${value}T00:00:00.000Z`);
    }

    private splitFullName(fullName: string) {
        const parts = fullName.trim().split(/\s+/);
        if (parts.length === 1) {
            return {
                first_name: parts[0],
                middle_name: null,
                last_name: parts[0],
            };
        }
        // Vietnamese standard naming: Họ (Last Name) is first, Tên (First Name) is last
        const lastName = parts[0];
        const firstName = parts[parts.length - 1];
        const middleName = parts.length > 2 ? parts.slice(1, -1).join(" ") : null;

        return {
            first_name: firstName,
            middle_name: middleName,
            last_name: lastName,
        };
    }

    private toApiStatus(status: string) {
        const normalized = status.toUpperCase();

        if (normalized === "ACTIVE") {
            return "admitted";
        }

        if (normalized === "DISCHARGED") {
            return "discharged";
        }

        return "pending";
    }

    private toDbStatus(status?: string) {
        if (status === "admitted") {
            return "ACTIVE";
        }

        if (status === "discharged") {
            return "DISCHARGED";
        }

        return "PENDING";
    }

    async checkChartLock(id: string) {
        const res = await this.prisma.residents.findUnique({
            where: { id },
            select: { is_chart_locked: true },
        });
        if (res?.is_chart_locked) {
            throw new ForbiddenException("Resident chart is locked. Modifications are not allowed.");
        }
    }

    async findAll(query: ListResidentsQueryDto) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 10;
        const skip = (page - 1) * limit;
        const search = query.search?.trim();

        const where: Prisma.residentsWhereInput = {
            ...(query.status && query.status !== "all" ? { status: this.toDbStatus(query.status) } : {}),
            ...(search
                ? {
                      OR: [{ first_name: { contains: search } }, { middle_name: { contains: search } }, { last_name: { contains: search } }],
                  }
                : {}),
        };

        const [residents, total] = await Promise.all([
            this.prisma.residents.findMany({
                where,
                skip,
                take: limit,
                orderBy: { created_at: "desc" },
                include: { beds: { include: { rooms: true } } },
            }),
            this.prisma.residents.count({ where }),
        ]);

        return {
            data: residents.map((resident) => this.serializeResident(resident)),
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async findOne(id: string) {
        const resident = await this.prisma.residents.findUnique({
            where: { id },
            include: {
                beds: { include: { rooms: true } },
                clinical_records: {
                    where: { is_deleted: false },
                    orderBy: { created_at: "desc" },
                },
                medication_orders: {
                    where: { is_deleted: false },
                    orderBy: { created_at: "desc" },
                },
            },
        });

        if (!resident) {
            throw new NotFoundException(`Resident with ID ${id} not found`);
        }

        return this.serializeResident(resident);
    }

    async create(dto: CreateResidentDto) {
        const resident = await this.prisma.residents.create({
            data: {
                ...this.splitFullName(dto.fullName),
                date_of_birth: this.toDate(dto.dateOfBirth),
                gender: dto.gender.toUpperCase(),
                status: "PENDING",
            },
            include: { beds: { include: { rooms: true } } },
        });

        return this.serializeResident(resident);
    }

    async update(id: string, dto: UpdateResidentDto) {
        await this.findOne(id);
        await this.checkChartLock(id);

        const data: Prisma.residentsUpdateInput = {
            ...(dto.fullName !== undefined ? this.splitFullName(dto.fullName) : {}),
            ...(dto.dateOfBirth !== undefined ? { date_of_birth: this.toDate(dto.dateOfBirth) } : {}),
            ...(dto.gender !== undefined ? { gender: dto.gender.toUpperCase() } : {}),
        };

        const resident = await this.prisma.residents.update({
            where: { id },
            data,
            include: { beds: { include: { rooms: true } } },
        });

        return this.serializeResident(resident);
    }

    async updateStatus(id: string, dto: UpdateResidentStatusDto) {
        await this.findOne(id);
        await this.checkChartLock(id);

        const resident = await this.prisma.residents.update({
            where: { id },
            data: { status: this.toDbStatus(dto.status) },
            include: { beds: { include: { rooms: true } } },
        });

        return this.serializeResident(resident);
    }
}
