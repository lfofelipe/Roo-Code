# Advanced Scraper Solution

Um framework avançado para automação de navegador e scraping com recursos de evasão de detecção, gestão de identidades, proxies e processamento de imagens por IA.

## Recursos

- 🔄 Automação de navegador com múltiplas sessões e suporte a Firefox, Chromium e WebKit
- 🧠 Simulação realista de comportamento humano (digitação, movimento de mouse, erros de digitação)
- 🛡️ Técnicas avançadas de evasão de detecção para sites com proteções anti-bot
- 📊 Sistema robusto de gestão de identidades e rotação automática de proxies
- 🤖 Processamento visual por IA para análise de imagens e extração de dados
- 🔍 Detecção e resolução automática de captchas utilizando modelos de visão computacional
- 🎯 Sistema de tomada de decisão adaptativa baseado em ML
- 🧩 API flexível e extensível para integração com seus projetos
- 📈 Extração de dados com suporte a diferentes formatos e seletores

## Instalação

### Pré-requisitos

- Node.js 16 ou superior
- NPM ou Yarn
- Compatível com Windows, macOS e Linux

### Passos

1. Clone o repositório:
```bash
git clone <url-do-repositorio>
cd adv-scraper-solution
```

2. Instale as dependências:
```bash
npm install
```

3. Compile o projeto:
```bash
npm run build
```

## Uso

### CLI

A ferramenta inclui uma interface de linha de comando para operações comuns:

#### Criar um perfil de identidade

```bash
npm start -- create-profile
```

#### Listar perfis de identidade

```bash
npm start -- list-profiles
```

#### Criar uma sessão de navegador

```bash
npm start -- create-session --url https://example.com
```

Com um perfil específico:
```bash
npm start -- create-session --profile <id-do-perfil> --url https://example.com
```

#### Navegar para uma URL

```bash
npm start -- navigate <id-da-sessao> https://example.com
```

#### Fechar uma sessão

```bash
npm start -- close-session <id-da-sessao>
```

### Programaticamente

Você também pode usar a API diretamente em seu código:

```typescript
import { 
  LogService, 
  ConfigService, 
  IdentityManager, 
  ProxyManager, 
  BrowserAutomationService 
} from 'adv-scraper-solution';

async function main() {
  // Inicializar serviços
  const logService = new LogService();
  const configService = new ConfigService(logService);
  await configService.initialize();
  
  const identityManager = new IdentityManager(configService, logService);
  await identityManager.initialize();
  
  const proxyManager = new ProxyManager(configService, logService);
  await proxyManager.initialize();
  
  const browserService = new BrowserAutomationService(
    configService,
    identityManager, 
    proxyManager,
    logService
  );
  
  // Criar sessão com comportamento humano
  const sessionId = await browserService.createSession({
    headless: false,
    defaultUrl: 'https://example.com',
    browserType: 'chromium', // ou 'firefox', 'webkit'
    humanBehavior: {
      typing: {
        minDelay: 50,
        maxDelay: 150,
        mistakeProbability: 0.03 // 3% de chance de erro de digitação
      },
      mouse: {
        moveSpeed: 10,
        clickDelay: 150,
        naturalMovement: true
      }
    }
  });
  
  // Navegar para uma URL
  await browserService.executeAction(sessionId, {
    type: 'navigate',
    url: 'https://example.com/login',
    humanLike: true // Comporta-se como humano ao navegar
  });
  
  // Preencher formulário
  await browserService.executeAction(sessionId, {
    type: 'type',
    selector: 'input[name="username"]',
    text: 'usuario@exemplo.com',
    humanLike: true // Digitação com velocidade variável e possíveis erros
  });
  
  await browserService.executeAction(sessionId, {
    type: 'type',
    selector: 'input[name="password"]',
    text: 'senha123',
    humanLike: true
  });
  
  // Clicar em botão
  await browserService.executeAction(sessionId, {
    type: 'click',
    selector: 'button.login',
    humanLike: true // Move o mouse naturalmente e faz pausa antes de clicar
  });
  
  // Esperar pelo carregamento
  await browserService.executeAction(sessionId, {
    type: 'wait',
    timeout: 2000
  });
  
  // Extrair dados
  const result = await browserService.executeAction(sessionId, {
    type: 'extractData',
    selector: '.user-profile .user-info'
  });
  
  console.log('Dados extraídos:', result.data);
  
  // Tirar screenshot
  const screenshot = await browserService.executeAction(sessionId, {
    type: 'screenshot'
  });
  
  // Fechar sessão
  await browserService.closeSession(sessionId);
}

main().catch(console.error);
```

## Guia de extração de dados

O Advanced Scraper Solution fornece várias formas de extrair dados das páginas:

### Extração básica usando seletores CSS

```typescript
// Extrair texto de elementos usando seletor CSS
const result = await browserService.executeAction(sessionId, {
  type: 'extractData',
  selector: '.product-item'
});

// Os dados retornados incluem texto, HTML e atributos de cada elemento
console.log(result.data);
```

### Executando JavaScript personalizado

```typescript
// Extrair dados usando código JavaScript personalizado
const prices = await browserService.executeAction(sessionId, {
  type: 'evaluate',
  function: `
    return Array.from(document.querySelectorAll('.product-price')).map(el => {
      const priceText = el.textContent.trim();
      return {
        raw: priceText,
        value: parseFloat(priceText.replace('R$', '').replace(',', '.'))
      };
    });
  `
});

console.log('Preços extraídos:', prices.data);
```

## Processamento visual com IA

O Advanced Scraper Solution inclui integração com modelos de visão computacional para extrair dados de imagens quando o DOM não está acessível ou para resolver desafios visuais.

### Inicializando o AIProcessingService

```typescript
import { 
  LogService, 
  ConfigService, 
  AIProcessingService 
} from 'adv-scraper-solution';

// Inicializar serviços
const logService = new LogService();
const configService = new ConfigService(logService);
await configService.initialize();

// Configurar a chave de API (pode ser feito via configurações)
await configService.setAIConfiguration({
  provider: 'openai', // ou 'gemini', 'claude'
  apiKey: 'sua-chave-api-aqui',
  enabled: true,
  modelParameters: {
    maxTokens: 1000,
    temperature: 0.2,
    timeout: 30000
  }
});

// Inicializar serviço de IA
const aiService = new AIProcessingService(configService, logService);
await aiService.initialize();
```

### Análise de contexto para decidir a estratégia de scraping

```typescript
// Obter uma captura de tela da página
const screenshot = await browserService.takeScreenshot(sessionId);
const url = 'https://example.com/protected-page';
const html = await browserService.executeAction(sessionId, {
  type: 'evaluate',
  function: 'return document.documentElement.outerHTML'
}).data;

// Analisar para decidir melhor abordagem
const analysisResult = await aiService.analyzeScrapingContext(
  screenshot,
  html,
  url
);

console.log(`Estratégia recomendada: ${analysisResult.strategy}`);
console.log(`Confiança: ${analysisResult.confidence}`);
console.log(`Motivo: ${analysisResult.reason}`);

// Adaptar o comportamento baseado na estratégia
switch (analysisResult.strategy) {
  case 'browser-automation':
    // Usar automação normal de navegador
    break;
  case 'api-client':
    // Tentar acessar APIs diretas
    break;
  case 'visual-scraping':
    // Usar processamento visual para obter dados
    break;
  case 'hybrid':
    // Usar uma combinação de técnicas
    break;
}
```

### Detecção e resolução de captchas

```typescript
// Tirar screenshot da área com captcha
const captchaScreenshot = await browserService.executeAction(sessionId, {
  type: 'screenshot',
  selector: '#captcha-container'
}).data;

// Usar IA para resolver o captcha
const captchaResult = await aiService.processImage(
  captchaScreenshot,
  'analyze-captcha'
);

if (captchaResult.success) {
  // Preencher o captcha com a solução
  await browserService.executeAction(sessionId, {
    type: 'type',
    selector: 'input[name="captcha"]',
    text: captchaResult.data.solution
  });
  
  console.log(`Captcha resolvido (confiança: ${captchaResult.confidence})`);
}
```

### Detectando honeypots e armadilhas

```typescript
// Analisar página em busca de honeypots
const honeypotsResult = await aiService.processImage(
  screenshot,
  'detect-honeypot'
);

if (honeypotsResult.success && honeypotsResult.data) {
  for (const honeypot of honeypotsResult.data) {
    console.log(`Honeypot detectado: ${honeypot.description}`);
    // Evitar interação com esses elementos
  }
}
```

### Extração de dados de imagens

```typescript
// Extrair dados estruturados de uma imagem (ex: tabela, gráfico)
const dataResult = await aiService.processImage(
  screenshot,
  'extract-data',
  {
    extractionSchema: {
      "título": "Título principal da página",
      "preços": "Lista de preços dos produtos",
      "avaliações": "Notas de avaliação dos produtos"
    }
  }
);

if (dataResult.success) {
  console.log('Dados extraídos via visão computacional:', dataResult.data);
}
```

## Técnicas avançadas de evasão

O framework inclui diversas técnicas para evitar detecção:

### Evasão em nível de navegador
- Alteração de user-agent e fingerprints do navegador
- Manipulação avançada de headers e características do navegador
- Modificação de propriedades JavaScript para evitar detecção de automação
- Emulação precisa de dispositivos reais (resolução, cores, fontes)
- Bloqueio inteligente de rastreadores e scripts de detecção

### Simulação de comportamento humano
- Digitação realista com variação de velocidade e padrões naturais
- Movimentos de mouse com curvas naturais e aceleração/desaceleração
- Simulação de erros comuns de digitação com autocorreção
- Padrões de navegação baseados em telemetria real de usuários
- Tempos de reação e pausa que imitam comportamento humano

### Análise e adaptação inteligente
- Sistema adaptativo que detecta e responde a técnicas anti-bot
- Aprendizado de padrões de bloqueio e ajuste automático
- Rotação estratégica de identidades digitais e proxies
- Análise de desafios JavaScript com emulação precisa de execução
- Sistema de decisão baseado em ML para estratégias de evasão ótimas

### Técnicas avançadas (novidade na versão 1.2.0)
- Uso de modelos de visão computacional para análise de elementos visuais
- Sistema de bypass de captchas baseado em IA
- Detecção automatizada de honeypots e armadilhas
- Fingerprinting adaptativo que evolui com o tempo
- Análise heurística para identificação de padrões de detecção de bot

## Acompanhando as mudanças

Consulte o [CHANGELOG.md](./CHANGELOG.md) para ver todas as alterações recentes e o histórico de versões do projeto.

## Resolução de problemas

### 1. Erro ao instalar dependências do Playwright

Se encontrar problemas ao instalar as dependências do Playwright, tente:

```bash
npx playwright install
```

### 2. Problemas com permissões

Em alguns sistemas, podem ser necessárias permissões adicionais para executar o navegador:

```bash
# Linux
sudo apt-get install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget
```

### 3. Erros de timeout durante a execução

Se você estiver enfrentando erros de timeout durante a execução:

1. Verifique sua conexão com a internet
2. Aumente os valores de timeout nas opções de ação
3. Verifique se o site alvo tem mecanismos anti-bot que podem estar bloqueando você
4. Tente usar um proxy diferente

## Contribuição

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues ou enviar pull requests.

## Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo LICENSE para detalhes.
