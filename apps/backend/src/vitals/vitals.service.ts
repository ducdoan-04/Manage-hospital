import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { CreateVitalSignDto } from "./dto/create-vital-sign.dto.js";

@Injectable()
export class VitalsService {
    constructor(private readonly prisma: PrismaService) {}

    private abnormalReasons(dto: CreateVitalSignDto): string[] {
        const reasons: string[] = [];
        if (dto.bloodPressureSystolic < 90 || dto.bloodPressureSystolic > 160 || dto.bloodPressureDiastolic < 60 || dto.bloodPressureDiastolic > 100)
            reasons.push("Huyết áp ngoài ngưỡng an toàn (<90/60 hoặc >160/100 mmHg)");
        if (dto.heartRateBpm < 50 || dto.heartRateBpm > 110) reasons.push("Nhịp tim bất thường (<50 hoặc >110 lần/phút)");
        if (dto.respiratoryRate < 10 || dto.respiratoryRate > 24) reasons.push("Nhịp thở bất thường (<10 hoặc >24 lần/phút)");
        if (dto.temperatureFahrenheit < 95 || dto.temperatureFahrenheit > 100.4) reasons.push("Thân nhiệt bất thường (sốt >38°C hoặc hạ thân nhiệt)");
        if (dto.spo2Percentage < 92) reasons.push("Độ bão hòa oxy máu SpO2 nguy hiểm (<92%)");
        if (dto.painScale >= 7) reasons.push("Thang điểm đau mức độ nặng (>= 7/10)");
        return reasons;
    }

    async create(dto: CreateVitalSignDto, userId: string) {
        const resident = await this.prisma.residents.findUnique({ where: { id: dto.residentId } });
        if (!resident || resident.is_deleted) throw new NotFoundException("Bệnh nhân không tồn tại trên hệ thống");
        if (resident.is_chart_locked) throw new BadRequestException("Hồ sơ bệnh án đang bị khóa do sự cố y khoa");
        const abnormalReasons = this.abnormalReasons(dto);
        const result = await this.prisma.$transaction(async (transaction) => {
            const vital = await transaction.vital_signs.create({
                data: {
                    resident_id: dto.residentId,
                    recorded_by: userId,
                    blood_pressure_systolic: dto.bloodPressureSystolic,
                    blood_pressure_diastolic: dto.bloodPressureDiastolic,
                    heart_rate_bpm: dto.heartRateBpm,
                    respiratory_rate: dto.respiratoryRate,
                    temperature_fahrenheit: dto.temperatureFahrenheit,
                    spo2_percentage: dto.spo2Percentage,
                    pain_scale: dto.painScale,
                    notes: dto.notes,
                },
            });
            if (dto.taskId) {
                await transaction.care_tasks.update({
                    where: { id: dto.taskId },
                    data: { status: "COMPLETED", completed_at: new Date(), is_abnormal_flagged: abnormalReasons.length > 0 },
                });
            }
            return vital;
        });
        return {
            id: result.id.toString(),
            residentId: result.resident_id,
            recordedBy: result.recorded_by,
            recordedAt: result.recorded_at.toISOString(),
            abnormal: abnormalReasons.length > 0,
            abnormalReasons,
        };
    }

    async recent(residentId: string) {
        const vitals = await this.prisma.vital_signs.findMany({
            where: { resident_id: residentId },
            include: { users: true },
            orderBy: { recorded_at: "desc" },
            take: 20,
        });
        return vitals.map((vital) => {
            const tempF = vital.temperature_fahrenheit ? Number(vital.temperature_fahrenheit) : null;
            const tempC = tempF !== null ? Number(((tempF - 32) * 5 / 9).toFixed(1)) : null;

            return {
                id: vital.id.toString(),
                residentId: vital.resident_id,
                bloodPressure: vital.blood_pressure_systolic && vital.blood_pressure_diastolic ? `${vital.blood_pressure_systolic}/${vital.blood_pressure_diastolic}` : null,
                heartRateBpm: vital.heart_rate_bpm,
                respiratoryRate: vital.respiratory_rate,
                temperatureFahrenheit: tempF,
                temperatureCelsius: tempC,
                spo2Percentage: vital.spo2_percentage,
                painScale: vital.pain_scale,
                notes: vital.notes,
                recordedAt: vital.recorded_at.toISOString(),
                recordedBy: `${vital.users.lastName} ${vital.users.firstName}`,
            };
        });
    }
}
