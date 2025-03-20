/**
 * @deprecated This module is deprecated and will be removed in a future version.
 * 
 * Please use the browser service instead:
 * import { browserService } from './browser';
 */

import { v4 as uuidv4 } from 'uuid';
import { browserService } from './browser';

/**
 * @deprecated Use browserService from './browser' instead.
 */
export interface AutomationConfig {
  headless: boolean;
  model: 'claude-3.7';
  maxWaitTime: number;
  humanLikeDelay: boolean;
}

/**
 * @deprecated Use browserService from './browser' instead.
 */
export class PerplexityAutomator {
  private sessionId: string | null = null;
  
  /**
   * @deprecated Use browserService from './browser' instead.
   */
  constructor(config: AutomationConfig) {
    console.warn(
      'PerplexityAutomator is deprecated. Please use browserService from ./browser instead.'
    );
  }

  /**
   * @deprecated Use browserService.createPerplexitySession() instead
   */
  async initialize(): Promise<void> {
    try {
      this.sessionId = await browserService.createPerplexitySession();
    } catch (error) {
      console.error('Failed to initialize Perplexity session:', error);
      throw error;
    }
  }

  /**
   * @deprecated Authentication is now handled automatically by browserService
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async login(email: string, password: string): Promise<void> {
    console.warn('Manual login is deprecated. Authentication is now handled automatically.');
    // Compatibility layer - no action needed as authentication is handled in createPerplexitySession
  }

  /**
   * @deprecated Use browserService.getPerplexityResponse() instead
   */
  async query(prompt: string): Promise<string> {
    if (!this.sessionId) {
      await this.initialize();
    }
    
    try {
      const response = await browserService.getPerplexityResponse(this.sessionId!, prompt);
      return response || '';
    } catch (error) {
      console.error('Failed to query Perplexity:', error);
      throw new Error(`Failed to query Perplexity: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      // Clean up the session
      if (this.sessionId) {
        void browserService.closePerplexitySession(this.sessionId).catch(closeError => {
          console.error(`Error closing session: ${closeError instanceof Error ? closeError.message : String(closeError)}`);
        });
        this.sessionId = null;
      }
    }
  }

  /**
   * @deprecated Human relay functionality is now integrated into src/activate/humanRelay.ts
   */
  async fallbackToHumanRelay(): Promise<void> {
    console.warn('fallbackToHumanRelay is deprecated. Human relay is now handled automatically.');
    // No action needed as human relay is now an integrated feature
  }
}
