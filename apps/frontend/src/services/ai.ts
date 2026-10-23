import { apiClient } from "./apiClient";

export interface EmrExtractedResult {
    chiefComplaint: string;
    clinicalNote: string;
    suggestedIcd10: Array<{
        code: string;
        nameVi: string;
        confidence: number;
        rationale: string;
    }>;
    suggestedOrders: Array<{
        type: "LAB" | "IMAGING" | "PROCEDURE";
        name: string;
        priority: "ROUTINE" | "STAT";
    }>;
    suggestedMedications: Array<{
        drugName: string;
        dosage: string;
        route: string;
        frequency: string;
        durationDays: number;
    }>;
    generatedAt: string;
    engine?: string;
}

export interface PrescriptionSafetyResult {
    safetyStatus: "SAFE" | "WARNING" | "DANGEROUS";
    totalAlerts: number;
    alerts: Array<{
        alertType: "DRUG_INTERACTION" | "ALLERGY_WARNING" | "DOSAGE_WARNING";
        severity: "CRITICAL" | "WARNING" | "INFO";
        title: string;
        message: string;
        recommendation: string;
        source: string;
    }>;
    checkedAt: string;
}

export interface News2Result {
    totalScore: number;
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
    sepsisRiskFlag: boolean;
    sepsisWarning: string | null;
    clinicalResponse: string;
    monitoringFrequency: string;
    breakdown: Record<string, { value: any; score: number; note: string }>;
    calculatedAt: string;
}

export interface BhytAuditResult {
    isAuditPassed: boolean;
    totalFlagged: number;
    totalEstimatedLossVnd: number;
    auditStatus: string;
    flaggedItems: Array<{
        item: string;
        type: "MEDICATION" | "PROCEDURE";
        severity: "HIGH_RISK" | "MEDIUM_RISK" | "COMPLIANT";
        reason: string;
        potentialLossVnd: number;
        recommendation: string;
    }>;
    auditedAt: string;
}

export interface PatientExplanationResult {
    targetAudience: string;
    friendlySummary: string;
    keyPoints: string[];
    lifestyleRecommendations: string[];
    emergencyNotice: string;
    generatedAt: string;
}

export interface AiChatResult {
    reply: string;
    sources: string[];
    timestamp: string;
}

export const aiService = {
    async extractEmr(inputSpeechOrText: string, residentId?: number): Promise<EmrExtractedResult> {
        const res = await apiClient.post<{ success: boolean; extractedSummary: EmrExtractedResult }>(
            "/ai/extract-emr",
            {
                inputSpeechOrText,
                residentId,
            },
            { timeout: 180000 },
        );
        return res.data.extractedSummary;
    },

    async saveEmr(payload: {
        residentId?: string;
        chiefComplaint: string;
        clinicalNote: string;
        suggestedIcd10?: any[];
        suggestedOrders?: any[];
        suggestedMedications?: any[];
    }): Promise<{ success: boolean; recordId: string; message: string }> {
        const res = await apiClient.post<{ success: boolean; recordId: string; message: string }>("/ai/save-emr", payload, { timeout: 60000 });
        return res.data;
    },

    async checkPrescription(payload: {
        residentId?: number;
        medications: Array<{ name: string; dosage?: string; frequency?: string }>;
        allergies?: string[];
        existingConditions?: string[];
    }): Promise<PrescriptionSafetyResult> {
        const res = await apiClient.post<PrescriptionSafetyResult>("/ai/check-prescription", payload, { timeout: 180000 });
        return res.data;
    },

    async calculateNews2(payload: {
        residentId?: number;
        respiratoryRate: number;
        spO2: number;
        onOxygen: boolean;
        systolicBP: number;
        pulseRate: number;
        consciousness: "ALERT" | "VOICE" | "PAIN" | "UNRESPONSIVE";
        temperatureCelsius: number;
    }): Promise<News2Result> {
        const res = await apiClient.post<News2Result>("/ai/calculate-news2", payload, { timeout: 120000 });
        return res.data;
    },

    async auditBhyt(payload: {
        residentId?: number;
        primaryDiagnosisIcd10: string;
        secondaryDiagnosesIcd10?: string[];
        medications: string[];
        labProcedures: string[];
        surgicalProcedures?: string[];
    }): Promise<BhytAuditResult> {
        const res = await apiClient.post<BhytAuditResult>("/ai/audit-bhyt", payload, { timeout: 180000 });
        return res.data;
    },

    async explainForPatient(payload: {
        medicalNotes: string;
        labResultsSummary?: string;
        targetAudience?: "PATIENT" | "FAMILY";
    }): Promise<PatientExplanationResult> {
        const res = await apiClient.post<PatientExplanationResult>("/ai/explain-for-patient", payload, { timeout: 180000 });
        return res.data;
    },

    async chat(message: string, contextType?: string): Promise<AiChatResult> {
        const res = await apiClient.post<AiChatResult>("/ai/chat", { message, contextType }, { timeout: 180000 });
        return res.data;
    },
};
