// Script para compilar e iniciar a extensão com correções de caminhos
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Compilando a extensão (sem verificação de tipos)...');

try {
  // Executa apenas o esbuild para compilar sem verificação de tipos
  execSync('node esbuild.js', { stdio: 'inherit' });
  
  console.log('Corrigindo problemas de caminhos...');
  
  // 1. Copiar package.json para vários diretórios para garantir que seja encontrado
  const packageJsonPath = path.join(__dirname, 'package.json');
  const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
  
  // Diretórios onde o package.json pode ser procurado
  const directories = [
    path.join(__dirname, 'dist'),
    path.join(__dirname, 'dist', '..'),
    path.join(__dirname, 'dist', '..', '..'),
    path.join(__dirname, 'dist', '..', '..', '..')
  ];
  
  // Garantir que os diretórios existam e copiar o package.json
  directories.forEach(dir => {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(path.join(dir, 'package.json'), packageJsonContent);
      console.log(`Copiado package.json para ${dir}`);
    } catch (e) {
      console.warn(`Não foi possível copiar para ${dir}:`, e.message);
    }
  });
  
  console.log('Abrindo VS Code com a extensão...');
  
  // Obtém o caminho atual do diretório
  const currentDir = process.cwd();
  
  // Inicia o VS Code com a extensão
  execSync(`code --extensionDevelopmentPath="${currentDir}"`, { stdio: 'inherit' });
  
  console.log('VS Code iniciado com a extensão.');
} catch (error) {
  console.error('Erro ao iniciar a extensão:', error);
}
