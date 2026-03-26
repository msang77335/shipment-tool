import { Browser, BrowserContext } from 'playwright';
import RecaptchaPlugin from 'puppeteer-extra-plugin-recaptcha';
import { env } from '.';
const { firefox } = require('playwright-extra')

export class PlaywrightBrowserSingleton {
  // Browser pool: one browser instance per proxy
  private static browserPool: Map<string, Browser> = new Map(); // key: proxy server URL
  private static contextPools: Map<string, (BrowserContext | undefined)[]> = new Map(); // key: proxy server URL
  
  private static proxyIndex: number = 0; // for round-robin proxy selection
  private static globalContextIndex: number = 0; // shared context index across all proxies
  private static currentProxyServer: string = ''; // Track which proxy is being used
  
  private static readonly MAX_CONTEXTS_PER_BROWSER = 9;
  
  // Non-proxy browser instance and contexts
  private static nonProxyBrowserInstance: Browser | null = null;
  private static nonProxyBrowserContexts: (BrowserContext | undefined)[] = [];
  private static nonProxyContextIndex: number = 0;
  private static readonly NON_PROXY_MAX_CONTEXTS = 3;
  
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
   * Get next proxy in rotation (requires proxies to be configured)
   * Returns the proxy config along with its index
   */
  private static getNextProxyWithIndex() {
    const proxy = env.proxies[this.proxyIndex % env.proxies.length];
    const proxyCount = env.proxies.length;
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
    
    // Ensure proxies are configured
    if (!env.proxies || env.proxies.length === 0) {
      const error = '❌ [BROWSER] No proxies configured! Use getInstanceWithoutProxy() for non-proxy browsing.';
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
        this.contextPools.delete(proxyKey);
      });
    }
    
    // Initialize context pool for this proxy
    if (!this.contextPools.has(proxyKey)) {
      this.contextPools.set(proxyKey, []);
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
      console.error('❌ [BROWSER CONTEXT] Cannot create context, browser instance is null');
      return null;
    }

    const proxyKey = proxy.server;
    
    // Get context pool for this proxy (same pool index used across all proxies)
    let contextPool = this.contextPools.get(proxyKey);
    if (!contextPool) {
      contextPool = [];
      this.contextPools.set(proxyKey, contextPool);
    }
    
    // Get GLOBAL context index (shared across all proxies for round-robin)
    const nextContextIndex = this.globalContextIndex % this.MAX_CONTEXTS_PER_BROWSER;
    
    console.log(`📋 [CONTEXT CHECK] Checking context ${nextContextIndex + 1}/${this.MAX_CONTEXTS_PER_BROWSER} for proxy [${index + 1}/${total}] ${proxyKey}`);
    
    // Check if context exists and is still valid (not closed)
    const existingContext = contextPool[nextContextIndex];
    console.log(`   Existing context: ${existingContext ? 'Found' : 'Not found'}`);
    
    const isContextValid = existingContext ? this.isContextStillValid(existingContext) : false;
    
    // Create context lazily only when needed or if it was closed
    if (isContextValid) {
      console.log(`♻️ [BROWSER CONTEXT] Reusing context ${nextContextIndex + 1}/${this.MAX_CONTEXTS_PER_BROWSER} (WITH PROXY [${index + 1}/${total}]: ${proxyKey})`);
    } else {
      if (existingContext) {
        console.log(`🔄 [CONTEXT CHECK] Existing context is invalid, creating new one...`);
      }
      console.log(`🆕 [BROWSER CONTEXT] Creating context ${nextContextIndex + 1} with proxy [${index + 1}/${total}] ${proxyKey} on demand...`);
      const context = await browser.newContext({ viewport: { width: 1280, height: 1080 } });
      console.log(`   ✅ Context instance created`);
      
      context.on('close', () => {
        console.log(`🔌 [BROWSER CONTEXT] Browser context ${nextContextIndex + 1} CLOSED EVENT (proxy: ${proxyKey})`);
        if (contextPool) contextPool[nextContextIndex] = undefined;
      });
      contextPool[nextContextIndex] = context;
      console.log(`✅ [BROWSER CONTEXT] Context ${nextContextIndex + 1} created and stored (WITH PROXY [${index + 1}/${total}] ${proxyKey})`);
    }

    const context = contextPool[nextContextIndex];
    
    // Rotate to next context for next call
    this.globalContextIndex++;
    console.log(`   Next context index will be: ${(this.globalContextIndex) % this.MAX_CONTEXTS_PER_BROWSER}`);
    
    return context ?? null;
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
}
