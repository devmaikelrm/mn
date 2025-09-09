import { Page } from 'playwright';
import { browserAutomation } from './browser-automation';
import { createLogger } from './logger';
import { config } from '../config';
import { RequestStatus } from '@shared/schema';

const logger = createLogger('status-checker');

export interface StatusResult {
  success: boolean;
  status: string;
  details?: string;
  errorMessage?: string;
}

export class StatusChecker {
  async checkStatus(imei: string, requestId: string): Promise<StatusResult> {
    let page: Page | null = null;
    
    try {
      logger.info(`Checking status for IMEI ${imei.substring(0, 6)}... and Request ID ${requestId}`);
      
      page = await browserAutomation.createPage();
      
      // Navigate to status page
      await page.goto(config.ATT_STATUS_URL);
      await browserAutomation.takeScreenshot(page, 'status-page-loaded');
      
      // Fill IMEI field
      const imeiSelectors = [
        'input[name*="imei"]',
        'input[placeholder*="IMEI"]',
        'input[id*="imei"]'
      ];
      
      const imeiSelector = await browserAutomation.waitForSelectorWithFallbacks(page, imeiSelectors);
      if (!imeiSelector) {
        throw new Error('No se pudo encontrar el campo IMEI en la página de estado');
      }
      
      await page.fill(imeiSelector, imei);
      
      // Fill Request ID field
      const requestIdSelectors = [
        'input[name*="request"]',
        'input[name*="case"]',
        'input[placeholder*="Request"]',
        'input[placeholder*="Case"]',
        'input[id*="request"]',
        'input[id*="case"]'
      ];
      
      const requestIdSelector = await browserAutomation.waitForSelectorWithFallbacks(page, requestIdSelectors);
      if (!requestIdSelector) {
        throw new Error('No se pudo encontrar el campo Request ID');
      }
      
      await page.fill(requestIdSelector, requestId);
      
      // Submit the form
      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Check Status")',
        'button:has-text("Submit")',
        'button:has-text("Verificar")',
        'button:has-text("Enviar")'
      ];
      
      const submitSelector = await browserAutomation.waitForSelectorWithFallbacks(page, submitSelectors);
      if (!submitSelector) {
        throw new Error('No se pudo encontrar el botón de envío');
      }
      
      await page.click(submitSelector);
      await page.waitForLoadState('networkidle');
      
      await browserAutomation.takeScreenshot(page, 'status-result');
      
      // Extract status information
      const result = await this.extractStatusInfo(page);
      
      logger.info(`Status check completed: ${result.status}`, undefined, result);
      return result;
      
    } catch (error: any) {
      logger.error(`Status check error: ${error.message}`, undefined, { error: error.stack });
      return {
        success: false,
        status: RequestStatus.UNKNOWN,
        errorMessage: error.message
      };
    } finally {
      if (page) {
        await browserAutomation.closePage(page);
      }
    }
  }

  private async extractStatusInfo(page: Page): Promise<StatusResult> {
    const pageText = await page.textContent('body');
    
    if (!pageText) {
      throw new Error('No se pudo obtener el contenido de la página de estado');
    }
    
    const text = pageText.toLowerCase();
    
    // Define status patterns
    const statusPatterns = {
      [RequestStatus.APPROVED]: [
        'approved',
        'aprobada',
        'completed',
        'completada',
        'unlocked',
        'desbloqueado',
        'success',
        'exitoso'
      ],
      [RequestStatus.DENIED]: [
        'denied',
        'denegada',
        'rejected',
        'rechazada',
        'declined',
        'declinada',
        'not eligible',
        'no elegible'
      ],
      [RequestStatus.PENDING]: [
        'pending',
        'pendiente',
        'in progress',
        'en progreso',
        'processing',
        'procesando',
        'under review',
        'en revisión'
      ]
    };
    
    // Check for each status
    for (const [status, patterns] of Object.entries(statusPatterns)) {
      if (patterns.some(pattern => text.includes(pattern))) {
        return {
          success: true,
          status,
          details: this.extractStatusDetails(pageText, status)
        };
      }
    }
    
    // If no clear status found, look for error messages
    const errorPatterns = [
      'error',
      'not found',
      'invalid',
      'incorrect',
      'wrong',
      'incorrecto',
      'inválido'
    ];
    
    if (errorPatterns.some(pattern => text.includes(pattern))) {
      throw new Error('Error en la consulta de estado. Verifique que el IMEI y Request ID sean correctos.');
    }
    
    // Default to unknown status
    return {
      success: true,
      status: RequestStatus.UNKNOWN,
      details: 'No se pudo determinar el estado actual. Reintente más tarde.'
    };
  }

  private extractStatusDetails(pageText: string, status: string): string {
    // Extract relevant portion of text around the status
    const lines = pageText.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    // Find lines that contain status-related information
    const relevantLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      
      // Look for lines with status information
      if (line.includes('status') || 
          line.includes('estado') ||
          line.includes('request') ||
          line.includes('solicitud') ||
          line.includes(status.toLowerCase())) {
        
        // Include surrounding context
        const start = Math.max(0, i - 1);
        const end = Math.min(lines.length, i + 3);
        
        for (let j = start; j < end; j++) {
          if (lines[j] && !relevantLines.includes(lines[j])) {
            relevantLines.push(lines[j]);
          }
        }
      }
    }
    
    // Return a concise summary
    return relevantLines
      .slice(0, 5) // Limit to first 5 relevant lines
      .join(' ')
      .substring(0, 500) // Limit length
      .trim();
  }
}

export const statusChecker = new StatusChecker();
