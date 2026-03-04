/**
 * Gemini API Key Rotator
 * Manages multiple Gemini API keys with round-robin rotation
 */

import { env } from './env';

class GeminiApiKeyRotator {
  private keys: string[] = [];
  private currentIndex: number = 0;

  constructor() {
    this.initializeKeys();
  }

  /**
   * Initialize keys from environment variable
   * Supports comma-separated list: "key1,key2,key3"
   */
  private initializeKeys(): void {
    if (!env.geminiApiKey) {
      console.log('⚠️ [GEMINI] No API keys configured');
      this.keys = [];
      return;
    }

    // Split by comma and trim whitespace
    this.keys = env.geminiApiKey
      .split(',')
      .map(key => key.trim())
      .filter(key => key.length > 0);

    console.log(`✅ [GEMINI] Loaded ${this.keys.length} API key(s)`);
  }

  /**
   * Get next key using round-robin algorithm
   * Returns undefined if no keys available
   */
  public getNextKey(): string | undefined {
    if (this.keys.length === 0) {
      console.log('❌ [GEMINI] No API keys available');
      return undefined;
    }

    const key = this.keys[this.currentIndex];
    
    // Move to next key for next request (round-robin)
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    
    console.log(`🔄 [GEMINI] Using API key ${this.currentIndex === 0 ? this.keys.length : this.currentIndex}/${this.keys.length}`);
    
    return key;
  }

  /**
   * Get current key without rotating
   */
  public getCurrentKey(): string | undefined {
    if (this.keys.length === 0) {
      return undefined;
    }
    return this.keys[this.currentIndex];
  }

  /**
   * Get total number of keys
   */
  public getKeyCount(): number {
    return this.keys.length;
  }

  /**
   * Check if keys are configured
   */
  public hasKeys(): boolean {
    return this.keys.length > 0;
  }

  /**
   * Reset rotation to first key
   */
  public reset(): void {
    this.currentIndex = 0;
    console.log('🔄 [GEMINI] API key rotation reset to start');
  }

  /**
   * Get all keys (for debugging)
   */
  public getAllKeys(): string[] {
    return [...this.keys];
  }

  /**
   * Manually set current index (for testing)
   */
  public setIndex(index: number): void {
    if (index >= 0 && index < this.keys.length) {
      this.currentIndex = index;
      console.log(`🔄 [GEMINI] API key index set to ${index + 1}/${this.keys.length}`);
    }
  }
}

// Export singleton instance
export const geminiApiKeyRotator = new GeminiApiKeyRotator();

/**
 * Get next Gemini API key using round-robin
 */
export function getNextGeminiApiKey(): string | undefined {
  return geminiApiKeyRotator.getNextKey();
}

/**
 * Check if Gemini API keys are configured
 */
export function hasGeminiApiKeys(): boolean {
  return geminiApiKeyRotator.hasKeys();
}

/**
 * Get Gemini API key count
 */
export function getGeminiApiKeyCount(): number {
  return geminiApiKeyRotator.getKeyCount();
}
