import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AccessService } from '../access/access.service';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/auth.guard';
import { RunAssignmentDto, UpsertAssignmentRuleDto } from './assignment.dto';
import { AssignmentService } from './assignment.service';

type AuthenticatedRequest = {
  user: AuthenticatedUser;
};

@Controller('assignment-engine')
export class AssignmentController {
  constructor(
    private readonly assignmentService: AssignmentService,
    private readonly accessService: AccessService
  ) {}

  @Post('run')
  @UseGuards(JwtAuthGuard)
  async run(@Req() request: AuthenticatedRequest, @Body() body: RunAssignmentDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Assignment', 'edit');
    return this.assignmentService.run(body, request.user.id);
  }

  @Post('preview')
  @UseGuards(JwtAuthGuard)
  async preview(@Req() request: AuthenticatedRequest, @Body() body: RunAssignmentDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Assignment', 'view');
    return this.assignmentService.preview(body);
  }

  @Get('metadata')
  @UseGuards(JwtAuthGuard)
  async metadata(@Req() request: AuthenticatedRequest) {
    await this.accessService.assertModulePermission(request.user.id, 'Assignment', 'view');
    return this.assignmentService.metadata();
  }

  @Get('runs')
  @UseGuards(JwtAuthGuard)
  async runs(@Req() request: AuthenticatedRequest, @Query('leadId') leadId?: string) {
    await this.accessService.assertModulePermission(request.user.id, 'Assignment', 'view');
    return this.assignmentService.listRuns(leadId);
  }

  @Get('rules')
  @UseGuards(JwtAuthGuard)
  async rules(@Req() request: AuthenticatedRequest) {
    await this.accessService.assertModulePermission(request.user.id, 'Assignment', 'view');
    return this.assignmentService.listRules();
  }

  @Post('rules')
  @UseGuards(JwtAuthGuard)
  async createRule(@Req() request: AuthenticatedRequest, @Body() body: UpsertAssignmentRuleDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Assignment', 'edit');
    return this.assignmentService.createRule(body, request.user.id);
  }

  @Patch('rules/:id')
  @UseGuards(JwtAuthGuard)
  async updateRule(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: UpsertAssignmentRuleDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Assignment', 'edit');
    return this.assignmentService.updateRule(id, body, request.user.id);
  }

  @Delete('rules/:id')
  @UseGuards(JwtAuthGuard)
  async deleteRule(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.accessService.assertModulePermission(request.user.id, 'Assignment', 'delete');
    return this.assignmentService.deleteRule(id, request.user.id);
  }
}
