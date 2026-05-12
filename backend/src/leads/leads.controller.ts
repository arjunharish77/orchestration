import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AccessService } from '../access/access.service';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/auth.guard';
import { AssignLeadDto, BulkAssignLeadDto, BulkUpdateLeadDto, CreateLeadDto, ListLeadsQueryDto, SaveLeadViewDto, UpdateDispositionDto, UpdateLeadDto } from './leads.dto';
import { LeadsService } from './leads.service';

type AuthenticatedRequest = {
  user: AuthenticatedUser;
};

@Controller('leads')
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly accessService: AccessService
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@Req() request: AuthenticatedRequest, @Query() query: ListLeadsQueryDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Lead', 'view');
    return this.leadsService.list(query, request.user.id);
  }

  @Get('summary')
  @UseGuards(JwtAuthGuard)
  async summary(@Req() request: AuthenticatedRequest) {
    await this.accessService.assertModulePermission(request.user.id, 'Lead', 'view');
    return this.leadsService.summary(request.user.id);
  }

  @Get('export.csv')
  @UseGuards(JwtAuthGuard)
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="leads-export.csv"')
  async exportCsv(@Req() request: AuthenticatedRequest, @Query() query: ListLeadsQueryDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Lead', 'export');
    return this.leadsService.exportCsv(request.user.id, query);
  }

  @Get('saved-views')
  @UseGuards(JwtAuthGuard)
  async savedViews(@Req() request: AuthenticatedRequest) {
    await this.accessService.assertModulePermission(request.user.id, 'Lead', 'view');
    return this.leadsService.savedViews(request.user.id);
  }

  @Post('saved-views')
  @UseGuards(JwtAuthGuard)
  async createSavedView(@Req() request: AuthenticatedRequest, @Body() body: SaveLeadViewDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Lead', 'view');
    return this.leadsService.createSavedView(request.user.id, body);
  }

  @Put('saved-views/:id')
  @UseGuards(JwtAuthGuard)
  async updateSavedView(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: SaveLeadViewDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Lead', 'view');
    return this.leadsService.updateSavedView(request.user.id, id, body);
  }

  @Delete('saved-views/:id')
  @UseGuards(JwtAuthGuard)
  async deleteSavedView(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.accessService.assertModulePermission(request.user.id, 'Lead', 'view');
    return this.leadsService.deleteSavedView(request.user.id, id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.accessService.assertModulePermission(request.user.id, 'Lead', 'view');
    return this.leadsService.get(id, request.user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Req() request: AuthenticatedRequest, @Body() body: CreateLeadDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Lead', 'create');
    await this.accessService.assertEditableFields(request.user.id, 'Lead', writableFieldKeys(body));
    await this.accessService.assertMandatoryFields('Lead', body, { teamId: body.teamId, context: 'create' });
    return this.leadsService.create(body, request.user.id);
  }

  @Post('bulk-assign')
  @UseGuards(JwtAuthGuard)
  async bulkAssign(@Req() request: AuthenticatedRequest, @Body() body: BulkAssignLeadDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Lead', 'assign');
    return this.leadsService.bulkAssign(body, request.user.id);
  }

  @Post('bulk-update')
  @UseGuards(JwtAuthGuard)
  async bulkUpdate(@Req() request: AuthenticatedRequest, @Body() body: BulkUpdateLeadDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Lead', 'edit');
    await this.accessService.assertEditableFields(request.user.id, 'Lead', writableFieldKeys(body.patch ?? {}));
    return this.leadsService.bulkUpdate(body, request.user.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: UpdateLeadDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Lead', 'edit');
    await this.accessService.assertEditableFields(request.user.id, 'Lead', writableFieldKeys(body));
    return this.leadsService.update(id, body, request.user.id);
  }

  @Post(':id/disposition')
  @UseGuards(JwtAuthGuard)
  async updateDisposition(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: UpdateDispositionDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Lead', 'edit');
    await this.accessService.assertEditableFields(request.user.id, 'Lead', writableFieldKeys(body));
    return this.leadsService.updateDisposition(id, body, request.user.id);
  }

  @Post(':id/assign')
  @UseGuards(JwtAuthGuard)
  async assign(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: AssignLeadDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Lead', 'assign');
    return this.leadsService.assign(id, body, request.user.id);
  }
}

function writableFieldKeys(body: object) {
  return Object.entries(body)
    .filter(([, value]) => value !== undefined)
    .flatMap(([key, value]) => {
      if ((key === 'customFields' || key === 'extraFields') && value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.keys(value as Record<string, unknown>);
      }
      return key === 'customFields' || key === 'extraFields' ? [] : [key];
    });
}
