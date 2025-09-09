import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { config } from '../config';
import { createLogger } from './logger';

const logger = createLogger('browser-automation');

export class BrowserAutomation {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing browser...');
      
      this.browser = await chromium.launch({
        headless: config.BROWSER_HEADLESS,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      });

      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      logger.info('Browser initialized successfully');
    } catch (error: any) {
      logger.error(`Failed to initialize browser: ${error.message}`);
      throw error;
    }
  }

  async createPage(): Promise<Page> {
    if (!this.context) {
      await this.initialize();
    }

    const page = await this.context!.newPage();
    
    // Set default timeout
    page.setDefaultTimeout(config.BROWSER_TIMEOUT);
    
    // Block unnecessary resources to speed up navigation
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      if (['image', 'stylesheet', 'font'].includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    return page;
  }

  async closePage(page: Page): Promise<void> {
    try {
      await page.close();
    } catch (error: any) {
      logger.warn(`Error closing page: ${error.message}`);
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      
      logger.info('Browser cleanup completed');
    } catch (error: any) {
      logger.error(`Error during browser cleanup: ${error.message}`);
    }
  }

  // Utility methods for common operations
  async waitForSelectorWithFallbacks(page: Page, selectors: string[], timeout = 10000): Promise<string | null> {
    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { timeout: timeout / selectors.length });
        return selector;
      } catch (error) {
        logger.debug(`Selector not found: ${selector}`);
      }
    }
    return null;
  }

  async detectCaptcha(page: Page): Promise<boolean> {
    const captchaSelectors = [
      'iframe[src*="recaptcha"]',
      '[data-captcha]',
      '.captcha',
      '#captcha',
      'img[src*="captcha"]',
      '[class*="captcha"]',
      '[id*="captcha"]'
    ];

    for (const selector of captchaSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          logger.warn(`CAPTCHA detected with selector: ${selector}`);
          return true;
        }
      } catch (error) {
        // Continue checking other selectors
      }
    }

    return false;
  }

  async takeScreenshot(page: Page, name: string): Promise<void> {
    try {
      if (config.DEBUG_ENABLED) {
        await page.screenshot({ 
          path: `debug-${name}-${Date.now()}.png`,
          fullPage: true 
        });
      }
    } catch (error: any) {
      logger.debug(`Failed to take screenshot: ${error.message}`);
    }
  }
}

export const browserAutomation = new BrowserAutomation();
