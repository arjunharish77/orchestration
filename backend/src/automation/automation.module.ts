import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AssignmentModule } from '../assignment/assignment.module';
import { AuditModule } from '../audit/audit.module';
import { ConnectorsModule } from '../connectors/connectors.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';

@Module({
  imports: [PrismaModule, AccessModule, AuditModule, AssignmentModule, ConnectorsModule],
  controllers: [AutomationController],
  providers: [AutomationService]
})
export class AutomationModule {}
