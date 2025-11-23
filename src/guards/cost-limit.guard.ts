

import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from '../entities/message.entity';
import { Conversation } from '../entities/conversation.entity';

@Injectable()
export class CostLimitGuard implements CanActivate {
  private readonly logger = new Logger(CostLimitGuard.name);
  
  // Cost limits (configurable via environment)
  private readonly dailyCostLimit: number;
  private readonly sessionCostLimit: number;
  private readonly userDailyCostLimit: number;

  constructor(
    @Optional() @InjectRepository(Message) private msgRepo: Repository<Message> | null,
    @Optional() @InjectRepository(Conversation) private convRepo: Repository<Conversation> | null,
  ) {
    this.dailyCostLimit = parseFloat(process.env.DAILY_COST_LIMIT || '10.0');
    this.sessionCostLimit = parseFloat(process.env.SESSION_COST_LIMIT || '1.0');
    this.userDailyCostLimit = parseFloat(process.env.USER_DAILY_COST_LIMIT || '2.0');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip check if database is not available
    if (!this.msgRepo || !this.convRepo) {
      this.logger.warn('Cost limit check skipped: database not available');
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.body?.user_id || request.query?.user_id;
    const sessionId = request.body?.session_id || request.query?.session_id || request.params?.sessionId;
    
    try {
      // Check global daily cost
      const globalCost = await this.getDailyCost();
      if (globalCost >= this.dailyCostLimit) {
        this.logger.error(`Global daily cost limit exceeded: $${globalCost.toFixed(2)}/$${this.dailyCostLimit}`);
        throw new HttpException(
          {
            statusCode: HttpStatus.SERVICE_UNAVAILABLE,
            message: 'Daily cost limit exceeded. Service temporarily unavailable.',
            cost: globalCost,
            limit: this.dailyCostLimit,
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      // Check user daily cost
      if (userId) {
        const userCost = await this.getUserDailyCost(userId);
        if (userCost >= this.userDailyCostLimit) {
          this.logger.warn(`User ${userId} daily cost limit exceeded: $${userCost.toFixed(2)}/$${this.userDailyCostLimit}`);
          throw new HttpException(
            {
              statusCode: HttpStatus.PAYMENT_REQUIRED,
              message: 'Your daily cost limit has been exceeded. Please try again tomorrow.',
              cost: userCost,
              limit: this.userDailyCostLimit,
            },
            HttpStatus.PAYMENT_REQUIRED,
          );
        }
      }

      // Check session cost
      if (sessionId) {
        const sessionCost = await this.getSessionCost(sessionId);
        if (sessionCost >= this.sessionCostLimit) {
          this.logger.warn(`Session ${sessionId} cost limit exceeded: $${sessionCost.toFixed(2)}/$${this.sessionCostLimit}`);
          throw new HttpException(
            {
              statusCode: HttpStatus.PAYMENT_REQUIRED,
              message: 'Session cost limit exceeded. Please start a new session.',
              cost: sessionCost,
              limit: this.sessionCostLimit,
            },
            HttpStatus.PAYMENT_REQUIRED,
          );
        }
      }

      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      // Log error but don't block request if cost check fails
      this.logger.error(`Cost limit check failed: ${error.message}`);
      return true;
    }
  }

  /**
   * Get total cost for today
   */
  private async getDailyCost(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await this.msgRepo!
      .createQueryBuilder('message')
      .select('SUM(message.cost_usd)', 'total')
      .where('message.timestamp >= :today', { today })
      .andWhere('message.cost_usd IS NOT NULL')
      .getRawOne();

    return parseFloat(result?.total || '0');
  }

  /**
   * Get user's cost for today
   */
  private async getUserDailyCost(userId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await this.msgRepo!
      .createQueryBuilder('message')
      .innerJoin('message.conversation', 'conversation')
      .select('SUM(message.cost_usd)', 'total')
      .where('message.timestamp >= :today', { today })
      .andWhere('conversation.user_id = :userId', { userId })
      .andWhere('message.cost_usd IS NOT NULL')
      .getRawOne();

    return parseFloat(result?.total || '0');
  }

  /**
   * Get session's total cost
   */
  private async getSessionCost(sessionId: string): Promise<number> {
    const result = await this.msgRepo!
      .createQueryBuilder('message')
      .select('SUM(message.cost_usd)', 'total')
      .where('message.conversation_id = :sessionId', { sessionId })
      .andWhere('message.cost_usd IS NOT NULL')
      .getRawOne();

    return parseFloat(result?.total || '0');
  }
}
