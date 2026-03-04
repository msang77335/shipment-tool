/**
 * Browserless Token Rotator
 * Manages multiple Browserless API tokens with round-robin rotation
 */

import { env } from './env';

class BrowserlessTokenRotator {
  private tokens: string[] = [];
  private currentIndex: number = 0;

  constructor() {
    this.initializeTokens();
  }

  /**
   * Initialize tokens from environment variable
   * Supports comma-separated list: "token1,token2,token3"
   */
  private initializeTokens(): void {
    if (!env.browserlessApiToken) {
      console.log('⚠️ [BROWSERLESS] No tokens configured');
      this.tokens = [];
      return;
    }

    // Split by comma and trim whitespace
    this.tokens = env.browserlessApiToken
      .split(',')
      .map(token => token.trim())
      .filter(token => token.length > 0);

    console.log(`✅ [BROWSERLESS] Loaded ${this.tokens.length} token(s)`);
  }

  /**
   * Get next token using round-robin algorithm
   * Returns undefined if no tokens available
   */
  public getNextToken(): string | undefined {
    if (this.tokens.length === 0) {
      console.log('❌ [BROWSERLESS] No tokens available');
      return undefined;
    }

    const token = this.tokens[this.currentIndex];
    
    // Move to next token for next request (round-robin)
    this.currentIndex = (this.currentIndex + 1) % this.tokens.length;
    
    console.log(`🔄 [BROWSERLESS] Using token ${this.currentIndex === 0 ? this.tokens.length : this.currentIndex}/${this.tokens.length}`);
    
    return token;
  }

  /**
   * Get current token without rotating
   */
  public getCurrentToken(): string | undefined {
    if (this.tokens.length === 0) {
      return undefined;
    }
    return this.tokens[this.currentIndex];
  }

  /**
   * Get total number of tokens
   */
  public getTokenCount(): number {
    return this.tokens.length;
  }

  /**
   * Check if tokens are configured
   */
  public hasTokens(): boolean {
    return this.tokens.length > 0;
  }

  /**
   * Reset rotation to first token
   */
  public reset(): void {
    this.currentIndex = 0;
    console.log('🔄 [BROWSERLESS] Token rotation reset to start');
  }

  /**
   * Get all tokens (for debugging)
   */
  public getAllTokens(): string[] {
    return [...this.tokens];
  }

  /**
   * Manually set current index (for testing)
   */
  public setIndex(index: number): void {
    if (index >= 0 && index < this.tokens.length) {
      this.currentIndex = index;
      console.log(`🔄 [BROWSERLESS] Token index set to ${index + 1}/${this.tokens.length}`);
    }
  }
}

// Export singleton instance
export const browserlessTokenRotator = new BrowserlessTokenRotator();

/**
 * Get next browserless token using round-robin
 */
export function getNextBrowserlessToken(): string | undefined {
  return browserlessTokenRotator.getNextToken();
}

/**
 * Check if browserless tokens are configured
 */
export function hasBrowserlessTokens(): boolean {
  return browserlessTokenRotator.hasTokens();
}

/**
 * Get browserless token count
 */
export function getBrowserlessTokenCount(): number {
  return browserlessTokenRotator.getTokenCount();
}
