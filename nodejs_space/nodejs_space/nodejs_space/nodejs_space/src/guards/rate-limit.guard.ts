

import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

interface RateLimitConfig {
  requests: number;
  windowMs: number;
}

interface RequestRecord {
  count: number;
  resetTime: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);
  private requestCounts: Map<string, RequestRecord> = new Map();
  
  // Default rate limits
  private readonly defaultLimit: RateLimitConfig = {
    requests: 10, // 10 requests
    windowMs: 60 * 1000, // per minute
  };

  constructor(private reflector: Reflector) {
    // Cleanup old entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const key = this.getClientKey(request);
    
    const now = Date.now();
    let record = this.requestCounts.get(key);
    
    // Create new record or reset if window expired
    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + this.defaultLimit.windowMs,
      };
      this.requestCounts.set(key, record);
      return true;
    }
    
    // Increment count
    record.count++;
    
    // Check if limit exceeded
    if (record.count > this.defaultLimit.requests) {
      const resetIn = Math.ceil((record.resetTime - now) / 1000);
      this.logger.warn(`Rate limit exceeded for ${key}: ${record.count}/${this.defaultLimit.requests} requests`);
      
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Rate limit exceeded. Try again in ${resetIn} seconds.`,
          retryAfter: resetIn,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    
    return true;
  }

  /**
   * Get client identifier (IP or user ID)
   */
  private getClientKey(request: any): string {
    const userId = request.body?.user_id || request.query?.user_id;
    if (userId) {
      return `user:${userId}`;
    }
    
    // Fallback to IP address
    const forwarded = request.headers['x-forwarded-for'];
    const ip = forwarded ? forwarded.split(',')[0] : request.connection.remoteAddress;
    return `ip:${ip}`;
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, record] of this.requestCounts.entries()) {
      if (now > record.resetTime) {
        this.requestCounts.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.logger.log(`Cleaned up ${cleaned} expired rate limit entries`);
    }
  }
}
