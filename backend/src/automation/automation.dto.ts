import { IsArray, IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateWorkflowDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateWorkflowDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class SaveWorkflowDefinitionDto {
  @IsObject()
  definition!: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}

export class UpsertAutomationNodeDto {
  @IsString()
  nodeId!: string;

  @IsString()
  nodeType!: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  position?: Record<string, unknown>;
}

export class UpsertAutomationEdgeDto {
  @IsString()
  edgeId!: string;

  @IsString()
  sourceNodeId!: string;

  @IsString()
  targetNodeId!: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsObject()
  condition?: Record<string, unknown>;
}

export class RunWorkflowDto {
  @IsOptional()
  @IsString()
  leadId?: string;

  @IsOptional()
  @IsArray()
  leadIds?: string[];

  @IsOptional()
  @IsBoolean()
  useDraft?: boolean;

  @IsOptional()
  @IsString()
  runLabel?: string;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}
