import { IsBoolean, IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UploadFileDto {
  @IsOptional()
  @IsIn(['shared-document', 'temporary'])
  fileType?: 'shared-document' | 'temporary';
}

export class CleanupTemporaryFilesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  olderThanDays?: number;
}

export class ApplyRetentionDto {
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
