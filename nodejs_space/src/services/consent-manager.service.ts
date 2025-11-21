
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

export interface ConsentPreferences {
  allowConversationMemory?: boolean;
  allowLearnedFacts?: boolean;
  allowPreferences?: boolean;
  retentionDays?: number;
}

export interface ConsentInfo {
  userId: string;
  consentGiven: boolean;
  consentDate?: Date;
  consentVersion?: string;
  preferences?: ConsentPreferences;
}

@Injectable()
export class ConsentManagerService {
  private readonly logger = new Logger(ConsentManagerService.name);
  private readonly currentVersion = '1.0.0';

  constructor(private readonly prisma: PrismaService) {
    this.logger.log('🤝 Consent Manager initialized');
  }

  /**
   * Grant consent for memory persistence
   */
  async grantConsent(
    userId: string,
    preferences?: ConsentPreferences,
  ): Promise<ConsentInfo> {
    try {
      const defaultPreferences: ConsentPreferences = {
        allowConversationMemory: true,
        allowLearnedFacts: true,
        allowPreferences: true,
        retentionDays: parseInt(process.env.MEMORY_RETENTION_DAYS || '90', 10),
      };

      const consent = await this.prisma.memory_consent.upsert({
        where: { user_id: userId },
        update: {
          consent_given: true,
          consent_date: new Date(),
          consent_version: this.currentVersion,
          preferences: { ...defaultPreferences, ...preferences } as any,
          updated_at: new Date(),
        },
        create: {
          user_id: userId,
          consent_given: true,
          consent_date: new Date(),
          consent_version: this.currentVersion,
          preferences: { ...defaultPreferences, ...preferences } as any,
        },
      });

      this.logger.log(`✅ Consent granted for user: ${userId}`);

      return this.mapToConsentInfo(consent);
    } catch (error) {
      this.logger.error(
        `Failed to grant consent: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Revoke consent for memory persistence
   */
  async revokeConsent(userId: string): Promise<boolean> {
    try {
      await this.prisma.memory_consent.update({
        where: { user_id: userId },
        data: {
          consent_given: false,
          updated_at: new Date(),
        },
      });

      this.logger.log(`❌ Consent revoked for user: ${userId}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to revoke consent: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Check if user has consent
   */
  async hasConsent(
    userId: string,
    memoryType?: string,
  ): Promise<boolean> {
    try {
      const consent = await this.prisma.memory_consent.findUnique({
        where: { user_id: userId },
      });

      if (!consent || !consent.consent_given) {
        return false;
      }

      // Check specific memory type preference
      if (memoryType && consent.preferences) {
        const prefs = consent.preferences as any;
        switch (memoryType) {
          case 'conversation':
            return prefs.allowConversationMemory !== false;
          case 'learned_fact':
            return prefs.allowLearnedFacts !== false;
          case 'preference':
            return prefs.allowPreferences !== false;
          default:
            return true;
        }
      }

      return true;
    } catch (error) {
      this.logger.error(
        `Failed to check consent: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Get consent info for a user
   */
  async getConsentInfo(userId: string): Promise<ConsentInfo | null> {
    try {
      const consent = await this.prisma.memory_consent.findUnique({
        where: { user_id: userId },
      });

      if (!consent) {
        return null;
      }

      return this.mapToConsentInfo(consent);
    } catch (error) {
      this.logger.error(
        `Failed to get consent info: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * Update consent preferences
   */
  async updatePreferences(
    userId: string,
    preferences: ConsentPreferences,
  ): Promise<ConsentInfo | null> {
    try {
      const consent = await this.prisma.memory_consent.update({
        where: { user_id: userId },
        data: {
          preferences: preferences as any,
          updated_at: new Date(),
        },
      });

      this.logger.log(`🔄 Preferences updated for user: ${userId}`);

      return this.mapToConsentInfo(consent);
    } catch (error) {
      this.logger.error(
        `Failed to update preferences: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * Map database model to ConsentInfo
   */
  private mapToConsentInfo(consent: any): ConsentInfo {
    return {
      userId: consent.user_id,
      consentGiven: consent.consent_given,
      consentDate: consent.consent_date,
      consentVersion: consent.consent_version,
      preferences: consent.preferences as ConsentPreferences,
    };
  }

}
