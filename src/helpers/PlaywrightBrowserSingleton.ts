import { Browser, BrowserContext } from 'playwright';
import RecaptchaPlugin from 'puppeteer-extra-plugin-recaptcha';
import { env } from '.';
const { firefox } = require('playwright-extra')

export class PlaywrightBrowserSingleton {
  private static browserInstance: Browser | null = null;
  private static browserContexts: BrowserContext[] = [];
  private static contextIndex: number = 0;
  private static readonly MAX_CONTEXTS = 1;
  
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
    this.browserInstance = await firefox.launch({
      headless: false,
      args: [
        '--no-sandbox',
      ]
    });
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
}
