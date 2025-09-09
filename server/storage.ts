import { 
  type UnlockRequest, 
  type InsertUnlockRequest,
  type SystemLog,
  type InsertSystemLog,
  type BotConfig,
  RequestStatus,
  LogLevel
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Unlock Requests
  createUnlockRequest(request: InsertUnlockRequest): Promise<UnlockRequest>;
  getUnlockRequest(id: string): Promise<UnlockRequest | undefined>;
  getUnlockRequestByRequestId(requestId: string): Promise<UnlockRequest | undefined>;
  getAllUnlockRequests(): Promise<UnlockRequest[]>;
  updateUnlockRequest(id: string, updates: Partial<UnlockRequest>): Promise<UnlockRequest | undefined>;
  
  // System Logs
  createLog(log: InsertSystemLog): Promise<SystemLog>;
  getLogs(limit?: number, level?: string): Promise<SystemLog[]>;
  clearLogs(): Promise<void>;
  
  // Bot Config
  getConfig(key: string): Promise<BotConfig | undefined>;
  setConfig(key: string, value: string): Promise<BotConfig>;
  getAllConfig(): Promise<BotConfig[]>;
  
  // Statistics
  getRequestStats(): Promise<{
    total: number;
    approved: number;
    pending: number;
    denied: number;
    unknown: number;
  }>;
}

export class MemStorage implements IStorage {
  private unlockRequests: Map<string, UnlockRequest>;
  private systemLogs: Map<string, SystemLog>;
  private botConfigs: Map<string, BotConfig>;

  constructor() {
    this.unlockRequests = new Map();
    this.systemLogs = new Map();
    this.botConfigs = new Map();
    this.initializeDefaultConfig();
  }

  private initializeDefaultConfig() {
    const defaultConfigs = [
      { key: "debug_enabled", value: "false" },
      { key: "timezone", value: "America/Mexico_City" },
      { key: "last_update", value: new Date().toISOString() }
    ];

    defaultConfigs.forEach(config => {
      const id = randomUUID();
      this.botConfigs.set(config.key, {
        id,
        key: config.key,
        value: config.value,
        updatedAt: new Date(),
      });
    });
  }

  // Unlock Requests
  async createUnlockRequest(insertRequest: InsertUnlockRequest): Promise<UnlockRequest> {
    const id = randomUUID();
    const now = new Date();
    const deadline = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours later
    
    const request: UnlockRequest = {
      ...insertRequest,
      id,
      requestId: insertRequest.requestId || null,
      status: insertRequest.status || 'pending',
      submittedAt: now,
      deadlineAt: deadline,
      lastCheckedAt: null,
      captchaDetected: false,
      errorMessage: null,
      statusDetails: null,
      metadata: null,
    };
    
    this.unlockRequests.set(id, request);
    return request;
  }

  async getUnlockRequest(id: string): Promise<UnlockRequest | undefined> {
    return this.unlockRequests.get(id);
  }

  async getUnlockRequestByRequestId(requestId: string): Promise<UnlockRequest | undefined> {
    return Array.from(this.unlockRequests.values()).find(
      request => request.requestId === requestId
    );
  }

  async getAllUnlockRequests(): Promise<UnlockRequest[]> {
    return Array.from(this.unlockRequests.values())
      .sort((a, b) => (b.submittedAt?.getTime() || 0) - (a.submittedAt?.getTime() || 0));
  }

  async updateUnlockRequest(id: string, updates: Partial<UnlockRequest>): Promise<UnlockRequest | undefined> {
    const existing = this.unlockRequests.get(id);
    if (!existing) return undefined;

    const updated = { ...existing, ...updates };
    this.unlockRequests.set(id, updated);
    return updated;
  }

  // System Logs
  async createLog(insertLog: InsertSystemLog): Promise<SystemLog> {
    const id = randomUUID();
    const log: SystemLog = {
      ...insertLog,
      id,
      timestamp: new Date(),
      requestId: insertLog.requestId || null,
      metadata: insertLog.metadata || null,
    };
    
    this.systemLogs.set(id, log);
    
    // Keep only last 1000 logs to prevent memory issues
    if (this.systemLogs.size > 1000) {
      const sorted = Array.from(this.systemLogs.entries())
        .sort(([,a], [,b]) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0))
        .slice(0, 1000);
      
      this.systemLogs.clear();
      sorted.forEach(([key, value]) => this.systemLogs.set(key, value));
    }
    
    return log;
  }

  async getLogs(limit = 100, level?: string): Promise<SystemLog[]> {
    let logs = Array.from(this.systemLogs.values());
    
    if (level) {
      logs = logs.filter(log => log.level === level);
    }
    
    return logs
      .sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0))
      .slice(0, limit);
  }

  async clearLogs(): Promise<void> {
    this.systemLogs.clear();
  }

  // Bot Config
  async getConfig(key: string): Promise<BotConfig | undefined> {
    return this.botConfigs.get(key);
  }

  async setConfig(key: string, value: string): Promise<BotConfig> {
    const existing = this.botConfigs.get(key);
    const config: BotConfig = {
      id: existing?.id || randomUUID(),
      key,
      value,
      updatedAt: new Date(),
    };
    
    this.botConfigs.set(key, config);
    return config;
  }

  async getAllConfig(): Promise<BotConfig[]> {
    return Array.from(this.botConfigs.values());
  }

  // Statistics
  async getRequestStats(): Promise<{
    total: number;
    approved: number;
    pending: number;
    denied: number;
    unknown: number;
  }> {
    const requests = Array.from(this.unlockRequests.values());
    
    return {
      total: requests.length,
      approved: requests.filter(r => r.status === RequestStatus.APPROVED).length,
      pending: requests.filter(r => r.status === RequestStatus.PENDING).length,
      denied: requests.filter(r => r.status === RequestStatus.DENIED).length,
      unknown: requests.filter(r => r.status === RequestStatus.UNKNOWN).length,
    };
  }
}

export const storage = new MemStorage();
