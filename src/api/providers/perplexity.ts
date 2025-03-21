import * as vscode from "vscode"
import axios from "axios"
import { ApiHandlerOptions } from "../../shared/api"
import * as puppeteer from "puppeteer-core"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { ProgressLocation } from "vscode"

// Configurações
const DEFAULT_TIMEOUT = 60000 // 60 segundos
const RETRY_TIMEOUT = 1000 // 1 segundo
const MAX_RETRIES = 3

interface PerplexityMessage {
  role: string
  content: any[]
}

interface PerplexityMessageContent {
  type: string
  text?: string
  image_url?: {
    url: string
  }
}

interface PerplexityApiResponse {
  id: string
  choices: {
    message: {
      content: string
      role: string
    }
  }[]
}

// Gerenciamento de logs
function createLogger(loggingEnabled = false, alternativeDir?: string) {

  // Verificar diretamente se o diretório de logs existe
  console.log('🔴 PERPLEXITY DEBUG: Verificando diretório de logs');
  const logDirPath = (() => {
    if (process.platform === "win32") {
      return path.join(os.homedir(), 'AppData', 'Roaming', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline');
    } else if (process.platform === "darwin") {
      return path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline');
    } else {
      return path.join(os.homedir(), '.config', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline');
    }
  })();
  
  console.log('🔴 PERPLEXITY DEBUG: Diretório de logs definido como:', logDirPath);
  console.log('🔴 PERPLEXITY DEBUG: Diretório existe?', fs.existsSync(logDirPath));
  
  // Criar diretório de logs temporário no diretório atual se o padrão não funcionar
  if (!fs.existsSync(logDirPath)) {
    const tempLogDir = path.join(__dirname, 'temp-logs');
    console.log('🔴 PERPLEXITY DEBUG: Tentando criar diretório temporário:', tempLogDir);
    
    try {
      if (!fs.existsSync(tempLogDir)) {
        fs.mkdirSync(tempLogDir, { recursive: true });
      }
      console.log('🔴 PERPLEXITY DEBUG: Usando diretório de logs temporário:', tempLogDir);
      return createLogger(loggingEnabled, tempLogDir); 
    } catch (e) {
      console.error('🔴 PERPLEXITY DEBUG ERROR: Falha ao criar diretório temporário:', e);
    }
  }

  // Diretório de logs - use uma localização mais acessível
  const logDir = (() => {
    if (alternativeDir) {
      return alternativeDir;
    } else if (process.platform === "win32") {
      return path.join(os.homedir(), 'AppData', 'Roaming', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline');
    } else if (process.platform === "darwin") {
      return path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline');
    } else {
      return path.join(os.homedir(), '.config', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline');
    }
  })();
  
  const logFile = path.join(logDir, 'perplexity-logs.txt');
  
  // Criar diretório se não existir, com tratamento de erro mais robusto
  try {
    if (!fs.existsSync(logDir)) {
      try {
        fs.mkdirSync(logDir, { recursive: true });
        // Verificação adicional para confirmar criação
        if (!fs.existsSync(logDir)) {
          console.error(`Erro: Diretório de logs não foi criado: ${logDir}`);
        } else {
          console.log(`Diretório de logs criado com sucesso: ${logDir}`);
          // Tentar criar um arquivo inicial para garantir permissões
          fs.writeFileSync(logFile, `--- Log iniciado ${new Date().toISOString()} ---\n`);
          console.log(`Arquivo de log inicializado: ${logFile}`);
        }
      } catch (mkdirError) {
        console.error(`Erro fatal ao criar diretório de logs: ${mkdirError}`);
        // Tente um diretório alternativo como fallback se não estamos já usando um alternativo
        if (!alternativeDir) {
          try {
            const tempDir = path.join(os.tmpdir(), 'roo-cline-logs');
            if (!fs.existsSync(tempDir)) {
              fs.mkdirSync(tempDir, { recursive: true });
            }
            return createLogger(loggingEnabled, tempDir);
          } catch (tempError) {
            console.error(`Também falhou ao usar diretório temporário: ${tempError}`);
          }
        }
      }
    }
  } catch (dirError) {
    console.error(`Exceção ao verificar diretório de logs: ${dirError}`);
  }
  
  // Função auxiliar para garantir escrita de logs
  const safeAppendToLog = (level: string, message: string) => {
    try {
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}][${level}] ${message}\n`;
      
      // Log no console sempre
      const consoleMethod = level === 'ERROR' ? console.error : 
                          level === 'WARN' ? console.warn : console.log;
      consoleMethod(`[Perplexity][${level}] ${message}`);
      
      // Log em arquivo somente se habilitado
      if (loggingEnabled) {
        try {
          fs.appendFileSync(logFile, logEntry);
        } catch (appendError) {
          console.error(`Erro ao escrever no arquivo de log: ${appendError}`);
          // Tentar criar o arquivo novamente
          try {
            fs.writeFileSync(logFile, `--- Log recriado ${timestamp} ---\n${logEntry}`);
          } catch (recreateError) {
            console.error(`Falha também ao recriar arquivo: ${recreateError}`);
          }
        }
      }
    } catch (error) {
      console.error(`Meta-erro no sistema de logs: ${error}`);
    }
  };
  
  return {
    debug: (message: string) => {
      if (loggingEnabled) {
        safeAppendToLog('DEBUG', message);
      }
    },
    warn: (message: string) => {
      safeAppendToLog('WARN', message);
    },
    info: (message: string) => {
      safeAppendToLog('INFO', message);
    },
    error: (message: string, error?: any) => {
      const errorMessage = error ? `${message}: ${error.message || error}` : message;
      safeAppendToLog('ERROR', errorMessage);
      
      if (loggingEnabled && error) {
        // Log detalhado de erros
        try {
          if (error.response) {
            safeAppendToLog('ERROR_DETAILS', JSON.stringify(error.response.data || 'No details'));
          }
          if (error.stack) {
            safeAppendToLog('STACK', error.stack);
          }
        } catch (e) {
          safeAppendToLog('META_ERROR', `Erro ao logar detalhes: ${e}`);
        }
      }
    },
    critical: (message: string, error?: any) => {
      // Logs críticos sempre são gravados, mesmo se logging desabilitado
      const errorMessage = error ? `${message}: ${error.message || error}` : message;
      safeAppendToLog('CRITICAL', `ATENÇÃO - ERRO GRAVE: ${errorMessage}`);
      
      // Sempre tenta gravar no arquivo, mesmo com logging desabilitado
      try {
        const timestamp = new Date().toISOString();
        fs.appendFileSync(logFile, `[${timestamp}][CRITICAL] ${errorMessage}\n`);
        if (error && error.stack) {
          fs.appendFileSync(logFile, `[${timestamp}][STACK] ${error.stack}\n`);
        }
      } catch (criticalError) {
        console.error(`Não foi possível registrar erro crítico: ${criticalError}`);
      }
    }
  };
}

// Função simplificada para imagens - já que não podemos importar getEmbeddedImageBase64
async function processImage(imageUrl: string, logger: any): Promise<string | null> {
  try {
    // Na versão atual, as imagens não são suportadas na automação de navegador,
    // então retornamos null
    logger.debug(`Image handling not implemented for ${imageUrl}`);
    return null;
  } catch (error) {
    logger.error(`Failed to process image`, error);
    return null;
  }
}

export async function perplexityCompletion(
  messages: { role: string; content: string }[],
  imageUrls: string[] | null,
  options: ApiHandlerOptions,
  onPartialResponse: ((content: string) => void) | null,
  signal?: AbortSignal,
  maxTokens: number = 200000
) {

  console.log('🔴 PERPLEXITY DEBUG: Iniciando chamada a perplexityCompletion');
  console.log('🔴 PERPLEXITY CONFIG:', {
    email: perplexityEmail ? 'presente' : 'ausente',
    password: perplexityPassword ? 'presente' : 'ausente',
    apiKey: perplexityApiKey ? 'presente' : 'ausente',
    preferMethod: perplexityPreferMethod,
    loggingEnabled: perplexityLoggingEnabled
  });

  const {
    perplexityEmail,
    perplexityPassword,
    perplexityApiKey,
    perplexityPreferMethod = "auto",
    perplexityLoggingEnabled = false,
    perplexityRequestTimeout = DEFAULT_TIMEOUT,
    apiModelId = "claude-3-7-sonnet",
  } = options;

  // Criar logger com suporte a logs críticos que sempre serão gravados
  const logger = createLogger(perplexityLoggingEnabled);
  logger.critical(`[INICIO] Solicitação Perplexity iniciada com método: ${perplexityPreferMethod}`);
  logger.debug(`Configurações: modelo=${apiModelId}, timeout=${perplexityRequestTimeout}ms, logging=${perplexityLoggingEnabled}`);
  
  // VERIFICAÇÃO FUNDAMENTAL: Qual método está selecionado
  logger.critical(`[VERIFICAÇÃO] Método selecionado: ${perplexityPreferMethod}`);
  
  try {
    // MODO BROWSER: Verificação separada e isolada para modo browser
    
    // MODO BROWSER: Verificação separada e isolada para modo browser
    if (perplexityPreferMethod === "browser") {

    console.log('🔴 PERPLEXITY DEBUG: Modo BROWSER selecionado explicitamente');
    console.log('🔴 PERPLEXITY BROWSER CONFIG:', {
      email: perplexityEmail ? 'presente' : 'ausente',
      password: perplexityPassword ? 'presente' : 'ausente',
      apiKey: perplexityApiKey ? 'presente' : 'ausente'
    });

      // Verificar credenciais exclusivamente para o modo browser
      logger.critical("MODO BROWSER selecionado explicitamente. Ignorando totalmente API.");
      
      if (!perplexityEmail || !perplexityPassword || 
          (typeof perplexityEmail === 'string' && perplexityEmail.trim() === '') || 
          (typeof perplexityPassword === 'string' && perplexityPassword.trim() === '')) {
        const erro = "Email e senha do Perplexity são necessários para o modo navegador. Configure-os nas configurações do RooCode.";
        logger.critical(`ERRO MODO BROWSER: ${erro}`);
        throw new Error(erro);
      }
      
      logger.info("Credenciais para modo BROWSER validadas. Prosseguindo com automação de navegador.");
      
      // Usar diretamente o browser sem nenhuma conversão de formato de mensagem para API
      return await vscode.window.withProgress(
        {
          location: ProgressLocation.Notification,
          title: "Perplexity Browser",
          cancellable: true,
        },
        async (progress, cancellationToken) => {
          if (cancellationToken.isCancellationRequested) {
            logger.info("Operação cancelada pelo usuário");
            throw new Error("Operação cancelada pelo usuário");
          }

          return await usePerplexityBrowser(
            perplexityEmail || '',
            perplexityPassword || '',
            messages,
            imageUrls,
            apiModelId,
            progress,
            cancellationToken,
            logger
          );
        }
      );
    }
  
    // MODO API: Verificação separada e isolada para modo API
    if (content === undefined) {
            contentDesc = "undefined";
          }
          else if (Array.isArray(content)) {
            // Explicitamente converter para array para evitar erro de tipo
            const arr = content as any[];
            contentDesc = `[Array com ${arr.length} itens]`;
          }
          else if (typeof content === 'string') {
            // Explicitamente converter para string para evitar erro de tipo
            const str = content as string;
            contentDesc = str.length > 100 ? `${str.substring(0, 100)}...` : str;
          }
          else {
            // Qualquer outro tipo
            contentDesc = `${typeof content}: ${String(content)}`;
          }
        } catch (e) {
          // Fallback se houver qualquer erro na conversão
          contentDesc = "Erro ao processar conteúdo para log";
        }
        
        return {
          role: msg.role,
          content: contentDesc
        };
      })
    };
    
    logger.debug(`Request body: ${JSON.stringify(safeRequestBody)}`);
    
    const response = await axios.post<PerplexityApiResponse>(
      "https://api.perplexity.ai/chat/completions",
      requestBody,
      {
        headers,
        timeout,
        signal,
        responseType: onPartialResponse ? "stream" : "json",
      }
    );
    
    logger.debug(`Resposta recebida com status: ${response.status}`);

    if (onPartialResponse) {
      // Processar streaming
      let buffer = ""
      const dataPrefix = "data: "
      const stream = response.data as any

      return new Promise((resolve, reject) => {
        let fullResponse = ""
        let chunkCount = 0;

        stream.on("data", (chunk: Buffer) => {
          if (signal?.aborted) {
            stream.destroy()
            logger.info("Requisição abortada pelo usuário");
            reject(new Error("Request aborted"))
            return
          }

          buffer += chunk.toString()
          chunkCount++;
          logger.debug(`Recebido chunk #${chunkCount} (${chunk.length} bytes)`);
          
          let newlineIndex
          while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, newlineIndex).trim()
            buffer = buffer.slice(newlineIndex + 1)

            if (line.startsWith(dataPrefix)) {
              const data = line.slice(dataPrefix.length)
              if (data === "[DONE]") {
                logger.debug("Stream concluído ([DONE] recebido)");
                continue;
              }

              try {
                const parsed = JSON.parse(data)
                if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                  const content = parsed.choices[0].delta.content
                  fullResponse += content
                  onPartialResponse(content)
                  logger.debug(`Conteúdo parcial recebido (${content.length} caracteres)`);
                }
              } catch (e) {
                logger.error(`Erro ao processar dados de streaming`, e);
              }
            }
          }
        })

        stream.on("end", () => {
          logger.info(`Stream concluído. Resposta total: ${fullResponse.length} caracteres`);
          resolve(fullResponse)
        })

        stream.on("error", (err: Error) => {
          logger.error(`Erro no stream de resposta`, err);
          reject(err)
        })
      })
    } else {
      // Resposta normal
      logger.info(`Resposta completa recebida (${JSON.stringify(response.data).length} bytes)`);
      return response.data.choices[0].message.content
    }
  } catch (error: any) {
    // Log detalhado e enriquecido do erro
    let errorDetails = "Erro desconhecido";
    let userFriendlyMessage = "Ocorreu um erro ao se comunicar com o Perplexity. Tente novamente mais tarde.";
    
    if (axios.isAxiosError(error)) {
      // Log dos headers da requisição (exceto auth) para debugging
      if (error.config && error.config.headers) {
        const safeHeaders = { ...error.config.headers };
        if ('Authorization' in safeHeaders) {
          safeHeaders['Authorization'] = 'Bearer [REDACTED]';
        }
        logger.debug(`Headers enviados na requisição: ${JSON.stringify(safeHeaders)}`);
      }
      
      if (error.response) {
        const status = error.response.status;
        const responseData = error.response.data || {};
        
        errorDetails = `Status HTTP: ${status}, Resposta: ${JSON.stringify(responseData)}`;
        logger.debug(`Resposta de erro completa: ${JSON.stringify(error.response.headers || {})}`);
        
        // Detecção e tratamento detalhado de erros específicos
        if (status === 400) {
          const errorType = responseData.error?.type || 'bad_request';
          logger.error(`Erro de requisição inválida (${errorType}): parâmetros incorretos ou mal formatados`, error);
          
          // Mensagens específicas baseadas no tipo de erro
          if (errorType.includes('authentication') || responseData.error?.message?.includes('authentication')) {
            userFriendlyMessage = "Erro de autenticação: método de autenticação não pode ser resolvido. Verifique suas configurações no Perplexity.";
          } else {
            userFriendlyMessage = "A requisição enviada ao Perplexity contém erros. Verifique as configurações e tente novamente.";
          }
        } 
        else if (status === 401) {
          logger.error(`Erro de autenticação (401): API key inválida ou expirada`, error);
          userFriendlyMessage = "Falha na autenticação da API Perplexity. Verifique se sua chave de API está correta e válida.";
        } 
        else if (status === 403) {
          logger.error(`Erro de permissão (403): Acesso negado`, error);
          userFriendlyMessage = "Acesso negado à API Perplexity. Sua chave de API pode não ter permissões para este modelo ou recurso.";
        } 
        else if (status === 404) {
          logger.error(`Erro 404: Recurso não encontrado`, error);
          userFriendlyMessage = "O recurso solicitado não foi encontrado na API do Perplexity. Verifique o modelo selecionado.";
        }
        else if (status === 429) {
          logger.error(`Limite de taxa excedido (429): Muitas requisições`, error);
          userFriendlyMessage = "Limite de requisições da API Perplexity excedido. Tente novamente mais tarde.";
        }
        else if (status >= 500) {
          logger.error(`Erro do servidor Perplexity (${status})`, error);
          userFriendlyMessage = "O servidor do Perplexity encontrou um erro. Tente novamente mais tarde.";
        }
      } 
      else if (error.request) {
        errorDetails = "Nenhuma resposta recebida do servidor";
        logger.error(`Erro de conexão: Solicitação enviada mas sem resposta`, error);
        logger.debug(`Detalhes da requisição: ${JSON.stringify(error.request)}`);
        userFriendlyMessage = "Não foi possível conectar à API Perplexity. Verifique sua conexão de internet.";
      } 
      else {
        errorDetails = error.message;
        logger.error(`Erro ao criar requisição: ${error.message}`, error);
        userFriendlyMessage = "Erro ao preparar a requisição para o Perplexity. Verifique a configuração.";
      }
    } 
    else if (error instanceof Error) {
      errorDetails = `Erro não-Axios: ${error.message}`;
      logger.error(`Erro não relacionado ao Axios: ${error.message}`, error);
    }
    
    // Log detalhado do erro para diagnosticar o problema
    logger.error(`Falha na requisição à API: ${errorDetails}`);
    
    // Log da pilha de chamadas para ajudar no diagnóstico
    if (error.stack) {
      logger.debug(`Stack trace: ${error.stack}`);
    }
    
    // Lançar erro com mensagem amigável para o usuário
    throw new Error(userFriendlyMessage);
  }
}

async function usePerplexityBrowser(
  email: string,
  password: string,
  messages: { role: string; content: string }[],
  imageUrls: string[] | null,
  modelId: string,
  progress: vscode.Progress<{ message?: string; increment?: number }>,
  cancellationToken: vscode.CancellationToken,
  logger: any
): Promise<string> {
  // Encontrar executável do Chrome
  let chromePath = ""
  
  // Verificar caminhos comuns baseados no SO
  if (process.platform === "win32") {
    chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    if (!fs.existsSync(chromePath)) {
      chromePath = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
    }
  } else if (process.platform === "darwin") {
    chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  } else {
    chromePath = "/usr/bin/google-chrome"
  }

  if (!fs.existsSync(chromePath)) {
    logger.error(`Chrome não encontrado em: ${chromePath}`);
    throw new Error("Não foi possível encontrar o Chrome. Por favor, instale o Google Chrome para usar esta funcionalidade.")
  }

  let browser: puppeteer.Browser | null = null
  try {
    progress.report({ message: "Iniciando navegador..." })
    logger.info("Iniciando navegador Puppeteer");
    
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true, // Mudado de "new" para boolean
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    })

    const page = await browser.newPage()
    logger.info("Navegador iniciado com sucesso");
    
    // Set viewport e agendar fechamento do navegador ao cancelar
    await page.setViewport({ width: 1280, height: 800 })
    cancellationToken.onCancellationRequested(() => {
      if (browser) {
        logger.info("Cancelamento solicitado, fechando navegador");
        browser.close().catch(e => logger.error("Erro ao fechar navegador", e))
      }
    })
    
    // Login no Perplexity
    progress.report({ message: "Acessando Perplexity..." })
    logger.info("Navegando para página de login do Perplexity");
    await page.goto("https://www.perplexity.ai/login", { timeout: 30000 })
    
    // Encontrar e preencher campo de email
    try { 
      logger.debug("Aguardando campo de email");
      await page.waitForSelector('input[type="email"]', { timeout: 5000 });
      
      // Mascarar email para logs
      const emailMask = email && email.includes('@') ? 
        `${email.substring(0, 3)}***@${email.split('@')[1]}` : 
        "email-inválido";
        
      logger.debug(`Preenchendo email: ${emailMask}`);
      await page.type('input[type="email"]', email);
    } catch (error) {
      logger.error("Não foi possível encontrar o campo de e-mail", error);
      throw new Error("Não foi possível encontrar o campo de e-mail na página de login do Perplexity. O site pode ter mudado ou está indisponível.");
    }
    
    // Clicar no botão de continuar
    logger.debug("Procurando botão de continuar");
    const continueButton = await page.$('button[type="submit"]')
    if (!continueButton) {
      logger.error("Botão de continuar não encontrado");
      throw new Error("Botão de continuar não encontrado na página de login do Perplexity");
    }
    
    logger.debug("Clicando no botão de continuar");
    await continueButton.click()
    
    // Esperar pelo campo de senha
    progress.report({ message: "Fazendo login..." })
    logger.debug("Aguardando campo de senha");
    await page.waitForSelector('input[type="password"]', { timeout: 10000 })
    logger.debug("Preenchendo senha");
    await page.type('input[type="password"]', password)
    
    // Submeter credenciais
    logger.debug("Procurando botão de login");
    const loginButton = await page.$('button[type="submit"]')
    if (!loginButton) {
      logger.error("Botão de login não encontrado");
      throw new Error("Botão de login não encontrado");
    }
    
    logger.debug("Clicando no botão de login");
    await loginButton.click()
    
    // Esperar pelo login ser concluído
    logger.debug("Aguardando navegação após login");
    await page.waitForNavigation({ timeout: 20000 }).catch(() => {
      // Às vezes não navega, mas o login acontece
      logger.debug("Timeout na navegação após login, mas continuando");
    })
    
    // Verificar se o login foi bem sucedido
    if (page.url().includes("login")) {
      logger.error(`Login falhou - ainda na página ${page.url()}`);
      throw new Error("Falha no login - verifique suas credenciais do Perplexity");
    }
    
    logger.info("Login bem-sucedido");
    progress.report({ message: "Configurando conversa..." })
    
    // Ir para uma nova conversa e selecionar o modelo Claude
    logger.debug("Navegando para a página inicial do Perplexity");
    
    try {
      await page.goto("https://www.perplexity.ai/", { timeout: 30000 });
      logger.debug("Aguardando botão de nova conversa");
      await page.waitForSelector('button[aria-label="New conversation"], button[aria-label="Nova conversa"]', { timeout: 10000 });
    } catch (error) {
      logger.error("Falha ao navegar para a página inicial ou encontrar o botão de nova conversa", error);
      throw new Error("Erro ao acessar a interface principal do Perplexity. Verifique se o site está acessível.");
    }
    
    // Encontrar e clicar no seletor de modelos
    logger.debug("Localizando seletor de modelos");
    
    try {
      await page.waitForSelector('div[role="button"]', { timeout: 5000 });
      const modelSelectors = await page.$$('div[role="button"]');
      
      if (modelSelectors.length === 0) {
        logger.error("Seletor de modelos não encontrado");
        throw new Error("Seletor de modelos não encontrado na interface do Perplexity");
      }
      
      logger.debug("Clicando no seletor de modelos");
      await modelSelectors[0].click();
      
      // Selecionar o modelo Claude na lista de opções
      logger.debug("Aguardando opções de modelos");
      await page.waitForSelector('div[role="menuitem"]', { timeout: 5000 });
      const menuItems = await page.$$('div[role="menuitem"]');
      
      logger.debug(`Encontradas ${menuItems.length} opções de modelo`);
      
      let modelFound = false;
      for (const item of menuItems) {
        const text = await page.evaluate((el: Element) => el.textContent || '', item);
        if (text && text.toLowerCase().includes("claude")) {
          logger.debug(`Modelo Claude encontrado: "${text}"`);
          await item.click();
          modelFound = true;
          break;
        }
      }
      
      if (!modelFound) {
        logger.warn("Modelo Claude não encontrado no menu de seleção, tentando prosseguir mesmo assim");
      }
      
      // Preparar e enviar a mensagem
      progress.report({ message: "Enviando mensagem..." });
      
      // Combinar todas as mensagens do usuário
      const userMessages = messages.filter(m => m.role === "user");
      let userMessage = "";
      
      // Garantir que temos conteúdo válido para enviar
      if (userMessages.length > 0) {
        userMessage = userMessages
          .map(m => m.content || '')
          .join("\n\n");
      } else {
        logger.warn("Nenhuma mensagem do usuário encontrada na conversa");
        userMessage = "Olá, preciso de ajuda com uma questão.";
      }
      
      logger.debug(`Preparada mensagem do usuário (${userMessages.length} mensagens combinadas, ${userMessage.length} caracteres)`);
      
      // Encontrar campo de texto e digitar mensagem
      logger.debug("Aguardando campo de texto");
      await page.waitForSelector('div[contenteditable="true"]', { timeout: 10000 });
      logger.debug(`Digitando mensagem (${userMessage.length} caracteres)`);
      await page.type('div[contenteditable="true"]', userMessage);
      
      // Se houver imagens, não podemos colocá-las diretamente usando o navegador headless
      if (imageUrls && imageUrls.length > 0) {
        logger.warn(`Imagens não podem ser adicionadas no modo navegador headless (ignorando ${imageUrls.length} imagens)`);
      }
      
      // Enviar mensagem
      logger.debug("Enviando mensagem (pressionando Enter)");
      await page.keyboard.press("Enter");
      
      // Esperar pela resposta
      progress.report({ message: "Aguardando resposta..." });
      logger.info("Mensagem enviada, aguardando resposta do Perplexity");
      
      // Aguardar pelo indicador de geração da resposta
      logger.debug("Esperando pelos primeiros elementos da resposta");
      await page.waitForSelector('div[data-key="assistant"] p, div[data-key="assistant"] li', { timeout: 60000 });
      
      // Esperar pela resposta completa
      let retries = 0;
      let previousResponseLength = 0;
      let responseStabilityCount = 0;
      let response = "";
      
      logger.debug("Monitorando conclusão da resposta");
      while (retries < 30 && responseStabilityCount < 5) {
        if (cancellationToken.isCancellationRequested) {
          logger.info("Operação cancelada pelo usuário");
          throw new Error("Operação cancelada pelo usuário");
        }
        
        // Substituir waitForTimeout por delay usando setTimeout
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verificar se ainda está gerando
        const isGenerating = await page.evaluate(() => {
          return document.querySelector('div.animate-pulse') !== null;
        });
        
        response = await page.evaluate(() => {
          const responseElement = document.querySelector('div[data-key="assistant"]');
          return responseElement ? responseElement.textContent || "" : "";
        });
        
        // Monitorar estabilidade da resposta
        if (response.length === previousResponseLength) {
          responseStabilityCount++;
          logger.debug(`Resposta estável ${responseStabilityCount}/5`);
        } else {
          responseStabilityCount = 0;
          logger.debug(`Tamanho da resposta: ${response.length} caracteres`);
        }
        
        if (!isGenerating && responseStabilityCount >= 3) {
          logger.debug("Geração parou e resposta estabilizou");
          break;
        }
        
        previousResponseLength = response.length;
        retries++;
        
        progress.report({
          message: `Recebendo resposta... ${response.length} caracteres`
        });
      }
      
      logger.info(`Resposta recebida: ${response.length} caracteres após ${retries} verificações`);
      
      // Remover elementos de interface que possam estar no texto
      response = response.replace(/Copiar\s*Compartilhar\s*Revisar/gi, "");
      response = response.replace(/Copy\s*Share\s*Review/gi, "");
      
      return response;
      
    } catch (error) {
      logger.error("Erro ao interagir com o seletor de modelos", error);
      throw error;
    }
    
  } catch (error) {
    logger.error(`Erro de automação de navegador`, error);
    throw error;
  } finally {
    if (browser) {
      logger.info("Fechando navegador");
      await browser.close();
    }
  }
}
