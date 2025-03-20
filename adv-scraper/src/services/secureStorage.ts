import * as vscode from 'vscode';
import * as crypto from 'crypto';

/**
 * Serviço para armazenamento seguro de dados sensíveis
 * Utiliza a API SecretStorage do VS Code
 */
export class SecureStorageService {
  private static readonly PREFIX = 'adv-scraper:';
  private readonly secretStorage: vscode.SecretStorage;
  
  constructor(secretStorage: vscode.SecretStorage) {
    this.secretStorage = secretStorage;
  }
  
  /**
   * Gera uma chave prefixada para o valor
   */
  private getKey(key: string): string {
    return `${SecureStorageService.PREFIX}${key}`;
  }
  
  /**
   * Armazena um valor de forma segura
   */
  public async store(key: string, value: string): Promise<void> {
    const prefixedKey = this.getKey(key);
    await this.secretStorage.store(prefixedKey, value);
  }
  
  /**
   * Armazena um objeto como JSON de forma segura
   */
  public async storeObject(key: string, value: any): Promise<void> {
    const jsonValue = JSON.stringify(value);
    await this.store(key, jsonValue);
  }
  
  /**
   * Recupera um valor armazenado de forma segura
   * Retorna undefined se o valor não for encontrado
   */
  public async retrieve(key: string): Promise<string | undefined> {
    const prefixedKey = this.getKey(key);
    return await this.secretStorage.get(prefixedKey);
  }
  
  /**
   * Recupera um objeto armazenado como JSON
   * Retorna undefined se o valor não for encontrado ou não for um JSON válido
   */
  public async retrieveObject<T>(key: string): Promise<T | undefined> {
    const jsonValue = await this.retrieve(key);
    
    if (!jsonValue) {
      return undefined;
    }
    
    try {
      return JSON.parse(jsonValue) as T;
    } catch (error) {
      console.error(`Erro ao fazer parse do JSON para a chave ${key}:`, error);
      return undefined;
    }
  }
  
  /**
   * Remove um valor armazenado
   */
  public async delete(key: string): Promise<void> {
    const prefixedKey = this.getKey(key);
    await this.secretStorage.delete(prefixedKey);
  }
  
  /**
   * Encripta informações sensíveis para armazenamento em arquivo
   * Útil quando o SecretStorage não está disponível ou para backups
   */
  public encryptString(value: string, password: string): string {
    // Gerar um IV (vetor de inicialização) aleatório
    const iv = crypto.randomBytes(16);
    
    // Derivar chave a partir da senha
    const key = crypto.scryptSync(password, 'salt', 32);
    
    // Criar cipher
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    // Encriptar dados
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Retornar IV + dados encriptados (IV é necessário para descriptografar)
    return iv.toString('hex') + ':' + encrypted;
  }
  
  /**
   * Descriptografa informações sensíveis
   */
  public decryptString(encryptedValue: string, password: string): string {
    try {
      // Separar IV e dados encriptados
      const parts = encryptedValue.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      // Derivar chave a partir da senha
      const key = crypto.scryptSync(password, 'salt', 32);
      
      // Criar decipher
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      
      // Descriptografar dados
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error('Falha ao descriptografar os dados. Senha incorreta ou dados corrompidos.');
    }
  }
  
  /**
   * Gera um hash único para identificação de recursos ou para derivar chaves
   */
  public generateHash(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex');
  }
  
  /**
   * Gera uma string aleatória que pode ser usada como chave de API ou senha temporária
   */
  public generateRandomToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }
  
  /**
   * Limpa todos os dados armazenados
   */
  public async clear(): Promise<void> {
    // Não é possível limpar tudo diretamente na API do VS Code,
    // então precisamos manter um registro de chaves e limpar uma a uma
    const allKeys = await this.retrieveObject<string[]>('__all_keys__') || [];
    
    for (const key of allKeys) {
      await this.delete(key);
    }
    
    // Limpar a própria lista de chaves
    await this.delete('__all_keys__');
  }
  
  /**
   * Armazena credenciais de proxy
   */
  public async storeProxyCredentials(proxyId: string, username: string, password: string, provider?: string): Promise<void> {
    const credentials = { username, password, provider };
    await this.storeObject(`proxy:${proxyId}:credentials`, credentials);
    
    // Atualizar lista de chaves
    await this.registerKey(`proxy:${proxyId}:credentials`);
  }
  
  /**
   * Obtém credenciais de proxy
   */
  public async getProxyCredentials(proxyId: string = ''): Promise<{username: string, password: string, provider: string} | undefined> {
    return await this.retrieveObject<{username: string, password: string, provider: string}>(`proxy:${proxyId}:credentials`);
  }
  
  /**
   * Armazena cookies de um perfil
   */
  public async storeCookies(profileId: string, cookies: string | any[]): Promise<void> {
    // Garantir que os cookies sejam armazenados como array
    const cookiesArray = typeof cookies === 'string' ? JSON.parse(cookies) : cookies;
    await this.storeObject(`profile:${profileId}:cookies`, cookiesArray);
    
    // Atualizar lista de chaves
    await this.registerKey(`profile:${profileId}:cookies`);
  }
  
  /**
   * Obtém cookies de um perfil
   */
  public async getCookies(profileId: string): Promise<string> {
    const cookies = await this.retrieveObject<any[]>(`profile:${profileId}:cookies`);
    return cookies ? JSON.stringify(cookies) : '[]';
  }
  
  /**
   * Registra uma chave na lista de todas as chaves para facilitar limpeza
   * @private
   */
  private async registerKey(key: string): Promise<void> {
    const allKeys = await this.retrieveObject<string[]>('__all_keys__') || [];
    
    if (!allKeys.includes(key)) {
      allKeys.push(key);
      await this.storeObject('__all_keys__', allKeys);
    }
  }
}
