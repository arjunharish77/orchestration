import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TelephonyConnectorController, TelephonyController } from './telephony.controller';
import { TelephonyService } from './telephony.service';

@Module({
  imports: [PrismaModule, AccessModule, AuditModule, AuthModule],
  controllers: [TelephonyController, TelephonyConnectorController],
  providers: [TelephonyService]
})
export class TelephonyModule {}
