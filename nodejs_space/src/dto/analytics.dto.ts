

import { IsOptional, IsString, IsDateString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum ExportFormat {
  JSON = 'json',
  CSV = 'csv',
}

export enum DateRange {
  TODAY = 'today',
  WEEK = 'week',
  MONTH = 'month',
  ALL = 'all',
}

export class CostAnalyticsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by user ID' })
  @IsOptional()
  @IsString()
  user_id?: string;

  @ApiPropertyOptional({ description: 'Filter by session ID' })
  @IsOptional()
  @IsString()
  session_id?: string;

  @ApiPropertyOptional({ 
    description: 'Date range filter',
    enum: DateRange,
    default: DateRange.ALL 
  })
  @IsOptional()
  @IsEnum(DateRange)
  range?: DateRange;

  @ApiPropertyOptional({ description: 'Start date (ISO format)' })
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @ApiPropertyOptional({ description: 'End date (ISO format)' })
  @IsOptional()
  @IsDateString()
  end_date?: string;
}

export class ExportQueryDto extends CostAnalyticsQueryDto {
  @ApiPropertyOptional({ 
    description: 'Export format',
    enum: ExportFormat,
    default: ExportFormat.JSON 
  })
  @IsOptional()
  @IsEnum(ExportFormat)
  format?: ExportFormat;
}
