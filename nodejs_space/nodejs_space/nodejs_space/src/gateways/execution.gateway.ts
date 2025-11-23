
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

/**
 * Execution WebSocket Gateway - Phase 3
 * 
 * Real-time updates for autonomous execution.
 * Clients can subscribe to goal execution updates.
 */

@WebSocketGateway({
  cors: {
    origin: '*', // In production, restrict this to your frontend domain
  },
  namespace: '/execution',
})
export class ExecutionGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ExecutionGateway.name);
  private connectedClients = new Map<string, Socket>();

  handleConnection(client: Socket) {
    this.logger.log(`🔌 Client connected: ${client.id}`);
    this.connectedClients.set(client.id, client);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`🔌 Client disconnected: ${client.id}`);
    this.connectedClients.delete(client.id);
  }

  /**
   * Client subscribes to updates for a specific goal
   */
  @SubscribeMessage('subscribe_goal')
  handleSubscribeGoal(client: Socket, goalId: number) {
    const room = `goal_${goalId}`;
    client.join(room);
    this.logger.log(`📡 Client ${client.id} subscribed to goal ${goalId}`);
    return { success: true, message: `Subscribed to goal ${goalId}` };
  }

  /**
   * Client unsubscribes from goal updates
   */
  @SubscribeMessage('unsubscribe_goal')
  handleUnsubscribeGoal(client: Socket, goalId: number) {
    const room = `goal_${goalId}`;
    client.leave(room);
    this.logger.log(`📡 Client ${client.id} unsubscribed from goal ${goalId}`);
    return { success: true, message: `Unsubscribed from goal ${goalId}` };
  }

  /**
   * Emit execution started event
   */
  emitExecutionStarted(goalId: number, data: any) {
    const room = `goal_${goalId}`;
    this.server.to(room).emit('execution_started', {
      goal_id: goalId,
      timestamp: new Date(),
      ...data,
    });
    this.logger.debug(`▶️  Emitted execution_started for goal ${goalId}`);
  }

  /**
   * Emit execution progress update
   */
  emitExecutionProgress(goalId: number, data: any) {
    const room = `goal_${goalId}`;
    this.server.to(room).emit('execution_progress', {
      goal_id: goalId,
      timestamp: new Date(),
      ...data,
    });
    this.logger.debug(`📊 Emitted execution_progress for goal ${goalId}`);
  }

  /**
   * Emit execution completed event
   */
  emitExecutionCompleted(goalId: number, data: any) {
    const room = `goal_${goalId}`;
    this.server.to(room).emit('execution_completed', {
      goal_id: goalId,
      timestamp: new Date(),
      ...data,
    });
    this.logger.log(`✅ Emitted execution_completed for goal ${goalId}`);
  }

  /**
   * Emit execution error event
   */
  emitExecutionError(goalId: number, data: any) {
    const room = `goal_${goalId}`;
    this.server.to(room).emit('execution_error', {
      goal_id: goalId,
      timestamp: new Date(),
      ...data,
    });
    this.logger.error(`❌ Emitted execution_error for goal ${goalId}`);
  }

  /**
   * Emit activity log (real-time activity feed)
   */
  emitActivity(goalId: number, activity: any) {
    const room = `goal_${goalId}`;
    this.server.to(room).emit('activity', {
      goal_id: goalId,
      timestamp: new Date(),
      ...activity,
    });
  }

  /**
   * Broadcast system status update to all clients
   */
  broadcastSystemStatus(status: any) {
    this.server.emit('system_status', {
      timestamp: new Date(),
      ...status,
    });
    this.logger.debug(`📢 Broadcast system_status`);
  }

  /**
   * Get connected clients count
   */
  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }
}
