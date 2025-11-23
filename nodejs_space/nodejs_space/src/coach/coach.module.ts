
import { Module } from '@nestjs/common';
import { CoachService } from './coach.service';
import { CoachController } from './coach.controller';
import { PrismaService } from '../services/prisma.service';

@Module({
  controllers: [CoachController],
  providers: [CoachService, PrismaService],
  exports: [CoachService],
})
export class CoachModule {}
