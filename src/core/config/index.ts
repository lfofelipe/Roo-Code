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
      } catch (error) {
        console.error('Failed to decrypt Perplexity email:', error);
      }
    }
    
    if (config.encryptedPerplexityPassword) {
      try {
        perplexityPassword = decrypt(config.encryptedPerplexityPassword as string);
      } catch (error) {
        console.error('Failed to decrypt Perplexity password:', error);
      }
    }
    
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
  [key: string]: unknown;
}): void => {
  try {
    // Ensure global config exists
    if (typeof global.globalConfig === 'undefined') {
      global.globalConfig = {};
    }
    
    // Encrypt and store values
    if (config.perplexityEmail) {
      global.globalConfig.encryptedPerplexityEmail = encrypt(config.perplexityEmail);
    }
    
    if (config.perplexityPassword) {
      global.globalConfig.encryptedPerplexityPassword = encrypt(config.perplexityPassword);
    }
    
    if (config.perplexityApiKey) {
      global.globalConfig.encryptedPerplexityApiKey = encrypt(config.perplexityApiKey);
    }
    
    // Copy other properties
    for (const key in config) {
      if (key !== 'perplexityEmail' && key !== 'perplexityPassword' && key !== 'perplexityApiKey') {
        global.globalConfig[key] = config[key];
      }
    }
  } catch (error) {
    console.error('Error setting secure config:', error);
  }
};
