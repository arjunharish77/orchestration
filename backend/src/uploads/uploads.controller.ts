import { Body, Controller, Get, Header, Param, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AccessService } from '../access/access.service';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/auth.guard';
import { UploadsService } from './uploads.service';

type AuthenticatedRequest = {
  user: AuthenticatedUser;
};

const defaultCsvMaxFileBytes = 25 * 1024 * 1024;

@Controller('uploads')
export class UploadsController {
  constructor(
    private readonly uploadsService: UploadsService,
    private readonly accessService: AccessService
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@Req() request: AuthenticatedRequest) {
    await this.accessService.assertModulePermission(request.user.id, 'Upload', 'view');
    return this.uploadsService.list(request.user.id);
  }

  @Post('csv')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: csvMaxFileBytes() } }))
  async uploadCsv(@Req() request: AuthenticatedRequest, @UploadedFile() file: { originalname?: string; buffer?: Buffer; mimetype?: string }, @Body('columnMapping') columnMapping?: string) {
    await this.accessService.assertModulePermission(request.user.id, 'Upload', 'bulkUpload');
    return this.uploadsService.enqueueCsv(file, request.user.id, columnMapping);
  }

  @Get(':id/result-csv')
  @UseGuards(JwtAuthGuard)
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="lead-upload-result.csv"')
  async resultCsv(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.accessService.assertModulePermission(request.user.id, 'Upload', 'export');
    return this.uploadsService.resultCsv(id, request.user.id);
  }

  @Get(':id/original-csv')
  @UseGuards(JwtAuthGuard)
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="lead-upload-original.csv"')
  async originalCsv(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.accessService.assertModulePermission(request.user.id, 'Upload', 'export');
    return this.uploadsService.originalCsv(id, request.user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.accessService.assertModulePermission(request.user.id, 'Upload', 'view');
    return this.uploadsService.get(id, request.user.id);
  }
}

function csvMaxFileBytes() {
  const raw = Number(process.env.CSV_MAX_FILE_BYTES ?? defaultCsvMaxFileBytes);
  return Number.isFinite(raw) && raw > 0 ? raw : defaultCsvMaxFileBytes;
}
