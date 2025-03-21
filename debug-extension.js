// Script para depurar a extensão com logs detalhados
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Compilando a extensão em modo de depuração...');

try {
  // Executa o esbuild com depuração ativada
  execSync('node esbuild.js', { stdio: 'inherit' });
  
  console.log('Configurando ambiente de depuração...');
  
  // Criar arquivo .env.debug temporário com configurações de depuração
  const envContent = `
DEBUG=roo-cline:*
VSCODE_DEBUG=true
NODE_ENV=development
`;
  
  const envPath = path.join(__dirname, '.env.debug');
  fs.writeFileSync(envPath, envContent);
  
  console.log('Iniciando VS Code com depuração ativada...');
  
  // Inicia o VS Code com depuração ativada e apenas a extensão Roo Code
  const currentDir = process.cwd();
  const args = [
    `--extensionDevelopmentPath="${currentDir}"`,
    '--disable-extensions',
    '--verbose',
    '--new-window'
  ].join(' ');
  
  execSync(`code ${args}`, { 
    stdio: 'inherit',
    env: {
      ...process.env,
      DEBUG: 'roo-cline:*',
      VSCODE_DEBUG: 'true'
    }
  });
  
  console.log('VS Code iniciado em modo de depuração.');
} catch (error) {
  console.error('Erro ao iniciar a extensão em modo de depuração:', error);
}
