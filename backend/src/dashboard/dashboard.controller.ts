import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AccessService } from '../access/access.service';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/auth.guard';
import { DashboardService } from './dashboard.service';

type AuthenticatedRequest = {
  user: AuthenticatedUser;
};

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly access: AccessService
  ) {}

  @Get('overview')
  @UseGuards(JwtAuthGuard)
  async overview(@Req() request: AuthenticatedRequest) {
    await this.access.assertModulePermission(request.user.id, 'Dashboard', 'view');
    return this.dashboard.overview(request.user.id);
  }
}
