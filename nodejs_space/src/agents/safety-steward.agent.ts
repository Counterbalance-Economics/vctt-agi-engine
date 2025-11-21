
/**
 * SafetySteward Agent
 * 
 * The ultimate safety guardian for the VCTT-AGI system.
 * Monitors all operations, enforces safety charter, and manages kill switch.
 * 
 * Responsibilities:
 * - Monitor all agent operations in real-time
 * - Enforce VCTT_AGI_SAFETY_CHARTER.md
 * - Manage emergency shutdown (kill switch)
 * - Audit autonomous operations
 * - Alert on anomalies
 * 
 * @module agents/safety-steward
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export enum SafetyLevel {
  SAFE = 'SAFE',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
  EMERGENCY = 'EMERGENCY'
}

export enum OperationMode {
  RESEARCH = 'RESEARCH',         // Read-only
  DEVELOPMENT = 'DEVELOPMENT',   // Writes with verification
  AUTONOMOUS = 'AUTONOMOUS',     // Scheduled tasks
  EMERGENCY = 'EMERGENCY'        // All operations halted
}

export interface SafetyCheckResult {
  allowed: boolean;
  level: SafetyLevel;
  reason: string;
  timestamp: Date;
  operation: string;
  userId?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  operation: string;
  userId?: string;
  mode: OperationMode;
  result: 'ALLOWED' | 'BLOCKED' | 'KILLED';
  reason: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class SafetyStewardAgent {
  private readonly logger = new Logger(SafetyStewardAgent.name);
  
  private currentMode: OperationMode = OperationMode.RESEARCH;
  private killSwitchActive: boolean = false;
  private auditLog: AuditLogEntry[] = [];
  private anomalyCount: number = 0;
  private readonly ANOMALY_THRESHOLD = 5;

  constructor(private configService: ConfigService) {
    this.logger.log('🛡️ SafetySteward Agent initialized');
    this.loadSafetyConfig();
  }

  /**
   * Load safety configuration from environment
   */
  private loadSafetyConfig(): void {
    const agiEnabled = this.configService.get<boolean>('AGI_MODE_ENABLED', false);
    const autonomousEnabled = this.configService.get<boolean>('AUTONOMOUS_MODE_ENABLED', false);
    
    if (!agiEnabled) {
      this.logger.warn('⚠️ AGI mode is DISABLED. All AGI features are inactive.');
      this.currentMode = OperationMode.EMERGENCY;
    }
    
    if (autonomousEnabled && !agiEnabled) {
      this.logger.error('❌ Configuration error: AUTONOMOUS_MODE_ENABLED=true but AGI_MODE_ENABLED=false');
      this.currentMode = OperationMode.EMERGENCY;
    }
  }

  /**
   * Check if an operation is allowed under current safety rules
   */
  async checkOperation(
    operation: string,
    context: { userId?: string; intent?: string; tools?: string[]; data?: any }
  ): Promise<SafetyCheckResult> {
    const timestamp = new Date();

    // KILL SWITCH: Block everything if active
    if (this.killSwitchActive) {
      this.logAudit({
        operation,
        userId: context.userId,
        result: 'KILLED',
        reason: 'Kill switch is active',
        timestamp
      });

      return {
        allowed: false,
        level: SafetyLevel.EMERGENCY,
        reason: 'Kill switch is active. All operations are halted.',
        timestamp,
        operation,
        userId: context.userId
      };
    }

    // MODE-BASED RESTRICTIONS
    const modeCheck = this.checkModeRestrictions(operation, context);
    if (!modeCheck.allowed) {
      this.logAudit({
        operation,
        userId: context.userId,
        result: 'BLOCKED',
        reason: modeCheck.reason,
        timestamp
      });
      return modeCheck;
    }

    // ANOMALY DETECTION
    const anomalyCheck = this.detectAnomaly(operation, context);
    if (anomalyCheck.level === SafetyLevel.CRITICAL) {
      this.anomalyCount++;
      
      if (this.anomalyCount >= this.ANOMALY_THRESHOLD) {
        this.logger.error(`❌ ANOMALY THRESHOLD EXCEEDED (${this.anomalyCount}/${this.ANOMALY_THRESHOLD}). Activating kill switch.`);
        await this.activateKillSwitch('Automatic: Anomaly threshold exceeded');
        
        return {
          allowed: false,
          level: SafetyLevel.EMERGENCY,
          reason: 'Anomaly threshold exceeded. System halted for safety.',
          timestamp,
          operation,
          userId: context.userId
        };
      }
    }

    // TOOL VERIFICATION
    if (context.tools && context.tools.length > 0) {
      const toolCheck = this.checkToolSafety(context.tools, context);
      if (!toolCheck.allowed) {
        this.logAudit({
          operation,
          userId: context.userId,
          result: 'BLOCKED',
          reason: toolCheck.reason,
          timestamp
        });
        return toolCheck;
      }
    }

    // ALL CHECKS PASSED
    this.logAudit({
      operation,
      userId: context.userId,
      result: 'ALLOWED',
      reason: 'All safety checks passed',
      timestamp
    });

    return {
      allowed: true,
      level: SafetyLevel.SAFE,
      reason: 'Operation approved by SafetySteward',
      timestamp,
      operation,
      userId: context.userId
    };
  }

  /**
   * Check mode-specific restrictions
   */
  private checkModeRestrictions(operation: string, context: any): SafetyCheckResult {
    const timestamp = new Date();

    // ADMIN OPERATIONS: Always allowed (for managing the safety system itself)
    const adminOps = ['kill_switch', 'kill-switch', 'mode', 'config', 'admin', 'safety'];
    const isAdminOp = adminOps.some(op => operation.toLowerCase().includes(op));
    
    this.logger.debug(`Mode check: operation="${operation}", isAdminOp=${isAdminOp}`);
    
    if (isAdminOp) {
      this.logger.log(`✅ Admin operation detected: ${operation} - bypassing mode restrictions`);
      return {
        allowed: true,
        level: SafetyLevel.SAFE,
        reason: 'Admin operation - bypass mode restrictions',
        timestamp,
        operation,
        userId: context.userId
      };
    }

    switch (this.currentMode) {
      case OperationMode.EMERGENCY:
        return {
          allowed: false,
          level: SafetyLevel.EMERGENCY,
          reason: 'System is in EMERGENCY mode. All operations blocked.',
          timestamp,
          operation,
          userId: context.userId
        };

      case OperationMode.RESEARCH:
        // Research mode: Read-only operations
        const writeOps = ['write', 'delete', 'update', 'create', 'modify', 'persist'];
        if (writeOps.some(op => operation.toLowerCase().includes(op))) {
          return {
            allowed: false,
            level: SafetyLevel.WARNING,
            reason: 'Write operations not allowed in RESEARCH mode',
            timestamp,
            operation,
            userId: context.userId
          };
        }
        break;

      case OperationMode.DEVELOPMENT:
        // Development mode: Writes allowed with verification
        // (VerifierAgent will handle granular checks)
        break;

      case OperationMode.AUTONOMOUS:
        // Autonomous mode: Check bounds
        if (!context.intent) {
          return {
            allowed: false,
            level: SafetyLevel.WARNING,
            reason: 'Autonomous operations require explicit intent',
            timestamp,
            operation,
            userId: context.userId
          };
        }
        break;
    }

    return {
      allowed: true,
      level: SafetyLevel.SAFE,
      reason: 'Mode restrictions passed',
      timestamp,
      operation,
      userId: context.userId
    };
  }

  /**
   * Detect anomalies in operation patterns
   */
  private detectAnomaly(operation: string, context: any): SafetyCheckResult {
    const timestamp = new Date();

    // Check for suspicious patterns
    const suspiciousPatterns = [
      'rm -rf',
      'DROP TABLE',
      'DELETE FROM',
      'eval(',
      'exec(',
      '__import__',
      'os.system',
      'subprocess'
    ];

    for (const pattern of suspiciousPatterns) {
      if (JSON.stringify(context).includes(pattern)) {
        this.logger.warn(`⚠️ Suspicious pattern detected: ${pattern}`);
        return {
          allowed: false,
          level: SafetyLevel.CRITICAL,
          reason: `Suspicious pattern detected: ${pattern}`,
          timestamp,
          operation,
          userId: context.userId
        };
      }
    }

    // Check for rapid repeated operations (potential loop/attack)
    const recentOps = this.auditLog.filter(
      log => log.timestamp.getTime() > Date.now() - 5000 // Last 5 seconds
    );

    if (recentOps.length > 20) {
      this.logger.warn(`⚠️ High operation frequency detected: ${recentOps.length} ops in 5s`);
      return {
        allowed: true,
        level: SafetyLevel.WARNING,
        reason: 'High operation frequency detected',
        timestamp,
        operation,
        userId: context.userId
      };
    }

    return {
      allowed: true,
      level: SafetyLevel.SAFE,
      reason: 'No anomalies detected',
      timestamp,
      operation,
      userId: context.userId
    };
  }

  /**
   * Check if tools are safe to use
   */
  private checkToolSafety(tools: string[], context: any): SafetyCheckResult {
    const timestamp = new Date();

    // Blocked tools in certain modes
    const blockedInResearch = ['file_write', 'database_write', 'external_api_call'];
    
    if (this.currentMode === OperationMode.RESEARCH) {
      for (const tool of tools) {
        if (blockedInResearch.some(blocked => tool.includes(blocked))) {
          return {
            allowed: false,
            level: SafetyLevel.WARNING,
            reason: `Tool "${tool}" not allowed in RESEARCH mode`,
            timestamp,
            operation: `tool_use:${tool}`,
            userId: context.userId
          };
        }
      }
    }

    return {
      allowed: true,
      level: SafetyLevel.SAFE,
      reason: 'Tool safety check passed',
      timestamp,
      operation: `tools:${tools.join(',')}`,
      userId: context.userId
    };
  }

  /**
   * Activate kill switch (EMERGENCY SHUTDOWN)
   */
  async activateKillSwitch(reason: string, adminId?: string): Promise<void> {
    this.killSwitchActive = true;
    this.currentMode = OperationMode.EMERGENCY;
    
    this.logger.error(`🚨 KILL SWITCH ACTIVATED by ${adminId || 'system'}: ${reason}`);
    
    this.logAudit({
      operation: 'KILL_SWITCH',
      userId: adminId,
      result: 'KILLED',
      reason,
      timestamp: new Date(),
      metadata: { adminId, automatic: !adminId }
    });

    // TODO: Integrate with agent orchestrator to halt all running tasks
    // TODO: Clear job queues
    // TODO: Notify admins
  }

  /**
   * Deactivate kill switch (requires admin)
   */
  async deactivateKillSwitch(adminId: string, reason: string): Promise<void> {
    this.killSwitchActive = false;
    this.currentMode = OperationMode.RESEARCH; // Safe default
    this.anomalyCount = 0; // Reset anomaly counter
    
    this.logger.warn(`✅ Kill switch deactivated by ${adminId}: ${reason}`);
    
    this.logAudit({
      operation: 'KILL_SWITCH_DEACTIVATE',
      userId: adminId,
      result: 'ALLOWED',
      reason,
      timestamp: new Date(),
      metadata: { adminId }
    });
  }

  /**
   * Change operation mode
   */
  async setMode(mode: OperationMode, adminId?: string): Promise<void> {
    const oldMode = this.currentMode;
    this.currentMode = mode;
    
    this.logger.log(`🔄 Mode changed: ${oldMode} → ${mode} by ${adminId || 'system'}`);
    
    this.logAudit({
      operation: 'MODE_CHANGE',
      userId: adminId,
      result: 'ALLOWED',
      reason: `Mode changed to ${mode}`,
      timestamp: new Date(),
      metadata: { oldMode, newMode: mode }
    });
  }

  /**
   * Get current safety status
   */
  getStatus(): {
    mode: OperationMode;
    killSwitchActive: boolean;
    anomalyCount: number;
    recentAuditLogs: AuditLogEntry[];
  } {
    return {
      mode: this.currentMode,
      killSwitchActive: this.killSwitchActive,
      anomalyCount: this.anomalyCount,
      recentAuditLogs: this.auditLog.slice(-50) // Last 50 entries
    };
  }

  /**
   * Get full audit log (admin only)
   */
  getAuditLog(filter?: { userId?: string; startDate?: Date; endDate?: Date }): AuditLogEntry[] {
    let logs = this.auditLog;

    if (filter) {
      if (filter.userId) {
        logs = logs.filter(log => log.userId === filter.userId);
      }
      if (filter.startDate) {
        logs = logs.filter(log => log.timestamp >= filter.startDate!);
      }
      if (filter.endDate) {
        logs = logs.filter(log => log.timestamp <= filter.endDate!);
      }
    }

    return logs;
  }

  /**
   * Log audit entry
   */
  private logAudit(entry: Omit<AuditLogEntry, 'id' | 'mode'>): void {
    const auditEntry: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      mode: this.currentMode,
      ...entry
    };

    this.auditLog.push(auditEntry);

    // Trim log if too large (keep last 10000 entries)
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-10000);
    }
  }

  /**
   * Simplified check for write operations (Stage 2 helper)
   */
  async canPerformOperation(operation: 'READ' | 'WRITE', userId: string): Promise<boolean> {
    const result = await this.checkOperation(operation, { userId });
    return result.allowed;
  }
}
