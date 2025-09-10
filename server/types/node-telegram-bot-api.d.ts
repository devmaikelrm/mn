declare module 'node-telegram-bot-api' {
 // Minimal class + namespace declarations so the codebase can use:
 // import TelegramBot from 'node-telegram-bot-api';
 // and also reference TelegramBot.Message (namespace merge)
 //
 // This file intentionally keeps types minimal and project-specific.

 // Class (will be exported with `export =` below)
 class TelegramBot {
   constructor(token: string, options?: any);
   startPolling(): Promise<void>;
   stopPolling(): Promise<void>;
   onText(regex: RegExp, callback: (msg: TelegramBot.Message, match?: RegExpExecArray) => void): void;
   on(event: string, callback: (payload: any) => void): void;
   sendMessage(chatId: number | string, text: string, opts?: TelegramBot.SendMessageOptions): Promise<any>;
   answerCallbackQuery(callbackQueryId: string, opts?: any): Promise<any>;
 }

 // Namespace merged with the class to expose types as TelegramBot.Message, etc.
 namespace TelegramBot {
   export interface Message {
     chat: { id: number | string };
     from?: {
       id?: number;
       is_bot?: boolean;
       first_name?: string;
       last_name?: string;
       username?: string;
       language_code?: string;
     };
     text?: string;
   }

   export interface CallbackQuery {
     id: string;
     from?: any;
     message: Message;
     data?: string;
   }

   export interface SendMessageOptions {
     parse_mode?: string;
     reply_markup?: any;
   }
 }

 export = TelegramBot;
}