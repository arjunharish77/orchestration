import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsBoolean, IsDateString, IsEmail, IsIn, IsNumberString, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

export class ListLeadsQueryDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  disposition?: string;

  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsString()
  assignedUserId?: string;

  @IsOptional()
  @IsString()
  branchCode?: string;

  @IsOptional()
  @IsString()
  createdFrom?: string;

  @IsOptional()
  @IsString()
  createdTo?: string;

  @IsOptional()
  @IsString()
  advancedFilters?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  pageSize?: string;

  @IsOptional()
  @IsIn(['customerName', 'createdAt', 'updatedAt', 'status', 'category', 'branchCode', 'offerAmount'])
  sortBy?: 'customerName' | 'createdAt' | 'updatedAt' | 'status' | 'category' | 'branchCode' | 'offerAmount';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}

export class CreateLeadDto {
  @IsString()
  customerName!: string;

  @IsString()
  mobile!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  externalLeadId?: string;

  @IsOptional()
  @IsString()
  branchCode?: string;

  @IsOptional()
  @IsString()
  branchName?: string;

  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsString()
  assignedUserId?: string;

  @IsOptional()
  @IsNumberString()
  offerAmount?: string;

  @IsOptional()
  @IsNumberString()
  emiAmount?: string;

  @IsOptional()
  @IsString()
  preferredLanguage?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsDateString()
  uploadDate?: string;

  @IsOptional()
  @IsDateString()
  offerExpiryDate?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  disposition?: string;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}

export class UpdateLeadDto {
  @IsOptional()
  @IsString()
  externalLeadId?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  branchCode?: string;

  @IsOptional()
  @IsString()
  branchName?: string;

  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsString()
  assignedUserId?: string;

  @IsOptional()
  @IsNumberString()
  offerAmount?: string;

  @IsOptional()
  @IsNumberString()
  emiAmount?: string;

  @IsOptional()
  @IsString()
  preferredLanguage?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  disposition?: string;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}

export class UpdateDispositionDto {
  @IsString()
  disposition!: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsDateString()
  callbackAt?: string;

  @IsOptional()
  extraFields?: Record<string, unknown>;
}

export class AssignLeadDto {
  @IsOptional()
  @IsString()
  assignedUserId?: string;

  @IsOptional()
  @IsString()
  assignedTeamId?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class BulkAssignLeadDto extends AssignLeadDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  leadIds!: string[];
}

export class BulkUpdateLeadDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  leadIds!: string[];

  @ValidateNested()
  @Type(() => UpdateLeadDto)
  patch!: UpdateLeadDto;
}

export class SaveLeadViewDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsObject()
  filterForm?: Record<string, unknown>;

  @IsOptional()
  @IsIn(['all', 'any'])
  advancedMatch?: 'all' | 'any';

  @IsOptional()
  @IsArray()
  advancedConditions?: Array<Record<string, unknown>>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  visibleLeadFields?: string[];

  @IsOptional()
  @IsIn(['compact'])
  density?: 'compact';
}
