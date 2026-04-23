import { Browser, BrowserContext } from 'playwright';
import RecaptchaPlugin from 'puppeteer-extra-plugin-recaptcha';
import { proxyManager } from '../proxy';
import { env } from '../env';
const { firefox } = require('playwright-extra')

export class PlaywrightBrowserSingleton {
  // Browser pool: one browser instance per proxy
  private static browserPool: Map<string, Browser> = new Map(); // key: proxy server URL

  // Context pool: 1 context per proxy (max 3 proxies with contexts at once)
  private static contextPool: Map<string, BrowserContext | undefined> = new Map(); // key: proxy server URL, value: single context

  // Track active proxies with contexts and their creation order (for reuse rotation)
  private static activeProxiesWithContexts: Set<string> = new Set(); // proxies that currently have contexts
  private static proxyContextCreationOrder: string[] = []; // FIFO queue of proxies with contexts
  private static proxyContextIndex: number = 0; // for round-robin context selection among proxies

  private static proxyIndex: number = 0; // for round-robin proxy selection
  private static currentProxyServer: string = ''; // Track which proxy is being used

  // Non-proxy browser instance and contexts
  private static nonProxyBrowserInstance: Browser | null = null;
  private static nonProxyBrowserContexts: (BrowserContext | undefined)[] = [];
  private static nonProxyContextIndex: number = 0;
  private static readonly NON_PROXY_MAX_CONTEXTS = 3;
  private static readonly MAX_CONCURRENT_PROXY_CONTEXTS = 2;  // Max 2 contexts total

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
      return this.browserPool.get(proxyKey) || null;
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
        this.activeProxiesWithContexts.delete(proxyKey);
        const idx = this.proxyContextCreationOrder.indexOf(proxyKey);
        if (idx > -1) this.proxyContextCreationOrder.splice(idx, 1);
      });
    }

    // Initialize context for this proxy if not exists
    if (!this.contextPool.has(proxyKey)) {
      console.log(`🆕 [CONTEXT] Initializing context storage for proxy ${proxyKey}...`);
      this.contextPool.set(proxyKey, undefined);
      console.log(`✅ [CONTEXT] Context storage initialized for proxy ${proxyKey}`);
    }

    this.browserPool.set(proxyKey, browserInstance);
    return browserInstance;
  }

  static async getContext(): Promise<BrowserContext | null> {
    console.log(`📋 [CONTEXT CHECK-PROXY] Checking contexts (active: ${this.activeProxiesWithContexts.size}/${this.MAX_CONCURRENT_PROXY_CONTEXTS})`);

    // Step 1: If we haven't filled all context slots yet, create a new context with next proxy
    if (this.activeProxiesWithContexts.size < this.MAX_CONCURRENT_PROXY_CONTEXTS) {
      const { proxy, index, total } = this.getNextProxyWithIndex();
      const proxyKey = proxy.server;

      // Skip if this proxy already has a valid context
      const existingContext = this.contextPool.get(proxyKey);
      if (!existingContext || !this.isContextStillValid(existingContext)) {
        const browser = await this.getOrCreateBrowserForProxy(proxy);
        if (!browser) {
          console.error('❌ [BROWSER CONTEXT] Cannot get context, browser instance is null');
          return null;
        }

        console.log(`🆕 [BROWSER-PROXY] Creating NEW context assigned to proxy [${index + 1}/${total}]: ${proxyKey}...`);
        const newContext = await browser.newContext({ viewport: { width: 1280, height: 1080 } });
        console.log(`   ✅ Context instance created`);

        newContext.on('close', () => {
          console.log(`🔌 [BROWSER-PROXY] Browser context CLOSED EVENT for proxy ${proxyKey}`);
          this.contextPool.set(proxyKey, undefined);
          this.activeProxiesWithContexts.delete(proxyKey);
          const idx = this.proxyContextCreationOrder.indexOf(proxyKey);
          if (idx > -1) this.proxyContextCreationOrder.splice(idx, 1);
        });

        this.contextPool.set(proxyKey, newContext);
        this.activeProxiesWithContexts.add(proxyKey);
        this.proxyContextCreationOrder.push(proxyKey);

        console.log(`✅ [BROWSER-PROXY] Context FIXED to proxy ${proxyKey}`);
        console.log(`   Queue: [${this.proxyContextCreationOrder.join(', ')}]`);
        return newContext;
      }
    }

    // Step 2: All slots filled — round-robin through existing valid contexts
    if (this.proxyContextCreationOrder.length > 0) {
      const startIndex = this.proxyContextIndex % this.proxyContextCreationOrder.length;
      const rotatedIndices = Array.from(
        { length: this.proxyContextCreationOrder.length },
        (_, i) => (startIndex + i) % this.proxyContextCreationOrder.length
      );

      for (const currentIndex of rotatedIndices) {
        const proxyKey = this.proxyContextCreationOrder[currentIndex];
        const context = this.contextPool.get(proxyKey);

        if (context && this.isContextStillValid(context)) {
          console.log(`♻️ [BROWSER-PROXY] Reusing existing context for proxy ${proxyKey}`);
          this.proxyContextIndex = (currentIndex + 1) % this.proxyContextCreationOrder.length;
          this.currentProxyServer = proxyKey; // Update so getCurrentProxyServer() returns correct proxy
          console.log(`   Queue: [${this.proxyContextCreationOrder.join(', ')}] → Next index: ${this.proxyContextIndex}`);
          return context;
        }
      }
    }

    console.log(`❌ [BROWSER-PROXY] No valid contexts available`);
    return null;
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
   * When closed, next getContext() call will rotate to next proxy and create new context
   * @param proxyServer - The proxy server URL
   */
  static async closeContextForProxy(proxyServer: string): Promise<void> {
    const context = this.contextPool.get(proxyServer);
    if (!context) {
      console.log(`⚠️ [CLOSE CONTEXT] No context found for proxy ${proxyServer}`);
      return;
    }

    try {
      console.log(`🔌 [CLOSE CONTEXT] Closing context for proxy ${proxyServer}...`);
      await context.close();
      console.log(`✅ [CLOSE CONTEXT] Context closed successfully for proxy ${proxyServer}`);
    } catch (error: any) {
      console.error(`❌ [CLOSE CONTEXT] Error closing context: ${error.message}`);
    }

    // Clean up tracking
    this.contextPool.set(proxyServer, undefined);
    this.activeProxiesWithContexts.delete(proxyServer);
    const idx = this.proxyContextCreationOrder.indexOf(proxyServer);
    if (idx > -1) {
      this.proxyContextCreationOrder.splice(idx, 1);
    }

    console.log(`✅ [CLOSE CONTEXT] Cleaned up proxy ${proxyServer} from tracking (remaining in queue: ${this.proxyContextCreationOrder.join(', ')})`);

    // Also close and remove the browser instance
    const browser = this.browserPool.get(proxyServer);
    if (browser) {
      try {
        console.log(`🔌 [CLOSE CONTEXT] Closing browser instance for proxy ${proxyServer}...`);
        await browser.close();
        this.browserPool.delete(proxyServer);
        console.log(`✅ [CLOSE CONTEXT] Browser instance closed for proxy ${proxyServer}`);
      } catch (error: any) {
        console.error(`⚠️ [CLOSE CONTEXT] Error closing browser: ${error.message}`);
        this.browserPool.delete(proxyServer);
      }
    }
  }

  /**
   * Deprecated: with 1 context per proxy, use closeContextForProxy() instead
   * @deprecated Use closeContextForProxy() instead
   */
  static async closeSpecificContextForProxy(proxyServer: string, contextIndex: number): Promise<void> {
    console.warn('⚠️ [DEPRECATED] closeSpecificContextForProxy() is deprecated. Use closeContextForProxy() instead.');
    // For backward compatibility, just close the context for this proxy
    return this.closeContextForProxy(proxyServer);
  }

  /**
   * Get the current proxy server being used
   */
  static getCurrentProxyServer(): string {
    return this.currentProxyServer;
  }
}
