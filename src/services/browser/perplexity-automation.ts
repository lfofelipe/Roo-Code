import { chromium, Browser, Page } from 'playwright';
import { getSecureConfig, SecureConfig } from '../../core/config';
import { v4 as uuidv4 } from 'uuid';

export interface PerplexitySession {
  browser: Browser;
  page: Page;
  isAuthenticated: boolean;
  lastActivityTime: number;
}

/**
 * BrowserAutomation class for handling Perplexity automation
 */
export class BrowserAutomation {
  private static activeSessions = new Map<string, PerplexitySession>();
  private static readonly SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
  
  // Cleanup inactive sessions periodically
  static {
    setInterval(() => {
      const now = Date.now();
      for (const [sessionId, session] of BrowserAutomation.activeSessions.entries()) {
        if (now - session.lastActivityTime > BrowserAutomation.SESSION_TIMEOUT_MS) {
          BrowserAutomation.closeSession(sessionId).catch(console.error);
        }
      }
    }, 60000); // Check every minute
  }

  /**
   * Creates a session ID
   * @returns A unique session ID
   */
  static generateSessionId(): string {
    return uuidv4();
  }

  /**
   * Creates a browser session for Perplexity
   * @param sessionId The session ID to use
   * @returns The session ID
   * @throws Error if session creation fails
   */
  static async createSession(sessionId: string): Promise<string> {
    let browser: Browser | undefined;
    
    try {
      browser = await chromium.launch({ 
        headless: true,
        args: ['--disable-blink-features=AutomationControlled'] // Avoid bot detection
      });
      
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      });
      
      const page = await context.newPage();
      
      // Avoid bot detection
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
      });
      
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('https://perplexity.ai');

      // Get secure config asynchronously
      const secureConfig = await getSecureConfig();
      let isAuthenticated = false;
      
      // Check if we have credentials
      if (typeof secureConfig.perplexityEmail === 'string' && 
          typeof secureConfig.perplexityPassword === 'string' &&
          secureConfig.perplexityEmail && 
          secureConfig.perplexityPassword) {
        try {
          await this.handleAuthentication(
            page, 
            secureConfig.perplexityEmail, 
            secureConfig.perplexityPassword
          );
          isAuthenticated = true;
          console.log('Successfully authenticated with Perplexity');
        } catch (authError) {
          console.error('Authentication failed:', authError);
          // Continue in unauthenticated mode
        }
      } else {
        console.log('No Perplexity credentials found, continuing in unauthenticated mode');
      }

      this.activeSessions.set(sessionId, { 
        browser, 
        page, 
        isAuthenticated,
        lastActivityTime: Date.now()
      });
      
      return sessionId;
    } catch (error) {
      // Clean up browser if it was created but something else failed
      if (browser) {
        await browser.close().catch(closeError => {
          console.error('Error closing browser after session creation failure:', closeError);
        });
      }
      
      console.error('Failed to create Perplexity session:', error);
      throw new Error(`Failed to create Perplexity session: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Handles authentication with Perplexity
   * @param page The Playwright page
   * @param email The user's email
   * @param password The user's password
   */
  private static async handleAuthentication(
    page: Page,
    email: string,
    password: string
  ): Promise<void> {
    try {
      // Check if login button exists
      const loginButton = await page.$('text="Log in"');
      if (!loginButton) {
        // Already logged in
        return;
      }
      
      await loginButton.click();
      await page.fill('input[type="email"]', email);
      await page.click('text="Continue"');
      await page.fill('input[type="password"]', password);
      await page.click('button:has-text("Sign in")');
      
      // Wait for either success indicator or error message
      await Promise.race([
        page.waitForSelector('.logged-in-indicator', { timeout: 15000 }),
        page.waitForSelector('.error-message', { timeout: 15000 })
      ]);
      
      // Check if there was an error
      const errorMessage = await page.$('.error-message');
      if (errorMessage) {
        const errorText = await errorMessage.textContent();
        throw new Error(`Login failed: ${errorText}`);
      }
    } catch (error) {
      console.error('Authentication error:', error);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  /**
   * Gets a response from Perplexity AI
   * @param sessionId The session ID to use
   * @param prompt The prompt to send to Perplexity
   * @returns The AI response or null if unavailable
   * @throws Error if session is invalid or response cannot be obtained
   */
  static async getAIResponse(
    sessionId: string, 
    prompt: string
  ): Promise<string | null> {
    const session = this.activeSessions.get(sessionId);
    if (!session) throw new Error('Invalid session');
    
    try {
      session.lastActivityTime = Date.now();
      
      // Select Claude 3.7 model if available
      try {
        await session.page.click('button[aria-label="Model selector"]');
        await session.page.click('text="Claude 3.7"', { timeout: 5000 });
      } catch (modelError) {
        console.warn('Could not select Claude 3.7 model:', modelError);
        // Continue with default model
      }
      
      // Find and fill the input field
      const textarea = await session.page.$('textarea[aria-label="Ask anything..."]');
      if (!textarea) throw new Error('Could not find input field');
      
      // Clear the textarea before typing (in case there's existing text)
      await textarea.fill('');
      await textarea.fill(prompt);
      
      // Submit the query
      await session.page.keyboard.press('Enter');
      
      // Wait for response with timeout
      await session.page.waitForSelector('.answer-content', { timeout: 60000 });
      
      // Extract the response text
      const responseText = await session.page.$eval(
        '.answer-content', 
        (el: HTMLElement) => el.textContent || ''
      );
      
      return responseText.trim();
    } catch (error) {
      console.error(`Failed to get AI response for session ${sessionId}:`, error);
      throw new Error(`Failed to get AI response: ${error.message}`);
    }
  }

  /**
   * Closes a browser session
   * @param sessionId The session ID to close
   */
  static async closeSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      try {
        await session.browser.close();
      } catch (error) {
        console.error(`Error closing browser for session ${sessionId}:`, error);
      } finally {
        this.activeSessions.delete(sessionId);
      }
    }
  }
}
