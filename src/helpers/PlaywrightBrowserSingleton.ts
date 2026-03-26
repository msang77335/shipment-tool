import { Browser, BrowserContext } from 'playwright';
import RecaptchaPlugin from 'puppeteer-extra-plugin-recaptcha';
import { env } from '.';
const { firefox } = require('playwright-extra')

export class PlaywrightBrowserSingleton {
  private static browserInstance: Browser | null = null;
  private static browserContexts: BrowserContext[] = [];
  private static contextIndex: number = 0;
  private static proxyIndex: number = 0;
  private static readonly MAX_CONTEXTS = 3;
  
  // Non-proxy browser instance and contexts
  private static nonProxyBrowserInstance: Browser | null = null;
  private static nonProxyBrowserContexts: (BrowserContext | undefined)[] = [];
  private static nonProxyContextIndex: number = 0;
  private static readonly NON_PROXY_MAX_CONTEXTS = 3;
  
  /**
   * Get next proxy in rotation or undefined if no proxies configured
   */
  private static getNextProxy() {
    if (!env.proxies || env.proxies.length === 0) {
      console.log('🔄 [PROXY] No proxies available, launching browser without proxy');
      return undefined;
    }
    
    const proxy = env.proxies[this.proxyIndex % env.proxies.length];
    const proxyCount = env.proxies.length;
    const currentIndex = this.proxyIndex % proxyCount;
    
    this.proxyIndex = (this.proxyIndex + 1) % proxyCount;
    
    const auth = proxy.username ? ` (${proxy.username})` : '';
    console.log(`🔄 [PROXY] Rotating to proxy [${currentIndex + 1}/${proxyCount}]: ${proxy.server}${auth}`);
    return proxy;
  }
  
  static async getInstance(): Promise<Browser | null> {
    if (this.browserInstance) {
      console.log('♻️ [BROWSER] Reusing existing browser instance');
      return this.browserInstance;
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
    console.log('🆕 [BROWSER] Creating new browser instance');
    
    const launchOptions: any = {
      headless: false,
      args: [
        '--no-sandbox',
      ]
    };
    
    // Add proxy if available
    const proxy = this.getNextProxy();
    if (proxy) {
      launchOptions.proxy = proxy;
    }
    
    this.browserInstance = await firefox.launch(launchOptions);
    if (this.browserInstance) {
      this.browserInstance.on('disconnected', () => {
        console.log('🔌 [BROWSER] Browser disconnected');
        this.browserInstance = null;
        this.browserContexts = [];
        this.contextIndex = 0;
      });
    }
    return this.browserInstance;
  }

  static async getContext(): Promise<BrowserContext | null> {
    const browser = await this.getInstance();
    if (!browser) {
      console.error('❌ [BROWSER CONTEXT] Cannot create context, browser instance is null');
      return null;
    }

    // Get next context index (round-robin)
    const nextIndex = this.contextIndex % this.MAX_CONTEXTS;
    
    // Create context lazily only when needed
    if (this.browserContexts[nextIndex]) {
      console.log(`♻️ [BROWSER CONTEXT] Reusing context ${nextIndex + 1}/${this.MAX_CONTEXTS}`);
    } else {
      console.log(`🆕 [BROWSER CONTEXT] Creating context ${nextIndex + 1} on demand...`);
      const context = await browser.newContext({ viewport: { width: 1280, height: 1080 } });
      context.on('close', () => {
        console.log(`🔌 [BROWSER CONTEXT] Browser context ${nextIndex + 1} closed`);
        this.browserContexts[nextIndex] = undefined as any;
      });
      this.browserContexts[nextIndex] = context;
      console.log(`✅ [BROWSER CONTEXT] Context ${nextIndex + 1} created`);
    }

    const context = this.browserContexts[nextIndex];
    this.contextIndex = (this.contextIndex + 1) % this.MAX_CONTEXTS;
    
    return context;
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

    // Create context lazily only when needed
    if (this.nonProxyBrowserContexts[nextIndex]) {
      console.log(`♻️ [BROWSER-NO-PROXY] Reusing context ${nextIndex + 1}/${this.NON_PROXY_MAX_CONTEXTS}`);
    } else {
      console.log(`🆕 [BROWSER-NO-PROXY] Creating context ${nextIndex + 1} on demand...`);
      const context = await browser.newContext({ viewport: { width: 1280, height: 1080 } });
      context.on('close', () => {
        console.log(`🔌 [BROWSER-NO-PROXY] Browser context ${nextIndex + 1} closed`);
        this.nonProxyBrowserContexts[nextIndex] = undefined;
      });
      this.nonProxyBrowserContexts[nextIndex] = context;
      console.log(`✅ [BROWSER-NO-PROXY] Context ${nextIndex + 1} created`);
    }

    const context = this.nonProxyBrowserContexts[nextIndex];
    this.nonProxyContextIndex = (this.nonProxyContextIndex + 1) % this.NON_PROXY_MAX_CONTEXTS;

    return context;
  }
}
