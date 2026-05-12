import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { assertProductionValue } from '../common/env';

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        const expiresIn = (config.get<string>('JWT_EXPIRES_IN') ?? '8h') as StringValue;
        assertProductionValue('JWT_SECRET', secret);
        if (!secret && config.get<string>('NODE_ENV') === 'production') {
          throw new Error('JWT_SECRET is required in production');
        }
        return {
          secret: secret ?? 'development-secret',
          signOptions: {
            expiresIn
          }
        };
      }
    })
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard, JwtModule]
})
export class AuthModule {}
