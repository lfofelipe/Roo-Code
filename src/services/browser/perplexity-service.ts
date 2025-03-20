import axios from 'axios';
import { getSecureConfig } from '../../core/config';
import { v4 as uuidv4 } from 'uuid';
import { BrowserAutomation } from './perplexity-automation';

/**
 * Interface for Perplexity API response
 */
interface PerplexityApiResponse {
  id: string;
  text: string;
  model: string;
  created: number;
}

/**
 * Interface for Perplexity session
 */
export interface PerplexitySessionInfo {
  sessionId: string;
  method: 'api' | 'browser';
  authenticated: boolean;
  lastActivityTime: number;
  model?: string;
}

/**
 * Service for interacting with Perplexity using both API and browser fallback
 */
export class PerplexityService {
  private static activeSessions = new Map<string, PerplexitySessionInfo>();
  private static readonly SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
  private static API_BASE_URL = 'https://api.perplexity.ai/v1';
  
  // Initialize session cleanup
  static {
    setInterval(() => {
      const now = Date.now();
      for (const [sessionId, session] of this.activeSessions.entries()) {
        if (now - session.lastActivityTime > this.SESSION_TIMEOUT_MS) {
          if (session.method === 'browser') {
            BrowserAutomation.closeSession(sessionId).catch(console.error);
          }
          this.activeSessions.delete(sessionId);
        }
      }
    }, 60000); // Check every minute
  }

  /**
   * Creates a new Perplexity session, prioritizing API method if credentials available
   * @returns A session ID string and information about the session
   */
  static async createSession(): Promise<PerplexitySessionInfo> {
    const sessionId = uuidv4();
    const secureConfig = await getSecureConfig();
    
    // Check if we have an API key
    if (typeof secureConfig.perplexityApiKey === 'string' && secureConfig.perplexityApiKey) {
      try {
        // Verify API key works by making a simple request
        const response = await axios.get(`${this.API_BASE_URL}/models`, {
          headers: {
            'Authorization': `Bearer ${secureConfig.perplexityApiKey}`
          }
        });
        
        if (response.status === 200) {
          const sessionInfo: PerplexitySessionInfo = {
            sessionId,
            method: 'api',
            authenticated: true,
            lastActivityTime: Date.now(),
            model: 'claude-3.7' // Default model
          };
          
          this.activeSessions.set(sessionId, sessionInfo);
          console.log('Created Perplexity API session');
          return sessionInfo;
        }
      } catch (error) {
        console.warn('Perplexity API key verification failed, falling back to browser method', error);
        // Fall through to browser method
      }
    }
    
    // Fall back to browser automation
    try {
      const browserId = await BrowserAutomation.createSession(sessionId);
      
      // Tentamos verificar se a autenticação foi bem-sucedida
      // Como não podemos acessar activeSessions diretamente, vamos adicionar um método para isso
      // na implementação final do BrowserAutomation
      const isAuthenticated = await this.checkBrowserAuthentication(browserId);
      
      const sessionInfo: PerplexitySessionInfo = {
        sessionId,
        method: 'browser',
        authenticated: isAuthenticated,
        lastActivityTime: Date.now()
      };
      
      this.activeSessions.set(sessionId, sessionInfo);
      console.log('Created Perplexity browser session');
      return sessionInfo;
    } catch (error) {
      console.error('Failed to create Perplexity session:', error);
      throw new Error(`Failed to create Perplexity session: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Verifica se uma sessão de navegador está autenticada
   * Este método seria substituído por uma implementação adequada no BrowserAutomation
   * quando for implementado
   */
  private static async checkBrowserAuthentication(sessionId: string): Promise<boolean> {
    try {
      // Implementação simulada - na prática, isso seria uma chamada ao BrowserAutomation
      // para verificar o status de autenticação da sessão
      return false; 
    } catch (error) {
      console.error('Error checking browser authentication:', error);
      return false;
    }
  }

  /**
   * Gets a response from Perplexity
   * @param sessionId The session ID to use
   * @param prompt The prompt to send to Perplexity
   * @param options Optional settings for the request
   * @returns The AI response or null if unavailable
   */
  static async getResponse(
    sessionId: string, 
    prompt: string,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      retry?: boolean;
    }
  ): Promise<string | null> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error('Invalid session');
    }
    
    session.lastActivityTime = Date.now();
    let response: string | null = null;
    
    // Try API method first if session is using API
    if (session.method === 'api') {
      try {
        response = await this.getApiResponse(sessionId, prompt, options);
        if (response) return response;
      } catch (error) {
        console.error('API method failed:', error);
        
        // If retry option is set, fall back to browser method
        if (options?.retry !== false) {
          console.log('Falling back to browser method...');
          try {
            // Create a new browser session
            const browserSessionId = await BrowserAutomation.createSession(uuidv4());
            
            // Update session info to use browser method
            session.method = 'browser';
            this.activeSessions.set(sessionId, session);
            
            // Continue to browser method below
          } catch (browserError) {
            console.error('Failed to create browser session for fallback:', browserError);
            throw new Error(`Perplexity API method failed and browser fallback creation failed: ${error.message}`);
          }
        } else {
          throw error;
        }
      }
    }
    
    // Use browser method if API wasn't used or failed
    if (session.method === 'browser') {
      try {
        response = await BrowserAutomation.getAIResponse(sessionId, prompt);
      } catch (error) {
        console.error('Browser method failed:', error);
        throw new Error(`Failed to get Perplexity response: ${error.message}`);
      }
    }
    
    return response;
  }

  /**
   * Gets a response from the Perplexity API
   * @param sessionId The session ID
   * @param prompt The prompt to send
   * @param options Optional settings
   * @returns The API response or null if unavailable
   */
  private static async getApiResponse(
    sessionId: string,
    prompt: string,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string | null> {
    const secureConfig = await getSecureConfig();
    if (!secureConfig.perplexityApiKey) {
      return null;
    }
    
    try {
      const response = await axios.post(
        `${this.API_BASE_URL}/chat/completions`,
        {
          model: options?.model || 'claude-3.7',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: options?.temperature || 0.7,
          max_tokens: options?.maxTokens || 4000
        },
        {
          headers: {
            'Authorization': `Bearer ${secureConfig.perplexityApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Update session with successful API call
      const session = this.activeSessions.get(sessionId);
      if (session) {
        session.lastActivityTime = Date.now();
        session.model = options?.model || 'claude-3.7';
        this.activeSessions.set(sessionId, session);
      }
      
      if (response.data && response.data.choices && response.data.choices.length > 0) {
        return response.data.choices[0].message.content;
      }
      return null;
    } catch (error) {
      console.error('Perplexity API error:', error);
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(`Perplexity API error: ${error.response.status} - ${error.response.data.error?.message || 'Unknown error'}`);
      }
      throw error;
    }
  }

  /**
   * Closes a Perplexity session
   * @param sessionId The session ID to close
   */
  static async closeSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;
    
    try {
      if (session.method === 'browser') {
        await BrowserAutomation.closeSession(sessionId);
      }
    } catch (error) {
      console.error(`Error closing session ${sessionId}:`, error);
    } finally {
      this.activeSessions.delete(sessionId);
    }
  }

  /**
   * Verifies a Perplexity API key
   * @param apiKey The API key to verify
   * @returns True if the API key is valid, false otherwise
   */
  static async verifyApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await axios.get(`${this.API_BASE_URL}/models`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      return response.status === 200;
    } catch (error) {
      console.error('API key verification failed:', error);
      return false;
    }
  }
}
