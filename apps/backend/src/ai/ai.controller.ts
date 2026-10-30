import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import {
    AuditBhytDto,
    CalculateNews2Dto,
    CheckPrescriptionDto,
    ExplainForPatientDto,
    ExtractEmrDto,
    AiChatDto,
    SaveEmrDto,
} from "./ai.dto.js";
import { AiService } from "./ai.service.js";

@Controller(["api/ai", "ai"])
export class AiController {
    constructor(private readonly aiService: AiService) {}

    @Get("saved-emr/:residentId")
    async getSavedEmrByResident(@Param("residentId") residentId: string) {
        return this.aiService.getSavedEmrByResident(residentId);
    }

    @Get("saved-emr")
    async getRecentSavedEmr() {
        return this.aiService.getRecentSavedEmr();
    }

    @Post("extract-emr")
    async extractEmr(@Body() dto: ExtractEmrDto) {
        return this.aiService.extractEmr(dto);
    }

    @Post("save-emr")
    async saveEmr(@Body() dto: SaveEmrDto) {
        return this.aiService.saveEmr(dto);
    }

    @Post("check-prescription")
    async checkPrescription(@Body() dto: CheckPrescriptionDto) {
        return this.aiService.checkPrescriptionSafety(dto);
    }

    @Post("calculate-news2")
    async calculateNews2(@Body() dto: CalculateNews2Dto) {
        return this.aiService.calculateNews2(dto);
    }

    @Post("audit-bhyt")
    async auditBhyt(@Body() dto: AuditBhytDto) {
        return this.aiService.auditBhyt(dto);
    }

    @Post("explain-for-patient")
    async explainForPatient(@Body() dto: ExplainForPatientDto) {
        return this.aiService.explainForPatient(dto);
    }

    @Post("chat")
    async chat(@Body() dto: AiChatDto) {
        return this.aiService.chatWithCopilot(dto);
    }
}
