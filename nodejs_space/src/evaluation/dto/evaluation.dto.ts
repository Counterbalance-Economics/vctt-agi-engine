
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsObject, IsOptional, Min, Max } from 'class-validator';

export class CreateEvaluationDto {
  @ApiProperty({ description: 'Conversation or task ID being evaluated' })
  @IsString()
  @IsNotEmpty()
  contextId: string;

  @ApiProperty({ description: 'Type of evaluation', example: 'CONVERSATION_QUALITY' })
  @IsString()
  @IsNotEmpty()
  evaluationType: string;

  @ApiProperty({ description: 'Score from 0-100' })
  @IsNumber()
  @Min(0)
  @Max(100)
  score: number;

  @ApiProperty({ description: 'Evaluation criteria and details', type: 'object' })
  @IsObject()
  criteria: Record<string, any>;

  @ApiProperty({ description: 'Human feedback or notes', required: false })
  @IsString()
  @IsOptional()
  humanFeedback?: string;

  @ApiProperty({ description: 'Metadata about the evaluation', required: false })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class CreateCoachProposalDto {
  @ApiProperty({ description: 'Related evaluation ID' })
  @IsString()
  @IsNotEmpty()
  evaluationId: string;

  @ApiProperty({ description: 'Improvement area identified', example: 'CODE_QUALITY' })
  @IsString()
  @IsNotEmpty()
  improvementArea: string;

  @ApiProperty({ description: 'Proposed change or improvement' })
  @IsString()
  @IsNotEmpty()
  proposal: string;

  @ApiProperty({ description: 'Justification for the proposal' })
  @IsString()
  @IsNotEmpty()
  justification: string;

  @ApiProperty({ description: 'Estimated impact (0-100)', required: false })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  estimatedImpact?: number;

  @ApiProperty({ description: 'Priority level', required: false, default: 'MEDIUM' })
  @IsString()
  @IsOptional()
  priority?: string;
}

export class ApproveProposalDto {
  @ApiProperty({ description: 'Proposal ID to approve' })
  @IsString()
  @IsNotEmpty()
  proposalId: string;

  @ApiProperty({ description: 'Approval decision', enum: ['APPROVED', 'REJECTED', 'NEEDS_REVISION'] })
  @IsString()
  @IsNotEmpty()
  decision: string;

  @ApiProperty({ description: 'Human feedback on the decision', required: false })
  @IsString()
  @IsOptional()
  feedback?: string;
}
