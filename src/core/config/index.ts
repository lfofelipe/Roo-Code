import { encrypt, decrypt } from '../crypto';

/**
 * Interface for secure configuration with encrypted and decrypted values
 */
export interface SecureConfig {
  encryptedPerplexityEmail?: string;
  encryptedPerplexityPassword?: string;
  encryptedPerplexityApiKey?: string;
  perplexityEmail?: string;
  perplexityPassword?: string;
  perplexityApiKey?: string;
  perplexityPreferMethod?: "api" | "browser" | "auto";
  perplexityLoggingEnabled?: boolean;
  perplexityRequestTimeout?: number;
  [key: string]: unknown;
}

/**
 * Global configuration object defined elsewhere in the codebase
 */
declare global {
  // eslint-disable-next-line no-var
  var globalConfig: {
    encryptedPerplexityEmail?: string;
    encryptedPerplexityPassword?: string;
    encryptedPerplexityApiKey?: string;
    perplexityPreferMethod?: "api" | "browser" | "auto";
    perplexityLoggingEnabled?: boolean;
    perplexityRequestTimeout?: number;
    [key: string]: unknown;
  } | undefined;
}

/**
 * Gets the secure configuration with decrypted values
 * @returns SecureConfig object with decrypted values
 */
export const getSecureConfig = async (): Promise<SecureConfig> => {
  try {
    // Attempt to load globalConfig
    if (typeof global.globalConfig === 'undefined') {
      console.warn('Global config is undefined');
      return {};
    }

    // Clone the global config to avoid mutating it
    const config = { ...global.globalConfig };

    // Decrypt sensitive information
    let perplexityEmail: string | undefined;
    let perplexityPassword: string | undefined;
    let perplexityApiKey: string | undefined;
    
    if (config.encryptedPerplexityEmail) {
      try {
        perplexityEmail = decrypt(config.encryptedPerplexityEmail as string);
        console.log('Successfully decrypted Perplexity email configuration');
      } catch (error) {
        console.error('Failed to decrypt Perplexity email:', error);
      }
    } else {
      console.log('No encrypted Perplexity email found in configuration');
    }
    
    if (config.encryptedPerplexityPassword) {
      try {
        perplexityPassword = decrypt(config.encryptedPerplexityPassword as string);
        console.log('Successfully decrypted Perplexity password configuration');
      } catch (error) {
        console.error('Failed to decrypt Perplexity password:', error);
      }
    } else {
      console.log('No encrypted Perplexity password found in configuration');
    }
    
    if (config.encryptedPerplexityApiKey) {
      try {
        perplexityApiKey = decrypt(config.encryptedPerplexityApiKey as string);
        console.log('Successfully decrypted Perplexity API key configuration');
      } catch (error) {
        console.error('Failed to decrypt Perplexity API key:', error);
      }
    } else {
      console.log('No encrypted Perplexity API key found in configuration');
    }
    
    // Validação básica das configurações recuperadas
    if (perplexityEmail === '') perplexityEmail = undefined;
    if (perplexityPassword === '') perplexityPassword = undefined;
    if (perplexityApiKey === '') perplexityApiKey = undefined;
    
    // Registro para depuração
    console.log('Perplexity configurations loaded:', {
      hasEmail: !!perplexityEmail,
      hasPassword: !!perplexityPassword,
      hasApiKey: !!perplexityApiKey,
      preferMethod: config.perplexityPreferMethod,
      loggingEnabled: config.perplexityLoggingEnabled,
      requestTimeout: config.perplexityRequestTimeout
    });
    
    return {
      ...config,
      perplexityEmail,
      perplexityPassword,
      perplexityApiKey
    };
  } catch (error) {
    console.error('Error loading secure config:', error);
    return {};
  }
};

/**
 * Sets encrypted values in the secure configuration
 * @param config Configuration values to encrypt and store
 */
export const setSecureConfig = (config: { 
  perplexityEmail?: string; 
  perplexityPassword?: string;
  perplexityApiKey?: string;
  perplexityPreferMethod?: "api" | "browser" | "auto";
  perplexityLoggingEnabled?: boolean;
  perplexityRequestTimeout?: number;
  [key: string]: unknown;
}): void => {
  try {
    // Ensure global config exists
    if (typeof global.globalConfig === 'undefined') {
      global.globalConfig = {};
    }
    
    // Encrypt and store values - Garantir que valores vazios não são criptografados
    if (config.perplexityEmail && config.perplexityEmail.trim() !== '') {
      global.globalConfig.encryptedPerplexityEmail = encrypt(config.perplexityEmail);
      console.log('Perplexity email encrypted and stored');
    } else if (config.perplexityEmail === '') {
      // Limpar valor existente se um valor vazio for fornecido
      delete global.globalConfig.encryptedPerplexityEmail;
      console.log('Perplexity email config cleared');
    }
    
    if (config.perplexityPassword && config.perplexityPassword.trim() !== '') {
      global.globalConfig.encryptedPerplexityPassword = encrypt(config.perplexityPassword);
      console.log('Perplexity password encrypted and stored');
    } else if (config.perplexityPassword === '') {
      // Limpar valor existente se um valor vazio for fornecido
      delete global.globalConfig.encryptedPerplexityPassword;
      console.log('Perplexity password config cleared');
    }
    
    if (config.perplexityApiKey && config.perplexityApiKey.trim() !== '') {
      global.globalConfig.encryptedPerplexityApiKey = encrypt(config.perplexityApiKey);
      console.log('Perplexity API key encrypted and stored');
    } else if (config.perplexityApiKey === '') {
      // Limpar valor existente se um valor vazio for fornecido
      delete global.globalConfig.encryptedPerplexityApiKey;
      console.log('Perplexity API key config cleared');
    }
    
    // Salvar configurações específicas do Perplexity
    if (config.perplexityPreferMethod) {
      global.globalConfig.perplexityPreferMethod = config.perplexityPreferMethod;
      console.log(`Perplexity prefer method set to: ${config.perplexityPreferMethod}`);
    }
    
    if (typeof config.perplexityLoggingEnabled !== 'undefined') {
      global.globalConfig.perplexityLoggingEnabled = config.perplexityLoggingEnabled;
      console.log(`Perplexity logging ${config.perplexityLoggingEnabled ? 'enabled' : 'disabled'}`);
    }
    
    if (typeof config.perplexityRequestTimeout !== 'undefined') {
      global.globalConfig.perplexityRequestTimeout = config.perplexityRequestTimeout;
      console.log(`Perplexity request timeout set to: ${config.perplexityRequestTimeout}ms`);
    }
    
    // Copy other properties
    for (const key in config) {
      if (key !== 'perplexityEmail' && 
          key !== 'perplexityPassword' && 
          key !== 'perplexityApiKey' && 
          key !== 'perplexityPreferMethod' && 
          key !== 'perplexityLoggingEnabled' && 
          key !== 'perplexityRequestTimeout') {
        global.globalConfig[key] = config[key];
      }
    }
    
    // Depuração - registrar as configurações do Perplexity sendo salvas
    console.log('Salvando configurações do Perplexity:', {
      hasEmail: !!config.perplexityEmail,
      hasPassword: !!config.perplexityPassword,
      hasApiKey: !!config.perplexityApiKey,
      preferMethod: config.perplexityPreferMethod,
      loggingEnabled: config.perplexityLoggingEnabled,
      requestTimeout: config.perplexityRequestTimeout
    });
  } catch (error) {
    console.error('Error setting secure config:', error);
  }
};
