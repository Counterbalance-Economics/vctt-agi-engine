
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global Exception Filter
 * 
 * Catches all unhandled exceptions and returns a proper HTTP response
 * instead of letting the server crash (502 Bad Gateway).
 * 
 * This fixes the CORS + 502 issues in production.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details: any = {};

    // Handle HTTP exceptions
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || message;
        details = exceptionResponse;
      }
    } else if (exception instanceof Error) {
      // Handle standard errors
      message = exception.message;
      details = {
        name: exception.name,
        stack: process.env.NODE_ENV === 'development' ? exception.stack : undefined,
      };
    }

    // Log the error
    this.logger.error(
      `❌ ${request.method} ${request.url} → ${status} ${message}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    // Send error response with CORS headers
    response
      .status(status)
      .header('Access-Control-Allow-Origin', '*')
      .header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS')
      .header('Access-Control-Allow-Credentials', 'true')
      .json({
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        message,
        ...(process.env.NODE_ENV === 'development' && { details }),
      });
  }
}
