// Script para resolver o problema de carregamento infinito na interface do Roo Code
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('Iniciando solução para o problema de carregamento infinito...');

try {
  // Diretórios de cache e configuração do VS Code
  const vsCodeDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Code', 'User');
  const globalStorageDir = path.join(vsCodeDir, 'globalStorage');
  const rooCodeStorageDir = path.join(globalStorageDir, 'rooveterinaryinc.roo-cline');
  const claudeStorageDir = path.join(globalStorageDir, 'saoudrizwan.claude-dev');
  
  // Remover pastas de cache existentes
  console.log('Limpando caches antigos...');
  
  if (fs.existsSync(rooCodeStorageDir)) {
    console.log(`Removendo ${rooCodeStorageDir}`);
    execSync(`rd /s /q "${rooCodeStorageDir}"`, { stdio: 'inherit' });
  }
  
  if (fs.existsSync(claudeStorageDir)) {
    console.log(`Removendo ${claudeStorageDir}`);
    execSync(`rd /s /q "${claudeStorageDir}"`, { stdio: 'inherit' });
  }
  
  // Criar diretório limpo para Roo Code
  fs.mkdirSync(rooCodeStorageDir, { recursive: true });
  
  // Copiar configuração mínima
  console.log('Configurando ambiente limpo...');
  const configDest = path.join(rooCodeStorageDir, 'settings.json');
  fs.copyFileSync('min-config.json', configDest);
  
  // Recompilar a extensão
  console.log('Recompilando a extensão...');
  execSync('npm run build:esbuild', { stdio: 'inherit' });
  
  // Iniciar VS Code com a extensão em modo limpo
  console.log('Iniciando VS Code com configuração limpa...');
  const currentDir = process.cwd();
  execSync(`code --extensionDevelopmentPath="${currentDir}" --disable-extensions --new-window --disable-gpu-sandbox`, { 
    stdio: 'inherit',
    env: {
      ...process.env,
      DEBUG: 'roo-cline:*',
      VSCODE_DEBUG: 'true',
      EXTENSION_LOGS: 'true'
    }
  });
  
  console.log('VS Code iniciado. Teste a extensão Roo Code agora.');
} catch (error) {
  console.error('Erro durante a solução:', error);
}
