import { IsArray, IsBoolean, IsNumber, IsOptional, IsString } from "class-validator";

export class ExtractEmrDto {
    @IsString()
    inputSpeechOrText!: string;

    @IsOptional()
    @IsNumber()
    residentId?: number;
}

export class CheckPrescriptionDto {
    @IsOptional()
    @IsNumber()
    residentId?: number;

    @IsArray()
    medications!: Array<{
        name: string;
        dosage?: string;
        frequency?: string;
        route?: string;
    }>;

    @IsOptional()
    @IsArray()
    allergies?: string[];

    @IsOptional()
    @IsArray()
    existingConditions?: string[];
}

export class CalculateNews2Dto {
    @IsOptional()
    @IsNumber()
    residentId?: number;

    @IsNumber()
    respiratoryRate!: number; // Nhịp thở (lần/phút)

    @IsNumber()
    spO2!: number; // Độ bão hòa oxy máu (%)

    @IsBoolean()
    onOxygen!: boolean; // Đang thở Oxy hỗ trợ

    @IsNumber()
    systolicBP!: number; // Huyết áp tâm thu (mmHg)

    @IsNumber()
    pulseRate!: number; // Nhịp tim (lần/phút)

    @IsString()
    consciousness!: "ALERT" | "VOICE" | "PAIN" | "UNRESPONSIVE"; // Ý thức AVPU

    @IsNumber()
    temperatureCelsius!: number; // Thân nhiệt độ C
}

export class AuditBhytDto {
    @IsOptional()
    @IsNumber()
    residentId?: number;

    @IsString()
    primaryDiagnosisIcd10!: string;

    @IsOptional()
    @IsArray()
    secondaryDiagnosesIcd10?: string[];

    @IsArray()
    medications!: string[];

    @IsArray()
    labProcedures!: string[];

    @IsOptional()
    @IsArray()
    surgicalProcedures?: string[];
}

export class ExplainForPatientDto {
    @IsString()
    medicalNotes!: string;

    @IsOptional()
    @IsString()
    labResultsSummary?: string;

    @IsOptional()
    @IsString()
    targetAudience?: "PATIENT" | "FAMILY";
}

export class AiChatDto {
    @IsString()
    message!: string;

    @IsOptional()
    @IsString()
    conversationId?: string;

    @IsOptional()
    @IsString()
    contextType?: string;

    @IsOptional()
    @IsNumber()
    residentId?: number;
}

export class SaveEmrDto {
    @IsOptional()
    @IsString()
    residentId?: string;

    @IsString()
    chiefComplaint!: string;

    @IsString()
    clinicalNote!: string;

    @IsOptional()
    @IsArray()
    suggestedIcd10?: any[];

    @IsOptional()
    @IsArray()
    suggestedOrders?: any[];

    @IsOptional()
    @IsArray()
    suggestedMedications?: any[];
}
