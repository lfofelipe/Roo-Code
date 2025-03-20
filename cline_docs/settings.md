# Configurações do Roo Code

Este documento descreve como adicionar uma nova configuração que persiste seu estado no Roo Code.

## Adicionando uma Nova Configuração

Para adicionar uma nova configuração ao Roo Code, siga estas etapas:

1. Adicione a configuração à interface `SecureConfig` em `src/core/config/index.ts`.
2. Adicione o campo criptografado à interface global `globalConfig`.
3. Atualize as funções `getSecureConfig` e `setSecureConfig` para manipular a nova configuração.
4. Atualize a interface do usuário para fornecer controles para a nova configuração.

## Exemplo: Adicionando Configuração de API Key do Perplexity

### 1. Atualize a interface `SecureConfig` em `src/core/config/index.ts`:

```typescript
export interface SecureConfig {
  encryptedPerplexityEmail?: string;
  encryptedPerplexityPassword?: string;
  encryptedPerplexityApiKey?: string; // Adicione o campo criptografado
  perplexityEmail?: string;
  perplexityPassword?: string;
  perplexityApiKey?: string; // Adicione o campo descriptografado
  [key: string]: unknown;
}
```

### 2. Atualize a interface global `globalConfig`:

```typescript
declare global {
  // eslint-disable-next-line no-var
  var globalConfig: {
    encryptedPerplexityEmail?: string;
    encryptedPerplexityPassword?: string;
    encryptedPerplexityApiKey?: string; // Adicione o novo campo
    [key: string]: unknown;
  } | undefined;
}
```

### 3. Atualize as funções `getSecureConfig` e `setSecureConfig`:

```typescript
export const getSecureConfig = async (): Promise<SecureConfig> => {
  // Código existente...

  // Decrypt sensitive information
  let perplexityEmail: string | undefined;
  let perplexityPassword: string | undefined;
  let perplexityApiKey: string | undefined; // Adicione a nova variável
  
  // Código existente para email e senha...
  
  if (config.encryptedPerplexityApiKey) {
    try {
      perplexityApiKey = decrypt(config.encryptedPerplexityApiKey as string);
    } catch (error) {
      console.error('Failed to decrypt Perplexity API key:', error);
    }
  }
  
  return {
    ...config,
    perplexityEmail,
    perplexityPassword,
    perplexityApiKey // Inclua o novo campo no retorno
  };
};

export const setSecureConfig = (config: { 
  perplexityEmail?: string; 
  perplexityPassword?: string;
  perplexityApiKey?: string; // Adicione o novo campo
  [key: string]: unknown;
}): void => {
  // Código existente...
  
  if (config.perplexityApiKey) {
    global.globalConfig.encryptedPerplexityApiKey = encrypt(config.perplexityApiKey);
  }
  
  // Atualize a exclusão de campos para cópia
  for (const key in config) {
    if (key !== 'perplexityEmail' && key !== 'perplexityPassword' && key !== 'perplexityApiKey') {
      global.globalConfig[key] = config[key];
    }
  }
};
```

### 4. Atualize a interface do usuário

Adicione um novo campo de texto na página de configurações para permitir que o usuário insira sua chave de API do Perplexity. Você precisará atualizar o componente de configurações em `webview-ui/src/components/Settings.tsx` ou equivalente.

```tsx
// Exemplo de implementação do campo na interface do usuário
<InputField
  label="Perplexity API Key"
  type="password"
  placeholder="Digite sua chave de API do Perplexity"
  value={perplexityApiKey}
  onChange={(e) => setPerplexityApiKey(e.target.value)}
/>

// No manipulador de salvar configurações
const handleSave = () => {
  setSecureConfig({
    ...otherConfig,
    perplexityApiKey,
    // outras configurações existentes
  });
};
```

## Notas Importantes

- Todas as configurações sensíveis devem ser criptografadas usando a função `encrypt` do `src/core/crypto.ts`.
- Nunca armazene credenciais em texto simples no código ou em configurações não criptografadas.
- Para verificar a validade de uma chave de API, implemente uma função de verificação como a `verifyApiKey` no serviço Perplexity.

## Implementação do Human Relay com API do Perplexity

O Human Relay agora suporta o uso da API oficial do Perplexity como método primário, com automação do navegador como fallback:

1. Tenta usar a API do Perplexity se uma chave de API estiver configurada.
2. Se a API falhar ou não estiver configurada, tenta usar automação do navegador.
3. Se ambos falharem, solicita resposta manual do usuário.

Essa abordagem melhora a confiabilidade e reduz a dependência de automação do navegador, que pode ser afetada por mudanças no site do Perplexity.
