import { browserService, PerplexityService } from '../services/browser';
import { getSecureConfig } from '../core/config';

// Callback mapping of human relay response.
const humanRelayCallbacks = new Map<string, (response: string | undefined) => void>();

/**
 * Register a callback function for human relay response.
 * @param requestId - The unique identifier for the request
 * @param callback - The callback function to invoke with the response
 */
export const registerHumanRelayCallback = (
  requestId: string, 
  callback: (response: string | undefined) => void
): void => {
  humanRelayCallbacks.set(requestId, callback);
};

/**
 * Unregister a previously registered callback
 * @param requestId - The unique identifier for the request
 */
export const unregisterHumanRelayCallback = (requestId: string): boolean => {
  return humanRelayCallbacks.delete(requestId);
};

/**
 * Tenta obter uma resposta do Perplexity usando API ou automação do navegador
 * 
 * @param prompt - O prompt a ser enviado para o Perplexity
 * @returns Uma resposta do Perplexity ou null se falhar
 */
async function getPerplexityAutomatedResponse(prompt: string): Promise<string | null> {
  console.log('Attempting to get automated response from Perplexity');
  
  try {
    // Primeiro, vamos verificar se temos a chave de API do Perplexity configurada
    const secureConfig = await getSecureConfig();
    let sessionId: string;
    let useDirectApiCall = false;
    
    // Se temos uma chave API, vamos tentar usar a API diretamente
    if (secureConfig.perplexityApiKey) {
      try {
        console.log('API key found, attempting to create API-based Perplexity session');
        const session = await PerplexityService.createSession();
        sessionId = session.sessionId;
        useDirectApiCall = session.method === 'api';
        console.log(`Created Perplexity session (${session.method} method): ${sessionId}`);
      } catch (apiError) {
        console.error('Failed to create Perplexity session using API method:', apiError);
        console.log('Falling back to browser service');
        sessionId = await browserService.createPerplexitySession();
        console.log(`Created Perplexity browser session: ${sessionId}`);
      }
    } else {
      console.log('No Perplexity API key found, using browser automation');
      sessionId = await browserService.createPerplexitySession();
      console.log(`Created Perplexity browser session: ${sessionId}`);
    }
    
    // Obtém a resposta do Perplexity
    let response: string | null;
    if (useDirectApiCall) {
      try {
        console.log('Using direct API call to Perplexity');
        response = await PerplexityService.getResponse(sessionId, prompt, {
          model: 'claude-3.7',
          retry: false // Desabilita o fallback durante chamada direta da API
        });
      } catch (apiError) {
        console.error('API call to Perplexity failed:', apiError);
        console.log('Falling back to browser method');
        response = await browserService.getPerplexityResponse(sessionId, prompt);
      }
    } else {
      // Usa o browserService que pode utilizar tanto PerplexityService quanto BrowserAutomation
      response = await browserService.getPerplexityResponse(sessionId, prompt);
    }
    
    // Limpa a sessão independentemente do resultado
    try {
      await browserService.closePerplexitySession(sessionId);
      console.log(`Closed Perplexity session: ${sessionId}`);
    } catch (closeError) {
      console.error(`Error closing Perplexity session: ${closeError}`);
      // Continua apesar do erro de fechamento da sessão
    }
    
    return response;
  } catch (error) {
    console.error('Failed to get automated response from Perplexity:', error);
    return null;
  }
}

/**
 * Handles human relay response from the system
 * Attempts to use Perplexity automation if no manual response is provided
 * 
 * @param response - The response object containing requestId, optional text, cancelled flag, and prompt
 */
export const handleHumanRelayResponse = async (response: { 
  requestId: string; 
  text?: string; 
  cancelled?: boolean; 
  prompt?: string 
}): Promise<void> => {
  const callback = humanRelayCallbacks.get(response.requestId);
  
  // Se não houver resposta manual e não for cancelado, tenta automação com Perplexity
  if (!response.text && !response.cancelled) {
    try {
      // Precisamos do texto do prompt para enviar ao Perplexity
      if (!response.prompt) {
        console.error('No prompt provided for Perplexity automation');
        // Passa para o modo manual
      } else {
        console.log(`Attempting Perplexity automation for request ${response.requestId}`);
        
        // Tenta obter resposta automatizada
        const autoResponse = await getPerplexityAutomatedResponse(response.prompt);
        
        // Processa a resposta
        if (autoResponse) {
          console.log(`Using automated Perplexity response for request ${response.requestId}`);
          callback?.(autoResponse);
          humanRelayCallbacks.delete(response.requestId);
          return;
        } else {
          console.error('Perplexity automation returned null response');
          // Passa para o modo manual
        }
      }
    } catch (error) {
      console.error('Perplexity automation failed:', error);
      // Passa para o modo manual
    }
  }

  // Modo manual (resposta do usuário ou cancelado)
  if (callback) {
    if (response.cancelled) {
      callback(undefined);
    } else {
      callback(response.text);
    }

    humanRelayCallbacks.delete(response.requestId);
  }
};
