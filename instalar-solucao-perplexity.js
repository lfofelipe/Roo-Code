#!/usr/bin/env node

// Script simplificado para instalar a solução do Perplexity PRO
// Executa o script de correção e guia o usuário pelos próximos passos

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Função para mostrar texto colorido
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function colorText(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

// Função para mostrar banners
function showBanner() {
  console.log(colorText('\n=================================================================', 'cyan'));
  console.log(colorText('            INSTALADOR DA SOLUÇÃO DO PERPLEXITY PRO', 'yellow'));
  console.log(colorText('=================================================================\n', 'cyan'));
}

// Função para fazer pergunta com opções
function perguntaOpcoes(pergunta, opcoes) {
  return new Promise((resolve) => {
    console.log(colorText(pergunta, 'yellow'));
    opcoes.forEach((opcao, index) => {
      console.log(colorText(`  ${index + 1}. ${opcao}`, 'white'));
    });
    
    rl.question(colorText('Escolha uma opção (número): ', 'cyan'), (answer) => {
      const escolha = parseInt(answer);
      if (isNaN(escolha) || escolha < 1 || escolha > opcoes.length) {
        console.log(colorText(`Opção inválida. Utilizando opção 1 como padrão.`, 'red'));
        resolve(1);
      } else {
        resolve(escolha);
      }
    });
  });
}

// Função para fazer pergunta simples
function perguntaSimples(pergunta) {
  return new Promise((resolve) => {
    rl.question(colorText(pergunta, 'cyan'), (answer) => {
      resolve(answer);
    });
  });
}

// Função para executar comando
function executarComando(comando, mensagem, silencioso = false) {
  console.log(colorText(mensagem, 'blue'));
  try {
    if (silencioso) {
      execSync(comando, { stdio: ['ignore', 'ignore', 'ignore'] });
    } else {
      execSync(comando, { stdio: 'inherit' });
    }
    return true;
  } catch (error) {
    console.error(colorText(`Erro ao executar: ${comando}`, 'red'));
    console.error(colorText(error.message, 'red'));
    return false;
  }
}

// Função principal
async function main() {
  showBanner();
  
  console.log(colorText('Este script vai instalar a solução para o problema do modo Browser do Perplexity PRO.', 'white'));
  console.log(colorText('O processo irá modificar o código da extensão RooCode e gerar uma versão corrigida.\n', 'white'));

  // Verificar se os scripts de solução existem
  const scripts = [
    'debug-perplexity.js',
    'fix-perplexity-browser-auth.js',
    'corrigir-perplexity-browser-modo.js'
  ];
  
  let scriptsPresentes = true;
  scripts.forEach(script => {
    if (!fs.existsSync(path.join(__dirname, script))) {
      console.log(colorText(`Script não encontrado: ${script}`, 'red'));
      scriptsPresentes = false;
    }
  });
  
  if (!scriptsPresentes) {
    console.log(colorText('\nAlguns scripts necessários estão faltando. Verifique se você está no diretório correto.', 'red'));
    process.exit(1);
  }

  // Perguntar ao usuário qual abordagem ele prefere
  const escolha = await perguntaOpcoes('Qual abordagem você prefere?', [
    'Solução completa (Corrige o código, compila e gera VSIX)',
    'Apenas correção do código (Sem compilar)',
    'Apenas modo de diagnóstico (Debug)'
  ]);

  if (escolha === 1) {
    // Solução completa
    console.log(colorText('\nExecutando solução completa...', 'green'));
    
    // Verificar versão anterior
    const confirmarBackup = await perguntaSimples('Deseja fazer backup do código atual antes de prosseguir? (s/n): ');
    if (confirmarBackup.toLowerCase() === 's') {
      const timestampBackup = Date.now();
      const backupDir = path.join(__dirname, `backup-perplexity-${timestampBackup}`);
      
      try {
        fs.mkdirSync(backupDir);
        fs.copyFileSync(
          path.join(__dirname, 'src', 'api', 'providers', 'perplexity.ts'),
          path.join(backupDir, 'perplexity.ts')
        );
        console.log(colorText(`Backup criado em: ${backupDir}`, 'green'));
      } catch (error) {
        console.log(colorText(`Erro ao criar backup: ${error.message}`, 'red'));
      }
    }
    
    // Executar script principal
    const sucesso = executarComando('node corrigir-perplexity-browser-modo.js', 'Aplicando correções e compilando...');
    
    if (sucesso) {
      console.log(colorText('\n✅ Solução aplicada com sucesso!', 'green'));
      
      // Perguntar se deseja instalar a extensão agora
      const instalarAgora = await perguntaSimples('Deseja instalar a extensão corrigida agora? (s/n): ');
      if (instalarAgora.toLowerCase() === 's') {
        console.log(colorText('\nPara instalar a extensão, siga estas etapas:', 'yellow'));
        console.log(colorText('1. Feche todas as instâncias do VS Code', 'white'));
        console.log(colorText('2. Execute o comando: code --install-extension bin/roo-cline-3.9.4.vsix', 'white'));
        console.log(colorText('3. Abra o VS Code e configure o Perplexity corretamente (consulte o guia PERPLEXITY-SOLUCAO-UNIFICADA-PT.md)', 'white'));
        
        const continuar = await perguntaSimples('\nPressione Enter quando estiver pronto para instalar ou digite "n" para sair: ');
        if (continuar.toLowerCase() !== 'n') {
          executarComando('code --install-extension bin/roo-cline-3.9.4.vsix', 'Instalando extensão corrigida...');
        }
      }
    }
  } else if (escolha === 2) {
    // Apenas correção do código
    console.log(colorText('\nAplicando apenas as correções no código (sem compilar)...', 'green'));
    executarComando('node fix-perplexity-browser-auth.js', 'Aplicando correções ao código...');
  } else if (escolha === 3) {
    // Modo debug
    console.log(colorText('\nExecutando modo de diagnóstico...', 'green'));
    executarComando('node debug-perplexity.js', 'Iniciando modo de diagnóstico...');
  }

  // Verificar se a documentação existe
  if (fs.existsSync(path.join(__dirname, 'PERPLEXITY-SOLUCAO-UNIFICADA-PT.md'))) {
    console.log(colorText('\nConsulte o arquivo PERPLEXITY-SOLUCAO-UNIFICADA-PT.md para instruções detalhadas de uso.', 'yellow'));
  }

  // Perguntar se deseja abrir a documentação
  const abrirDocs = await perguntaSimples('Deseja abrir a documentação com instruções completas? (s/n): ');
  if (abrirDocs.toLowerCase() === 's') {
    try {
      if (process.platform === 'win32') {
        execSync('start PERPLEXITY-SOLUCAO-UNIFICADA-PT.md', { stdio: 'ignore' });
      } else if (process.platform === 'darwin') {
        execSync('open PERPLEXITY-SOLUCAO-UNIFICADA-PT.md', { stdio: 'ignore' });
      } else {
        execSync('xdg-open PERPLEXITY-SOLUCAO-UNIFICADA-PT.md', { stdio: 'ignore' });
      }
    } catch (error) {
      console.log(colorText('Não foi possível abrir a documentação automaticamente.', 'red'));
    }
  }

  console.log(colorText('\nProcesso concluído! Obrigado por usar a solução.', 'green'));
  rl.close();
}

// Iniciar o script
main().catch(error => {
  console.error(colorText(`Erro fatal: ${error.message}`, 'red'));
  rl.close();
  process.exit(1);
});
