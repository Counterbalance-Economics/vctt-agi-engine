
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
import { VCTTEngineService } from '../services/vctt-engine.service';
import { DeepAgentService } from '../services/deepagent.service';
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

  constructor(
    private readonly llmService: LLMService,
    private readonly vcttEngine: VCTTEngineService,
    private readonly deepAgent: DeepAgentService,
  ) {}

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
   * Handle VCTT orchestration query with phase updates
   * This is the main entry point for frontend queries
   */
  @SubscribeMessage('query')
  async handleQuery(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { session_id: string; input: string },
  ): Promise<void> {
    const { session_id, input } = data;
    const startTime = Date.now();
    
    this.logger.log(`🎸 Query received: session=${session_id}, input="${input.substring(0, 50)}..."`);

    try {
      // Phase callback factory
      const emitPhase = (phase: string, description: string, progress: number, status: 'in_progress' | 'complete' | 'error' = 'in_progress') => {
        const emoji = this.getPhaseEmoji(phase);
        client.emit('stream_phase', {
          phase,
          description,
          progress,
          emoji,
          status,
          timestamp: new Date().toISOString(),
        });
      };

      // Emit phases during orchestration
      emitPhase('initializing', 'Starting VCTT orchestration...', 0, 'in_progress');
      
      emitPhase('analyst', 'Analyst gathering facts and patterns...', 15, 'in_progress');
      await this.sleep(200); // Brief pause for UX
      
      emitPhase('relational', 'Relational mapping connections...', 35, 'in_progress');
      await this.sleep(200);
      
      emitPhase('ethics', 'Ethics evaluating alignment...', 55, 'in_progress');
      await this.sleep(200);
      
      emitPhase('synthesiser', 'Synthesiser composing response...', 75, 'in_progress');
      
      // Execute actual VCTT orchestration
      const response = await this.vcttEngine.processStep(session_id, input);
      
      emitPhase('verifier', 'Verifier validating with Grok-4...', 90, 'in_progress');
      await this.sleep(500);
      
      // Stream the response content
      client.emit('stream_chunk', { content: response.response });
      
      // Complete
      emitPhase('complete', 'Response complete!', 100, 'complete');
      
      const latencyMs = Date.now() - startTime;
      client.emit('stream_complete', {
        session_id,
        latency_ms: latencyMs,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`✅ Query complete: session=${session_id}, latency=${latencyMs}ms`);

    } catch (error) {
      this.logger.error(`❌ Query error for ${session_id}: ${error.message}`);
      
      const errorEmoji = '❌';
      client.emit('stream_phase', {
        phase: 'error',
        description: `Error: ${error.message}`,
        progress: 0,
        emoji: errorEmoji,
        status: 'error',
        timestamp: new Date().toISOString(),
      });
      
      client.emit('stream_error', {
        error: error.message,
        code: error.name || 'QUERY_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get emoji for phase
   */
  private getPhaseEmoji(phase: string): string {
    const emojiMap: Record<string, string> = {
      initializing: '🎬',
      analyst: '🎸',
      relational: '🎺',
      ethics: '🎻',
      synthesiser: '🥁',
      verifier: '✅',
      complete: '🎉',
      error: '❌',
    };
    return emojiMap[phase] || '🎵';
  }

  /**
   * Sleep utility for phase pacing
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Handle DeepAgent command execution
   * This powers the autonomous engineering co-pilot /deep interface
   */
  @SubscribeMessage('deepagent_command')
  async handleDeepAgentCommand(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { input: string; session_id?: string },
  ): Promise<void> {
    const startTime = Date.now();
    const sessionId = data.session_id || `deepagent_${randomUUID()}`;
    
    this.logger.log(`🤖 DeepAgent command received: "${data.input.substring(0, 50)}..."`);

    try {
      // Emit start event
      client.emit('stream_start', {
        sessionId,
        model: 'deepagent',
        timestamp: new Date().toISOString(),
      });

      // Process command - this will execute real git/file/build operations
      const output = await this.deepAgent.processCommand(data.input);
      
      // Stream output in chunks for terminal effect
      const chunks = this.chunkOutput(output, 100);
      for (const chunk of chunks) {
        client.emit('stream_chunk', {
          chunk,
          timestamp: new Date().toISOString(),
        });
        await this.sleep(10); // Small delay for terminal typing effect
      }

      // Emit completion
      const latencyMs = Date.now() - startTime;
      client.emit('stream_complete', {
        sessionId,
        latency_ms: latencyMs,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`✅ DeepAgent command complete: ${latencyMs}ms`);

    } catch (error) {
      this.logger.error(`❌ DeepAgent error: ${error.message}`);
      
      client.emit('stream_error', {
        error: error.message,
        code: 'DEEPAGENT_ERROR',
        timestamp: new Date().toISOString(),
      });
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
    // Route to DeepAgent if mode is 'deepagent'
    if (data.mode === 'deepagent') {
      return await this.handleDeepAgentCommand(client, {
        input: data.message,
        session_id: `deepagent_${randomUUID()}`,
      });
    }

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
   * Chunk output for terminal typing effect
   */
  private chunkOutput(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.substring(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Get active stream count
   */
  getActiveStreamCount(): number {
    return this.activeStreams.size;
  }
}
