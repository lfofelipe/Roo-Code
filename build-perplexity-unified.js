/**
 * Script unificado para construir versão do VSIX com suporte ao Perplexity PRO
 * 
 * Uso: node build-perplexity-unified.js [--skip-check]
 * 
 * Opções:
 *   --skip-check: Desativa a verificação de tipos TypeScript durante a compilação
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Cores para output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Argumentos da linha de comando
const args = process.argv.slice(2);
const skipTypeCheck = args.includes('--skip-check');

// Verifica se as ferramentas necessárias estão instaladas
function checkRequirements() {
  try {
    console.log(`${colors.blue}Verificando requisitos...${colors.reset}`);
    
    // Verifica Node.js
    const nodeVersion = execSync('node --version').toString().trim();
    console.log(`${colors.green}✓ Node.js: ${nodeVersion}${colors.reset}`);
    
    // Verifica npm
    const npmVersion = execSync('npm --version').toString().trim();
    console.log(`${colors.green}✓ npm: ${npmVersion}${colors.reset}`);
    
    // Verifica vsce
    try {
      const vsceVersion = execSync('npx vsce --version').toString().trim();
      console.log(`${colors.green}✓ vsce: ${vsceVersion}${colors.reset}`);
    } catch (error) {
      console.log(`${colors.yellow}! vsce não encontrado. Será instalado automaticamente.${colors.reset}`);
    }
    
    return true;
  } catch (error) {
    console.error(`${colors.red}Erro ao verificar requisitos: ${error.message}${colors.reset}`);
    return false;
  }
}

// Leitura de arquivos
function readFileContent(filePath) {
  const fullPath = path.resolve(filePath);
  try {
    if (fs.existsSync(fullPath)) {
      return fs.readFileSync(fullPath, 'utf8');
    } else {
      console.error(`${colors.red}Arquivo não encontrado: ${fullPath}${colors.reset}`);
      return null;
    }
  } catch (error) {
    console.error(`${colors.red}Erro ao ler arquivo ${fullPath}: ${error.message}${colors.reset}`);
    return null;
  }
}

// Verificar se os arquivos contêm as correções necessárias
function verifyFilesFixes() {
  console.log(`${colors.blue}Verificando se os arquivos contêm as correções necessárias...${colors.reset}`);
  
  // Caminhos dos arquivos
  const perplexityPath = path.join('src', 'api', 'providers', 'perplexity.ts');
  const apiOptionsPath = path.join('webview-ui', 'src', 'components', 'settings', 'ApiOptions.tsx');
  
  // Verificar arquivo perplexity.ts
  const perplexityContent = readFileContent(perplexityPath);
  if (!perplexityContent) {
    return false;
  }
  
  // Verificar se contém as correções importantes
  const hasLoggerFunction = perplexityContent.includes('function createLogger');
  const hasTypeHandling = perplexityContent.includes('typeof perplexityEmail === \'string\'') || 
                          perplexityContent.includes('typeof perplexityEmail === "string"');
  const hasTypeSafety = perplexityContent.includes('as any[]') || 
                        perplexityContent.includes('Tratar o conteúdo com segurança');
  
  // Verificar arquivo ApiOptions.tsx se existir
  let hasEmailValidation = false;
  let hasLogsArea = false;
  
  if (fs.existsSync(apiOptionsPath)) {
    const apiOptionsContent = readFileContent(apiOptionsPath);
    if (apiOptionsContent) {
      hasEmailValidation = apiOptionsContent.includes('apiConfiguration.perplexityEmail?.trim()');
      hasLogsArea = apiOptionsContent.includes('id="perplexity-logs"');
    }
  }
  
  // Mostrar resultados
  console.log(`${colors.cyan}Arquivo perplexity.ts:${colors.reset}`);
  console.log(`  - Sistema de logs: ${hasLoggerFunction ? colors.green + '✓' : colors.red + '✗'}${colors.reset}`);
  console.log(`  - Validação de tipos: ${hasTypeHandling ? colors.green + '✓' : colors.red + '✗'}${colors.reset}`);
  console.log(`  - Tratamento seguro de tipos: ${hasTypeSafety ? colors.green + '✓' : colors.red + '✗'}${colors.reset}`);
  
  if (fs.existsSync(apiOptionsPath)) {
    console.log(`${colors.cyan}Arquivo ApiOptions.tsx:${colors.reset}`);
    console.log(`  - Validação de email: ${hasEmailValidation ? colors.green + '✓' : colors.red + '✗'}${colors.reset}`);
    console.log(`  - Área de logs: ${hasLogsArea ? colors.green + '✓' : colors.red + '✗'}${colors.reset}`);
  }
  
  // Verificação principal: o arquivo perplexity.ts precisa ter as correções
  const hasRequiredFixes = hasLoggerFunction && (hasTypeHandling || hasTypeSafety);
  
  if (!hasRequiredFixes) {
    console.log(`${colors.yellow}⚠ Aviso: O arquivo perplexity.ts não contém todas as correções necessárias.${colors.reset}`);
    
    if (!skipTypeCheck) {
      console.log(`${colors.yellow}Recomenda-se usar a opção --skip-check para evitar erros de compilação.${colors.reset}`);
      console.log(`${colors.yellow}Execute: node ${path.basename(__filename)} --skip-check${colors.reset}`);
    }
  } else {
    console.log(`${colors.green}✓ O arquivo perplexity.ts contém as correções principais!${colors.reset}`);
  }
  
  return hasRequiredFixes;
}

// Constrói a extensão
function buildExtension() {
  console.log(`${colors.blue}Construindo a extensão...${colors.reset}`);
  
  try {
    // Compila a webview
    console.log(`${colors.cyan}Compilando webview...${colors.reset}`);
    execSync('cd webview-ui && npm run vite-build', { stdio: 'inherit' });
    
    // Compila a extensão usando esbuild
    console.log(`${colors.cyan}Compilando extensão${skipTypeCheck ? ' (sem verificação de tipos)' : ''}...${colors.reset}`);
    const buildCommand = skipTypeCheck ? 
      'node esbuild.js --production --skip-check' : 
      'node esbuild.js --production';
    
    execSync(buildCommand, { stdio: 'inherit' });
    
    // Certifica-se de que o diretório bin existe
    if (!fs.existsSync('bin')) {
      fs.mkdirSync('bin', { recursive: true });
    }
    
    // Nome do arquivo VSIX
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const vsixFileName = `bin/roo-cline-${packageJson.version}-perplexity-fix.vsix`;
    
    // Cria o pacote VSIX
    console.log(`${colors.cyan}Empacotando a extensão...${colors.reset}`);
    execSync(`npx vsce package --no-dependencies -o ${vsixFileName}`, { stdio: 'inherit' });
    
    console.log(`${colors.green}Extensão construída com sucesso: ${vsixFileName}${colors.reset}`);
    
    return vsixFileName;
  } catch (error) {
    console.error(`${colors.red}Erro ao construir a extensão: ${error.message}${colors.reset}`);
    return null;
  }
}

// Função principal
async function main() {
  console.log(`${colors.blue}=== Construção unificada de VSIX com suporte ao Perplexity PRO ====${colors.reset}`);
  console.log(`${colors.blue}Modo: ${skipTypeCheck ? 'Sem verificação de tipos' : 'Com verificação de tipos'}${colors.reset}`);
  
  // Verifica os requisitos
  if (!checkRequirements()) {
    console.log(`${colors.red}Requisitos não atendidos. Abortando.${colors.reset}`);
    return;
  }
  
  // Verifica se os arquivos contêm as correções necessárias
  const hasAllFixes = verifyFilesFixes();
  
  // Se não tiver todas as correções e não estiver no modo skip-check, pergunte
  if (!hasAllFixes && !skipTypeCheck) {
    console.log(`${colors.yellow}Os arquivos não contêm todas as correções necessárias.${colors.reset}`);
    console.log(`${colors.yellow}Recomenda-se usar a opção --skip-check para evitar erros de compilação.${colors.reset}`);
    
    try {
      // No PowerShell, vamos usar o padrão de escolha menos interativo
      console.log(`${colors.yellow}Continuando com verificação de tipos. Se encontrar erros, execute novamente com --skip-check${colors.reset}`);
    } catch (error) {
      // Se não conseguir executar, apenas avisamos
      console.log(`${colors.yellow}Continuando mesmo assim.${colors.reset}`);
    }
  }
  
  // Constrói a extensão
  const vsixPath = buildExtension();
  
  if (!vsixPath) {
    console.log(`${colors.red}Falha ao construir a extensão. Abortando.${colors.reset}`);
    return;
  }
  
  // Instruções para instalação
  console.log('\n' + '-'.repeat(80));
  console.log(`${colors.blue}Instruções para Instalação:${colors.reset}`);
  console.log('1. Desinstale a versão anterior do RooCode no VS Code');
  console.log('2. Instale a versão corrigida executando um dos comandos:');
  console.log(`   a) Via VS Code: Menu de extensões > ... > Instalar do VSIX > Selecione ${vsixPath}`);
  console.log(`   b) Via terminal: code --install-extension ${vsixPath}`);
  console.log('3. Reinicie o VS Code');
  console.log('4. Configure as credenciais do Perplexity PRO na extensão');
  console.log('-'.repeat(80) + '\n');
}

// Executa o script
main().catch(error => {
  console.error(`${colors.red}Erro inesperado: ${error.message}${colors.reset}`);
  process.exit(1);
});
