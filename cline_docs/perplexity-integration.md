# Integração do Perplexity PRO com RooCode

Esta documentação descreve a implementação da integração direta entre o RooCode e o Perplexity PRO, permitindo que os usuários utilizem o modelo Claude 3.7 sem custos adicionais de API.

## Visão Geral

A integração com o Perplexity PRO permite acessar o modelo Claude 3.7 através de dois métodos:

1. **API REST do Perplexity** - Para usuários com chave de API disponível
2. **Automação de navegador** - Para usuários sem chave de API, utilizando automação web
3. **Entrada manual** - Como fallback quando os outros métodos falham

A implementação segue uma arquitetura em camadas, com sistemas de fallback automático para garantir máxima confiabilidade.

## Benefícios

- **Acesso ao Claude 3.7** sem custos adicionais de API da Anthropic
- **Automação transparente** que funciona em segundo plano
- **Sistema de fallback** robusto que garante continuidade mesmo em caso de falhas
- **Armazenamento seguro** de credenciais
- **Configurações flexíveis** para personalizar o comportamento

## Configuração

Para configurar a integração com o Perplexity PRO:

1. Acesse as configurações do RooCode no VSCode
2. Selecione "Perplexity PRO" como provedor de API
3. Preencha suas credenciais do Perplexity:
   - Email da conta Perplexity PRO
   - Senha da conta Perplexity
   - Chave de API (opcional, para usuários com acesso à API)
4. Configure opções adicionais conforme necessário

## Arquitetura em Camadas

A integração é implementada em várias camadas:

### 1. Interface de Usuário (UI)
- Componentes na interface de configurações do RooCode para configuração de credenciais
- Opções para personalizar o comportamento da integração

### 2. Camada de Armazenamento Seguro
- Criptografia de credenciais sensíveis
- Gerenciamento de estado entre sessões

### 3. Automação do Perplexity
- API REST para usuários com chave de API
- Automação de navegador usando Playwright para interações com a interface web

### 4. Sistema de Gerenciamento de Sessões
- Criação e manutenção de sessões do Perplexity
- Limpeza automática de sessões inativas

### 5. Integração com o Human Relay
- Extensão do sistema Human Relay existente
- Automação transparente para o usuário final

## Diagrama de Fluxo

```
┌─────────────┐      ┌─────────────────┐      ┌────────────────┐
│ Prompt do   │─────▶│ Human Relay     │─────▶│ Verifica       │
│ Usuário     │      │ (humanRelay.ts) │      │ Configurações  │
└─────────────┘      └─────────────────┘      └────────┬───────┘
                                                       │
      ┌───────────────────────────────────────────────┤
      │                                               │
┌─────▼────────┐                              ┌───────▼────────┐
│ API REST     │                              │ Automação de   │
│ Perplexity   │                              │ Navegador      │
└──────┬───────┘                              └───────┬────────┘
       │                                              │
       │                                              │
┌──────▼──────────────────────────────────────────────▼────────┐
│                      Processamento de Resposta                │
└───────────────────────────────┬───────────────────────────────┘
                                │
                        ┌───────▼────────┐
                        │ Resposta para  │
                        │ o Usuário      │
                        └────────────────┘
```

## Sistema de Fallback

O sistema de fallback funciona da seguinte forma:

1. Tenta usar a API REST do Perplexity (se a chave de API estiver disponível)
2. Se falhar, tenta usar a automação de navegador
3. Se ambos falharem, recorre ao modo manual original do Human Relay

Este sistema garante a máxima confiabilidade mesmo em condições instáveis.

## Configurações Disponíveis

| Configuração | Descrição | Valor Padrão |
|-------------|-----------|--------------|
| `perplexityEmail` | Email da conta Perplexity | - |
| `perplexityPassword` | Senha da conta Perplexity | - |
| `perplexityApiKey` | Chave de API do Perplexity (opcional) | - |
| `perplexityPreferMethod` | Método preferido: "api", "browser" ou "auto" | "auto" |
| `perplexityLoggingEnabled` | Habilitar logs detalhados | false |
| `perplexityRequestTimeout` | Timeout para requisições (em ms) | 60000 |

## Troubleshooting

### Problemas de Autenticação

- Verifique se suas credenciais estão corretas
- Teste o login manualmente no site do Perplexity para confirmar que sua conta está ativa
- Verifique se você tem uma assinatura PRO válida do Perplexity

### Falhas na Automação do Navegador

- Atualize a extensão RooCode para a versão mais recente
- Verifique os logs detalhados (habilite em configurações)
- Tente o modo manual como alternativa temporária

### Problemas de Performance

- A automação de navegador é mais lenta que a API direta
- Considere obter uma chave de API do Perplexity para melhor performance
- Ajuste o timeout de requisição nas configurações avançadas

## Considerações de Segurança

- As credenciais são armazenadas de forma segura utilizando criptografia
- Nenhuma informação é enviada para servidores externos além do Perplexity
- A automação do navegador é executada localmente no ambiente do usuário

## Limitações Conhecidas

- A automação de navegador pode ser afetada por mudanças na interface do Perplexity
- O tempo de resposta da automação é mais lento que a API direta
- A integração requer uma assinatura PRO válida do Perplexity

## Roadmap Futuro

- Melhoria no sistema de detecção de erros e recuperação
- Opções adicionais de personalização
- Otimização de performance na automação do navegador
- Integração com outros modelos disponíveis no Perplexity
