import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AccessService } from '../access/access.service';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/auth.guard';
import { CreateActivityDto, UpdateActivityDto } from './activities.dto';
import { ActivitiesService } from './activities.service';

type AuthenticatedRequest = {
  user: AuthenticatedUser;
};

@Controller('activities')
export class ActivitiesController {
  constructor(
    private readonly activitiesService: ActivitiesService,
    private readonly accessService: AccessService
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@Req() request: AuthenticatedRequest, @Query('leadId') leadId?: string, @Query('type') type?: string) {
    await this.accessService.assertModulePermission(request.user.id, 'Activity', 'view');
    return this.activitiesService.list({ leadId, type }, request.user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Req() request: AuthenticatedRequest, @Body() body: CreateActivityDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Activity', 'create');
    await this.accessService.assertEditableFields(request.user.id, 'Activity', writableFieldKeys(body));
    await this.accessService.assertMandatoryFields('Activity', body, { context: 'create' });
    return this.activitiesService.create(body, request.user.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: UpdateActivityDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Activity', 'edit');
    await this.accessService.assertEditableFields(request.user.id, 'Activity', writableFieldKeys(body));
    return this.activitiesService.update(id, body, request.user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.accessService.assertModulePermission(request.user.id, 'Activity', 'delete');
    return this.activitiesService.delete(id, request.user.id);
  }
}

function writableFieldKeys(body: object) {
  return Object.entries(body)
    .filter(([, value]) => value !== undefined)
    .flatMap(([key]) => (key === 'customFields' ? [] : [key]));
}
