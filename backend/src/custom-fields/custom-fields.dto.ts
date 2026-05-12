import { Allow, IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export const customFieldModules = ['Lead', 'User', 'Activity'] as const;
export type CustomFieldModule = (typeof customFieldModules)[number];

export const customFieldTypes = ['text', 'number', 'date', 'datetime', 'select', 'multi_select', 'boolean', 'json'] as const;

export class CreateCustomFieldDefinitionDto {
  @IsIn(customFieldModules)
  moduleName!: CustomFieldModule;

  @IsOptional()
  @IsString()
  activityTypeCode?: string;

  @IsString()
  fieldKey!: string;

  @IsString()
  label!: string;

  @IsIn(customFieldTypes)
  fieldType!: (typeof customFieldTypes)[number];

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @Allow()
  defaultValue?: unknown;

  @IsOptional()
  @IsObject()
  validation?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  options?: unknown[];
}

export class UpdateCustomFieldDefinitionDto {
  @IsOptional()
  @IsString()
  activityTypeCode?: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsIn(customFieldTypes)
  fieldType?: (typeof customFieldTypes)[number];

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @Allow()
  defaultValue?: unknown;

  @IsOptional()
  @IsObject()
  validation?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  options?: unknown[];

  @IsOptional()
  @IsBoolean()
  confirmImpact?: boolean;
}

export class UpsertCustomFieldValuesDto {
  @IsObject()
  values!: Record<string, unknown>;
}
