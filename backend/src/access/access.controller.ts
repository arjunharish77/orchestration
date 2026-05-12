import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/auth.guard';
import {
  CreatePermissionTemplateDto,
  CreateSalesGroupDto,
  CreateTeamDto,
  CreateUserDto,
  EvaluatePermissionDto,
  UpdatePermissionTemplateDto,
  UpdateSalesGroupDto,
  UpdateTeamDto,
  UpdateUserDto,
  UpsertFieldPermissionDto,
  UpsertModulePermissionDto
} from './access.dto';
import { AccessService, ModuleAction } from './access.service';

type AuthenticatedRequest = {
  user: AuthenticatedUser;
};

@Controller('access')
export class AccessController {
  constructor(private readonly accessService: AccessService) {}

  @Get('overview')
  @UseGuards(JwtAuthGuard)
  async overview(@Req() request: AuthenticatedRequest) {
    await this.requireSettings(request.user, 'view');
    return this.accessService.overview();
  }

  @Get('users/:id/effective-permissions')
  @UseGuards(JwtAuthGuard)
  async effectivePermissions(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    if (request.user.id !== id) await this.requireSettings(request.user, 'view');
    return this.accessService.effectivePermissions(id);
  }

  @Get('roles')
  @UseGuards(JwtAuthGuard)
  async listRoles(@Req() request: AuthenticatedRequest) {
    await this.requireSettings(request.user, 'view');
    return this.accessService.listRoles();
  }

  @Get('users')
  @UseGuards(JwtAuthGuard)
  async listUsers(@Req() request: AuthenticatedRequest) {
    await this.requireUser(request.user, 'view');
    return this.accessService.listUsers(request.user.id);
  }

  @Get('users/:id')
  @UseGuards(JwtAuthGuard)
  async getUser(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.requireUser(request.user, 'view');
    return this.accessService.getUser(id, request.user.id);
  }

  @Post('users')
  @UseGuards(JwtAuthGuard)
  async createUser(@Req() request: AuthenticatedRequest, @Body() body: CreateUserDto) {
    await this.requireUser(request.user, 'create');
    return this.accessService.createUser(body, request.user.id);
  }

  @Patch('users/:id')
  @UseGuards(JwtAuthGuard)
  async updateUser(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: UpdateUserDto) {
    await this.requireUser(request.user, 'edit');
    return this.accessService.updateUser(id, body, request.user.id);
  }

  @Delete('users/:id')
  @UseGuards(JwtAuthGuard)
  async deactivateUser(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.requireUser(request.user, 'delete');
    return this.accessService.deactivateUser(id, request.user.id);
  }

  @Get('teams')
  @UseGuards(JwtAuthGuard)
  async listTeams(@Req() request: AuthenticatedRequest) {
    await this.requireSettings(request.user, 'view');
    return this.accessService.listTeams();
  }

  @Post('teams')
  @UseGuards(JwtAuthGuard)
  async createTeam(@Req() request: AuthenticatedRequest, @Body() body: CreateTeamDto) {
    await this.requireSettings(request.user, 'edit');
    return this.accessService.createTeam(body, request.user.id);
  }

  @Patch('teams/:id')
  @UseGuards(JwtAuthGuard)
  async updateTeam(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: UpdateTeamDto) {
    await this.requireSettings(request.user, 'edit');
    return this.accessService.updateTeam(id, body, request.user.id);
  }

  @Delete('teams/:id')
  @UseGuards(JwtAuthGuard)
  async deactivateTeam(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.requireSettings(request.user, 'delete');
    return this.accessService.deactivateTeam(id, request.user.id);
  }

  @Get('sales-groups')
  @UseGuards(JwtAuthGuard)
  async listSalesGroups(@Req() request: AuthenticatedRequest) {
    await this.requireSettings(request.user, 'view');
    return this.accessService.listSalesGroups();
  }

  @Post('sales-groups')
  @UseGuards(JwtAuthGuard)
  async createSalesGroup(@Req() request: AuthenticatedRequest, @Body() body: CreateSalesGroupDto) {
    await this.requireSettings(request.user, 'edit');
    return this.accessService.createSalesGroup(body, request.user.id);
  }

  @Patch('sales-groups/:id')
  @UseGuards(JwtAuthGuard)
  async updateSalesGroup(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: UpdateSalesGroupDto) {
    await this.requireSettings(request.user, 'edit');
    return this.accessService.updateSalesGroup(id, body, request.user.id);
  }

  @Delete('sales-groups/:id')
  @UseGuards(JwtAuthGuard)
  async deactivateSalesGroup(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.requireSettings(request.user, 'delete');
    return this.accessService.deactivateSalesGroup(id, request.user.id);
  }

  @Get('permission-templates')
  @UseGuards(JwtAuthGuard)
  async listPermissionTemplates(@Req() request: AuthenticatedRequest) {
    await this.requireSettings(request.user, 'view');
    return this.accessService.listPermissionTemplates();
  }

  @Get('permission-templates/:id')
  @UseGuards(JwtAuthGuard)
  async getPermissionTemplate(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.requireSettings(request.user, 'view');
    return this.accessService.getPermissionTemplate(id);
  }

  @Post('permission-templates')
  @UseGuards(JwtAuthGuard)
  async createPermissionTemplate(@Req() request: AuthenticatedRequest, @Body() body: CreatePermissionTemplateDto) {
    await this.requireSettings(request.user, 'create');
    return this.accessService.createPermissionTemplate(body, request.user.id);
  }

  @Patch('permission-templates/:id')
  @UseGuards(JwtAuthGuard)
  async updatePermissionTemplate(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: UpdatePermissionTemplateDto) {
    await this.requireSettings(request.user, 'edit');
    return this.accessService.updatePermissionTemplate(id, body, request.user.id);
  }

  @Delete('permission-templates/:id')
  @UseGuards(JwtAuthGuard)
  async deletePermissionTemplate(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.requireSettings(request.user, 'delete');
    return this.accessService.deletePermissionTemplate(id, request.user.id);
  }

  @Post('permission-templates/:id/modules')
  @UseGuards(JwtAuthGuard)
  async upsertModulePermission(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: UpsertModulePermissionDto) {
    await this.requireSettings(request.user, 'edit');
    return this.accessService.upsertModulePermission(id, body, request.user.id);
  }

  @Delete('permission-templates/:id/modules/:moduleName')
  @UseGuards(JwtAuthGuard)
  async deleteModulePermission(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Param('moduleName') moduleName: string) {
    await this.requireSettings(request.user, 'edit');
    return this.accessService.deleteModulePermission(id, moduleName, request.user.id);
  }

  @Post('evaluate')
  @UseGuards(JwtAuthGuard)
  async evaluate(@Req() request: AuthenticatedRequest, @Body() body: EvaluatePermissionDto) {
    await this.requireSettings(request.user, 'view');
    return this.accessService.evaluate(body);
  }

  @Post('field-permissions')
  @UseGuards(JwtAuthGuard)
  async upsertFieldPermission(@Req() request: AuthenticatedRequest, @Body() body: UpsertFieldPermissionDto) {
    await this.requireSettings(request.user, 'edit');
    return this.accessService.upsertFieldPermission(body, request.user.id);
  }

  private requireSettings(user: AuthenticatedUser, action: ModuleAction) {
    return this.accessService.assertModulePermission(user.id, 'Settings', action);
  }

  private requireUser(user: AuthenticatedUser, action: ModuleAction) {
    return this.accessService.assertModulePermission(user.id, 'User', action);
  }
}
