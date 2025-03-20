import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '../configService';
import { LogService } from '../../utils/logService';

/**
 * Tipo de modelo de IA suportado
 */
export type AIModel = 'openai-gpt4-vision' | 'gemini-pro-vision' | 'claude-3-opus';

/**
 * Tipos de tarefas de processamento de imagem suportadas
 */
export type ImageTaskType = 
  | 'extract-data'      // Extrair dados estruturados de uma imagem
  | 'analyze-captcha'   // Analisar e resolver captchas
  | 'detect-honeypot'   // Detectar elementos honeypot
  | 'analyze-content'   // Analisar conteúdo para verificar qualidade
  | 'extract-text';     // OCR para extrair texto

/**
 * Resultado de processamento de imagem
 */
export interface ImageProcessingResult {
  success: boolean;
  data?: any;
  error?: string;
  confidence?: number;
  processingTime?: number;
}

/**
 * Opções para processamento de imagem
 */
export interface ImageProcessingOptions {
  model?: AIModel;
  maxTokens?: number;
  temperature?: number;
  extractionSchema?: Record<string, string>;
  customPrompt?: string;
  language?: string;
}

/**
 * Serviço para processamento de imagens e texto usando modelos de IA
 */
export class AIProcessingService {
  private config: ConfigService;
  private logService: LogService;
  
  constructor(config: ConfigService, logService: LogService) {
    this.config = config;
    this.logService = logService;
  }
  
  /**
   * Inicializa o serviço de IA
   */
  public async initialize(): Promise<boolean> {
    try {
      const aiConfig = this.config.getAIConfiguration();
      
      if (!aiConfig.enabled) {
        this.logService.info('Serviço de IA desativado nas configurações');
        return false;
      }
      
      if (!aiConfig.apiKey) {
        this.logService.warn('Chave de API para serviço de IA não configurada');
        return false;
      }
      
      this.logService.info(`Serviço de IA inicializado com provedor: ${aiConfig.provider}`);
      return true;
    } catch (error) {
      this.logService.error('Erro ao inicializar serviço de IA', error);
      return false;
    }
  }
  
  /**
   * Processa uma imagem e extrai dados estruturados
   * @param imagePath Caminho para imagem local ou buffer da imagem
   * @param taskType Tipo de tarefa a ser realizada
   * @param options Opções adicionais de processamento
   */
  public async processImage(
    imagePath: string | Buffer,
    taskType: ImageTaskType,
    options: ImageProcessingOptions = {}
  ): Promise<ImageProcessingResult> {
    try {
      const startTime = Date.now();
      
      // Obter configuração de IA
      const aiConfig = this.config.getAIConfiguration();
      
      if (!aiConfig.enabled) {
        return { 
          success: false, 
          error: 'Serviço de IA não está habilitado nas configurações' 
        };
      }
      
      // Verificar parâmetros do modelo
      const model = options.model || this.getDefaultModel(aiConfig.provider);
      const temperature = options.temperature ?? aiConfig.modelParameters?.temperature ?? 0.2;
      const maxTokens = options.maxTokens ?? aiConfig.modelParameters?.maxTokens ?? 1000;
      
      // Carregar imagem como Base64, se for um caminho
      let imageBase64: string;
      if (typeof imagePath === 'string') {
        if (!fs.existsSync(imagePath)) {
          return { success: false, error: `Arquivo de imagem não encontrado: ${imagePath}` };
        }
        const imageBuffer = fs.readFileSync(imagePath);
        imageBase64 = imageBuffer.toString('base64');
      } else {
        imageBase64 = imagePath.toString('base64');
      }
      
      // Gerar prompt baseado no tipo de tarefa
      const prompt = this.generatePrompt(taskType, options);
      
      // Enviar para o modelo específico
      let result;
      
      switch (aiConfig.provider) {
        case 'openai':
          result = await this.processWithOpenAI(imageBase64, prompt, model, maxTokens, temperature);
          break;
        case 'gemini':
          result = await this.processWithGemini(imageBase64, prompt, model, maxTokens, temperature);
          break;
        case 'claude':
          result = await this.processWithClaude(imageBase64, prompt, model, maxTokens, temperature);
          break;
        default:
          return { success: false, error: `Provedor de IA não suportado: ${aiConfig.provider}` };
      }
      
      // Calcular tempo de processamento
      const processingTime = Date.now() - startTime;
      
      // Processar a resposta de acordo com o tipo de tarefa
      const responseResult = this.parseResponse(result, taskType, options);
      
      // Garantir que success sempre seja definido
      return {
        success: responseResult.success === undefined ? true : responseResult.success,
        data: responseResult.data,
        error: responseResult.error,
        confidence: responseResult.confidence,
        processingTime
      };
      
    } catch (error) {
      this.logService.error(`Erro ao processar imagem: ${error.message}`, error);
      return { 
        success: false, 
        error: `Erro ao processar imagem: ${error.message}` 
      };
    }
  }
  
  /**
   * Gera um prompt específico para o tipo de tarefa
   */
  private generatePrompt(taskType: ImageTaskType, options: ImageProcessingOptions): string {
    // Se há um prompt personalizado, usar este
    if (options.customPrompt) {
      return options.customPrompt;
    }
    
    const language = options.language || 'português';
    
    switch (taskType) {
      case 'extract-data':
        let schemaText = '';
        if (options.extractionSchema) {
          schemaText = 'Extraia os dados de acordo com o schema a seguir:\n';
          for (const [key, desc] of Object.entries(options.extractionSchema)) {
            schemaText += `- ${key}: ${desc}\n`;
          }
        }
        
        return `Analise esta captura de tela e extraia os dados estruturados mostrados.
${schemaText}
Responda apenas com o JSON dos dados, sem explicações adicionais.`;

      case 'analyze-captcha':
        return `Esta imagem contém um CAPTCHA. Analise cuidadosamente e informe o texto ou números exibidos.
Se o CAPTCHA for baseado em puzzle ou seleção de imagens, descreva o que é pedido e qual seria a resposta.
Se for um captcha de texto/números, responda apenas com o texto.`;

      case 'detect-honeypot':
        return `Analise esta página web e identifique elementos que podem ser honeypots ou armadilhas para bots.
Procure por:
1. Campos de formulário escondidos com CSS
2. Links invisíveis
3. Elementos clickbait projetados para detectar bots
4. Elementos com z-index negativo

Responda em formato JSON com os elementos suspeitos encontrados, suas posições e por que você os considera honeypots.`;

      case 'analyze-content':
        return `Analise o conteúdo desta página web e determine:
1. Se o conteúdo parece ser real ou um placeholder/erro
2. Se há indicações de que o acesso foi bloqueado ou limitado
3. Se aparecem mensagens de detecção de bot ou necessidade de verificação
4. Qualidade do conteúdo carregado (completo, parcial, com erros)

Responda em formato JSON com uma análise detalhada.`;

      case 'extract-text':
        return `Realize OCR nesta imagem e extraia todo o texto visível. Mantenha a formatação o máximo possível.
Responda apenas com o texto extraído, sem explicações adicionais.`;
        
      default:
        return `Analise esta imagem e descreva detalhadamente o que você vê em ${language}.`;
    }
  }
  
  /**
   * Processa a imagem usando a API da OpenAI (GPT-4 Vision)
   */
  private async processWithOpenAI(
    imageBase64: string,
    prompt: string,
    model: string,
    maxTokens: number,
    temperature: number
  ): Promise<string> {
    try {
      const apiKey = this.config.getAIConfiguration().apiKey;
      
      // Determinar URL da API
      const apiUrl = 'https://api.openai.com/v1/chat/completions';
      
      // Montar payload
      const payload = {
        model: model === 'openai-gpt4-vision' ? 'gpt-4-vision-preview' : model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: maxTokens,
        temperature: temperature
      };
      
      // Fazer requisição
      const response = await axios.post(apiUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: this.config.getAIConfiguration().modelParameters?.timeout || 60000
      });
      
      // Extrair resposta
      return response.data.choices[0].message.content;
      
    } catch (error) {
      this.logService.error(`Erro ao processar com OpenAI: ${error.message}`, error);
      throw new Error(`Falha ao processar com OpenAI: ${error.message}`);
    }
  }
  
  /**
   * Processa a imagem usando a API do Google Gemini
   */
  private async processWithGemini(
    imageBase64: string,
    prompt: string,
    model: string,
    maxTokens: number,
    temperature: number
  ): Promise<string> {
    try {
      const apiKey = this.config.getAIConfiguration().apiKey;
      
      // Determinar URL da API
      const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent';
      
      // Montar payload
      const payload = {
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: imageBase64
                }
              }
            ]
          }
        ],
        generation_config: {
          max_output_tokens: maxTokens,
          temperature: temperature
        }
      };
      
      // Fazer requisição
      const response = await axios.post(`${apiUrl}?key=${apiKey}`, payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: this.config.getAIConfiguration().modelParameters?.timeout || 60000
      });
      
      // Extrair resposta
      return response.data.candidates[0].content.parts[0].text;
      
    } catch (error) {
      this.logService.error(`Erro ao processar com Gemini: ${error.message}`, error);
      throw new Error(`Falha ao processar com Gemini: ${error.message}`);
    }
  }
  
  /**
   * Processa a imagem usando a API da Anthropic (Claude)
   */
  private async processWithClaude(
    imageBase64: string,
    prompt: string,
    model: string,
    maxTokens: number,
    temperature: number
  ): Promise<string> {
    try {
      const apiKey = this.config.getAIConfiguration().apiKey;
      
      // Determinar URL da API e modelo
      const apiUrl = 'https://api.anthropic.com/v1/messages';
      const claudeModel = model === 'claude-3-opus' ? 'claude-3-opus-20240229' : 'claude-3-sonnet-20240229';
      
      // Montar payload
      const payload = {
        model: claudeModel,
        max_tokens: maxTokens,
        temperature: temperature,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: imageBase64
                }
              }
            ]
          }
        ]
      };
      
      // Fazer requisição
      const response = await axios.post(apiUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        timeout: this.config.getAIConfiguration().modelParameters?.timeout || 60000
      });
      
      // Extrair resposta
      return response.data.content[0].text;
      
    } catch (error) {
      this.logService.error(`Erro ao processar com Claude: ${error.message}`, error);
      throw new Error(`Falha ao processar com Claude: ${error.message}`);
    }
  }
  
  /**
   * Converte a resposta do modelo para o formato adequado
   */
  private parseResponse(
    responseText: string,
    taskType: ImageTaskType,
    options: ImageProcessingOptions
  ): Partial<ImageProcessingResult> {
    try {
      switch (taskType) {
        case 'extract-data':
        case 'detect-honeypot':
        case 'analyze-content':
          // Tentar extrair um JSON da resposta
          const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || 
                          responseText.match(/\{[\s\S]*\}/);
          
          if (jsonMatch) {
            const jsonStr = jsonMatch[0].replace(/```json|```/g, '').trim();
            const data = JSON.parse(jsonStr);
            return { success: true, data };
          } else {
            // Tentar interpretar toda a resposta como JSON
            try {
              const data = JSON.parse(responseText.trim());
              return { success: true, data };
            } catch {
              // Se não for possível, retornar o texto como está
              return { 
                success: true, 
                data: { raw: responseText.trim() },
                confidence: 0.7
              };
            }
          }
          
        case 'analyze-captcha':
          // Para captchas, geralmente queremos apenas o texto da solução
          const captchaText = responseText.trim().split('\n')[0].trim();
          return { 
            success: true, 
            data: { solution: captchaText },
            confidence: this.estimateCaptchaConfidence(responseText) 
          };
          
        case 'extract-text':
          // Apenas retornar o texto extraído
          return { 
            success: true, 
            data: { text: responseText.trim() },
            confidence: 0.95
          };
          
        default:
          return { 
            success: true, 
            data: { response: responseText.trim() } 
          };
      }
    } catch (error) {
      this.logService.error(`Erro ao processar resposta: ${error.message}`, error);
      return { 
        success: false,
        error: `Falha ao processar resposta do modelo: ${error.message}`
      };
    }
  }
  
  /**
   * Salva uma captura de tela no disco
   */
  public async saveScreenshot(
    imageBuffer: Buffer, 
    prefix: string, 
    targetUrl: string
  ): Promise<string> {
    try {
      // Obter diretório de armazenamento
      const storageDir = path.join(
        this.config.getDataDirectory(),
        'screenshots'
      );
      
      // Garantir que o diretório existe
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }
      
      // Gerar nome de arquivo baseado na URL e timestamp
      const urlHash = Buffer.from(targetUrl).toString('base64').replace(/[+/=]/g, '').substring(0, 16);
      const timestamp = Math.floor(Date.now() / 1000);
      const fileName = `${prefix}_${urlHash}_${timestamp}.jpg`;
      
      // Caminho completo
      const filePath = path.join(storageDir, fileName);
      
      // Salvar imagem
      fs.writeFileSync(filePath, imageBuffer);
      
      return filePath;
    } catch (error) {
      this.logService.error(`Erro ao salvar screenshot: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Estima a confiança da resolução de um captcha com base na resposta
   */
  private estimateCaptchaConfidence(response: string): number {
    const lowerResponse = response.toLowerCase();
    
    // Se menciona incerteza, baixa confiança
    if (lowerResponse.includes('não tenho certeza') || 
        lowerResponse.includes('difícil de ler') ||
        lowerResponse.includes('pode ser') ||
        lowerResponse.includes('talvez') ||
        lowerResponse.includes('não consigo')){
      return 0.3;
    }
    
    // Se a resposta é muito longa ou tem múltiplas opções
    if (response.includes('\n') || response.includes('ou') || response.length > 20) {
      return 0.5;
    }
    
    // Respostas curtas e diretas tendem a ser mais confiáveis
    if (response.length < 10 && !lowerResponse.includes('acredito')) {
      return 0.85;
    }
    
    // Valor padrão
    return 0.7;
  }
  
  /**
   * Obtém o modelo padrão para o provedor
   */
  private getDefaultModel(provider: string): AIModel {
    switch (provider) {
      case 'openai':
        return 'openai-gpt4-vision';
      case 'gemini':
        return 'gemini-pro-vision';
      case 'claude':
        return 'claude-3-opus';
      default:
        return 'openai-gpt4-vision';
    }
  }
  
  /**
   * Executa análise de contexto para decidir a melhor estratégia de scraping
   */
  public async analyzeScrapingContext(
    screenshot: Buffer,
    html: string,
    url: string
  ): Promise<{
    strategy: ScrapingMethod,
    confidence: number,
    reason: string
  }> {
    try {
      // Salvar screenshot para análise
      const screenshotPath = await this.saveScreenshot(screenshot, 'analysis', url);
      
      // Criar prompt personalizado para análise de contexto
      const customPrompt = `Analise esta captura de tela de "${url}" para determinar a melhor estratégia de scraping.

Baseado no que você vê, determine qual abordagem seria mais eficaz:
1. "browser-automation": Automação completa de navegador (para sites complexos com muito JavaScript)
2. "api-client": Chamadas diretas a APIs (se identificar APIs no background)
3. "visual-scraping": Extrair dados das imagens (se houver proteções anti-scraping avançadas)
4. "hybrid": Abordagem combinada (navegador + análise visual)
5. "direct-request": Requisições HTTP diretas (para sites simples)

Considere:
- Presença de captchas ou verificações
- Complexidade do JavaScript
- Verificações de fingerprint
- Técnicas anti-bot visíveis
- APIs visíveis no front-end

Responda APENAS com um JSON no seguinte formato:
{
  "strategy": "uma das estratégias acima",
  "confidence": número de 0 a 1 representando sua confiança,
  "reason": "explicação breve para sua escolha"
}`;

      // Processar com IA
      const result = await this.processImage(
        Buffer.from(fs.readFileSync(screenshotPath)), 
        'extract-data',
        { customPrompt }
      );
      
      if (!result.success || !result.data) {
        throw new Error('Falha ao analisar contexto de scraping');
      }
      
      // Validar resultado
      const strategy = result.data.strategy as ScrapingMethod;
      const confidence = result.data.confidence as number;
      const reason = result.data.reason as string;
      
      return {
        strategy: strategy || 'browser-automation',
        confidence: confidence || 0.5,
        reason: reason || 'Análise padrão'
      };
      
    } catch (error) {
      this.logService.error(`Erro ao analisar contexto de scraping: ${error.message}`, error);
      
      // Retornar estratégia padrão em caso de erro
      return {
        strategy: 'browser-automation',
        confidence: 0.5,
        reason: `Fallback devido a erro: ${error.message}`
      };
    }
  }
  
  /**
   * Analisa e extrai seletores para capturar dados de uma página
   */
  public async suggestSelectors(
    screenshot: Buffer,
    html: string,
    url: string,
    targetData: string[]
  ): Promise<Selector[]> {
    try {
      // Criar prompt personalizado para geração de seletores
      const customPrompt = `Analise esta página web e ajude-me a extrair os seguintes dados:
${targetData.map(item => `- ${item}`).join('\n')}

Observe a captura de tela e determine os melhores seletores CSS ou XPath para extrair esses dados.
Para cada item, forneça:
1. Um seletor CSS ideal (preciso e robusto)
2. Um seletor XPath alternativo
3. O tipo de dado esperado
4. Quaisquer transformações necessárias

Responda com JSON no seguinte formato:
{
  "selectors": [
    {
      "name": "nome do campo",
      "description": "o que este campo representa",
      "cssSelector": "seletor css",
      "xpathSelector": "seletor xpath",
      "dataType": "texto|número|data|booleano|lista",
      "transform": "qualquer transformação necessária",
      "multiple": true/false
    }
  ]
}`;

      // Processar com IA
      const result = await this.processImage(
        screenshot,
        'extract-data',
        { customPrompt }
      );
      
      if (!result.success || !result.data || !result.data.selectors) {
        throw new Error('Falha ao gerar seletores');
      }
      
      // Converter para formato de seletores do sistema
      const suggestedSelectors: Selector[] = result.data.selectors.map((sel: any) => ({
        name: sel.name,
        selector: sel.cssSelector || sel.xpathSelector,
        selectorType: sel.cssSelector ? 'css' : 'xpath',
        multiple: sel.multiple || false,
        transform: sel.transform,
        required: true
      }));
      
      return suggestedSelectors;
      
    } catch (error) {
      this.logService.error(`Erro ao sugerir seletores: ${error.message}`, error);
      return [];
    }
  }
  
  /**
   * Detecta e analisa desafios em uma página (captchas, verificações, etc)
   */
  public async detectChallenges(
    screenshot: Buffer
  ): Promise<{
    hasChallenges: boolean,
    challenges: Array<{
      type: 'captcha' | 'browser-check' | 'behavioral-check' | 'ip-block' | 'other',
      description: string,
      solvable: boolean,
      solution?: string
    }>
  }> {
    try {
      // Criar prompt personalizado para detecção de desafios
      const customPrompt = `Analise esta captura de tela e identifique se há desafios anti-bot ou proteções visíveis.

Procure por:
1. CAPTCHAs (reCAPTCHA, hCaptcha, etc)
2. Verificações de navegador
3. Mensagens de bloqueio de IP
4. Mensagens sobre comportamento suspeito
5. Desafios de JavaScript
6. Redirecionamentos de proteção

Responda com JSON no seguinte formato:
{
  "hasChallenges": true/false,
  "challenges": [
    {
      "type": "captcha|browser-check|behavioral-check|ip-block|other",
      "description": "descrição detalhada do desafio",
      "solvable": true/false,
      "solution": "solução sugerida, se aplicável"
    }
  ]
}`;

      // Processar com IA
      const result = await this.processImage(
        screenshot,
        'extract-data',
        { customPrompt }
      );
      
      if (!result.success || !result.data) {
        throw new Error('Falha ao detectar desafios');
      }
      
      return {
        hasChallenges: result.data.hasChallenges || false,
        challenges: result.data.challenges || []
      };
      
    } catch (error) {
      this.logService.error(`Erro ao detectar desafios: ${error.message}`, error);
      return {
        hasChallenges: false,
        challenges: []
      };
    }
  }
}

/**
 * Definição de seletor para extração de dados
 */
interface Selector {
  name: string;
  selector: string;
  selectorType: 'css' | 'xpath';
  multiple?: boolean;
  transform?: string;
  required?: boolean;
}

/**
 * Tipos de métodos de scraping disponíveis
 */
type ScrapingMethod = 
  | 'browser-automation' 
  | 'api-client' 
  | 'visual-scraping' 
  | 'hybrid' 
  | 'direct-request';
