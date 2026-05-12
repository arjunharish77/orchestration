import { Body, Controller, Get, Param, Post, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AccessService } from '../access/access.service';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/auth.guard';
import { ApplyRetentionDto, CleanupTemporaryFilesDto, UploadFileDto } from './files.dto';
import { FilesService } from './files.service';

type AuthenticatedRequest = {
  user: AuthenticatedUser;
};

@Controller('files')
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly accessService: AccessService
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@Req() request: AuthenticatedRequest) {
    await this.accessService.assertModulePermission(request.user.id, 'Report', 'view');
    return this.filesService.list(request.user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async upload(@Req() request: AuthenticatedRequest, @UploadedFile() file: { originalname?: string; buffer?: Buffer }, @Body() body: UploadFileDto) {
    return this.filesService.upload(file, body.fileType ?? 'shared-document', request.user.id);
  }

  @Post('cleanup-temporary')
  @UseGuards(JwtAuthGuard)
  async cleanupTemporary(@Req() request: AuthenticatedRequest, @Body() body: CleanupTemporaryFilesDto) {
    return this.filesService.cleanupTemporaryFiles(request.user.id, body.olderThanDays ?? 7);
  }

  @Get('retention-policy')
  @UseGuards(JwtAuthGuard)
  async retentionPolicy(@Req() request: AuthenticatedRequest) {
    return this.filesService.retentionPolicy(request.user.id);
  }

  @Post('apply-retention')
  @UseGuards(JwtAuthGuard)
  async applyRetention(@Req() request: AuthenticatedRequest, @Body() body: ApplyRetentionDto) {
    return this.filesService.applyRetention(request.user.id, body.dryRun ?? true);
  }

  @Get(':id/download')
  @UseGuards(JwtAuthGuard)
  async download(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Res({ passthrough: true }) response: { setHeader(name: string, value: string): void }) {
    const file = await this.filesService.download(id, request.user.id);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', `attachment; filename="${safeDownloadName(file.fileName)}"`);
    return file.buffer;
  }
}

function safeDownloadName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}
