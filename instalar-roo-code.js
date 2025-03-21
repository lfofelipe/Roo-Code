// Script de instalação completo para o Roo Code
// Este script implementa todas as correções necessárias para evitar o problema de carregamento infinito
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('=== Script de Instalação do Roo Code ===');

try {
  // 1. Limpar caches e configurações antigas que podem causar conflitos
  console.log('\n1. Limpando caches e configurações antigas...');
  
  const vsCodeDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Code', 'User');
  const globalStorageDir = path.join(vsCodeDir, 'globalStorage');
  const rooCodeStorageDir = path.join(globalStorageDir, 'rooveterinaryinc.roo-cline');
  
  if (fs.existsSync(rooCodeStorageDir)) {
    console.log(`Removendo ${rooCodeStorageDir}`);
    try {
      execSync(`rd /s /q "${rooCodeStorageDir}"`, { stdio: 'inherit' });
    } catch (e) {
      console.log('Erro ao remover diretório, tentando continuar...');
    }
  }
  
  // 2. Desinstalar qualquer versão anterior do Roo Code
  console.log('\n2. Desinstalando versões anteriores...');
  try {
    execSync('code --uninstall-extension rooveterinaryinc.roo-cline', { stdio: 'inherit' });
  } catch (e) {
    console.log('Extensão não encontrada ou erro ao desinstalar, continuando...');
  }
  
  // 3. Compilar o pacote VSIX 
  console.log('\n3. Construindo pacote VSIX com correções...');
  
  // Compilar webview
  console.log('Compilando webview...');
  execSync('cd webview-ui && npm run vite-build', { stdio: 'inherit' });
  
  // Compilar extensão
  console.log('Compilando extensão...');
  execSync('node esbuild.js --production', { stdio: 'inherit' });
  
  // Implementar correção de caminhos
  console.log('Aplicando correção de caminhos...');
  
  const packageJsonPath = path.join(__dirname, 'package.json');
  const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
  
  const directories = [
    path.join(__dirname, 'dist'),
    path.join(__dirname, 'dist', '..'),
    path.join(__dirname, 'dist', '..', '..'),
    path.join(__dirname, 'dist', '..', '..', '..')
  ];
  
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
  
  // Criar pacote VSIX
  console.log('Gerando pacote VSIX...');
  
  // Remover e criar diretório bin
  if (process.platform === 'win32') {
    // Windows
    try {
      execSync('if (Test-Path bin) { Remove-Item -Recurse -Force bin }', { shell: 'powershell.exe', stdio: 'inherit' });
      execSync('New-Item -ItemType Directory -Force -Path bin', { shell: 'powershell.exe', stdio: 'inherit' });
    } catch (e) {
      console.log('Erro ao manipular diretórios, tentando criar mesmo assim...');
      if (!fs.existsSync('bin')) {
        fs.mkdirSync('bin', { recursive: true });
      }
    }
  } else {
    // Linux/macOS
    execSync('rm -rf bin && mkdir -p bin', { stdio: 'inherit' });
  }
  
  // Empacotar a extensão
  execSync('npx vsce package --no-dependencies --out bin', { stdio: 'inherit' });
  
  // 4. Instalar o pacote VSIX
  console.log('\n4. Instalando extensão...');
  
  // Encontrar o arquivo VSIX mais recente na pasta bin
  const binDir = path.join(__dirname, 'bin');
  const vsixFiles = fs.readdirSync(binDir).filter(file => file.endsWith('.vsix'));
  
  if (vsixFiles.length === 0) {
    throw new Error('Nenhum arquivo VSIX encontrado na pasta bin/');
  }
  
  // Ordenar por data de modificação e pegar o mais recente
  const mostRecentVsix = vsixFiles.sort((a, b) => {
    return fs.statSync(path.join(binDir, b)).mtime.getTime() - 
           fs.statSync(path.join(binDir, a)).mtime.getTime();
  })[0];
  
  const vsixPath = path.join(binDir, mostRecentVsix);
  console.log(`Instalando ${vsixPath}...`);
  
  execSync(`code --install-extension "${vsixPath}"`, { stdio: 'inherit' });
  
  // 5. Iniciar VS Code com a extensão
  console.log('\n5. Iniciando VS Code com a extensão...');
  
  // Obter caminho do diretório atual
  const currentDir = process.cwd();
  
  // Iniciar VS Code com a extensão
  execSync(`code --new-window`, { stdio: 'inherit' });
  
  console.log('\n=== Instalação concluída com sucesso! ===');
  console.log('\nO VS Code foi iniciado. Clique no ícone do foguete na barra lateral para usar o Roo Code.');
  console.log('\nSe você encontrar algum problema, consulte o arquivo SOLUCAO-ROO-CODE.md para soluções alternativas.');
} catch (error) {
  console.error('\nErro durante a instalação:', error);
  console.log('\nPara soluções alternativas, consulte o arquivo SOLUCAO-ROO-CODE.md');
}
