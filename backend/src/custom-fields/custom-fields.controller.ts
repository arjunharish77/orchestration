import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AccessService } from '../access/access.service';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/auth.guard';
import { CreateCustomFieldDefinitionDto, UpdateCustomFieldDefinitionDto, UpsertCustomFieldValuesDto } from './custom-fields.dto';
import { CustomFieldsService } from './custom-fields.service';

type AuthenticatedRequest = {
  user: AuthenticatedUser;
};

@Controller('custom-fields')
export class CustomFieldsController {
  constructor(
    private readonly customFieldsService: CustomFieldsService,
    private readonly accessService: AccessService
  ) {}

  @Get('definitions')
  @UseGuards(JwtAuthGuard)
  async listDefinitions(@Req() request: AuthenticatedRequest, @Query('moduleName') moduleName?: string, @Query('activityTypeCode') activityTypeCode?: string) {
    if (moduleName) await this.accessService.assertModulePermission(request.user.id, moduleName, 'view');
    return this.customFieldsService.listDefinitions(moduleName, request.user.id, activityTypeCode);
  }

  @Post('definitions')
  @UseGuards(JwtAuthGuard)
  async createDefinition(@Req() request: AuthenticatedRequest, @Body() body: CreateCustomFieldDefinitionDto) {
    await this.accessService.assertModulePermission(request.user.id, body.moduleName, 'edit');
    return this.customFieldsService.createDefinition(body, request.user.id);
  }

  @Patch('definitions/:moduleName/:id')
  @UseGuards(JwtAuthGuard)
  async updateDefinition(@Req() request: AuthenticatedRequest, @Param('moduleName') moduleName: string, @Param('id') id: string, @Body() body: UpdateCustomFieldDefinitionDto) {
    await this.accessService.assertModulePermission(request.user.id, moduleName, 'edit');
    return this.customFieldsService.updateDefinition(moduleName, id, body, request.user.id);
  }

  @Get('definitions/:moduleName/:id/impact')
  @UseGuards(JwtAuthGuard)
  async definitionImpact(@Req() request: AuthenticatedRequest, @Param('moduleName') moduleName: string, @Param('id') id: string) {
    await this.accessService.assertModulePermission(request.user.id, moduleName, 'view');
    return this.customFieldsService.definitionImpact(moduleName, id);
  }

  @Get('values/:moduleName/:entityId')
  @UseGuards(JwtAuthGuard)
  async listValues(@Req() request: AuthenticatedRequest, @Param('moduleName') moduleName: string, @Param('entityId') entityId: string) {
    await this.accessService.assertModulePermission(request.user.id, moduleName, 'view');
    return this.customFieldsService.listValues(moduleName, entityId, request.user.id);
  }

  @Put('values/:moduleName/:entityId')
  @UseGuards(JwtAuthGuard)
  async upsertValues(@Req() request: AuthenticatedRequest, @Param('moduleName') moduleName: string, @Param('entityId') entityId: string, @Body() body: UpsertCustomFieldValuesDto) {
    await this.accessService.assertEditableFields(request.user.id, moduleName, Object.keys(body.values ?? {}));
    return this.customFieldsService.upsertValues(moduleName, entityId, body);
  }
}
