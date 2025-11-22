
/**
 * System Integrity Service
 * 
 * Performs startup diagnostics and daily reviews to ensure MIN's API integrity.
 * - Startup: Validates running routes against memory reference
 * - Daily: Analyzes usage, updates reference, proposes improvements
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { MemoryService } from './memory.service';
import { AnalyticsService } from './analytics.service';
import { SchedulerService } from './scheduler.service';
import { ConsentManagerService } from './consent-manager.service';

interface ApiReference {
  version: string;
  last_updated: string;
  endpoints: {
    [category: string]: {
      [endpoint: string]: {
        method: string;
        path: string;
        description: string;
        frontend_usage?: string;
      };
    };
  };
}

interface Discrepancy {
  type: 'missing' | 'unexpected' | 'mismatch';
  message: string;
  category?: string;
  endpoint?: string;
}

@Injectable()
export class SystemIntegrityService implements OnModuleInit {
  private readonly logger = new Logger(SystemIntegrityService.name);
  private readonly MIN_USER_ID = 'min_system';
  private readonly API_REF_TYPE = 'system_api_reference';

  constructor(
    private readonly memoryService: MemoryService,
    private readonly analyticsService: AnalyticsService,
    private readonly schedulerService: SchedulerService,
    private readonly httpAdapter: HttpAdapterHost,
    private readonly consentManager: ConsentManagerService,
  ) {}

  /**
   * Run on backend startup
   */
  async onModuleInit() {
    this.logger.log('🔍 MIN Startup Diagnostic: Initiating...');
    
    try {
      await this.runStartupDiagnostic();
      await this.setupDailyReview();
    } catch (error) {
      this.logger.error('❌ Startup diagnostic failed:', error);
      this.logger.error(`🚨 CRITICAL: Startup diagnostic failure - ${error.message}`);
    }
  }

  /**
   * Startup Diagnostic: Validate API routes against memory reference
   */
  async runStartupDiagnostic() {
    try {
      // Step 1: Fetch API reference from MIN's memory
      const apiRef = await this.getApiReferenceFromMemory();
      
      if (!apiRef) {
        this.logger.warn('⚠️ No API reference found in memory. Creating initial reference...');
        await this.createInitialApiReference();
        return;
      }

      this.logger.log(`📚 Loaded API reference v${apiRef.version} (updated ${apiRef.last_updated})`);

      // Step 2: Get current running routes
      const currentRoutes = this.extractRunningRoutes();
      this.logger.log(`🔍 Found ${currentRoutes.length} running routes`);

      // Step 3: Validate (compare expected vs actual)
      const discrepancies = this.validateApiRoutes(apiRef, currentRoutes);

      // Step 4: Handle results
      if (discrepancies.length > 0) {
        this.logger.warn(`⚠️ Found ${discrepancies.length} API discrepancies`);
        this.logger.warn(`📝 Discrepancies:\n${JSON.stringify(discrepancies, null, 2)}`);
        
        // Store discrepancy report in memory for MIN
        await this.memoryService.storeMemory({
          userId: this.MIN_USER_ID,
          memoryType: 'learned_fact',
          content: JSON.stringify({
            type: 'startup_diagnostic',
            timestamp: new Date().toISOString(),
            discrepancies,
            formatted: this.formatDiscrepanciesForProposal(discrepancies),
          }),
          metadata: {
            diagnosticType: 'system_diagnostic_report',
            importance: 0.9,
          },
        });

        this.logger.warn('📝 Diagnostic report stored in MIN memory');
      } else {
        this.logger.log('✅ Startup diagnostic: All APIs match reference');
        
        // Store success report
        await this.memoryService.storeMemory({
          userId: this.MIN_USER_ID,
          memoryType: 'learned_fact',
          content: JSON.stringify({
            type: 'startup_diagnostic',
            timestamp: new Date().toISOString(),
            status: 'success',
            message: 'All API routes validated successfully',
          }),
          metadata: {
            diagnosticType: 'system_diagnostic_report',
            importance: 0.5,
          },
        });
      }
    } catch (error) {
      this.logger.error('❌ Startup diagnostic error:', error);
      throw error;
    }
  }

  /**
   * Setup daily review task (runs once to schedule recurring task)
   */
  async setupDailyReview() {
    try {
      // Grant memory consent for MIN if not already granted
      await this.ensureMinMemoryConsent();
      
      // Check if already scheduled
      const response = await this.schedulerService.getPendingTasks();
      const existing = response.tasks || [];
      const hasReview = existing.some((t: any) => t.title && t.title.includes('MIN daily API integrity review'));
      
      if (hasReview) {
        this.logger.log('📅 Daily review already scheduled');
        return;
      }

      // Schedule first run for tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(2, 0, 0, 0); // 2 AM daily

      // TODO: Create a proper goal for MIN self-maintenance first
      // For now, logging that setup is complete (monitoring only)
      this.logger.log('✅ Daily review setup complete');
      this.logger.log('   Note: Automated scheduling requires MIN self-maintenance goal (coming soon)');
    } catch (error) {
      this.logger.error('❌ Failed to setup daily review:', error);
      this.logger.error(`🚨 CRITICAL: Daily review setup failure - ${error.message}`);
    }
  }

  /**
   * Daily Review: Analyze API usage and propose improvements
   */
  async runDailyReview() {
    this.logger.log('📊 MIN Daily Review: Starting...');
    
    try {
      // Step 1: Fetch current API reference
      const apiRef = await this.getApiReferenceFromMemory();
      if (!apiRef) {
        throw new Error('API reference not found');
      }

      // Step 2: Fetch usage analytics
      const aggregate = await this.analyticsService.getAggregateAnalytics();
      const sessions = await this.analyticsService.getSessions(undefined, 100);

      // Step 3: Analyze usage patterns
      const underused = this.findUnderusedEndpoints(apiRef);
      const overused = this.findOverusedEndpoints(aggregate);
      const errors = this.analyzeErrorRates(aggregate);

      // Step 4: Generate report
      const report = {
        timestamp: new Date().toISOString(),
        total_endpoints: this.countEndpoints(apiRef),
        total_sessions: sessions.total,
        underused_endpoints: underused.length,
        error_rate: errors.percentage,
        recommendations: [] as string[],
      };

      // Step 5: Create proposals if needed
      if (underused.length > 0) {
        report.recommendations.push(`Connect ${underused.length} underused endpoints`);
        this.logger.warn(`⚠️ Found ${underused.length} underused endpoints`);
      }

      if (errors.percentage > 5) {
        report.recommendations.push(`Investigate high error rate: ${errors.percentage}%`);
        
        // TODO: Create a coach proposal for high error rates
        // This requires direct Prisma access since CoachService doesn't expose createProposal
        this.logger.warn(`⚠️ High error rate detected: ${errors.percentage}% - Manual investigation recommended`);
      }

      // Step 6: Update memory with report
      await this.memoryService.storeMemory({
        userId: this.MIN_USER_ID,
        memoryType: 'learned_fact',
        content: JSON.stringify(report),
        metadata: {
          reportType: 'daily_integrity_report',
          importance: 0.8,
        },
      });

      // Step 7: Log to Safety (via Safety Steward)
      this.logger.log(`📝 Safety audit: Daily review complete - ${report.total_endpoints} endpoints reviewed`);

      this.logger.log(`✅ Daily review complete: ${report.recommendations.length} recommendations`);

      // Step 8: Reschedule for tomorrow
      await this.rescheduleDailyReview();
    } catch (error) {
      this.logger.error('❌ Daily review failed:', error);
      this.logger.error(`📝 Safety alert: Daily review failure - ${error.message}`);
    }
  }

  /**
   * Helper: Fetch API reference from MIN's memory
   */
  private async getApiReferenceFromMemory(): Promise<ApiReference | null> {
    try {
      const memories = await this.memoryService.getMemories({
        userId: this.MIN_USER_ID,
        memoryType: 'learned_fact',
        limit: 10,
      });

      if (!memories || memories.length === 0) {
        return null;
      }

      // Find the API reference in memories (look for system_api_reference in metadata or content)
      for (const memory of memories) {
        try {
          const parsed = JSON.parse(memory.content);
          if (parsed.version && parsed.endpoints) {
            return parsed as ApiReference;
          }
        } catch (e) {
          // Skip invalid JSON
          continue;
        }
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to fetch API reference from memory:', error);
      return null;
    }
  }

  /**
   * Helper: Create initial API reference from current routes
   */
  private async createInitialApiReference() {
    const routes = this.extractRunningRoutes();
    
    const apiRef: ApiReference = {
      version: '1.0.0',
      last_updated: new Date().toISOString(),
      endpoints: {
        core: {},
        ide: {},
        goals: {},
        safety: {},
        analytics: {},
        knowledge: {},
        memory: {},
        scheduler: {},
        coach: {},
        skills: {},
      },
    };

    // Categorize routes
    for (const route of routes) {
      const category = this.categorizeRoute(route);
      if (category) {
        apiRef.endpoints[category][route] = {
          method: route.split(' ')[0],
          path: route.split(' ').slice(1).join(' '),
          description: 'Auto-generated from running routes',
        };
      }
    }

    // Store in memory
    await this.memoryService.storeMemory({
      userId: this.MIN_USER_ID,
      memoryType: 'learned_fact',
      content: JSON.stringify(apiRef),
      metadata: {
        referenceType: this.API_REF_TYPE,
        importance: 1.0,
      },
    });

    this.logger.log('✅ Created initial API reference in memory');
  }

  /**
   * Helper: Extract all running routes from NestJS
   */
  private extractRunningRoutes(): string[] {
    try {
      const server = this.httpAdapter.httpAdapter;
      const routes: string[] = [];

      // Get routes from Express/Fastify
      if (server.getHttpServer) {
        const app = server.getHttpServer();
        
        // Express
        if (app._router && app._router.stack) {
          app._router.stack.forEach((layer: any) => {
            if (layer.route) {
              const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
              methods.forEach(method => {
                routes.push(`${method} ${layer.route.path}`);
              });
            }
          });
        }
      }

      return routes;
    } catch (error) {
      this.logger.warn('Could not extract routes, using fallback method');
      return [];
    }
  }

  /**
   * Helper: Validate API routes against reference
   */
  private validateApiRoutes(apiRef: ApiReference, currentRoutes: string[]): Discrepancy[] {
    const discrepancies: Discrepancy[] = [];

    // Check for missing endpoints (in reference but not running)
    for (const category in apiRef.endpoints) {
      for (const endpoint in apiRef.endpoints[category]) {
        if (!currentRoutes.includes(endpoint)) {
          discrepancies.push({
            type: 'missing',
            message: `Missing endpoint: ${endpoint}`,
            category,
            endpoint,
          });
        }
      }
    }

    // Check for unexpected endpoints (running but not in reference)
    const referencedEndpoints = Object.values(apiRef.endpoints)
      .flatMap(cat => Object.keys(cat));
    
    for (const route of currentRoutes) {
      if (!referencedEndpoints.includes(route) && !route.includes('swagger') && !route.includes('health')) {
        discrepancies.push({
          type: 'unexpected',
          message: `Unexpected endpoint: ${route}`,
        });
      }
    }

    return discrepancies;
  }

  /**
   * Helper: Categorize route by path
   */
  private categorizeRoute(route: string): string | null {
    const path = route.toLowerCase();
    
    if (path.includes('/session')) return 'core';
    if (path.includes('/ide') || path.includes('/deep')) return 'ide';
    if (path.includes('/goal')) return 'goals';
    if (path.includes('/safety')) return 'safety';
    if (path.includes('/analytics')) return 'analytics';
    if (path.includes('/knowledge')) return 'knowledge';
    if (path.includes('/memory')) return 'memory';
    if (path.includes('/scheduler')) return 'scheduler';
    if (path.includes('/coach')) return 'coach';
    if (path.includes('/skill')) return 'skills';
    
    return null;
  }

  /**
   * Helper: Find underused endpoints
   */
  private findUnderusedEndpoints(apiRef: ApiReference): string[] {
    // TODO: Cross-reference with analytics data
    // For now, return endpoints marked as "not connected" in docs
    return [];
  }

  /**
   * Helper: Find overused endpoints
   */
  private findOverusedEndpoints(aggregate: any): string[] {
    // TODO: Analyze high-traffic endpoints
    return [];
  }

  /**
   * Helper: Analyze error rates
   */
  private analyzeErrorRates(aggregate: any): { percentage: number; top: string[] } {
    // TODO: Calculate error rates from analytics
    return { percentage: 0, top: [] };
  }

  /**
   * Helper: Count total endpoints
   */
  private countEndpoints(apiRef: ApiReference): number {
    return Object.values(apiRef.endpoints)
      .reduce((sum, cat) => sum + Object.keys(cat).length, 0);
  }

  /**
   * Helper: Format discrepancies for Coach proposal
   */
  private formatDiscrepanciesForProposal(discrepancies: Discrepancy[]): string {
    const grouped = {
      missing: discrepancies.filter(d => d.type === 'missing'),
      unexpected: discrepancies.filter(d => d.type === 'unexpected'),
      mismatch: discrepancies.filter(d => d.type === 'mismatch'),
    };

    let description = '## API Integrity Issues Detected\n\n';
    
    if (grouped.missing.length > 0) {
      description += `### Missing Endpoints (${grouped.missing.length})\n`;
      description += grouped.missing.map(d => `- ${d.message}`).join('\n');
      description += '\n\n';
    }
    
    if (grouped.unexpected.length > 0) {
      description += `### Unexpected Endpoints (${grouped.unexpected.length})\n`;
      description += grouped.unexpected.map(d => `- ${d.message}`).join('\n');
      description += '\n\n';
    }
    
    if (grouped.mismatch.length > 0) {
      description += `### Mismatches (${grouped.mismatch.length})\n`;
      description += grouped.mismatch.map(d => `- ${d.message}`).join('\n');
      description += '\n\n';
    }

    description += '**Recommended Action:** Review and update API reference or fix backend routes.';
    
    return description;
  }

  /**
   * Helper: Ensure MIN has memory consent
   */
  private async ensureMinMemoryConsent() {
    try {
      const existing = await this.consentManager.getConsentInfo(this.MIN_USER_ID);
      
      if (!existing || !existing.consentGiven) {
        this.logger.log('🔐 Granting memory consent for MIN system user...');
        await this.consentManager.grantConsent(
          this.MIN_USER_ID,
          {
            allowConversationMemory: true,
            allowLearnedFacts: true,
            allowPreferences: true,
            retentionDays: 365 // Long-term retention for system user
          }
        );
        this.logger.log('✅ Memory consent granted for MIN');
      }
    } catch (error) {
      this.logger.warn('⚠️ Could not grant memory consent for MIN:', error.message);
    }
  }

  /**
   * Helper: Reschedule daily review
   */
  private async rescheduleDailyReview() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(2, 0, 0, 0);

    // TODO: Implement proper rescheduling with MIN self-maintenance goal
    this.logger.log('📅 Daily review rescheduling requires goal infrastructure');
  }
}
