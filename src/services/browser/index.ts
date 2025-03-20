import { BrowserAutomation } from './perplexity-automation';
import { PerplexityService } from './perplexity-service';
import { v4 as uuidv4 } from 'uuid';

/**
 * Browser service for interacting with web-based services
 * Provides an interface for Perplexity automation with API and browser fallback
 */
export const browserService = {
  /**
   * Creates a new Perplexity session
   * Uses API method if available, with browser fallback
   * @returns A session ID string
   */
  createPerplexitySession: async () => {
    try {
      const session = await PerplexityService.createSession();
      return session.sessionId;
    } catch (error) {
      console.error('Failed to create Perplexity session using new service, falling back to legacy method:', error);
      // Fallback to direct browser automation in case of issues with the new service
      const sessionId = uuidv4();
      return BrowserAutomation.createSession(sessionId);
    }
  },
  
  /**
   * Closes a Perplexity session
   * @param sessionId The session ID to close
   */
  closePerplexitySession: async (sessionId: string) => {
    try {
      await PerplexityService.closeSession(sessionId);
    } catch (error) {
      console.error('Failed to close Perplexity session using new service, falling back to legacy method:', error);
      await BrowserAutomation.closeSession(sessionId);
    }
  },
  
  /**
   * Gets a response from Perplexity AI
   * @param sessionId The session ID to use
   * @param prompt The prompt to send to Perplexity
   * @returns The AI response or null if unavailable
   */
  getPerplexityResponse: async (sessionId: string, prompt: string) => {
    try {
      return await PerplexityService.getResponse(sessionId, prompt, {
        model: 'claude-3.7',
        retry: true // Enable fallback to browser automation if API fails
      });
    } catch (error) {
      console.error('Failed to get Perplexity response using new service, falling back to legacy method:', error);
      // Fallback to direct browser automation method in case of issues with the new service
      return BrowserAutomation.getAIResponse(sessionId, prompt);
    }
  }
};

// Export services for direct access
export { PerplexityService };
