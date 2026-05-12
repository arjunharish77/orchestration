import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccessModule } from './access/access.module';
import { ActivitiesModule } from './activities/activities.module';
import { AssignmentModule } from './assignment/assignment.module';
import { AutomationModule } from './automation/automation.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { ConnectorsModule } from './connectors/connectors.module';
import { CustomFieldsModule } from './custom-fields/custom-fields.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { FilesModule } from './files/files.module';
import { HealthModule } from './health/health.module';
import { LeadsModule } from './leads/leads.module';
import { OpsModule } from './ops/ops.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { SettingsModule } from './settings/settings.module';
import { TasksModule } from './tasks/tasks.module';
import { TelephonyModule } from './telephony/telephony.module';
import { UploadsModule } from './uploads/uploads.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    PrismaModule,
    HealthModule,
    DashboardModule,
    AuthModule,
    AuditModule,
    LeadsModule,
    OpsModule,
    ActivitiesModule,
    AssignmentModule,
    TasksModule,
    UploadsModule,
    AccessModule,
    AutomationModule,
    ConnectorsModule,
    CustomFieldsModule,
    FilesModule,
    ReportsModule,
    SettingsModule,
    TelephonyModule
  ]
})
export class AppModule {}
