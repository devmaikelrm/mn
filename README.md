# AT&T Device Unlock Bot

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
