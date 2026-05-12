import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AccessService } from '../access/access.service';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/auth.guard';
import { CreateWorkflowDto, RunWorkflowDto, SaveWorkflowDefinitionDto, UpdateWorkflowDto, UpsertAutomationEdgeDto, UpsertAutomationNodeDto } from './automation.dto';
import { AutomationService } from './automation.service';

type AuthenticatedRequest = {
  user: AuthenticatedUser;
};

@Controller('automation')
export class AutomationController {
  constructor(
    private readonly automationService: AutomationService,
    private readonly accessService: AccessService
  ) {}

  @Get('overview')
  @UseGuards(JwtAuthGuard)
  async overview(@Req() request: AuthenticatedRequest) {
    await this.accessService.assertModulePermission(request.user.id, 'Automation', 'view');
    return this.automationService.overview();
  }

  @Get('workflows')
  @UseGuards(JwtAuthGuard)
  async listWorkflows(@Req() request: AuthenticatedRequest) {
    await this.accessService.assertModulePermission(request.user.id, 'Automation', 'view');
    return this.automationService.listWorkflows();
  }

  @Post('workflows')
  @UseGuards(JwtAuthGuard)
  async createWorkflow(@Req() request: AuthenticatedRequest, @Body() body: CreateWorkflowDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Automation', 'configureAutomation');
    return this.automationService.createWorkflow(body, request.user.id);
  }

  @Get('workflows/:id')
  @UseGuards(JwtAuthGuard)
  async getWorkflow(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.accessService.assertModulePermission(request.user.id, 'Automation', 'view');
    return this.automationService.getWorkflow(id);
  }

  @Patch('workflows/:id')
  @UseGuards(JwtAuthGuard)
  async updateWorkflow(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: UpdateWorkflowDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Automation', 'configureAutomation');
    return this.automationService.updateWorkflow(id, body);
  }

  @Post('workflows/:id/definition')
  @UseGuards(JwtAuthGuard)
  async saveDefinition(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: SaveWorkflowDefinitionDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Automation', 'configureAutomation');
    return this.automationService.saveDefinition(id, body, request.user.id, request.user.role);
  }

  @Post('workflows/:id/nodes')
  @UseGuards(JwtAuthGuard)
  async upsertNode(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: UpsertAutomationNodeDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Automation', 'configureAutomation');
    return this.automationService.upsertNode(id, body, request.user.id, request.user.role);
  }

  @Post('workflows/:id/nodes/:nodeId/clone')
  @UseGuards(JwtAuthGuard)
  async cloneNode(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Param('nodeId') nodeId: string) {
    await this.accessService.assertModulePermission(request.user.id, 'Automation', 'configureAutomation');
    return this.automationService.cloneNode(id, nodeId);
  }

  @Delete('workflows/:id/nodes/:nodeId')
  @UseGuards(JwtAuthGuard)
  async deleteNode(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Param('nodeId') nodeId: string) {
    await this.accessService.assertModulePermission(request.user.id, 'Automation', 'configureAutomation');
    return this.automationService.deleteNode(id, nodeId);
  }

  @Post('workflows/:id/edges')
  @UseGuards(JwtAuthGuard)
  async upsertEdge(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: UpsertAutomationEdgeDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Automation', 'configureAutomation');
    return this.automationService.upsertEdge(id, body);
  }

  @Delete('workflows/:id/edges/:edgeId')
  @UseGuards(JwtAuthGuard)
  async deleteEdge(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Param('edgeId') edgeId: string) {
    await this.accessService.assertModulePermission(request.user.id, 'Automation', 'configureAutomation');
    return this.automationService.deleteEdge(id, edgeId);
  }

  @Post('workflows/:id/run')
  @UseGuards(JwtAuthGuard)
  async runWorkflow(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: RunWorkflowDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Automation', 'configureAutomation');
    return this.automationService.runWorkflow(id, body, request.user.id, request.user.role);
  }

  @Post('workflows/:id/enqueue')
  @UseGuards(JwtAuthGuard)
  async enqueueWorkflowRun(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: RunWorkflowDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Automation', 'configureAutomation');
    return this.automationService.enqueueWorkflowRun(id, body, request.user.id, request.user.role);
  }

  @Get('runs/:id')
  @UseGuards(JwtAuthGuard)
  async getRun(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.accessService.assertModulePermission(request.user.id, 'Automation', 'view');
    return this.automationService.getRun(id, request.user.role);
  }

  @Post('runs/:id/retry-failed')
  @UseGuards(JwtAuthGuard)
  async retryFailedRun(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.accessService.assertModulePermission(request.user.id, 'Automation', 'configureAutomation');
    return this.automationService.retryFailedRun(id, request.user.id, request.user.role);
  }

  @Get('scheduled-jobs')
  @UseGuards(JwtAuthGuard)
  async listScheduledJobs(@Req() request: AuthenticatedRequest) {
    await this.accessService.assertModulePermission(request.user.id, 'Automation', 'view');
    return this.automationService.listScheduledJobs();
  }
}
