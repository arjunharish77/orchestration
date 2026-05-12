import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CustomFieldsController } from './custom-fields.controller';
import { CustomFieldsService } from './custom-fields.service';

@Module({
  imports: [PrismaModule, AccessModule],
  controllers: [CustomFieldsController],
  providers: [CustomFieldsService],
  exports: [CustomFieldsService]
})
export class CustomFieldsModule {}
