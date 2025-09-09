import { Page } from 'playwright';
import { browserAutomation } from './browser-automation';
import { createLogger } from './logger';
import { config } from '../config';
import { type InsertUnlockRequest } from '@shared/schema';

const logger = createLogger('att-flow');

export interface SubmissionResult {
  success: boolean;
  requestId?: string;
  deadlineISO?: string;
  captchaDetected: boolean;
  errorMessage?: string;
}

export class ATTFlow {
  async submitUnlockRequest(request: InsertUnlockRequest): Promise<SubmissionResult> {
    let page: Page | null = null;
    
    try {
      logger.info('Starting AT&T unlock request submission', undefined, request);
      
      page = await browserAutomation.createPage();
      
      // Navigate to AT&T unlock page
      await page.goto(config.ATT_UNLOCK_URL);
      await browserAutomation.takeScreenshot(page, 'step1-loaded');
      
      // Check for CAPTCHA early
      const captchaDetected = await browserAutomation.detectCaptcha(page);
      if (captchaDetected) {
        logger.warn('CAPTCHA detected on initial page load');
        return {
          success: false,
          captchaDetected: true,
          errorMessage: 'CAPTCHA detectado. Se requiere intervención manual.'
        };
      }

      // Step 1: Choose path (with/without AT&T number)
      const hasAttNumber = !!request.phoneNumber;
      await this.selectPath(page, hasAttNumber);
      
      // Step 2: Fill device information
      await this.fillDeviceInfo(page, request);
      
      // Step 3: Fill personal information
      await this.fillPersonalInfo(page, request);
      
      // Step 4: Accept terms and submit
      await this.acceptTermsAndSubmit(page);
      
      // Step 5: Extract confirmation details
      const result = await this.extractConfirmationDetails(page);
      
      logger.info('AT&T unlock request submitted successfully', undefined, result);
      return result;
      
    } catch (error: any) {
      logger.error(`AT&T flow error: ${error.message}`, undefined, { error: error.stack });
      
      // Check for CAPTCHA on error
      const captchaDetected = page ? await browserAutomation.detectCaptcha(page) : false;
      
      return {
        success: false,
        captchaDetected,
        errorMessage: error.message
      };
    } finally {
      if (page) {
        await browserAutomation.closePage(page);
      }
    }
  }

  private async selectPath(page: Page, hasAttNumber: boolean): Promise<void> {
    logger.info(`Selecting path: ${hasAttNumber ? 'with' : 'without'} AT&T number`);
    
    // Look for radio buttons or buttons to select path
    const pathSelectors = hasAttNumber 
      ? ['input[value*="yes"]', 'input[value*="att"]', 'button:has-text("Yes")', 'button:has-text("Sí")']
      : ['input[value*="no"]', 'input[value*="nonatt"]', 'button:has-text("No")'];
    
    const foundSelector = await browserAutomation.waitForSelectorWithFallbacks(page, pathSelectors);
    if (!foundSelector) {
      throw new Error('No se pudo encontrar la opción de selección de ruta');
    }
    
    await page.click(foundSelector);
    await page.waitForTimeout(1000);
    
    // Look for continue/next button
    const continueSelectors = [
      'button:has-text("Continue")',
      'button:has-text("Next")',
      'button:has-text("Continuar")',
      'button:has-text("Siguiente")',
      'input[type="submit"]',
      'button[type="submit"]'
    ];
    
    const continueSelector = await browserAutomation.waitForSelectorWithFallbacks(page, continueSelectors);
    if (continueSelector) {
      await page.click(continueSelector);
      await page.waitForLoadState('networkidle');
    }
    
    await browserAutomation.takeScreenshot(page, 'step1-path-selected');
  }

  private async fillDeviceInfo(page: Page, request: InsertUnlockRequest): Promise<void> {
    logger.info('Filling device information');
    
    // Fill IMEI
    const imeiSelectors = [
      'input[name*="imei"]',
      'input[placeholder*="IMEI"]',
      'input[id*="imei"]',
      'input[aria-label*="IMEI"]'
    ];
    
    const imeiSelector = await browserAutomation.waitForSelectorWithFallbacks(page, imeiSelectors);
    if (!imeiSelector) {
      throw new Error('No se pudo encontrar el campo IMEI');
    }
    
    await page.fill(imeiSelector, request.imei);
    logger.debug(`IMEI filled: ${request.imei.substring(0, 6)}...`);
    
    // Handle Make/Model dropdown - select first available option
    await this.selectMakeModel(page);
    
    // Fill phone number if provided
    if (request.phoneNumber) {
      const phoneSelectors = [
        'input[name*="phone"]',
        'input[name*="number"]',
        'input[placeholder*="phone"]',
        'input[type="tel"]'
      ];
      
      const phoneSelector = await browserAutomation.waitForSelectorWithFallbacks(page, phoneSelectors);
      if (phoneSelector) {
        await page.fill(phoneSelector, request.phoneNumber);
        logger.debug(`Phone number filled: ${request.phoneNumber.substring(0, 3)}...`);
      }
    }
    
    await browserAutomation.takeScreenshot(page, 'step2-device-info');
  }

  private async selectMakeModel(page: Page): Promise<void> {
    const makeModelSelectors = [
      'select[name*="make"]',
      'select[name*="model"]',
      'select[name*="device"]',
      '[role="combobox"]',
      '.select-wrapper select'
    ];
    
    const selector = await browserAutomation.waitForSelectorWithFallbacks(page, makeModelSelectors);
    if (!selector) {
      logger.warn('Make/Model selector not found, continuing...');
      return;
    }
    
    try {
      // Get all options and select the first non-empty one
      const options = await page.$$eval(`${selector} option`, options => 
        options.map(option => ({ value: (option as HTMLOptionElement).value, text: option.textContent }))
      );
      
      const validOption = options.find(opt => opt.value && opt.value !== '' && opt.text && !opt.text.includes('Select'));
      
      if (validOption) {
        await page.selectOption(selector, validOption.value);
        logger.info(`Selected make/model: ${validOption.text}`);
      } else {
        logger.warn('No valid make/model options found');
      }
    } catch (error: any) {
      logger.warn(`Error selecting make/model: ${error.message}`);
    }
  }

  private async fillPersonalInfo(page: Page, request: InsertUnlockRequest): Promise<void> {
    logger.info('Filling personal information');
    
    // First Name
    const firstNameSelectors = [
      'input[name*="first"]',
      'input[placeholder*="First"]',
      'input[placeholder*="Nombre"]'
    ];
    
    const firstNameSelector = await browserAutomation.waitForSelectorWithFallbacks(page, firstNameSelectors);
    if (firstNameSelector) {
      await page.fill(firstNameSelector, request.firstName);
    }
    
    // Last Name
    const lastNameSelectors = [
      'input[name*="last"]',
      'input[placeholder*="Last"]',
      'input[placeholder*="Apellido"]'
    ];
    
    const lastNameSelector = await browserAutomation.waitForSelectorWithFallbacks(page, lastNameSelectors);
    if (lastNameSelector) {
      await page.fill(lastNameSelector, request.lastName);
    }
    
    // Email
    const emailSelectors = [
      'input[type="email"]',
      'input[name*="email"]',
      'input[placeholder*="email"]'
    ];
    
    const emailSelector = await browserAutomation.waitForSelectorWithFallbacks(page, emailSelectors);
    if (emailSelector) {
      await page.fill(emailSelector, request.email);
    }
    
    // Confirm Email (if present)
    const confirmEmailSelectors = [
      'input[name*="confirm"]',
      'input[placeholder*="confirm"]',
      'input[placeholder*="verificar"]'
    ];
    
    const confirmEmailSelector = await browserAutomation.waitForSelectorWithFallbacks(page, confirmEmailSelectors);
    if (confirmEmailSelector) {
      await page.fill(confirmEmailSelector, request.email);
    }
    
    await browserAutomation.takeScreenshot(page, 'step3-personal-info');
  }

  private async acceptTermsAndSubmit(page: Page): Promise<void> {
    logger.info('Accepting terms and submitting');
    
    // Look for terms checkbox
    const termsSelectors = [
      'input[type="checkbox"]',
      'input[name*="terms"]',
      'input[name*="agree"]',
      'input[name*="accept"]'
    ];
    
    const termsSelector = await browserAutomation.waitForSelectorWithFallbacks(page, termsSelectors);
    if (termsSelector) {
      await page.check(termsSelector);
      logger.debug('Terms accepted');
    }
    
    // Submit form
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Submit")',
      'button:has-text("Enviar")',
      'button:has-text("Continue")',
      'button:has-text("Continuar")'
    ];
    
    const submitSelector = await browserAutomation.waitForSelectorWithFallbacks(page, submitSelectors);
    if (!submitSelector) {
      throw new Error('No se pudo encontrar el botón de envío');
    }
    
    await page.click(submitSelector);
    await page.waitForLoadState('networkidle');
    
    await browserAutomation.takeScreenshot(page, 'step4-submitted');
  }

  private async extractConfirmationDetails(page: Page): Promise<SubmissionResult> {
    logger.info('Extracting confirmation details');
    
    // Look for Request ID
    const pageText = await page.textContent('body');
    const requestIdMatch = pageText?.match(/([A-Z]{3}\d{12})/);
    
    // Look for confirmation text
    const confirmationIndicators = [
      'Thanks',
      'Confirmation',
      'Request submitted',
      'Solicitud enviada',
      'Gracias',
      'Confirmación'
    ];
    
    const hasConfirmation = confirmationIndicators.some(indicator => 
      pageText?.toLowerCase().includes(indicator.toLowerCase())
    );
    
    if (!hasConfirmation) {
      // Check if we're still on a form page or error page
      const formElements = await page.$$('form, input[type="submit"], button[type="submit"]');
      if (formElements.length > 0) {
        throw new Error('La solicitud no se completó correctamente. Es posible que falten campos requeridos.');
      }
    }
    
    const requestId = requestIdMatch?.[1];
    const deadlineISO = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    await browserAutomation.takeScreenshot(page, 'step5-confirmation');
    
    return {
      success: true,
      requestId,
      deadlineISO,
      captchaDetected: false
    };
  }
}

export const attFlow = new ATTFlow();
