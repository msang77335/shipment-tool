import { Browser } from 'puppeteer';
import puppeteerExtra from 'puppeteer-extra';
import RecaptchaPlugin from 'puppeteer-extra-plugin-recaptcha';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteerExtra.use(StealthPlugin());

export class PuppeteerBrowserSingleton {
  private static browserInstance: Browser | null = null;

  static async getInstance(): Promise<Browser | null> {
    if (this.browserInstance) {
      console.log('♻️ [PUPPETEER] Reusing existing browser instance');
      return this.browserInstance;
    }

    // Configure recaptcha plugin
    puppeteerExtra.use(
      RecaptchaPlugin({
        provider: {
          id: '2captcha',
          token: process.env.CAPTCHA_SOLVER_API_KEY || '',
        },
        visualFeedback: true,
      })
    );

    console.log('🆕 [PUPPETEER] Creating new browser instance');
    this.browserInstance = await puppeteerExtra.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    });

    if (this.browserInstance) {
      this.browserInstance.on('disconnected', () => {
        console.log('🔌 [PUPPETEER] Browser disconnected');
        this.browserInstance = null;
      });
      console.log('✅ [PUPPETEER] Browser instance created successfully');
    }

    return this.browserInstance;
  }
}
