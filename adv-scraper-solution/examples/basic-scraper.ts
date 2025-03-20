/**
 * Advanced Scraper Solution - Exemplo básico de uso
 * 
 * Este exemplo demonstra várias funcionalidades da versão 1.1.0+:
 * - Uso de múltiplos tipos de navegadores (Chromium, Firefox, WebKit)
 * - Simulação avançada de comportamento humano
 * - Técnicas de evasão de detecção
 * - Extração de dados com diferentes métodos
 * - Rotação de proxies e identidades
 * 
 * Consulte o CHANGELOG.md para ver todas as novidades desta versão.
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { 
  initialize, 
  scrape, 
  createSession, 
  executeAction, 
  closeSession,
  shutdown,
  createProfile,
  listProfiles,
  listProxies,
  createProxy
} from '../src/api';

// Carregar configurações de ambiente
dotenv.config();

// Configurações
const SAVE_SCREENSHOTS = true;
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

/**
 * Exemplo completo de uso da API de scraping
 */
async function main() {
  try {
    // Criar diretório para screenshots se necessário
    if (SAVE_SCREENSHOTS && !fs.existsSync(SCREENSHOTS_DIR)) {
      fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    }
    
    // Inicializar todos os serviços
    console.log('Inicializando serviços...');
    await initialize();
    
    // Demonstração de API de alto nível (mais simples de usar)
    await demonstrarApiAltoNivel();
    
    // Demonstração de API de baixo nível (mais controle)
    await demonstrarApiBaixoNivel();
    
    // Demonstração de funcionalidades avançadas
    await demonstrarFuncionalidadesAvancadas();
    
    // Finalizar serviços
    await shutdown();
    console.log('Serviços encerrados. Exemplo concluído com sucesso!');
    
  } catch (error) {
    console.error('Erro fatal:', error);
    await shutdown().catch(console.error);
    process.exit(1);
  }
}

/**
 * Demonstração da API de alto nível (mais simples)
 */
async function demonstrarApiAltoNivel() {
  console.log('\n1. EXEMPLO USANDO API DE ALTO NÍVEL:');
  console.log('Esta API é mais simples e direta para casos comuns');
  
  // Exemplo com site de exemplo
  const result = await scrape({
    url: 'https://example.com',
    selectors: {
      title: 'h1',
      description: 'p',
      links: 'a'
    },
    waitForSelector: 'h1',
    timeout: 30000,
    humanLike: true,
    browserType: 'chromium', // pode ser 'firefox' ou 'webkit' também
    evasionTechniques: ['stealth', 'blockTrackers'],
    viewport: { width: 1366, height: 768 }
  });
  
  if (result.success) {
    console.log('✅ Scraping completado com sucesso:');
    console.log(`   Título: ${result.data.title[0].text}`);
    console.log(`   Descrição: ${result.data.description[0].text}`);
    console.log(`   Total de links: ${result.data.links.length}`);
    console.log(`   Tempo de execução: ${result.timing.duration}ms`);
  } else {
    console.error('❌ Erro no scraping:', result.error);
  }
}

/**
 * Demonstração da API de baixo nível (mais controle)
 */
async function demonstrarApiBaixoNivel() {
  console.log('\n2. EXEMPLO USANDO API DE BAIXO NÍVEL:');
  console.log('Esta API oferece controle detalhado sobre cada ação');
  
  // Criar um perfil de identidade personalizado
  console.log('Criando perfil de identidade personalizado...');
  const profileId = await createProfile({
    name: 'Perfil Demo',
    personal: {
      firstName: 'João',
      lastName: 'Silva'
    },
    tags: ['demo', 'exemplo']
  });
  
  // Criar uma sessão de navegador personalizada
  const sessionId = await createSession({
    headless: false,
    profileId,
    browserType: 'chromium',
    humanBehavior: {
      typing: {
        minDelay: 50,
        maxDelay: 150,
        mistakeProbability: 0.03 // 3% de chance de erro ao digitar
      },
      mouse: {
        moveSpeed: 8,
        clickDelay: 120,
        naturalMovement: true
      },
      wait: {
        minDelay: 800,
        maxDelay: 2500
      }
    },
    viewport: { width: 1280, height: 720 },
    blockDomains: ['analytics.com', 'tracker.com']
  });
  
  console.log(`✅ Sessão criada: ${sessionId}`);
  
  try {
    // Navegar para a URL com comportamento humano
    console.log('Navegando para example.com...');
    let action = await executeAction(sessionId, {
      type: 'navigate',
      url: 'https://example.com',
      humanLike: true
    });
    
    if (!action.success) {
      throw new Error(`Erro na navegação: ${action.error}`);
    }
    
    // Extrair título e outros elementos
    console.log('Extraindo dados da página...');
    action = await executeAction(sessionId, {
      type: 'extractData',
      selector: 'h1, p'
    });
    
    if (action.success) {
      console.log('Elementos extraídos:');
      action.data.forEach((item, index) => {
        console.log(`   [${index}] ${item.text.substring(0, 50)}${item.text.length > 50 ? '...' : ''}`);
      });
    }
    
    // Executar JavaScript personalizado na página
    console.log('Executando JavaScript para análise...');
    action = await executeAction(sessionId, {
      type: 'evaluate',
      function: `
        return {
          title: document.title,
          metaTags: Array.from(document.querySelectorAll('meta')).map(m => ({
            name: m.getAttribute('name'),
            content: m.getAttribute('content')
          })).filter(m => m.name && m.content),
          performance: {
            timing: performance.timing.toJSON(),
            memory: performance.memory ? performance.memory.toJSON() : null
          }
        }
      `
    });
    
    if (action.success) {
      console.log('Resultado da análise JavaScript:');
      console.log(`   Título: ${action.data.title}`);
      console.log(`   Meta tags: ${action.data.metaTags.length}`);
      console.log(`   Performance: ${JSON.stringify(action.data.performance.timing).substring(0, 70)}...`);
    }
    
    // Tirar screenshot
    console.log('Capturando screenshot...');
    action = await executeAction(sessionId, {
      type: 'screenshot'
    });
    
    if (action.success && action.screenshot) {
      console.log(`✅ Screenshot capturado com sucesso`);
      
      // Salvar screenshot se configurado
      if (SAVE_SCREENSHOTS) {
        const base64Data = action.screenshot.replace(/^data:image\/jpeg;base64,/, '');
        const filename = path.join(SCREENSHOTS_DIR, `example-${Date.now()}.jpg`);
        fs.writeFileSync(filename, base64Data, 'base64');
        console.log(`   Salvo em: ${filename}`);
      }
    }
    
  } finally {
    // Fechar sessão independentemente do resultado
    console.log('Fechando sessão...');
    await closeSession(sessionId);
    console.log('✅ Sessão fechada com sucesso');
  }
}

/**
 * Demonstração de funcionalidades avançadas (v1.1.0+)
 */
async function demonstrarFuncionalidadesAvancadas() {
  console.log('\n3. DEMONSTRAÇÃO DE FUNCIONALIDADES AVANÇADAS:');
  
  // Criar sessão com Firefox
  console.log('Criando sessão com Firefox...');
  const sessionId = await createSession({
    browserType: 'firefox', // Usando Firefox em vez de Chromium
    headless: false,
    locale: 'pt-BR',
    viewport: { width: 1366, height: 768 },
    humanLike: true
  });
  
  try {
    // Navegar para site de e-commerce
    console.log('Navegando para um site de exemplo...');
    let action = await executeAction(sessionId, {
      type: 'navigate',
      url: 'https://books.toscrape.com/', // Site de demonstração para scraping
      humanLike: true
    });
    
    // Simular navegação natural pela página
    console.log('Simulando navegação realista...');
    
    // Rolar para baixo lentamente
    await executeAction(sessionId, {
      type: 'scrollTo',
      x: 0,
      y: 300,
      humanLike: true
    });
    
    // Esperar um tempo (como um humano olhando a página)
    await executeAction(sessionId, {
      type: 'wait',
      timeout: 1500
    });
    
    // Rolar mais para baixo
    await executeAction(sessionId, {
      type: 'scrollTo',
      x: 0,
      y: 600,
      humanLike: true
    });
    
    // Esperar novamente
    await executeAction(sessionId, {
      type: 'wait',
      timeout: 2000
    });
    
    // Extração complexa de dados
    console.log('Extraindo catálogo de produtos...');
    action = await executeAction(sessionId, {
      type: 'evaluate',
      function: `
        function extractPrice(priceText) {
          const match = priceText.match(/£([0-9.]+)/);
          return match ? parseFloat(match[1]) : null;
        }
        
        const products = Array.from(document.querySelectorAll('.product_pod')).map(product => {
          const title = product.querySelector('h3 a').getAttribute('title');
          const url = product.querySelector('h3 a').getAttribute('href');
          const imageUrl = product.querySelector('.image_container img').getAttribute('src');
          const priceElement = product.querySelector('.price_color');
          const priceText = priceElement ? priceElement.textContent.trim() : '';
          const price = extractPrice(priceText);
          const availability = product.querySelector('.availability').textContent.trim();
          const stars = product.querySelector('.star-rating').classList[1];
          
          return {
            title,
            url,
            imageUrl,
            price,
            priceText,
            availability,
            stars
          };
        });
        
        return {
          totalProducts: products.length,
          averagePrice: products.reduce((sum, p) => sum + (p.price || 0), 0) / products.length,
          products: products.slice(0, 5) // Retornar apenas 5 para não sobrecarregar o log
        };
      `
    });
    
    if (action.success) {
      console.log('✅ Catálogo extraído com sucesso:');
      console.log(`   Total de produtos: ${action.data.totalProducts}`);
      console.log(`   Preço médio: £${action.data.averagePrice.toFixed(2)}`);
      console.log('   Amostra de produtos:');
      
      action.data.products.forEach((product, index) => {
        console.log(`   [${index+1}] ${product.title}`);
        console.log(`       Preço: ${product.priceText}, Avaliação: ${product.stars}`);
      });
    }
    
    // Demonstrar simulação de clique com comportamento humano
    console.log('Demonstrando simulação de clique humano...');
    
    // Clicar em um categoria
    action = await executeAction(sessionId, {
      type: 'click',
      selector: '.side_categories ul li a',
      humanLike: true
    });
    
    // Tirar screenshot final
    action = await executeAction(sessionId, {
      type: 'screenshot'
    });
    
    if (action.success && action.screenshot && SAVE_SCREENSHOTS) {
      const base64Data = action.screenshot.replace(/^data:image\/jpeg;base64,/, '');
      const filename = path.join(SCREENSHOTS_DIR, `advanced-${Date.now()}.jpg`);
      fs.writeFileSync(filename, base64Data, 'base64');
      console.log(`✅ Screenshot final salvo em: ${filename}`);
    }
    
  } finally {
    // Fechar sessão
    await closeSession(sessionId);
    console.log('✅ Sessão avançada fechada com sucesso');
  }
  
  console.log('\nDemonstração concluída! Consulte o CHANGELOG.md para ver todas as novidades da versão 1.1.0');
}

// Executar o exemplo
main().catch(console.error);
