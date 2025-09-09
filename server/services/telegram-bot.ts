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

    // Handle callback queries (button presses)
    this.bot.on('callback_query', (query: any) => {
      this.handleCallbackQuery(query);
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

¡Bienvenido! Utiliza los botones de abajo para una experiencia más fácil, o escribe los comandos directamente.

*Comandos disponibles:*

📱 */solicitar* - Nueva solicitud de desbloqueo
📊 */status* - Consultar estado de solicitud
❓ */help* - Mostrar esta ayuda

*Formatos de comandos:*
• \`/solicitar IMEI, Nombre Apellido, correo@email.com\`
• \`/solicitar NUMERO_ATT, IMEI, Nombre Apellido, correo@email.com\`
• \`/status IMEI, REQUEST_ID\`

⚠️ *Información importante:*
• Proceso puede tomar hasta 24 horas
• Si aparece CAPTCHA, se requerirá intervención manual
• Los datos no se almacenan permanentemente

*Disclaimer:* Este bot automatiza el portal oficial de AT&T. La decisión final es únicamente de AT&T.
    `;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '📱 Nueva Solicitud', callback_data: 'help_solicitar' },
          { text: '📊 Consultar Estado', callback_data: 'help_status' }
        ],
        [
          { text: '📋 Ver Ejemplos', callback_data: 'show_examples' },
          { text: '❓ Ayuda Completa', callback_data: 'show_help' }
        ],
        [
          { text: '🌐 Portal AT&T', url: 'https://www.att.com/deviceunlock' }
        ]
      ]
    };

    await this.bot.sendMessage(chatId, helpText, { 
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
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
        
        const successKeyboard = {
          inline_keyboard: [
            [
              { text: '📊 Consultar Estado', callback_data: `check_status_${result.requestId}` },
              { text: '📱 Nueva Solicitud', callback_data: 'help_solicitar' }
            ],
            [
              { text: '🔄 Volver al Menú', callback_data: 'show_help' }
            ]
          ]
        };
        
        await this.bot.sendMessage(chatId, responseText, { 
          parse_mode: 'Markdown',
          reply_markup: successKeyboard
        });
      } else if (result.captchaDetected) {
        const captchaKeyboard = {
          inline_keyboard: [
            [
              { text: '🔄 Intentar de Nuevo', callback_data: 'help_solicitar' },
              { text: '🌐 Portal AT&T', url: 'https://www.att.com/deviceunlock' }
            ],
            [
              { text: '🏠 Volver al Menú', callback_data: 'show_help' }
            ]
          ]
        };
        
        await this.bot.sendMessage(chatId, 
          '🔐 *CAPTCHA Detectado*\n\n' +
          'Se detectó un CAPTCHA en el portal de AT&T. Es necesaria la intervención manual.\n\n' +
          'Puedes intentar nuevamente más tarde o visitar directamente el portal de AT&T.',
          { 
            parse_mode: 'Markdown',
            reply_markup: captchaKeyboard
          }
        );
      } else {
        const errorKeyboard = {
          inline_keyboard: [
            [
              { text: '🔄 Intentar de Nuevo', callback_data: 'help_solicitar' },
              { text: '📋 Ver Ejemplos', callback_data: 'show_examples' }
            ],
            [
              { text: '🏠 Volver al Menú', callback_data: 'show_help' }
            ]
          ]
        };
        
        await this.bot.sendMessage(chatId, 
          `❌ *Error en la solicitud*\n\n${result.errorMessage || 'Error desconocido'}`,
          { 
            parse_mode: 'Markdown',
            reply_markup: errorKeyboard
          }
        );
      }

    } catch (error: any) {
      if (error.issues) {
        // Validation error
        const errorMessages = error.issues.map((issue: any) => `• ${issue.message}`).join('\n');
        const validationKeyboard = {
          inline_keyboard: [
            [
              { text: '📋 Ver Ejemplos', callback_data: 'show_examples' },
              { text: '❓ Ayuda', callback_data: 'help_solicitar' }
            ],
            [
              { text: '🏠 Volver al Menú', callback_data: 'show_help' }
            ]
          ]
        };
        
        await this.bot.sendMessage(chatId, 
          `❌ *Error de validación:*\n\n${errorMessages}\n\n` +
          'Use el formato correcto:\n' +
          '`/solicitar IMEI, Nombre Apellido, correo@email.com`\n' +
          'o\n' +
          '`/solicitar NUMERO_ATT, IMEI, Nombre Apellido, correo@email.com`',
          { 
            parse_mode: 'Markdown',
            reply_markup: validationKeyboard
          }
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

        const statusKeyboard = {
          inline_keyboard: [
            [
              { text: '🔄 Actualizar Estado', callback_data: `refresh_status_${validated.imei}_${validated.requestId}` },
              { text: '📱 Nueva Solicitud', callback_data: 'help_solicitar' }
            ],
            [
              { text: '🏠 Volver al Menú', callback_data: 'show_help' }
            ]
          ]
        };

        await this.bot.sendMessage(chatId, responseText, { 
          parse_mode: 'Markdown',
          reply_markup: statusKeyboard
        });
      } else {
        const statusErrorKeyboard = {
          inline_keyboard: [
            [
              { text: '🔄 Intentar de Nuevo', callback_data: 'help_status' },
              { text: '📋 Ver Ejemplos', callback_data: 'show_examples' }
            ],
            [
              { text: '🏠 Volver al Menú', callback_data: 'show_help' }
            ]
          ]
        };
        
        await this.bot.sendMessage(chatId, 
          `❌ *Error al consultar estado*\n\n${result.errorMessage || 'Error desconocido'}`,
          { 
            parse_mode: 'Markdown',
            reply_markup: statusErrorKeyboard
          }
        );
      }

    } catch (error: any) {
      if (error.issues) {
        const errorMessages = error.issues.map((issue: any) => `• ${issue.message}`).join('\n');
        const statusValidationKeyboard = {
          inline_keyboard: [
            [
              { text: '📋 Ver Ejemplos', callback_data: 'show_examples' },
              { text: '❓ Ayuda', callback_data: 'help_status' }
            ],
            [
              { text: '🏠 Volver al Menú', callback_data: 'show_help' }
            ]
          ]
        };
        
        await this.bot.sendMessage(chatId, 
          `❌ *Error de validación:*\n\n${errorMessages}\n\n` +
          'Use el formato correcto:\n`/status IMEI, REQUEST_ID`',
          { 
            parse_mode: 'Markdown',
            reply_markup: statusValidationKeyboard
          }
        );
      } else {
        await this.bot.sendMessage(chatId, `❌ Error: ${error.message}`);
      }
    }
  }

  private async handleUnknown(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    
    const unknownKeyboard = {
      inline_keyboard: [
        [
          { text: '📱 Nueva Solicitud', callback_data: 'help_solicitar' },
          { text: '📊 Consultar Estado', callback_data: 'help_status' }
        ],
        [
          { text: '❓ Ver Ayuda', callback_data: 'show_help' }
        ]
      ]
    };
    
    await this.bot.sendMessage(chatId, 
      '❓ Comando no reconocido. Usa los botones de abajo o /start para ver los comandos disponibles.',
      { reply_markup: unknownKeyboard }
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

  private async handleCallbackQuery(query: any): Promise<void> {
    const chatId = query.message.chat.id;
    const data = query.data;

    // Answer the callback query to stop loading indicator
    await this.bot.answerCallbackQuery(query.id);

    try {
      switch (data) {
        case 'help_solicitar':
          await this.showSolicitarHelp(chatId);
          break;
        case 'help_status':
          await this.showStatusHelp(chatId);
          break;
        case 'show_examples':
          await this.showExamples(chatId);
          break;
        case 'show_help':
          // Create a fake message object for handleStart
          const fakeMsg = { chat: { id: chatId } } as TelegramBot.Message;
          await this.handleStart(fakeMsg);
          break;
        default:
          if (data.startsWith('check_status_') || data.startsWith('refresh_status_')) {
            await this.handleQuickStatus(chatId, data);
          }
          break;
      }
    } catch (error: any) {
      logger.error(`Callback query error: ${error.message}`);
      await this.bot.sendMessage(chatId, '❌ Error procesando la acción. Intenta nuevamente.');
    }
  }

  private async showSolicitarHelp(chatId: number): Promise<void> {
    const helpText = `
📱 *Cómo enviar una solicitud*

Usa el comando */solicitar* seguido de los datos separados por comas:

*Formato 1:* IMEI, Nombre Apellido, correo@email.com
*Formato 2:* NUMERO_ATT, IMEI, Nombre Apellido, correo@email.com

*Importante:*
• IMEI debe tener 15 dígitos
• Número AT&T debe tener 10 dígitos (si lo proporcionas)
• Email debe ser válido
• Separar cada campo con coma y espacio

¿Necesitas más ayuda?`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '📋 Ver Ejemplos', callback_data: 'show_examples' },
          { text: '📊 Consultar Estado', callback_data: 'help_status' }
        ],
        [
          { text: '🏠 Volver al Menú', callback_data: 'show_help' }
        ]
      ]
    };

    await this.bot.sendMessage(chatId, helpText, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  private async showStatusHelp(chatId: number): Promise<void> {
    const helpText = `
📊 *Cómo consultar el estado*

Usa el comando */status* seguido de los datos separados por comas:

*Formato:* IMEI, REQUEST_ID

*Importante:*
• IMEI debe tener 15 dígitos
• REQUEST_ID es el código que recibiste al crear la solicitud
• Separar con coma y espacio

El bot consultará automáticamente el portal de AT&T para obtener el estado actual.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '📋 Ver Ejemplos', callback_data: 'show_examples' },
          { text: '📱 Nueva Solicitud', callback_data: 'help_solicitar' }
        ],
        [
          { text: '🏠 Volver al Menú', callback_data: 'show_help' }
        ]
      ]
    };

    await this.bot.sendMessage(chatId, helpText, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  private async showExamples(chatId: number): Promise<void> {
    const helpText = `
📋 *Ejemplos de uso*

*Para enviar solicitud (sin número AT&T):*
\`/solicitar 353012345678901, Juan Pérez, juan@email.com\`

*Para enviar solicitud (con número AT&T):*
\`/solicitar 1234567890, 353012345678901, María García, maria@email.com\`

*Para consultar estado:*
\`/status 353012345678901, NUL117557332822\`

*Notas importantes:*
• Respeta las comas y espacios exactamente como se muestra
• El IMEI siempre tiene 15 dígitos
• El número AT&T tiene 10 dígitos (opcional)
• El REQUEST_ID lo recibes al crear la solicitud`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '📱 Nueva Solicitud', callback_data: 'help_solicitar' },
          { text: '📊 Consultar Estado', callback_data: 'help_status' }
        ],
        [
          { text: '🏠 Volver al Menú', callback_data: 'show_help' }
        ]
      ]
    };

    await this.bot.sendMessage(chatId, helpText, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  private async handleQuickStatus(chatId: number, data: string): Promise<void> {
    const keyboard = {
      inline_keyboard: [
        [
          { text: '📋 Ver Ejemplos', callback_data: 'show_examples' },
          { text: '❓ Ayuda Status', callback_data: 'help_status' }
        ],
        [
          { text: '🏠 Volver al Menú', callback_data: 'show_help' }
        ]
      ]
    };

    await this.bot.sendMessage(chatId, 
      '📊 *Consulta rápida de estado*\n\n' +
      'Para consultar el estado, usa:\n' +
      '`/status IMEI, REQUEST_ID`\n\n' +
      'Ejemplo:\n' +
      '`/status 353012345678901, NUL117557332822`', 
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }
    );
  }
}

export const telegramBot = new TelegramBotService();
