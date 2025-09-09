import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  // Bot Configuration
  BOT_TOKEN: process.env.BOT_TOKEN || '',
  OWNER_ID: process.env.OWNER_ID || '',
  
  // Server Configuration
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Browser Configuration
  BROWSER_HEADLESS: process.env.BROWSER_HEADLESS !== 'false',
  BROWSER_TIMEOUT: parseInt(process.env.BROWSER_TIMEOUT || '30000', 10),
  
  // AT&T URLs
  ATT_UNLOCK_URL: 'https://www.att.com/deviceunlock/unlockstep1',
  ATT_STATUS_URL: 'https://www.att.com/deviceunlock/status',
  
  // Application Settings
  TIMEZONE: process.env.TZ || 'America/Mexico_City',
  DEBUG_ENABLED: process.env.DEBUG_ENABLED === 'true',
  
  // Validation
  validate() {
    const required = ['BOT_TOKEN', 'OWNER_ID'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }
};

// Validate configuration on startup
if (process.env.NODE_ENV !== 'test') {
  config.validate();
}
