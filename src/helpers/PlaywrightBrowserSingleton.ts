import { Browser, BrowserContext } from 'playwright';
import RecaptchaPlugin from 'puppeteer-extra-plugin-recaptcha';
import { env } from '.';
import { proxyManager } from './proxyManager';
const { firefox } = require('playwright-extra')

export class PlaywrightBrowserSingleton {
  // Browser pool: one browser instance per proxy
  private static browserPool: Map<string, Browser> = new Map(); // key: proxy server URL
  
  // Context pool: multiple contexts per proxy (round-robin, max 3 per proxy)
  private static contextPool: Map<string, (BrowserContext | undefined)[]> = new Map(); // key: proxy server URL
  private static contextIndexPerProxy: Map<string, number> = new Map(); // track round-robin index per proxy
  
  private static proxyIndex: number = 0; // for round-robin proxy selection
  private static currentProxyServer: string = ''; // Track which proxy is being used
  
  // Non-proxy browser instance and contexts
  private static nonProxyBrowserInstance: Browser | null = null;
  private static nonProxyBrowserContexts: (BrowserContext | undefined)[] = [];
  private static nonProxyContextIndex: number = 0;
  private static readonly NON_PROXY_MAX_CONTEXTS = 3;
  private static readonly PROXY_MAX_CONTEXTS = 3;
  
  /**
   * Check if a browser context is still valid and usable
   */
  private static isContextStillValid(context: BrowserContext | undefined): boolean {
    if (!context) {
      console.log(`   ⚠️ Context is undefined`);
      return false;
    }
    
    try {
      const browser = context.browser();
      if (!browser) {
        console.log(`   ⚠️ Context browser is null`);
        return false;
      }
      
      // Check if browser is connected
      if (browser.isConnected?.() === false) {
        console.log(`   ⚠️ Browser is not connected`);
        return false;
      }
      
      console.log(`   ✓ Context is valid and usable`);
      return true;
    } catch (error: any) {
      console.log(`   ⚠️ Context validation error: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Get next proxy in rotation (requires proxies to be configured in proxyManager)
   * Returns the proxy config along with its index
   */
  private static getNextProxyWithIndex() {
    const proxies = proxyManager.getAllProxies();
    
    if (!proxies || proxies.length === 0) {
      const error = '❌ [PROXY] No proxies available in proxy manager!';
      console.error(error);
      throw new Error(error);
    }

    const proxy = proxies[this.proxyIndex % proxies.length];
    const proxyCount = proxies.length;
    const currentIndex = this.proxyIndex % proxyCount;
    
    this.proxyIndex = (this.proxyIndex + 1) % proxyCount;
    
    const auth = proxy.username ? ` (${proxy.username})` : '';
    console.log(`🔄 [PROXY] Rotating to proxy [${currentIndex + 1}/${proxyCount}]: ${proxy.server}${auth}`);
    
    // Store the current proxy server for logging
    this.currentProxyServer = proxy.server;
    
    return { proxy, index: currentIndex, total: proxyCount };
  }
  
  /**
   * Get or create browser instance for a specific proxy
   */
  private static async getOrCreateBrowserForProxy(proxy: any): Promise<Browser | null> {
    const proxyKey = proxy.server;
    
    // Return existing browser instance if available
    if (this.browserPool.has(proxyKey)) {
      console.log(`♻️ [BROWSER] Reusing existing browser instance (WITH PROXY: ${proxyKey})`);
      return this.browserPool.get(proxyKey)!;
    }
    
    // Ensure proxies are configured in proxy manager
    const availableProxies = proxyManager.getAllProxies();
    if (!availableProxies || availableProxies.length === 0) {
      const error = '❌ [BROWSER] No proxies configured in proxy manager! Use getInstanceWithoutProxy() for non-proxy browsing.';
      console.error(error);
      throw new Error(error);
    }
    
    // Configure plugins
    firefox.use(
      RecaptchaPlugin({
        provider: {
          id: '2captcha',
          token: env.captchaSolverApiKey || '',
        },
        visualFeedback: true,
      })
    );
    console.log(`🆕 [BROWSER] Creating new browser instance WITH proxy ${proxyKey}`);
    
    const launchOptions: any = {
      headless: false,
      args: [
        '--no-sandbox',
      ],
      proxy: proxy
    };
    
    const browserInstance = await firefox.launch(launchOptions);
    console.log(`✅ [BROWSER] Browser instance created with proxy ${proxyKey}`);
    
    if (browserInstance) {
      browserInstance.on('disconnected', () => {
        console.log(`🔌 [BROWSER] Browser disconnected (proxy: ${proxyKey})`);
        this.browserPool.delete(proxyKey);
        this.contextPool.delete(proxyKey);
        this.contextIndexPerProxy.delete(proxyKey);
      });
    }
    
    // Initialize context array for this proxy if not exists
    if (!this.contextPool.has(proxyKey)) {
      console.log(`🆕 [CONTEXT] Creating context pool for proxy ${proxyKey} (${this.PROXY_MAX_CONTEXTS} max)...`);
      this.contextPool.set(proxyKey, []);
      this.contextIndexPerProxy.set(proxyKey, 0);
      console.log(`✅ [CONTEXT] Context pool initialized for proxy ${proxyKey}`);
    }
    
    this.browserPool.set(proxyKey, browserInstance);
    return browserInstance;
  }

  static async getContext(): Promise<BrowserContext | null> {
    // Get next proxy with rotation
    const { proxy, index, total } = this.getNextProxyWithIndex();
    
    // Get or create browser for this proxy
    const browser = await this.getOrCreateBrowserForProxy(proxy);
    if (!browser) {
      console.error('❌ [BROWSER CONTEXT] Cannot get context, browser instance is null');
      return null;
    }

    const proxyKey = proxy.server;
    
    // Get context pool for this proxy
    let contextArray = this.contextPool.get(proxyKey);
    if (!contextArray) {
      console.error('❌ [BROWSER CONTEXT] Context pool not found for proxy');
      return null;
    }

    // Get current round-robin index for this proxy
    const currentContextIndex = this.contextIndexPerProxy.get(proxyKey) ?? 0;
    const nextContextIndex = currentContextIndex % this.PROXY_MAX_CONTEXTS;

    console.log(`📋 [CONTEXT CHECK-PROXY] Checking context ${nextContextIndex + 1}/${this.PROXY_MAX_CONTEXTS} for proxy [${index + 1}/${total}]`);
    
    // Check if context exists and is still valid
    const existingContext = contextArray[nextContextIndex];
    console.log(`   Existing context: ${existingContext ? 'Found' : 'Not found'}`);
    
    const isContextValid = existingContext ? this.isContextStillValid(existingContext) : false;

    // Create context lazily only when needed
    if (isContextValid) {
      console.log(`♻️ [BROWSER-PROXY] Reusing context ${nextContextIndex + 1}/${this.PROXY_MAX_CONTEXTS} for proxy ${proxyKey}`);
    } else {
      if (existingContext) {
        console.log(`🔄 [CONTEXT CHECK-PROXY] Existing context is invalid, creating new one...`);
      }
      console.log(`🆕 [BROWSER-PROXY] Creating context ${nextContextIndex + 1} on demand for proxy ${proxyKey}...`);
      const context = await browser.newContext({ viewport: { width: 1280, height: 1080 } });
      console.log(`   ✅ Context instance created`);
      
      context.on('close', () => {
        console.log(`🔌 [BROWSER-PROXY] Browser context ${nextContextIndex + 1} CLOSED EVENT for proxy ${proxyKey}`);
        contextArray[nextContextIndex] = undefined;
      });
      contextArray[nextContextIndex] = context;
      console.log(`✅ [BROWSER-PROXY] Context ${nextContextIndex + 1} created and stored for proxy ${proxyKey}`);
    }

    const context = contextArray[nextContextIndex] ?? null;
    
    // Update round-robin index for next call
    const nextIndex = (currentContextIndex + 1) % this.PROXY_MAX_CONTEXTS;
    this.contextIndexPerProxy.set(proxyKey, nextIndex);
    console.log(`   Next context index for proxy ${proxyKey} will be: ${nextIndex}`);

    return context;
  }

  /**
   * Get browser context WITH proxy (explicit method, only works when proxies are configured)
   * Alias for getContext() with explicit naming for clarity
   */
  static async getContextWithProxy(): Promise<BrowserContext | null> {
    return this.getContext();
  }

  /**
   * Get browser instance WITHOUT proxy (separate instance)
   */
  static async getInstanceWithoutProxy(): Promise<Browser | null> {
    if (this.nonProxyBrowserInstance) {
      console.log('♻️ [BROWSER-NO-PROXY] Reusing existing non-proxy browser instance');
      return this.nonProxyBrowserInstance;
    }

    // Configure plugins
    firefox.use(
      RecaptchaPlugin({
        provider: {
          id: '2captcha',
          token: env.captchaSolverApiKey || '',
        },
        visualFeedback: true,
      })
    );

    console.log('🆕 [BROWSER-NO-PROXY] Creating new browser instance WITHOUT proxy');

    this.nonProxyBrowserInstance = await firefox.launch({
      headless: false,
      args: [
        '--no-sandbox',
      ]
    });

    if (this.nonProxyBrowserInstance) {
      this.nonProxyBrowserInstance.on('disconnected', () => {
        console.log('🔌 [BROWSER-NO-PROXY] Browser disconnected');
        this.nonProxyBrowserInstance = null;
        this.nonProxyBrowserContexts = [];
        this.nonProxyContextIndex = 0;
      });
    }

    return this.nonProxyBrowserInstance;
  }

  /**
   * Get browser context WITHOUT proxy (3 contexts max, no proxy rotation)
   */
  static async getContextWithoutProxy(): Promise<BrowserContext | null> {
    const browser = await this.getInstanceWithoutProxy();
    if (!browser) {
      console.error('❌ [BROWSER-NO-PROXY] Cannot create context, browser instance is null');
      return null;
    }

    // Get next context index (round-robin)
    const nextIndex = this.nonProxyContextIndex % this.NON_PROXY_MAX_CONTEXTS;

    console.log(`📋 [CONTEXT CHECK-NO-PROXY] Checking context ${nextIndex + 1}/${this.NON_PROXY_MAX_CONTEXTS}`);
    
    // Check if context exists and is still valid
    const existingContext = this.nonProxyBrowserContexts[nextIndex];
    console.log(`   Existing context: ${existingContext ? 'Found' : 'Not found'}`);
    
    const isContextValid = existingContext ? this.isContextStillValid(existingContext) : false;

    // Create context lazily only when needed
    if (isContextValid) {
      console.log(`♻️ [BROWSER-NO-PROXY] Reusing context ${nextIndex + 1}/${this.NON_PROXY_MAX_CONTEXTS}`);
    } else {
      if (existingContext) {
        console.log(`🔄 [CONTEXT CHECK-NO-PROXY] Existing context is invalid, creating new one...`);
      }
      console.log(`🆕 [BROWSER-NO-PROXY] Creating context ${nextIndex + 1} on demand...`);
      const context = await browser.newContext({ viewport: { width: 1280, height: 1080 } });
      console.log(`   ✅ Context instance created`);
      
      context.on('close', () => {
        console.log(`🔌 [BROWSER-NO-PROXY] Browser context ${nextIndex + 1} CLOSED EVENT`);
        this.nonProxyBrowserContexts[nextIndex] = undefined;
      });
      this.nonProxyBrowserContexts[nextIndex] = context;
      console.log(`✅ [BROWSER-NO-PROXY] Context ${nextIndex + 1} created and stored`);
    }

    const context = this.nonProxyBrowserContexts[nextIndex] ?? null;
    this.nonProxyContextIndex = (this.nonProxyContextIndex + 1) % this.NON_PROXY_MAX_CONTEXTS;
    console.log(`   Next context index will be: ${this.nonProxyContextIndex % this.NON_PROXY_MAX_CONTEXTS}`);

    return context;
  }

  /**
   * Close context for a specific proxy
   * @param proxyServer - The proxy server URL
   */
  static async closeContextForProxy(proxyServer: string): Promise<void> {
    const contextArray = this.contextPool.get(proxyServer);
    if (!contextArray || contextArray.length === 0) {
      console.log(`⚠️ [CLOSE CONTEXT] No contexts found for proxy ${proxyServer}`);
    } else {
      console.log(`🔌 [CLOSE CONTEXT] Closing all contexts for proxy ${proxyServer}...`);
      let closedCount = 0;

      for (let i = 0; i < contextArray.length; i++) {
        const context = contextArray[i];
        if (!context) continue;

        try {
          console.log(`   Closing context ${i + 1}/${this.PROXY_MAX_CONTEXTS}...`);
          await context.close();
          contextArray[i] = undefined;
          closedCount++;
        } catch (error: any) {
          console.error(`   ❌ Error closing context ${i + 1}: ${error.message}`);
        }
      }

      this.contextPool.delete(proxyServer);
      this.contextIndexPerProxy.set(proxyServer, 0);
      console.log(`✅ [CLOSE CONTEXT] Closed ${closedCount}/${this.PROXY_MAX_CONTEXTS} contexts for proxy ${proxyServer}`);
    }

    // Also close and remove the browser instance to force fresh connection on next attempt
    const browser = this.browserPool.get(proxyServer);
    if (browser) {
      try {
        console.log(`🔌 [CLOSE CONTEXT] Closing browser instance for proxy ${proxyServer}...`);
        await browser.close();
        this.browserPool.delete(proxyServer);
        console.log(`✅ [CLOSE CONTEXT] Browser instance closed for proxy ${proxyServer}`);
      } catch (error: any) {
        console.error(`⚠️ [CLOSE CONTEXT] Error closing browser for proxy ${proxyServer}: ${error.message}`);
        // Still remove from pool even if close fails
        this.browserPool.delete(proxyServer);
      }
    }
  }

  /**
   * Close a specific context by index for a proxy
   * @param proxyServer - The proxy server URL
   * @param contextIndex - The context index (0-based)
   */
  static async closeSpecificContextForProxy(proxyServer: string, contextIndex: number): Promise<void> {
    if (contextIndex < 0 || contextIndex >= this.PROXY_MAX_CONTEXTS) {
      console.error(`❌ [CLOSE CONTEXT] Invalid context index ${contextIndex} for proxy ${proxyServer}`);
      return;
    }

    const contextArray = this.contextPool.get(proxyServer);
    if (!contextArray) {
      console.log(`⚠️ [CLOSE CONTEXT] No context pool found for proxy ${proxyServer}`);
      return;
    }

    const context = contextArray[contextIndex];
    if (!context) {
      console.log(`⚠️ [CLOSE CONTEXT] No context found at index ${contextIndex} for proxy ${proxyServer}`);
      return;
    }

    try {
      console.log(`🔌 [CLOSE CONTEXT] Closing context ${contextIndex + 1}/${this.PROXY_MAX_CONTEXTS} for proxy ${proxyServer}...`);
      await context.close();
      contextArray[contextIndex] = undefined;
      console.log(`✅ [CLOSE CONTEXT] Context closed successfully for proxy ${proxyServer}`);
    } catch (error: any) {
      console.error(`❌ [CLOSE CONTEXT] Error closing context: ${error.message}`);
    }

    // If all contexts are closed/undefined, also close browser instance
    const allClosed = contextArray.every(ctx => !ctx);
    if (allClosed) {
      const browser = this.browserPool.get(proxyServer);
      if (browser) {
        try {
          console.log(`🔌 [CLOSE CONTEXT] All contexts closed - closing browser instance for proxy ${proxyServer}...`);
          await browser.close();
          this.browserPool.delete(proxyServer);
          this.contextPool.delete(proxyServer);
          this.contextIndexPerProxy.set(proxyServer, 0);
          console.log(`✅ [CLOSE CONTEXT] Browser instance closed for proxy ${proxyServer}`);
        } catch (error: any) {
          console.error(`⚠️ [CLOSE CONTEXT] Error closing browser: ${error.message}`);
          this.browserPool.delete(proxyServer);
        }
      }
    }
  }

  /**
   * Get the current proxy server being used
   */
  static getCurrentProxyServer(): string {
    return this.currentProxyServer;
  }
}
