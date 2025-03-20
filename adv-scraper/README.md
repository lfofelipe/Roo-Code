# Advanced Web Scraper (2025)

Uma extensão VSCode para coleta de dados web resiliente, indetectável e adaptativa. Projetada para desenvolvedores que precisam coletar dados da web enfrentando técnicas anti-bot modernas.

## Visão Geral

O Advanced Web Scraper é uma solução abrangente que combina automação de navegador, aprendizado de máquina e processamento visual para extrair dados da web, mesmo de sites com proteções anti-bot avançadas. A extensão implementa uma arquitetura distribuída com seleção dinâmica de método de scraping, rotação de identidades e proxies, e análise adaptativa em tempo real.

![Advanced Web Scraper](media/screenshot.png)

## Principais Recursos

### 🧠 Arquitetura de Scraping Inteligente

- **Sistema de decisão baseado em ML** que escolhe dinamicamente o método de scraping mais adequado
- **Infraestrutura distribuída** combinando automação de navegador, requisições diretas e processamento visual
- **Monitoramento em tempo real** que detecta bloqueios e ajusta parâmetros automaticamente

### 🌐 Navegação Avançada

- **Automação multi-browser** com Playwright/Puppeteer e rotação entre engines de renderização
- **Emulação de comportamento humano** com micro-pausas, movimentos de mouse naturais e padrões de digitação
- **Personalização avançada de fingerprint** para evitar detecção de automação

### 👤 Gerenciamento de Identidade

- **Sistema de proxies residenciais** com rotação geográfica inteligente
- **Banco de perfis completos** com fingerprints consistentes entre sessões
- **Emulação baseada em telemetria real** de usuários específicos

### 🔑 Autenticação Resiliente

- **Sistema híbrido de automação de login** combinando preenchimento de formulários e interceptação de tokens
- **Manutenção inteligente de sessão** para evitar timeouts
- **Manipulação de MFA** incluindo interceptação de códigos por email, SMS ou aplicativos

### 🛡️ Evasão Anti-Bot

- **Detecção e bypass de honeypots** e armadilhas
- **Resposta adaptativa** a desafios JavaScript dinâmicos
- **Análise de imagem por IA** para resolver captchas e extrair dados visuais

### 📊 Processamento de Dados

- **Pipeline de extração estruturada** de fontes heterogêneas (HTML, JS, imagens, PDFs)
- **Sistema de validação** para identificar dados falsos ou honeypots
- **Normalização automática** para unificar dados de múltiplas fontes

### 🔍 Exploração de APIs

- **Análise automatizada de tráfego XHR** para descobrir APIs internas
- **Inferência de parâmetros e autenticação** a partir do navegador
- **Documentação automática** de endpoints e parâmetros

## Características Técnicas

### Métodos de Scraping

O sistema suporta diversos métodos de scraping, escolhendo o mais adequado com base em ML:

- **Browser Automation**: Navegação completa com Playwright/Puppeteer
- **API Client**: Comunicação direta com APIs expostas pelo site
- **Visual Scraping**: Análise de capturas de tela com IA para extrair dados
- **Hybrid**: Combinação de abordagens para máxima resiliência
- **Direct Request**: Requisições HTTP simples para sites menos protegidos

### Evasão de Detecção

Implementamos técnicas avançadas para evitar detecção:

- **Fingerprint Randomization**: Geração de fingerprints únicos mas consistentes
- **Behavior Simulation**: Padrões humanos de clique, digitação e navegação
- **Challenge Bypass**: Resolução automática de captchas e desafios JavaScript
- **Proxy Rotation**: Mudança inteligente de IPs com base no contexto
- **Screenshot Analysis**: Detecção visual de bloqueios e honeypots

### Arquitetura do Sistema

A solução é construída em camadas:

1. **Core**: Sistema central de orquestração e decisão
2. **Services**: Componentes especializados para cada função
3. **Adapters**: Interfaces para diferentes navegadores e APIs
4. **Repository**: Armazenamento estruturado de dados e perfis
5. **UI**: Interface amigável para configuração e monitoramento

## Ética e Conformidade

Esta ferramenta foi projetada para uso legítimo, incluindo:

- Coleta de dados públicos para pesquisa
- Automação de testes e monitoramento
- Análise de mercado e concorrência
- Agregação de conteúdo para processamento legítimo

Recursos automáticos para conformidade:

- **Limitação de taxa adaptável** para respeitar capacidade de servidores
- **Cache inteligente** para minimizar requisições desnecessárias
- **Conformidade com robots.txt** avançada

## Requisitos

- VSCode 1.85.0 ou superior
- Node.js 18+ e npm
- Pelo menos 4GB de RAM disponível
- Acesso à internet com capacidade de usar proxies (opcional)

## Instalação

1. Abra o VSCode
2. Acesse a aba de Extensões
3. Pesquise por "Advanced Web Scraper"
4. Clique em "Instalar"

Ou instale manualmente:

```bash
git clone https://github.com/advanced-web-scraper/adv-scraper.git
cd adv-scraper
npm install
npm run vscode:prepublish
code --install-extension adv-scraper-1.0.0.vsix
```

## Uso Rápido

1. Abra a barra lateral do Advanced Web Scraper no VSCode
2. Clique em "Nova Tarefa"
3. Insira a URL alvo e configure as opções
4. Selecione ou crie um perfil de identidade
5. Configure os seletores de dados ou use a sugestão automática
6. Execute a tarefa e monitore em tempo real

Para uso avançado, consulte a [documentação completa](https://github.com/advanced-web-scraper/adv-scraper/docs).

## Configuração

A extensão oferece configurações em vários níveis:

### Configurações Globais

- **Comportamento de scraping**: Agressividade, evasão, tempo de espera
- **Gerenciamento de proxy**: Configurações de rotação e geolocalização
- **Serviços de IA**: Chaves de API e configurações para processamento visual

### Configurações por Tarefa

- **Método de scraping**: Auto (ML), Browser, API, Visual ou Híbrido
- **Autenticação**: Configurações de login e MFA
- **Seletores**: Definição precisa de dados a extrair
- **Comportamento**: Ajustes específicos para o site alvo

## Licença

Este projeto é licenciado sob MIT License - veja o arquivo [LICENSE](LICENSE) para detalhes.

## Aviso Legal

Esta ferramenta deve ser usada em conformidade com os termos de serviço dos sites alvo e leis aplicáveis. Os usuários são responsáveis por garantir que seu uso da ferramenta é legal e ético. Os desenvolvedores não se responsabilizam pelo uso indevido desta ferramenta.
