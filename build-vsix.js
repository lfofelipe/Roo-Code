// Simple script to build a VSIX package without type checking
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Construindo extensão VSIX sem verificação de tipos...');

try {
  // 1. Compilar o webview
  console.log('Compilando webview...');
  execSync('cd webview-ui && npm run vite-build', { stdio: 'inherit' });
  
  // 2. Compilar a extensão
  console.log('Compilando extensão...');
  execSync('node esbuild.js --production', { stdio: 'inherit' });
  
  // 3. Corrigir problemas de caminhos (importante para evitar carregamento infinito)
  console.log('Corrigindo problemas de caminhos...');
  
  // Copiar package.json para vários diretórios para garantir que seja encontrado
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
  
  // 4. Criar o pacote VSIX
  console.log('Criando pacote VSIX...');
  // Usar comandos do PowerShell para remover e criar diretórios
  if (process.platform === 'win32') {
    // Windows
    try {
      execSync('if (Test-Path bin) { Remove-Item -Recurse -Force bin }', { shell: 'powershell.exe', stdio: 'inherit' });
      execSync('New-Item -ItemType Directory -Force -Path bin', { shell: 'powershell.exe', stdio: 'inherit' });
    } catch (e) {
      console.log('Erro ao manipular diretórios, tentando criar mesmo assim...');
    }
  } else {
    // Linux/macOS
    execSync('rm -rf bin && mkdir -p bin', { stdio: 'inherit' });
  }
  
  // Empacotar a extensão
  execSync('npx vsce package --no-dependencies --out bin', { stdio: 'inherit' });
  
  console.log('VSIX criado com sucesso! Procure pelo arquivo na pasta bin/');
} catch (error) {
  console.error('Erro ao criar VSIX:', error.message);
}
