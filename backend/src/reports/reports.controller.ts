import { Body, Controller, Delete, Get, Header, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AccessService } from '../access/access.service';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/auth.guard';
import { CreateReportExportDto, SaveReportDto, ScheduleReportDto } from './reports.dto';
import { ReportsService } from './reports.service';

type AuthenticatedRequest = {
  user: AuthenticatedUser;
};

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly accessService: AccessService
  ) {}

  @Get('overview')
  @UseGuards(JwtAuthGuard)
  async overview(
    @Req() request: AuthenticatedRequest,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('teamId') teamId?: string,
    @Query('ownerId') ownerId?: string,
    @Query('salesGroupId') salesGroupId?: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('disposition') disposition?: string,
    @Query('connector') connector?: string
  ) {
    await this.accessService.assertModulePermission(request.user.id, 'Report', 'view');
    return this.reportsService.overview(request.user.id, { dateFrom, dateTo, teamId, ownerId, salesGroupId, status, category, disposition, connector });
  }

  @Get('export.csv')
  @UseGuards(JwtAuthGuard)
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="unnatify-report.csv"')
  async exportCsv(@Req() request: AuthenticatedRequest, @Query('type') type = 'lead-summary') {
    await this.accessService.assertModulePermission(request.user.id, 'Report', 'export');
    return this.reportsService.exportCsv(request.user.id, type);
  }

  @Post('exports')
  @UseGuards(JwtAuthGuard)
  async createExport(@Req() request: AuthenticatedRequest, @Body() body: CreateReportExportDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Report', 'export');
    return this.reportsService.createExport(request.user.id, body);
  }

  @Get('exports')
  @UseGuards(JwtAuthGuard)
  async exportHistory(@Req() request: AuthenticatedRequest) {
    await this.accessService.assertModulePermission(request.user.id, 'Report', 'view');
    return this.reportsService.exportHistory(request.user.id);
  }

  @Get('saved')
  @UseGuards(JwtAuthGuard)
  async savedReports(@Req() request: AuthenticatedRequest) {
    await this.accessService.assertModulePermission(request.user.id, 'Report', 'view');
    return this.reportsService.savedReports(request.user.id);
  }

  @Post('saved')
  @UseGuards(JwtAuthGuard)
  async createSavedReport(@Req() request: AuthenticatedRequest, @Body() body: SaveReportDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Report', 'create');
    return this.reportsService.createSavedReport(request.user.id, body);
  }

  @Put('saved/:id')
  @UseGuards(JwtAuthGuard)
  async updateSavedReport(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: SaveReportDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Report', 'edit');
    return this.reportsService.updateSavedReport(request.user.id, id, body);
  }

  @Delete('saved/:id')
  @UseGuards(JwtAuthGuard)
  async deleteSavedReport(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.accessService.assertModulePermission(request.user.id, 'Report', 'delete');
    return this.reportsService.deleteSavedReport(request.user.id, id);
  }

  @Get('schedules')
  @UseGuards(JwtAuthGuard)
  async scheduledReports(@Req() request: AuthenticatedRequest) {
    await this.accessService.assertModulePermission(request.user.id, 'Report', 'view');
    return this.reportsService.scheduledReports(request.user.id);
  }

  @Post('schedules')
  @UseGuards(JwtAuthGuard)
  async createScheduledReport(@Req() request: AuthenticatedRequest, @Body() body: ScheduleReportDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Report', 'create');
    return this.reportsService.createScheduledReport(request.user.id, body);
  }

  @Put('schedules/:id')
  @UseGuards(JwtAuthGuard)
  async updateScheduledReport(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: ScheduleReportDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Report', 'edit');
    return this.reportsService.updateScheduledReport(request.user.id, id, body);
  }

  @Delete('schedules/:id')
  @UseGuards(JwtAuthGuard)
  async deleteScheduledReport(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.accessService.assertModulePermission(request.user.id, 'Report', 'delete');
    return this.reportsService.deleteScheduledReport(request.user.id, id);
  }

  @Get('drilldown')
  @UseGuards(JwtAuthGuard)
  async drilldown(
    @Req() request: AuthenticatedRequest,
    @Query('metric') metric = 'totalLeads',
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('teamId') teamId?: string,
    @Query('ownerId') ownerId?: string,
    @Query('salesGroupId') salesGroupId?: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('disposition') disposition?: string,
    @Query('connector') connector?: string
  ) {
    await this.accessService.assertModulePermission(request.user.id, 'Report', 'view');
    return this.reportsService.drilldown(request.user.id, metric, { dateFrom, dateTo, teamId, ownerId, salesGroupId, status, category, disposition, connector });
  }
}
