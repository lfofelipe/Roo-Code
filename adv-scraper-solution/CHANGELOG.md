# Changelog do Advanced Scraper Solution

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [1.1.0] - 2025-03-20

### Adicionado
- Nova API para execução de scripts personalizados no navegador
- Suporte para múltiplas identidades por sessão
- Funcionalidade de rotação automática de proxies
- Interface de linha de comando aprimorada com mais opções
- Novos comandos para gerenciamento de sessões em lote
- Suporte para Firefox e WebKit além do Chromium

### Melhorado
- Desempenho aprimorado na criação e gerenciamento de sessões
- Mecanismos de evasão de detecção mais sofisticados
- Implementação completa das ações de navegador no serviço `BrowserAutomationService`
- Tratamento de erros mais robusto com recuperação automática
- Documentação de API expandida com mais exemplos
- Simulação de comportamento humano mais realista durante digitação e navegação

### Corrigido
- Problema onde sessões de navegador não fechavam corretamente
- Vazamento de memória durante o uso prolongado
- Erro no gerenciamento de proxies quando a conexão caia
- Validação incorreta das opções de configuração
- Problemas de tipagem em várias interfaces

## [1.0.0] - 2025-01-15

### Adicionado
- Lançamento inicial do Advanced Scraper Solution
- Automação de navegador com Playwright
- Sistema de identidades para simular usuários distintos
- Gerenciamento de proxies
- Técnicas básicas de evasão de detecção
- API programática e interface de linha de comando
- Simulação de comportamento humano
- Suporte a bloqueio de domínios de rastreamento
