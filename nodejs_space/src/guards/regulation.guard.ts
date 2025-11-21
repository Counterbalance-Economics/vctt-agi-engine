
/**
 * Regulation Guard
 * 
 * Global guard that enforces mode-based restrictions on all API endpoints.
 * This is Layer 3 of the safety architecture.
 * 
 * Intercepts all requests and validates them against current operation mode.
 * Works in conjunction with SafetyStewardAgent.
 * 
 * @module guards/regulation
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SafetyStewardAgent, OperationMode } from '../agents/safety-steward.agent';

/**
 * Decorator to mark routes that require specific operation modes
 */
export const RequireMode = Reflector.createDecorator<OperationMode[]>();

/**
 * Decorator to mark routes that bypass regulation (use sparingly!)
 */
export const BypassRegulation = Reflector.createDecorator<boolean>();

@Injectable()
export class RegulationGuard implements CanActivate {
  private readonly logger = new Logger(RegulationGuard.name);

  constructor(
    private reflector: Reflector,
    private safetySteward: SafetyStewardAgent
  ) {
    this.logger.log('🛡️ Regulation Guard initialized');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, headers } = request;

    // Check if route bypasses regulation
    const bypass = this.reflector.get(BypassRegulation, context.getHandler());
    if (bypass) {
      this.logger.debug(`✓ Route ${url} bypasses regulation`);
      return true;
    }

    // Get current safety status
    const status = this.safetySteward.getStatus();

    // KILL SWITCH: Block everything except safety admin endpoints
    if (status.killSwitchActive) {
      const allowedEndpoints = ['/api/safety/status', '/api/safety/kill-switch'];
      
      if (!allowedEndpoints.some(endpoint => url.includes(endpoint))) {
        this.logger.warn(`🚨 Request blocked by kill switch: ${method} ${url}`);
        throw new HttpException(
          {
            statusCode: HttpStatus.SERVICE_UNAVAILABLE,
            message: 'System is in emergency shutdown. Only safety admin endpoints are available.',
            error: 'Kill Switch Active',
            killSwitchActive: true
          },
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }
    }

    // MODE-BASED RESTRICTIONS
    const operation = this.getOperationType(method, url);
    
    const checkResult = await this.safetySteward.checkOperation(operation, {
      userId: this.extractUserId(request),
      intent: body?.intent || body?.prompt,
      tools: body?.tools,
      data: body
    });

    if (!checkResult.allowed) {
      this.logger.warn(`⚠️ Request blocked: ${method} ${url} - ${checkResult.reason}`);
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          message: checkResult.reason,
          error: 'Operation Not Allowed',
          safetyLevel: checkResult.level,
          currentMode: status.mode,
          timestamp: checkResult.timestamp
        },
        HttpStatus.FORBIDDEN
      );
    }

    // Check required modes (if decorator is used)
    const requiredModes = this.reflector.get(RequireMode, context.getHandler());
    if (requiredModes && requiredModes.length > 0) {
      if (!requiredModes.includes(status.mode)) {
        this.logger.warn(
          `⚠️ Route requires mode ${requiredModes.join(' or ')}, but current mode is ${status.mode}`
        );
        throw new HttpException(
          {
            statusCode: HttpStatus.FORBIDDEN,
            message: `This operation requires mode: ${requiredModes.join(' or ')}`,
            error: 'Mode Restriction',
            currentMode: status.mode,
            requiredModes
          },
          HttpStatus.FORBIDDEN
        );
      }
    }

    this.logger.debug(`✓ Request allowed: ${method} ${url}`);
    return true;
  }

  /**
   * Extract operation type from request method and URL
   */
  private getOperationType(method: string, url: string): string {
    const normalizedUrl = url.toLowerCase();
    
    // Map HTTP methods to operations
    const methodMap: Record<string, string> = {
      GET: 'read',
      POST: 'write',
      PUT: 'update',
      PATCH: 'update',
      DELETE: 'delete'
    };

    const operation = methodMap[method.toUpperCase()] || 'unknown';

    // Add context from URL
    if (normalizedUrl.includes('/memory')) return `${operation}_memory`;
    if (normalizedUrl.includes('/world-model')) return `${operation}_world_model`;
    if (normalizedUrl.includes('/goal')) return `${operation}_goal`;
    if (normalizedUrl.includes('/autonomous')) return `${operation}_autonomous`;
    if (normalizedUrl.includes('/analyze')) return `analyze`;
    if (normalizedUrl.includes('/chat')) return `chat`;

    return `${operation}_${url.split('/').pop() || 'unknown'}`;
  }

  /**
   * Extract user ID from request (placeholder - will integrate with auth)
   */
  private extractUserId(request: any): string | undefined {
    // TODO: Extract from JWT token
    // For now, check headers or body
    return request.headers['x-user-id'] || request.body?.userId || undefined;
  }
}
