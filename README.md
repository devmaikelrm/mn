# AT&T Device Unlock Bot

## Adaptation: Force AT&T short-flow entry (/unlockstep1)

The application now forces the AT&T unlock flow to always start at:
https://www.att.com/deviceunlock/unlockstep1

Changes applied:
- Created client-side constants: [`client/src/config/att.ts`](client/src/config/att.ts:1) exporting ATT_UNLOCK_URL and ATT_STATUS_URL.
- Server uses the centralized config value: [`server/config/index.ts`](server/config/index.ts:20).
- Telegram bot links updated to point to the forced entry: [`server/services/telegram-bot.ts`](server/services/telegram-bot.ts:140).
- Automation now enforces navigation to the short flow and retries/forces client-side navigation if the portal redirects: [`server/services/att-flow.ts`](server/services/att-flow.ts:26).

If you run into TypeScript errors for missing types (playwright, node-telegram-bot-api), install the dev dependencies:
- npm i -D @types/node
- npm i playwright
- npm i node-telegram-bot-api

Bot automatizado de Telegram para gestionar solicitudes de desbloqueo de dispositivos AT&T con navegador headless y reenvío de correos.

## 🚀 Características

- **Bot de Telegram**: Interfaz completa para envío y consulta de solicitudes
- **Automatización Web**: Navegador headless para interactuar con el portal AT&T
- **Reenvío de Correos**: Integración con Google Apps Script para notificaciones
- **Panel Web**: Dashboard para monitoreo y gestión
- **Detección de CAPTCHA**: Manejo inteligente sin intentos de bypass
- **Validación Robusta**: Verificación de IMEI, números y emails
- **Logging Detallado**: Sistema completo de logs para depuración

## 📋 Requisitos

- Node.js 18+ 
- Replit (recomendado) o servidor compatible
- Bot de Telegram (token de @BotFather)
- Cuenta de Google (para Apps Script)

## ⚙️ Configuración

### 1. Variables de Entorno

Configura las siguientes variables en Replit Secrets o archivo `.env`:

```bash
# Bot Configuration (REQUERIDO)
BOT_TOKEN=tu_bot_token_de_telegram
OWNER_ID=tu_chat_id_numerico

# Optional Settings
BROWSER_HEADLESS=true
BROWSER_TIMEOUT=30000
TZ=America/Mexico_City
DEBUG_ENABLED=false
