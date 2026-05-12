import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { CustomFieldsModule } from '../custom-fields/custom-fields.module';
import { PrismaModule } from '../prisma/prisma.module';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [PrismaModule, AuditModule, AccessModule, CustomFieldsModule],
  controllers: [LeadsController],
  providers: [LeadsService]
})
export class LeadsModule {}
