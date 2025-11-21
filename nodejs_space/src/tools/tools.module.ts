
import { Module } from '@nestjs/common';
import { ToolsService } from './tools.service';
import { ToolsController } from './tools.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [ToolsService, PrismaService],
  controllers: [ToolsController],
  exports: [ToolsService],
})
export class ToolsModule {}
