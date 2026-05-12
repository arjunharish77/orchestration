import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ConnectorsController } from './connectors.controller';
import { ConnectorsService } from './connectors.service';

@Module({
  imports: [PrismaModule, AccessModule, AuditModule],
  controllers: [ConnectorsController],
  providers: [ConnectorsService],
  exports: [ConnectorsService]
})
export class ConnectorsModule {}
