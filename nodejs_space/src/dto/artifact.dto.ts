
import { IsString, IsOptional, IsInt, IsObject, IsIn } from 'class-validator';

export class CreateArtifactDto {
  @IsInt()
  goalId: number;

  @IsString()
  @IsIn(['code', 'url', 'file', 'screenshot', 'document', 'deployment', 'other'])
  artifactType: string;

  @IsString()
  artifactName: string;

  @IsOptional()
  @IsString()
  artifactDescription?: string;

  @IsOptional()
  @IsString()
  artifactPath?: string;

  @IsOptional()
  @IsString()
  artifactData?: string;

  @IsOptional()
  @IsInt()
  fileSize?: number;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsString()
  createdBy?: string;
}

export class ArtifactResponseDto {
  id: number;
  goalId: number;
  artifactType: string;
  artifactName: string;
  artifactDescription?: string;
  artifactPath?: string;
  artifactData?: string;
  fileSize?: number;
  mimeType?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  createdBy: string;
}
