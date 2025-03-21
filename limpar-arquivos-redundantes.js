/**
 * Script para remover arquivos redundantes e simplificar o projeto
 * 
 * Este script identifica e remove arquivos duplicados ou obsoletos
 * que foram substituídos por versões unificadas.
 * 
 * Uso: node limpar-arquivos-redundantes.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

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

// Interface de terminal
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Lista de arquivos substituídos por soluções unificadas
const arquivosObsoletos = [
  // Scripts de build redundantes
  'build-perplexity-vsix.js',
  'build-perplexity-fixed-vsix.js',
  'build-fixed-vsix.js',
  'build-fixed-simples.js',
  
  // Scripts de correção redundantes
  'perplexity-fix.js',
  'fix-perplexity-settings.js',
  'fix-config-filenames.js',
  'fix-installed-extension.js',
  
  // Documentação redundante
  'PERPLEXITY-SOLUCAO.md',
  'PERPLEXITY-SOLUCAO-PT.md',
  'SOLUCAO-ROO-CODE.md',
  'VSIX-CORRECAO.md',
  'README-SOLUCAO.md'
];

// Arquivos que devem ser mantidos (soluções unificadas)
const arquivosParaManter = [
  // Código fonte
  'src/api/providers/perplexity.ts',
  
  // Scripts unificados
  'build-perplexity-unified.js',
  'fix-perplexity-unificado.js',
  'instalar-solucao-perplexity.js',
  
  // Documentação unificada
  'PERPLEXITY-SOLUCAO-UNIFICADA.md'
];

// Verifica se um arquivo existe
function arquivoExiste(arquivo) {
  try {
    return fs.existsSync(arquivo);
  } catch (error) {
    return false;
  }
}

// Mostrar banner
function mostrarBanner() {
  console.log(`${colors.blue}=======================================================================${colors.reset}`);
  console.log(`${colors.blue}        LIMPEZA DE ARQUIVOS REDUNDANTES DA SOLUÇÃO PERPLEXITY         ${colors.reset}`);
  console.log(`${colors.blue}=======================================================================${colors.reset}`);
  console.log(`\nEste script identificará e removerá arquivos obsoletos que foram`);
  console.log(`substituídos por soluções unificadas para o problema do Perplexity PRO.\n`);
}

// Verificar e exibir status dos arquivos
function verificarArquivos() {
  console.log(`${colors.blue}Verificando arquivos...${colors.reset}\n`);
  
  // Verificar arquivos a serem removidos
  let arquivosEncontrados = [];
  
  console.log(`${colors.yellow}Arquivos redundantes:${colors.reset}`);
  arquivosObsoletos.forEach(arquivo => {
    const existe = arquivoExiste(arquivo);
    console.log(`  ${existe ? colors.red + '✓' : colors.green + '✗'} ${arquivo}${colors.reset}`);
    
    if (existe) {
      arquivosEncontrados.push(arquivo);
    }
  });
  
  console.log(`\n${colors.green}Arquivos unificados (serão mantidos):${colors.reset}`);
  arquivosParaManter.forEach(arquivo => {
    const existe = arquivoExiste(arquivo);
    console.log(`  ${existe ? colors.green + '✓' : colors.red + '✗'} ${arquivo}${colors.reset}`);
  });
  
  return arquivosEncontrados;
}

// Remover arquivos obsoletos
function removerArquivos(arquivos) {
  console.log(`\n${colors.blue}Removendo arquivos redundantes...${colors.reset}\n`);
  
  let sucessos = 0;
  let falhas = 0;
  
  arquivos.forEach(arquivo => {
    try {
      fs.unlinkSync(arquivo);
      console.log(`${colors.green}✓ Removido: ${arquivo}${colors.reset}`);
      sucessos++;
    } catch (error) {
      console.log(`${colors.red}✗ Erro ao remover: ${arquivo} - ${error.message}${colors.reset}`);
      falhas++;
    }
  });
  
  console.log(`\n${colors.blue}Resumo:${colors.reset}`);
  console.log(`${colors.green}✓ ${sucessos} arquivo(s) removido(s) com sucesso${colors.reset}`);
  
  if (falhas > 0) {
    console.log(`${colors.red}✗ ${falhas} arquivo(s) não puderam ser removidos${colors.reset}`);
  }
  
  return sucessos;
}

// Função principal
async function main() {
  mostrarBanner();
  
  // Verificar arquivos
  const arquivosParaRemover = verificarArquivos();
  
  if (arquivosParaRemover.length === 0) {
    console.log(`\n${colors.green}✓ Nenhum arquivo redundante encontrado! O projeto já está limpo.${colors.reset}`);
    rl.close();
    return;
  }
  
  // Perguntar se deve prosseguir
  console.log(`\n${colors.yellow}Encontrados ${arquivosParaRemover.length} arquivo(s) redundante(s).${colors.reset}`);
  
  rl.question(`\nDeseja remover estes arquivos? (s/n) `, (resposta) => {
    const confirmacao = resposta.toLowerCase();
    
    if (confirmacao === 's' || confirmacao === 'sim') {
      const removidos = removerArquivos(arquivosParaRemover);
      
      if (removidos > 0) {
        console.log(`\n${colors.green}✅ Limpeza concluída com sucesso!${colors.reset}`);
      } else {
        console.log(`\n${colors.yellow}⚠ Nenhum arquivo foi removido.${colors.reset}`);
      }
    } else {
      console.log(`\n${colors.yellow}Operação cancelada pelo usuário.${colors.reset}`);
    }
    
    rl.close();
  });
}

// Executar o script
main().catch(error => {
  console.error(`${colors.red}Erro inesperado: ${error.message}${colors.reset}`);
  rl.close();
  process.exit(1);
});
