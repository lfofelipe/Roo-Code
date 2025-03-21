# Solução para o Problema do Perplexity PRO no RooCode

Este documento contém a solução para o problema de autenticação com o Perplexity PRO no modo Browser na extensão RooCode, incluindo instruções passo a passo para implementar a correção.

## O Problema

Ao configurar o Perplexity no modo "Somente Browser", ocorre o seguinte erro:

> Could not resolve authentication method. Expected either apiKey or authToken to be set. Or for one of the "X-Api-Key" or "Authorization" headers to be explicitly omitted

Este erro acontece porque mesmo quando o modo "Somente Browser" está selecionado, o código tenta usar cabeçalhos de autenticação de API, criando um conflito.

## Causas Identificadas

1. **Mistura de modos de autenticação**: O código não separa completamente os modos "browser" e "api", causando interferências.
2. **Logs não funcionam**: O sistema de logs não consegue criar arquivos, dificultando o diagnóstico.
3. **Validação inadequada**: A validação não impede completamente o uso de autenticação de API no modo browser.
4. **Persistência de configurações**: As configurações são mantidas entre as sessões, mas podem estar gerando conflitos.

## Soluções Disponíveis

Criamos três scripts para ajudar a resolver o problema, cada um com uma abordagem diferente:

1. **debug-perplexity.js**: Adiciona logs temporários para diagnóstico sem modificar permanentemente o código.
2. **fix-perplexity-browser-auth.js**: Corrige o problema no código modificando apenas as partes relevantes.
3. **corrigir-perplexity-browser-modo.js**: Solução completa que reescreve a função principal, atualiza configurações e cria um novo VSIX.

## Instruções para Solução Rápida

Para resolver o problema rapidamente, siga estes passos:

1. Execute o script unificado:
   ```
   node corrigir-perplexity-browser-modo.js
   ```

2. Aguarde a conclusão do processo, que fará:
   - Backup do código original
   - Correção do código fonte
   - Compilação da extensão
   - Criação do pacote VSIX

3. Desinstale a versão atual do RooCode no VS Code

4. Instale a versão corrigida com o comando:
   ```
   code --install-extension bin/roo-cline-3.9.4.vsix
   ```

5. Configure o Perplexity PRO corretamente:
   - Selecione o provedor "Perplexity"
   - Informe seu email e senha
   - Selecione EXPLICITAMENTE "Somente Browser" como método
   - IMPORTANTE: Deixe o campo de API Key vazio
   - Habilite logs para diagnóstico

## Solução Alternativa: Modo de Depuração

Se você quiser apenas diagnosticar o problema sem modificar permanentemente o código:

1. Execute o script de depuração:
   ```
   node debug-perplexity.js
   ```

2. Siga as instruções na tela para testar o comportamento
3. Verifique os logs gerados em `./temp-logs/`

## Detalhes Técnicos da Correção

A correção implementada faz as seguintes alterações:

1. **Isolamento completo de modos**: Reescreve a função principal `perplexityCompletion` para separar completamente os modos "browser", "api" e "auto".

2. **Sistema de logs melhorado**:
   - Adiciona um método `critical` para logs críticos que são gravados mesmo com logging desabilitado
   - Melhora a detecção de erros de diretório/arquivo
   - Cria logs de diagnóstico em locais alternativos se o padrão falhar

3. **Tratamento rigoroso de credenciais**:
   - No modo "Somente Browser", ignora completamente qualquer chave de API
   - No modo "Somente API", verifica rigorosamente a presença da chave de API
   - No modo "Auto", tenta API primeiro e faz fallback para browser apenas se necessário

4. **Melhoria na gestão de erros**:
   - Mensagens de erro mais descritivas e amigáveis
   - Detecção específica para diferentes tipos de erros HTTP
   - Registro detalhado para facilitar diagnóstico

## Restaurando o Código Original

Se precisar reverter para o código original após testar a correção:

```bash
node -e "require('fs').copyFileSync('src/api/providers/perplexity.ts.backup-<timestamp>', 'src/api/providers/perplexity.ts'); console.log('Arquivo restaurado')"
```

(Substitua `<timestamp>` pelo timestamp no nome do arquivo de backup)

## Logs e Diagnóstico

Após aplicar a correção, um arquivo de log detalhado será criado em:
```
./correcao-perplexity.log
```

Este arquivo contém informações sobre todas as etapas do processo de correção e pode ser útil para diagnóstico adicional.

## Suporte Adicional

Se você continuar enfrentando problemas após aplicar esta correção, tente:

1. Limpar completamente as configurações do VS Code:
   - Feche o VS Code
   - Encontre o diretório de configuração:
     - Windows: `%APPDATA%\Code\User\globalStorage\rooveterinaryinc.roo-cline`
     - macOS: `~/Library/Application Support/Code/User/globalStorage/rooveterinaryinc.roo-cline`
     - Linux: `~/.config/Code/User/globalStorage/rooveterinaryinc.roo-cline`
   - Remova todos os arquivos `.json` deste diretório
   - Reinicie o VS Code e configure novamente

2. Aumente o nível de detalhe dos logs:
   - Habilite logs nas configurações do Perplexity
   - Verifique os logs gerados para identificar problemas específicos

3. Tente usar outra conta do Perplexity se disponível

---

## Explicação Técnica do Problema

O erro "Could not resolve authentication method" ocorre porque, mesmo quando o modo browser é selecionado explicitamente, o código tenta construir headers HTTP para autenticação de API. Isso cria um conflito quando os headers são enviados.

A solução implementada garante que quando o modo "Somente Browser" é selecionado, nenhuma lógica relacionada à API seja executada. Da mesma forma, quando o modo "Somente API" é selecionado, nenhuma lógica de navegador é executada. Isso elimina completamente o conflito que causava o erro.

## Verificação da Solução

Após aplicar a correção e configurar o Perplexity PRO:

1. Tente fazer uma pergunta simples ao Perplexity
2. Verifique se a resposta é recebida sem erros
3. Confira se o arquivo de log está sendo gerado corretamente

Se tudo funcionar sem erros, a correção foi aplicada com sucesso.
