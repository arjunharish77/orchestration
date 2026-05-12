import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { IsArray, IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { AccessService, ModuleAction } from '../access/access.service';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/auth.guard';
import { SettingsService, TaskListKey } from './settings.service';

type MandatoryRuleModuleName = 'Lead' | 'User' | 'Activity';

class AccountTwoFactorDto {
  @IsBoolean()
  enabled!: boolean;
}

class UserTwoFactorDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  disabledByAdmin?: boolean;
}

class CreateMandatoryRuleDto {
  @IsIn(['Lead', 'User', 'Activity'])
  moduleName!: MandatoryRuleModuleName;

  @IsString()
  fieldKey!: string;

  @IsOptional()
  @IsString()
  roleId?: string;

  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsString()
  context?: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class UpdateMandatoryRuleDto {
  @IsOptional()
  @IsIn(['Lead', 'User', 'Activity'])
  moduleName?: MandatoryRuleModuleName;

  @IsOptional()
  @IsString()
  fieldKey?: string;

  @IsOptional()
  @IsString()
  roleId?: string;

  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsString()
  context?: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class UpdateLeadListDto {
  @IsArray()
  @IsString({ each: true })
  values!: string[];
}

class UpdateTaskListDto {
  @IsArray()
  @IsString({ each: true })
  values!: string[];
}

class CreateActivityTypeDto {
  @IsString()
  label!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  showInGlobalList?: boolean;

  @IsOptional()
  @IsBoolean()
  showInLeadDetail?: boolean;

  @IsOptional()
  @IsBoolean()
  allowManualCreate?: boolean;
}

class UpdateActivityTypeDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  showInGlobalList?: boolean;

  @IsOptional()
  @IsBoolean()
  showInLeadDetail?: boolean;

  @IsOptional()
  @IsBoolean()
  allowManualCreate?: boolean;
}

class DispositionFormFieldDto {
  @IsString()
  fieldKey!: string;

  @IsString()
  label!: string;

  @IsString()
  fieldType!: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class UpdateDispositionFormDto {
  @IsArray()
  fields!: DispositionFormFieldDto[];
}

class UpdateCsvUploadConfigDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredColumns?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  duplicateKeyFields?: string[];

  @IsOptional()
  defaultMapping?: Record<string, string>;
}

type AuthenticatedRequest = {
  user: AuthenticatedUser;
};

@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly accessService: AccessService
  ) {}

  @Get('overview')
  @UseGuards(JwtAuthGuard)
  async overview(@Req() request: AuthenticatedRequest) {
    await this.requireSettings(request.user, 'view');
    return this.settingsService.overview();
  }

  @Get('lead-lists')
  @UseGuards(JwtAuthGuard)
  leadLists() {
    return this.settingsService.leadLists();
  }

  @Put('lead-lists/:type')
  @UseGuards(JwtAuthGuard)
  async updateLeadList(@Req() request: AuthenticatedRequest, @Param('type') type: 'status' | 'category' | 'disposition', @Body() body: UpdateLeadListDto) {
    await this.requireSettings(request.user, 'edit');
    if (!['status', 'category', 'disposition'].includes(type)) throw new ForbiddenException('Invalid lead list type');
    return this.settingsService.updateLeadList(type, body.values, request.user.id);
  }

  @Get('task-lists')
  @UseGuards(JwtAuthGuard)
  taskLists() {
    return this.settingsService.taskLists();
  }

  @Put('task-lists/:type')
  @UseGuards(JwtAuthGuard)
  async updateTaskList(@Req() request: AuthenticatedRequest, @Param('type') type: TaskListKey, @Body() body: UpdateTaskListDto) {
    await this.requireSettings(request.user, 'edit');
    if (!['type', 'status'].includes(type)) throw new ForbiddenException('Invalid task list type');
    return this.settingsService.updateTaskList(type, body.values, request.user.id);
  }

  @Get('activity-types')
  @UseGuards(JwtAuthGuard)
  activityTypes() {
    return this.settingsService.activityTypes();
  }

  @Post('activity-types')
  @UseGuards(JwtAuthGuard)
  async createActivityType(@Req() request: AuthenticatedRequest, @Body() body: CreateActivityTypeDto) {
    await this.requireSettings(request.user, 'create');
    return this.settingsService.createActivityType(body, request.user.id);
  }

  @Patch('activity-types/:code')
  @UseGuards(JwtAuthGuard)
  async updateActivityType(@Req() request: AuthenticatedRequest, @Param('code') code: string, @Body() body: UpdateActivityTypeDto) {
    await this.requireSettings(request.user, 'edit');
    return this.settingsService.updateActivityType(code, body, request.user.id);
  }

  @Patch('activity-types/:code/deactivate')
  @UseGuards(JwtAuthGuard)
  async deactivateActivityType(@Req() request: AuthenticatedRequest, @Param('code') code: string) {
    await this.requireSettings(request.user, 'delete');
    return this.settingsService.deactivateActivityType(code, request.user.id);
  }

  @Get('disposition-form')
  @UseGuards(JwtAuthGuard)
  dispositionForm() {
    return this.settingsService.dispositionForm();
  }

  @Put('disposition-form')
  @UseGuards(JwtAuthGuard)
  async updateDispositionForm(@Req() request: AuthenticatedRequest, @Body() body: UpdateDispositionFormDto) {
    await this.requireSettings(request.user, 'edit');
    return this.settingsService.updateDispositionForm(body.fields, request.user.id);
  }

  @Post('disposition-form/fields')
  @UseGuards(JwtAuthGuard)
  async addDispositionFormField(@Req() request: AuthenticatedRequest, @Body() body: DispositionFormFieldDto) {
    await this.requireSettings(request.user, 'edit');
    return this.settingsService.addDispositionFormField(body, request.user.id);
  }

  @Patch('disposition-form/fields/:fieldKey/deactivate')
  @UseGuards(JwtAuthGuard)
  async deactivateDispositionFormField(@Req() request: AuthenticatedRequest, @Param('fieldKey') fieldKey: string) {
    await this.requireSettings(request.user, 'delete');
    return this.settingsService.deactivateDispositionFormField(fieldKey, request.user.id);
  }

  @Get('csv-upload-config')
  @UseGuards(JwtAuthGuard)
  async csvUploadConfig(@Req() request: AuthenticatedRequest) {
    await this.requireSettings(request.user, 'view');
    return this.settingsService.csvUploadConfig();
  }

  @Put('csv-upload-config')
  @UseGuards(JwtAuthGuard)
  async updateCsvUploadConfig(@Req() request: AuthenticatedRequest, @Body() body: UpdateCsvUploadConfigDto) {
    await this.requireSettings(request.user, 'edit');
    return this.settingsService.updateCsvUploadConfig(body, request.user.id);
  }

  @Get('security')
  @UseGuards(JwtAuthGuard)
  async securityOverview(@Req() request: AuthenticatedRequest) {
    await this.requireSettings(request.user, 'view');
    return this.settingsService.securityOverview();
  }

  @Put('security/two-factor/account')
  @UseGuards(JwtAuthGuard)
  async setAccountTwoFactor(@Req() request: AuthenticatedRequest, @Body() body: AccountTwoFactorDto) {
    await this.requireSettings(request.user, 'edit');
    return this.settingsService.setAccountTwoFactor(body.enabled, request.user.id);
  }

  @Put('security/users/:userId/two-factor')
  @UseGuards(JwtAuthGuard)
  async setUserTwoFactor(@Req() request: AuthenticatedRequest, @Param('userId') userId: string, @Body() body: UserTwoFactorDto) {
    await this.requireSettings(request.user, 'edit');
    return this.settingsService.setUserTwoFactor(userId, body, request.user.id);
  }

  @Post('mandatory-rules')
  @UseGuards(JwtAuthGuard)
  async createMandatoryRule(@Req() request: AuthenticatedRequest, @Body() body: CreateMandatoryRuleDto) {
    await this.requireSettings(request.user, 'create');
    return this.settingsService.createMandatoryRule(body, request.user.id);
  }

  @Get('mandatory-rules')
  @UseGuards(JwtAuthGuard)
  async listMandatoryRules(@Req() request: AuthenticatedRequest) {
    await this.requireSettings(request.user, 'view');
    return this.settingsService.listMandatoryRules();
  }

  @Patch('mandatory-rules/:id')
  @UseGuards(JwtAuthGuard)
  async updateMandatoryRule(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: UpdateMandatoryRuleDto) {
    await this.requireSettings(request.user, 'edit');
    return this.settingsService.updateMandatoryRule(id, body, request.user.id);
  }

  @Patch('mandatory-rules/:id/deactivate')
  @UseGuards(JwtAuthGuard)
  async deactivateMandatoryRule(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.requireSettings(request.user, 'delete');
    return this.settingsService.updateMandatoryRule(id, { isActive: false }, request.user.id);
  }

  private requireSettings(user: AuthenticatedUser, action: ModuleAction) {
    return this.accessService.assertModulePermission(user.id, 'Settings', action);
  }
}
