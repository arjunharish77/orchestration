import { IsArray, IsBoolean, IsEmail, IsIn, IsObject, IsOptional, IsString, Length, MinLength } from 'class-validator';

export class EvaluatePermissionDto {
  @IsString()
  userId!: string;

  @IsString()
  moduleName!: string;

  @IsString()
  action!: string;

  @IsOptional()
  @IsString()
  fieldKey?: string;
}

export const fieldAccessValues = ['visible', 'editable', 'hidden', 'masked'] as const;

export class UpsertFieldPermissionDto {
  @IsString()
  permissionTemplateId!: string;

  @IsString()
  moduleName!: string;

  @IsString()
  fieldKey!: string;

  @IsIn(fieldAccessValues)
  access!: (typeof fieldAccessValues)[number];
}

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  @Length(10, 10)
  phone?: string;

  @IsString()
  roleId!: string;

  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsString()
  permissionTemplateId?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  salesGroupIds?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  twoFactorEnabled?: boolean;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @Length(10, 10)
  phone?: string;

  @IsOptional()
  @IsString()
  roleId?: string;

  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsString()
  permissionTemplateId?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  salesGroupIds?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  twoFactorEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  twoFactorDisabledByAdmin?: boolean;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}

export class CreateTeamDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTeamDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateSalesGroupDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSalesGroupDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreatePermissionTemplateDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdatePermissionTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpsertModulePermissionDto {
  @IsString()
  moduleName!: string;

  @IsOptional()
  @IsBoolean()
  canView?: boolean;

  @IsOptional()
  @IsBoolean()
  canCreate?: boolean;

  @IsOptional()
  @IsBoolean()
  canEdit?: boolean;

  @IsOptional()
  @IsBoolean()
  canDelete?: boolean;

  @IsOptional()
  @IsBoolean()
  canExport?: boolean;

  @IsOptional()
  @IsBoolean()
  canAssign?: boolean;

  @IsOptional()
  @IsBoolean()
  canBulkUpload?: boolean;

  @IsOptional()
  @IsBoolean()
  canConfigureAutomation?: boolean;

  @IsOptional()
  @IsBoolean()
  canManageConnector?: boolean;

  @IsOptional()
  @IsBoolean()
  canViewAuditLogs?: boolean;
}
