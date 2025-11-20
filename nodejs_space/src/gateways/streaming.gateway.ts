
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { LLMService } from '../services/llm.service';
import {
  StreamRequestDto,
  StreamChunkDto,
  StreamStartDto,
  StreamCompleteDto,
  StreamErrorDto,
} from '../dto/streaming.dto';
import { randomUUID } from 'crypto';

/**
 * 🌊 WebSocket Streaming Gateway
 * 
 * Provides real-time token-by-token streaming for LLM responses.
 * Significantly improves UX by showing progressive responses instead of waiting.
 * 
 * Events:
 * - Client → Server: 'stream_request' (start streaming)
 * - Server → Client: 'stream_start' (stream begins)
 * - Server → Client: 'stream_chunk' (token/text chunk)
 * - Server → Client: 'stream_complete' (stream finished)
 * - Server → Client: 'stream_error' (error occurred)
 */
@WebSocketGateway({
  cors: {
    origin: '*', // Configure properly in production
    credentials: true,
  },
  namespace: '/stream',
})
export class StreamingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(StreamingGateway.name);
  private activeStreams = new Map<string, { socketId: string; startTime: number }>();

  constructor(private readonly llmService: LLMService) {}

  handleConnection(client: Socket) {
    this.logger.log(`🔌 Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`🔌 Client disconnected: ${client.id}`);
    
    // Clean up any active streams for this client
    for (const [sessionId, data] of this.activeStreams.entries()) {
      if (data.socketId === client.id) {
        this.activeStreams.delete(sessionId);
        this.logger.warn(`🧹 Cleaned up abandoned stream: ${sessionId}`);
      }
    }
  }

  /**
   * Handle streaming request from client
   */
  @SubscribeMessage('stream_request')
  async handleStreamRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: StreamRequestDto,
  ): Promise<void> {
    const sessionId = `stream_${randomUUID()}`;
    const startTime = Date.now();
    
    this.activeStreams.set(sessionId, {
      socketId: client.id,
      startTime,
    });

    this.logger.log(
      `🌊 Stream request: sessionId=${sessionId}, client=${client.id}, role=${data.agentRole || 'primary'}`
    );

    try {
      // Prepare messages
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
      
      if (data.systemPrompt) {
        messages.push({ role: 'system', content: data.systemPrompt });
      }
      
      if (data.history) {
        messages.push(...data.history.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })));
      }
      
      messages.push({ role: 'user', content: data.message });

      // Select model
      const model = data.agentRole 
        ? (this.llmService as any).selectModelForAgent(data.agentRole)
        : 'gpt-4o';

      // Send stream start event
      const streamStart: StreamStartDto = {
        sessionId,
        model,
        agentRole: data.agentRole,
        timestamp: new Date().toISOString(),
      };
      client.emit('stream_start', streamStart);

      // Start streaming
      await this.streamCompletion(
        client,
        sessionId,
        messages,
        model,
        data.temperature,
        data.agentRole,
        data.enableTools,
        startTime,
      );

    } catch (error) {
      this.logger.error(`Stream error for ${sessionId}: ${error.message}`);
      
      const streamError: StreamErrorDto = {
        sessionId,
        error: error.message,
        code: error.name || 'STREAM_ERROR',
        timestamp: new Date().toISOString(),
      };
      
      client.emit('stream_error', streamError);
      this.activeStreams.delete(sessionId);
    }
  }

  /**
   * Stream completion chunks to client
   */
  private async streamCompletion(
    client: Socket,
    sessionId: string,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    model: string,
    temperature?: number,
    agentRole?: string,
    enableTools = true,
    startTime: number = Date.now(),
  ): Promise<void> {
    try {
      const fullText: string[] = [];
      let totalTokens = 0;
      let totalCost = 0;

      // Call streaming LLM API
      await this.llmService.generateCompletionStream(
        messages,
        model,
        temperature,
        agentRole as any,
        enableTools,
        // Chunk callback
        (chunk: string, tokensUsed: number, estimatedCost: number) => {
          fullText.push(chunk);
          totalTokens = tokensUsed;
          totalCost = estimatedCost;

          const streamChunk: StreamChunkDto = {
            chunk,
            model,
            tokensUsed,
            estimatedCost,
            timestamp: new Date().toISOString(),
          };

          client.emit('stream_chunk', streamChunk);
        },
      );

      // Send completion event
      const latencyMs = Date.now() - startTime;
      const streamComplete: StreamCompleteDto = {
        sessionId,
        fullText: fullText.join(''),
        totalTokens,
        totalCost,
        latencyMs,
        timestamp: new Date().toISOString(),
      };

      client.emit('stream_complete', streamComplete);
      this.activeStreams.delete(sessionId);

      this.logger.log(
        `✅ Stream complete: ${sessionId}, tokens=${totalTokens}, cost=$${totalCost.toFixed(4)}, latency=${latencyMs}ms`
      );

    } catch (error) {
      throw error; // Will be caught by handleStreamRequest
    }
  }

  /**
   * Get active stream count
   */
  getActiveStreamCount(): number {
    return this.activeStreams.size;
  }
}
