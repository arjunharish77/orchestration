import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AccessService } from '../access/access.service';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/auth.guard';
import { CreateTaskCommentDto, CreateTaskDto, UpdateTaskDto } from './tasks.dto';
import { TasksService } from './tasks.service';

type AuthenticatedRequest = {
  user: AuthenticatedUser;
};

@Controller('tasks')
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly accessService: AccessService
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(
    @Req() request: AuthenticatedRequest,
    @Query('leadId') leadId?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('search') search?: string,
    @Query('dueAfter') dueAfter?: string,
    @Query('dueBefore') dueBefore?: string,
    @Query('pageSize') pageSize?: string
  ) {
    await this.accessService.assertModulePermission(request.user.id, 'Task', 'view');
    return this.tasksService.list({
      leadId,
      assignedTo,
      status,
      priority,
      search,
      dueAfter,
      dueBefore,
      pageSize
    }, request.user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Req() request: AuthenticatedRequest, @Body() body: CreateTaskDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Task', 'create');
    return this.tasksService.create(body, request.user.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: UpdateTaskDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Task', 'edit');
    return this.tasksService.update(id, body, request.user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.accessService.assertModulePermission(request.user.id, 'Task', 'delete');
    return this.tasksService.delete(id, request.user.id);
  }

  @Post(':id/comments')
  @UseGuards(JwtAuthGuard)
  async addComment(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: CreateTaskCommentDto) {
    await this.accessService.assertModulePermission(request.user.id, 'Task', 'edit');
    return this.tasksService.addComment(id, body, request.user.id);
  }
}
