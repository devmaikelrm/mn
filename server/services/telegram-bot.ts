import TelegramBot from 'node-telegram-bot-api';
import { config } from '../config';
import { createLogger } from './logger';
import { storage } from '../storage';
import { attFlow } from './att-flow';
import { statusChecker } from './status-checker';
import { insertUnlockRequestSchema, statusCheckSchema, RequestStatus } from '@shared/schema';

const logger = createLogger('telegram-bot');

export class TelegramBotService {
  private bot: TelegramBot;
  private isRunning = false;

  constructor() {
    this.bot = new TelegramBot(config.BOT_TOKEN, { polling: false });
    this.setupCommands();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Bot is already running');
      return;
    }

    try {
      await this.bot.startPolling();
      this.isRunning = true;
      logger.info('Telegram bot started successfully');
    } catch (error: any) {
      logger.error(`Failed to start bot: ${error.message}`);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      await this.bot.stopPolling();
      this.isRunning = false;
      logger.info('Telegram bot stopped');
    } catch (error: any) {
      logger.error(`Error stopping bot: ${error.message}`);
    }
  }

  private setupCommands(): void {
    // Start command
    this.bot.onText(/\/start/, (msg: any) => {
      this.handleCommand(msg, () => this.handleStart(msg));
    });

    // Submit request command
    this.bot.onText(/\/solicitar (.+)/, (msg: any, match: any) => {
      this.handleCommand(msg, () => this.handleSolicitar(msg, match?.[1] || ''));
    });

    // Status check command
    this.bot.onText(/\/status (.+)/, (msg: any, match: any) => {
      this.handleCommand(msg, () => this.handleStatus(msg, match?.[1] || ''));
    });

    // Help command
    this.bot.onText(/\/help/, (msg: any) => {
      this.handleCommand(msg, () => this.handleStart(msg));
    });

    // Handle any other message
    this.bot.on('message', (msg: any) => {
      if (!msg.text?.startsWith('/')) {
        this.handleCommand(msg, () => this.handleUnknown(msg));
      }
    });
  }

  private async handleCommand(msg: TelegramBot.Message, handler: () => Promise<void>): Promise<void> {
    const chatId = msg.chat.id.toString();
    const username = msg.from?.username || 'unknown';

    // Check if user is authorized
    if (chatId !== config.OWNER_ID) {
      logger.warn(`Unauthorized access attempt from ${username} (${chatId})`);
      await this.bot.sendMessage(chatId, '🔒 Este bot es privado. Solo el propietario autorizado puede usarlo.');
      return;
    }

    try {
      await handler();
    } catch (error: any) {
      logger.error(`Command handler error: ${error.message}`, undefined, { chatId, error: error.stack });
      await this.bot.sendMessage(chatId, '❌ Error interno del bot. Revisa los logs para más detalles.');
    }
  }

  private async handleStart(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const helpText = `
🤖 *AT&T Device Unlock Bot*

*Comandos disponibles:*

/solicitar - Enviar nueva solicitud de desbloqueo
Formatos válidos:
• \`IMEI, Nombre Apellido, correo@email.com\`
• \`NUMERO_ATT, IMEI, Nombre Apellido, correo@email.com\`

/status - Consultar estado de solicitud
Formato: \`IMEI, REQUEST_ID\`

*Ejemplos:*
\`/solicitar 353012345678901, Juan Pérez, juan@email.com\`
\`/solicitar 1234567890, 353012345678901, María García, maria@email.com\`
\`/status 353012345678901, NUL117557332822\`

*Información importante:*
• Solo el propietario autorizado puede usar este bot
• El proceso puede tomar hasta 24 horas
• Si aparece CAPTCHA, se requerirá intervención manual
• Los datos no se almacenan permanentemente

*Disclaimer:* Este bot automatiza la navegación del portal oficial de AT&T. La decisión final de desbloqueo es únicamente de AT&T. Use bajo su responsabilidad y cumpliendo los términos de servicio.
    `;

    await this.bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
  }

  private async handleSolicitar(msg: TelegramBot.Message, args: string): Promise<void> {
    const chatId = msg.chat.id;

    try {
      // Parse arguments
      const request = this.parseSubmissionArgs(args);

      // Validate request
      const validatedRequest = insertUnlockRequestSchema.parse(request);

      await this.bot.sendMessage(chatId, '🔄 Procesando solicitud de desbloqueo...');

      // Submit to AT&T
      const result = await attFlow.submitUnlockRequest(validatedRequest);

      // Store request in database
      const storedRequest = await storage.createUnlockRequest({
        ...validatedRequest,
        requestId: result.requestId || null,
        status: result.success ? RequestStatus.PENDING : RequestStatus.UNKNOWN,
        captchaDetected: result.captchaDetected,
        errorMessage: result.errorMessage || null,
      });

      // Send response
      if (result.success) {
        let responseText = '✅ *Solicitud enviada exitosamente*\n\n';
        
        if (result.requestId) {
          responseText += `📋 *Request ID:* \`${result.requestId}\`\n`;
        }
        
        responseText += `📱 *IMEI:* \`${validatedRequest.imei.substring(0, 6)}...${validatedRequest.imei.substring(-4)}\`\n`;
        responseText += `📧 *Email:* ${validatedRequest.email}\n`;
        responseText += `⏰ *Vencimiento aproximado:* ${new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleString('es-MX')}\n\n`;
        responseText += '📬 Revisa tu correo electrónico para recibir actualizaciones de AT&T.';
        
        await this.bot.sendMessage(chatId, responseText, { parse_mode: 'Markdown' });
      } else if (result.captchaDetected) {
        await this.bot.sendMessage(chatId, 
          '🔐 *CAPTCHA Detectado*\n\n' +
          'Se detectó un CAPTCHA en el portal de AT&T. Es necesaria la intervención manual.\n\n' +
          'Por favor, intenta nuevamente más tarde o visita directamente el portal de AT&T.',
          { parse_mode: 'Markdown' }
        );
      } else {
        await this.bot.sendMessage(chatId, 
          `❌ *Error en la solicitud*\n\n${result.errorMessage || 'Error desconocido'}`,
          { parse_mode: 'Markdown' }
        );
      }

    } catch (error: any) {
      if (error.issues) {
        // Validation error
        const errorMessages = error.issues.map((issue: any) => `• ${issue.message}`).join('\n');
        await this.bot.sendMessage(chatId, 
          `❌ *Error de validación:*\n\n${errorMessages}\n\n` +
          'Use el formato correcto:\n' +
          '`/solicitar IMEI, Nombre Apellido, correo@email.com`\n' +
          'o\n' +
          '`/solicitar NUMERO_ATT, IMEI, Nombre Apellido, correo@email.com`',
          { parse_mode: 'Markdown' }
        );
      } else {
        await this.bot.sendMessage(chatId, `❌ Error: ${error.message}`);
      }
    }
  }

  private async handleStatus(msg: TelegramBot.Message, args: string): Promise<void> {
    const chatId = msg.chat.id;

    try {
      // Parse arguments
      const { imei, requestId } = this.parseStatusArgs(args);

      // Validate
      const validated = statusCheckSchema.parse({ imei, requestId });

      await this.bot.sendMessage(chatId, '🔍 Consultando estado en el portal de AT&T...');

      // Check status
      const result = await statusChecker.checkStatus(validated.imei, validated.requestId);

      // Update stored request if found
      const storedRequest = await storage.getUnlockRequestByRequestId(validated.requestId);
      if (storedRequest) {
        await storage.updateUnlockRequest(storedRequest.id, {
          status: result.status,
          statusDetails: result.details || null,
          lastCheckedAt: new Date(),
        });
      }

      // Send response
      if (result.success) {
        const statusEmoji = {
          [RequestStatus.APPROVED]: '✅',
          [RequestStatus.PENDING]: '⏳',
          [RequestStatus.DENIED]: '❌',
          [RequestStatus.UNKNOWN]: '❓',
        }[result.status] || '❓';

        const statusText = {
          [RequestStatus.APPROVED]: 'Aprobada',
          [RequestStatus.PENDING]: 'Pendiente',
          [RequestStatus.DENIED]: 'Denegada',
          [RequestStatus.UNKNOWN]: 'Desconocido',
        }[result.status] || 'Desconocido';

        let responseText = `${statusEmoji} *Estado de la solicitud*\n\n`;
        responseText += `📱 *IMEI:* \`${validated.imei.substring(0, 6)}...${validated.imei.substring(-4)}\`\n`;
        responseText += `📋 *Request ID:* \`${validated.requestId}\`\n`;
        responseText += `📊 *Estado:* ${statusText}\n\n`;
        
        if (result.details) {
          responseText += `📝 *Detalles:*\n${result.details}`;
        }

        await this.bot.sendMessage(chatId, responseText, { parse_mode: 'Markdown' });
      } else {
        await this.bot.sendMessage(chatId, 
          `❌ *Error al consultar estado*\n\n${result.errorMessage || 'Error desconocido'}`,
          { parse_mode: 'Markdown' }
        );
      }

    } catch (error: any) {
      if (error.issues) {
        const errorMessages = error.issues.map((issue: any) => `• ${issue.message}`).join('\n');
        await this.bot.sendMessage(chatId, 
          `❌ *Error de validación:*\n\n${errorMessages}\n\n` +
          'Use el formato correcto:\n`/status IMEI, REQUEST_ID`',
          { parse_mode: 'Markdown' }
        );
      } else {
        await this.bot.sendMessage(chatId, `❌ Error: ${error.message}`);
      }
    }
  }

  private async handleUnknown(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    await this.bot.sendMessage(chatId, 
      '❓ Comando no reconocido. Use /start para ver los comandos disponibles.'
    );
  }

  private parseSubmissionArgs(args: string): any {
    const parts = args.split(',').map(part => part.trim());

    if (parts.length === 3) {
      // Format: IMEI, Name, Email
      return {
        imei: parts[0],
        firstName: parts[1].split(' ')[0],
        lastName: parts[1].split(' ').slice(1).join(' ') || parts[1].split(' ')[0],
        email: parts[2],
      };
    } else if (parts.length === 4) {
      // Format: Phone, IMEI, Name, Email
      return {
        phoneNumber: parts[0],
        imei: parts[1],
        firstName: parts[2].split(' ')[0],
        lastName: parts[2].split(' ').slice(1).join(' ') || parts[2].split(' ')[0],
        email: parts[3],
      };
    } else {
      throw new Error('Formato incorrecto. Use el formato especificado en /start');
    }
  }

  private parseStatusArgs(args: string): { imei: string; requestId: string } {
    const parts = args.split(',').map(part => part.trim());

    if (parts.length !== 2) {
      throw new Error('Formato incorrecto. Use: IMEI, REQUEST_ID');
    }

    return {
      imei: parts[0],
      requestId: parts[1],
    };
  }
}

export const telegramBot = new TelegramBotService();
