import { CookieParam, Page } from 'puppeteer';
import { CheckShop, ScreenshotResult, ShopSiteEnum } from '.';
import { PuppeteerBrowserSingleton } from '../PuppeteerBrowserSingleton';
import { getEnv } from '../env';

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

const _GC = (name: string, value: string): CookieParam => ({
  name, value, domain: '.google.com', path: '/',
  expires: -1, httpOnly: false, secure: true, sameSite: 'None',
});

// Google account cookies — required for Google OAuth / embedded Google resources on Shopee.
// Refresh these from browser DevTools > Application > Cookies > https://www.google.com when expired.
const GOOGLE_COOKIES: CookieParam[] = [
  _GC('__Secure-3PSID',   'g.a0008Agcup0Ng_thAjJR7P-d-uF6Dmwk4wyAAV-HERlyRgzrcc27QhO2jgQnok5AOHOqArdjKgACgYKAXsSARMSFQHGX2MidMJgTPgv2usfIEmo3fdHpBoVAUF8yKptbWlwnWXN9ZuDMG5Su3NT0076'),
  _GC('__Secure-3PAPISID','NKFYGB-8p7zUf6hp/AA-HZpkeQ2q-rAa9c'),
  _GC('__Secure-3PSIDTS', 'sidts-CjEBBj1CYjDeuLVy1-I-jeA-_J-EYBumLHAl1rfKyCrpv5wQUGK8L3M_C8hXcaROb1LqEAA'),
  _GC('__Secure-3PSIDCC', 'AKEyXzV-vVR6o2F1r7Qa9IZhxU7uAFG0VCUAx2Sf_kbUr3_EnKo-g1niNWfTFCGnITjm0jUhxQ'),
  _GC('NID',              '529=Jir6M_nF2gqyNEApYYGlK-8qW5W2i5VmJEbYSMezM5dBS5xNLBSuaF2Xur4y8yJ4jHVn-UlbSS8pToOwh4aIqjY9IZ6zI8FZWCzahTDk0DX9p2GKtielnFC27u970scp_CaD0ZkjiQ_xpbOTEP7xs2k0iPwaSfy6TkDJM09pGE2Q3mI4PakGjh99A3zyEuV9mthT9JEVypKEGpUEV7a2sr5jpQHBc2Wm_vxhTPms0BsH_QZa_Logr0wT76O9WVSwbdAHxWhYmHVzi66ALIlS7PpLFuuxFNdUHO3B0VPJ43mF28HY-jQLYXyZBDUvRZ-gGh5PQFTRNdYw-2TjBaEqR8Qg6jEBe7EGPJR2zVLRaK3juMQabL67XxJikuayLEHaJqb4Lrw0W0Rdq5g8eTb-Szj6HtRU23McjuGVzqRu-A9OXr4E_qYErKs7e0BKyQLYCa13w-xVBWkAw2L_bKbqDAvpfEyyMQyAtzniXjkiK_bb9d4db5I48HJZBtnHf6gjd2G5Hsi9r2qTtykrSqUrvPhRPl2Pl57miP2Z4PlQkog7TK9kTj5PbKIByPDxBnsMzRSSU3kuIKUOra_UFrzBZv9ttmRao5vkehvIvROvloBcd9kbGNEqlFNsoqB23947RstcjOhGvOjK7dypjPq8pdD_YSn03rzTm0608JQTVlFqW6nHxyw5E4zpH1w6l4EViUQwL4hnmar4XidVoj4MWoWlmuumLwvFLF_5CDgHS0undF1Hi4BpCiPRL-yh2aMvCG7GasHr7VXs4b2C2dO62bk4hU3y0kjU9ABvXxlXRFTNWsU8KtGKxQMyltAou-kDXf2SY9NNehEI'),
];

export class ShopeeCheckShop extends CheckShop {
  readonly site = ShopSiteEnum.Shopee;

  matches(url: string): boolean {
    return url.toUpperCase().includes('SHOPEE');
  }

  async screenshot(url: string): Promise<ScreenshotResult> {
    const browser = await PuppeteerBrowserSingleton.getInstance();
    if (!browser) throw new Error('Browser instance is not available');

    const page = await browser.newPage();
    try {
      // Inject SPC_F device fingerprint cookie before navigation so Shopee
      // treats the browser as a known device and skips device-verification flows.
      const { shopeeSpcF } = getEnv();
      if (shopeeSpcF) {
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        await (page as any).setCookie({
          name: 'SPC_F', value: shopeeSpcF,
          domain: '.shopee.vn', path: '/',
          expires: -1, httpOnly: false, secure: true, sameSite: 'Lax',
        });
        console.log(`🍪 [SHOPEE] SPC_F cookie injected`);
      } else {
        console.warn('⚠️ [SHOPEE] SHOPEE_SPC_F not set — device fingerprint missing');
      }

      // Inject Google account cookies so Google OAuth / embedded resources are authenticated.
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      await (page as any).setCookie(...GOOGLE_COOKIES);
      console.log(`🍪 [SHOPEE] Google cookies injected (${GOOGLE_COOKIES.length})`);

      console.log(`🌐 [SHOPEE CHECK SHOP] Navigating to ${url}...`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

      // Wait for shop content to settle after React hydration
      await sleep(10000);

      // Click the language selector button if visible (dismisses language prompt overlay)
      try {
        await page.waitForSelector('button.shopee-button-outline', { visible: true, timeout: 3000 });
        const clicked = await page.evaluate(() => {
          const doc = (globalThis as any).document;
          const btns: any[] = Array.from(doc.querySelectorAll('button.shopee-button-outline'));
          const langBtn = btns.find((b: any) => /tiếng việt/i.test(b.textContent || ''));
          if (langBtn) { langBtn.click(); return true; }
          return false;
        });
        if (clicked) {
          console.log(`🌐 [SHOPEE] Clicking language button...`);
          await sleep(1000);
        }
      } catch {
        // language button not present — continue normally
      }

      // Auto-login if credentials are configured and page landed on login
      await this.loginIfNeeded(page);

      const shopTile = await page.title();
      console.log(`🏪 [SHOPEE CHECK SHOP] Screenshotting: ${shopTile}`);
      const buffer = Buffer.from(await page.screenshot({ fullPage: true }));
      const isValidShop = await this.checkValidShop(page);
      const status = isValidShop ? 'AVAILABLE' : 'UNAVAILABLE';

      return { site: this.site, status, shopTile, screenshot: buffer };
    } finally {
      await page.close();
    }
  }

  private async loginIfNeeded(page: Page): Promise<void> {
    const loginInput = await page.waitForSelector('input[name="loginKey"]', { visible: true, timeout: 3000 }).catch(() => null);
    if (!loginInput) return;

    const { shopeeUsername, shopeePassword } = getEnv();
    if (!shopeeUsername || !shopeePassword) {
      console.warn('⚠️ [SHOPEE] Login page detected but SHOPEE_USERNAME/SHOPEE_PASSWORD not set');
      return;
    }

    console.log('🔑 [SHOPEE] Login page detected — attempting login...');
    await loginInput.type(shopeeUsername);
    await page.type('input[name="password"]', shopeePassword);

    await page.waitForSelector('button[elementtiming="shopee:heroComponentPaint"]', { visible: true, timeout: 5000 });
    // Wait until button is enabled (Shopee enables it after input validation)
    await page.waitForFunction(
      () => !(globalThis as any).document.querySelector('button[elementtiming="shopee:heroComponentPaint"]')?.hasAttribute('disabled'),
      { timeout: 10000 },
    );
    await page.click('button[elementtiming="shopee:heroComponentPaint"]');

    // Wait for login to complete — page navigates away from /login
    await page.waitForFunction(
      () => !(globalThis as any).location.pathname.includes('/login'),
      { timeout: 30000 },
    ).catch(() => console.warn('⚠️ [SHOPEE] Login may have failed — still on login page'));

    console.log('✅ [SHOPEE] Login complete, current URL:', page.url());
    await sleep(3000);
  }

  async checkValidShop(page: Page) {
    const isErrorPage = await page.evaluate(() => {
      const doc = (globalThis as any).document;
      // Case 1: error page title element
      if (doc.querySelector('.error-page-title')) return true;
      // Case 2: body has data-spm="store_error"
      if (doc.body?.dataset?.spm === 'store_error') return true;
      // Case 3: common-error iframe (errCode in URL)
      if (doc.querySelector('iframe[src*="common-error"]')) return true;
      // Case 4: specific text content indicating shop not found
      if (doc.querySelector('.shop-enter-fail-page')) return true;
      return false;
    });
    return !isErrorPage;
  }
}
