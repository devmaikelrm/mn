import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { telegramBot } from "./services/telegram-bot";
import { statusChecker } from "./services/status-checker";
import { attFlow } from "./services/att-flow";
import { createLogger } from "./services/logger";
import { 
  insertUnlockRequestSchema, 
  statusCheckSchema,
  configUpdateSchema,
  type UnlockRequest,
  type SystemLog 
} from "@shared/schema";

const logger = createLogger('api');

export async function registerRoutes(app: Express): Promise<Server> {
  // Start Telegram bot
  try {
    await telegramBot.start();
    logger.info('Telegram bot service started');
  } catch (error: any) {
    logger.error(`Failed to start Telegram bot: ${error.message}`);
  }

  // Dashboard API - Get statistics
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getRequestStats();
      const recentRequests = await storage.getAllUnlockRequests();
      const recentLogs = await storage.getLogs(10);
      
      res.json({
        stats,
        recentRequests: recentRequests.slice(0, 5),
        recentActivity: recentLogs.slice(0, 10)
      });
    } catch (error: any) {
      logger.error(`Dashboard stats error: ${error.message}`);
      res.status(500).json({ message: error.message });
    }
  });

  // Get all unlock requests
  app.get("/api/requests", async (req, res) => {
    try {
      const requests = await storage.getAllUnlockRequests();
      res.json(requests);
    } catch (error: any) {
      logger.error(`Get requests error: ${error.message}`);
      res.status(500).json({ message: error.message });
    }
  });

  // Create new unlock request
  app.post("/api/requests", async (req, res) => {
    try {
      const validated = insertUnlockRequestSchema.parse(req.body);
      
      logger.info('Creating new unlock request via API', undefined, validated);
      
      // Submit to AT&T
      const result = await attFlow.submitUnlockRequest(validated);
      
      // Store in database
      const request = await storage.createUnlockRequest({
        ...validated,
        requestId: result.requestId || null,
        status: result.success ? 'pending' : 'unknown',
        captchaDetected: result.captchaDetected,
        errorMessage: result.errorMessage || null,
      });

      res.json({ 
        request,
        submissionResult: result
      });
    } catch (error) {
      if (error.issues) {
        res.status(400).json({ message: "Validation error", issues: error.issues });
      } else {
        logger.error(`Create request error: ${(error as any).message}`);
        res.status(500).json({ message: (error as any).message });
      }
    }
  });

  // Check status of a request
  app.post("/api/requests/:id/check-status", async (req, res) => {
    try {
      const request = await storage.getUnlockRequest(req.params.id);
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }

      if (!request.requestId) {
        return res.status(400).json({ message: "No Request ID available for status check" });
      }

      const result = await statusChecker.checkStatus(request.imei, request.requestId);
      
      // Update stored request
      const updated = await storage.updateUnlockRequest(request.id, {
        status: result.status,
        statusDetails: result.details || null,
        lastCheckedAt: new Date(),
      });

      res.json({ 
        statusResult: result,
        request: updated
      });
    } catch (error: any) {
      logger.error(`Status check error: ${error.message}`);
      res.status(500).json({ message: error.message });
    }
  });

  // Manual status check endpoint
  app.post("/api/status-check", async (req, res) => {
    try {
      const validated = statusCheckSchema.parse(req.body);
      const result = await statusChecker.checkStatus(validated.imei, validated.requestId);
      res.json(result);
    } catch (error) {
      if (error.issues) {
        res.status(400).json({ message: "Validation error", issues: error.issues });
      } else {
        logger.error(`Manual status check error: ${(error as any).message}`);
        res.status(500).json({ message: (error as any).message });
      }
    }
  });

  // Get system logs
  app.get("/api/logs", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const level = req.query.level as string;
      
      const logs = await storage.getLogs(limit, level);
      res.json(logs);
    } catch (error: any) {
      logger.error(`Get logs error: ${error.message}`);
      res.status(500).json({ message: error.message });
    }
  });

  // Clear logs
  app.delete("/api/logs", async (req, res) => {
    try {
      await storage.clearLogs();
      logger.info('System logs cleared via API');
      res.json({ message: "Logs cleared successfully" });
    } catch (error: any) {
      logger.error(`Clear logs error: ${error.message}`);
      res.status(500).json({ message: error.message });
    }
  });

  // Get bot configuration
  app.get("/api/config", async (req, res) => {
    try {
      const configs = await storage.getAllConfig();
      // Filter out sensitive values
      const filtered = configs.map(config => ({
        ...config,
        value: config.key.toLowerCase().includes('token') ? '***hidden***' : config.value
      }));
      res.json(filtered);
    } catch (error: any) {
      logger.error(`Get config error: ${error.message}`);
      res.status(500).json({ message: error.message });
    }
  });

  // Update bot configuration
  app.post("/api/config", async (req, res) => {
    try {
      const validated = configUpdateSchema.parse(req.body);
      const config = await storage.setConfig(validated.key, validated.value);
      
      logger.info(`Configuration updated: ${validated.key}`, undefined, { key: validated.key });
      
      res.json(config);
    } catch (error) {
      if (error.issues) {
        res.status(400).json({ message: "Validation error", issues: error.issues });
      } else {
        logger.error(`Update config error: ${(error as any).message}`);
        res.status(500).json({ message: (error as any).message });
      }
    }
  });

  // Health check endpoint
  app.get("/api/health", async (req, res) => {
    try {
      const stats = await storage.getRequestStats();
      
      res.json({
        status: "operational",
        timestamp: new Date().toISOString(),
        services: {
          telegramBot: "active",
          browserAutomation: "available", 
          attPortal: "operational",
          appsScript: "pending_configuration"
        },
        stats
      });
    } catch (error) {
      res.status(500).json({
        status: "error",
        timestamp: new Date().toISOString(),
        error: (error as any).message
      });
    }
  });

  // Update last activity timestamp
  app.post("/api/activity", async (req, res) => {
    try {
      await storage.setConfig('last_update', new Date().toISOString());
      res.json({ message: "Activity updated" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
