import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AssignmentController } from './assignment.controller';
import { AssignmentService } from './assignment.service';

@Module({
  imports: [PrismaModule, AuditModule, AccessModule],
  controllers: [AssignmentController],
  providers: [AssignmentService],
  exports: [AssignmentService]
})
export class AssignmentModule {}
