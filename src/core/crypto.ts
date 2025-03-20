import { AES, enc, lib } from 'crypto-js';
import * as vscode from 'vscode';

// Declare the extension context in global scope
declare global {
  // eslint-disable-next-line no-var
  var __vscode_extension_context: vscode.ExtensionContext | undefined;
}

/**
 * Get the encryption key from environment or generate a machine-specific one
 * @returns The encryption key
 */
function getEncryptionKey(): string {
  // Use environment variable if available (preferred for production)
  if (process.env.CLINE_ENCRYPTION_KEY) {
    return process.env.CLINE_ENCRYPTION_KEY;
  }
  
  // For development/local use, create a key based on machine-specific information
  // and store it in extension state (persistent across sessions)
  const context = global.__vscode_extension_context;
  if (context && context.globalState) {
    let storedKey = context.globalState.get('encryption_key') as string | undefined;
    
    if (!storedKey) {
      // Generate a new secure random key
      const randomKey = lib.WordArray.random(16).toString();
      // Store it for future use
      context.globalState.update('encryption_key', randomKey);
      storedKey = randomKey;
    }
    
    return storedKey;
  }
  
  // Last resort fallback with warning (should rarely happen)
  console.warn('WARNING: Using non-secure encryption. Please set CLINE_ENCRYPTION_KEY environment variable.');
  
  // Use machine id if available to at least have some variability
  const machineId = vscode.env.machineId || '';
  return `roo-code-${machineId}-key`;
}

// Get the key only once on module import
const SECRET_KEY = getEncryptionKey();

/**
 * Encrypt a string using AES encryption
 * @param text The text to encrypt
 * @returns The encrypted string
 */
export function encrypt(text: string): string {
  if (!text) return '';
  return AES.encrypt(text, SECRET_KEY).toString();
}

/**
 * Decrypt a string using AES encryption
 * @param ciphertext The encrypted text
 * @returns The decrypted string
 */
export function decrypt(ciphertext: string): string {
  if (!ciphertext) return '';
  try {
    const bytes = AES.decrypt(ciphertext, SECRET_KEY);
    return bytes.toString(enc.Utf8);
  } catch (error) {
    console.error('Decryption failed:', error);
    return '';
  }
}
