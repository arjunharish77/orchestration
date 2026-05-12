import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { OpsController } from './ops.controller';
import { OpsGuard } from './ops.guard';

@Module({
  imports: [ConfigModule, JwtModule.register({}), PrismaModule],
  controllers: [OpsController],
  providers: [OpsGuard]
})
export class OpsModule {}
