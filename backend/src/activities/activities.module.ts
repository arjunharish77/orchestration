import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { CustomFieldsModule } from '../custom-fields/custom-fields.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';

@Module({
  imports: [PrismaModule, AuditModule, AccessModule, CustomFieldsModule],
  controllers: [ActivitiesController],
  providers: [ActivitiesService]
})
export class ActivitiesModule {}
