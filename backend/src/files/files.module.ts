import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { PrismaModule } from '../prisma/prisma.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

@Module({
  imports: [PrismaModule, AccessModule],
  controllers: [FilesController],
  providers: [FilesService]
})
export class FilesModule {}
