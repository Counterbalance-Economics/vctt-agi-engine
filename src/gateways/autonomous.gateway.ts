
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

/**
 * Autonomous Execution WebSocket Gateway - Phase 4
 * 
 * Real-time bidirectional communication for:
 * - Queue status updates
 * - Execution progress
 * - Swarm mode activation
 * - DeepAgent session events
 * - Coach analysis results
 */

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/autonomous',
})
export class AutonomousGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AutonomousGateway.name);
  private connectedClients = 0;

  afterInit(server: Server) {
    this.logger.log('🔌 Autonomous WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.connectedClients++;
    this.logger.log(`✅ Client connected: ${client.id} (total: ${this.connectedClients})`);
    
    // Send welcome message
    client.emit('connected', {
      message: 'Connected to MIN autonomous execution system',
      client_id: client.id,
      timestamp: new Date(),
    });
  }

  handleDisconnect(client: Socket) {
    this.connectedClients--;
    this.logger.log(`❌ Client disconnected: ${client.id} (total: ${this.connectedClients})`);
  }

  /**
   * Broadcast queue status update
   */
  broadcastStatus(status: any) {
    this.server.emit('status_update', {
      type: 'status',
      data: status,
      timestamp: new Date(),
    });
  }

  /**
   * Broadcast queue item update
   */
  broadcastQueueUpdate(queueItem: any) {
    this.server.emit('queue_update', {
      type: 'queue_added',
      data: queueItem,
      timestamp: new Date(),
    });
  }

  /**
   * Broadcast execution start event
   */
  broadcastExecutionStart(queueId: number, goalId: number, sessionId: string) {
    this.server.emit('execution_start', {
      type: 'execution_start',
      queue_id: queueId,
      goal_id: goalId,
      session_id: sessionId,
      timestamp: new Date(),
    });

    this.logger.log(`📡 Broadcasted execution start: goal ${goalId}, session ${sessionId}`);
  }

  /**
   * Broadcast execution progress
   */
  broadcastExecutionProgress(queueId: number, goalId: number, progress: number, message?: string) {
    this.server.emit('execution_progress', {
      type: 'execution_progress',
      queue_id: queueId,
      goal_id: goalId,
      progress,
      message,
      timestamp: new Date(),
    });
  }

  /**
   * Broadcast execution completion
   */
  broadcastExecutionComplete(queueId: number, goalId: number, result: any) {
    this.server.emit('execution_complete', {
      type: 'execution_complete',
      queue_id: queueId,
      goal_id: goalId,
      result,
      timestamp: new Date(),
    });

    this.logger.log(`📡 Broadcasted execution complete: goal ${goalId}`);
  }

  /**
   * Broadcast execution error
   */
  broadcastExecutionError(queueId: number, goalId: number, error: string) {
    this.server.emit('execution_error', {
      type: 'execution_error',
      queue_id: queueId,
      goal_id: goalId,
      error,
      timestamp: new Date(),
    });

    this.logger.error(`📡 Broadcasted execution error: goal ${goalId} - ${error}`);
  }

  /**
   * Broadcast swarm mode status
   */
  broadcastSwarmStatus(active: boolean, queueDepth: number) {
    this.server.emit('swarm_status', {
      type: 'swarm_status',
      active,
      queue_depth: queueDepth,
      timestamp: new Date(),
    });

    this.logger.log(`📡 Broadcasted swarm mode ${active ? 'ACTIVATED' : 'deactivated'} (depth: ${queueDepth})`);
  }

  /**
   * Broadcast coach analysis result
   */
  broadcastCoachAnalysis(goalId: number, analysis: any) {
    this.server.emit('coach_analysis', {
      type: 'coach_analysis',
      goal_id: goalId,
      analysis,
      timestamp: new Date(),
    });

    this.logger.log(`📡 Broadcasted coach analysis: goal ${goalId}`);
  }

  /**
   * Broadcast log entry
   */
  broadcastLog(goalId: number, level: string, message: string, details?: any) {
    this.server.emit('execution_log', {
      type: 'execution_log',
      goal_id: goalId,
      level,
      message,
      details,
      timestamp: new Date(),
    });
  }

  /**
   * Client subscribes to goal updates
   */
  @SubscribeMessage('subscribe_goal')
  handleSubscribeGoal(client: Socket, goalId: number) {
    client.join(`goal-${goalId}`);
    this.logger.log(`Client ${client.id} subscribed to goal ${goalId}`);
    return { success: true, message: `Subscribed to goal ${goalId}` };
  }

  /**
   * Client unsubscribes from goal updates
   */
  @SubscribeMessage('unsubscribe_goal')
  handleUnsubscribeGoal(client: Socket, goalId: number) {
    client.leave(`goal-${goalId}`);
    this.logger.log(`Client ${client.id} unsubscribed from goal ${goalId}`);
    return { success: true, message: `Unsubscribed from goal ${goalId}` };
  }

  /**
   * Ping-pong for connection health check
   */
  @SubscribeMessage('ping')
  handlePing(client: Socket) {
    return { event: 'pong', data: { timestamp: new Date() } };
  }
}
