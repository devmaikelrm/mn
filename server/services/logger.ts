import { storage } from '../storage';
import { LogLevel, type InsertSystemLog } from '@shared/schema';

export class Logger {
  private source: string;

  constructor(source: string) {
    this.source = source;
  }

  async info(message: string, requestId?: string, metadata?: any) {
    await this.log(LogLevel.INFO, message, requestId, metadata);
    console.log(`[${new Date().toISOString()}] [INFO] [${this.source}] ${message}`);
  }

  async warn(message: string, requestId?: string, metadata?: any) {
    await this.log(LogLevel.WARN, message, requestId, metadata);
    console.warn(`[${new Date().toISOString()}] [WARN] [${this.source}] ${message}`);
  }

  async error(message: string, requestId?: string, metadata?: any) {
    await this.log(LogLevel.ERROR, message, requestId, metadata);
    console.error(`[${new Date().toISOString()}] [ERROR] [${this.source}] ${message}`);
  }

  async debug(message: string, requestId?: string, metadata?: any) {
    const debugConfig = await storage.getConfig('debug_enabled');
    const debugEnabled = debugConfig?.value === 'true';
    
    if (debugEnabled) {
      await this.log(LogLevel.DEBUG, message, requestId, metadata);
      console.debug(`[${new Date().toISOString()}] [DEBUG] [${this.source}] ${message}`);
    }
  }

  private async log(level: string, message: string, requestId?: string, metadata?: any) {
    try {
      const logEntry: InsertSystemLog = {
        level,
        message,
        source: this.source,
        requestId: requestId || null,
        metadata: metadata || null,
      };
      
      await storage.createLog(logEntry);
    } catch (error) {
      console.error('Failed to store log:', error);
    }
  }
}

export const createLogger = (source: string) => new Logger(source);
