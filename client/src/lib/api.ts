import { apiRequest } from "./queryClient";

export interface DashboardStats {
  stats: {
    total: number;
    approved: number;
    pending: number;
    denied: number;
    unknown: number;
  };
  recentRequests: any[];
  recentActivity: any[];
}

export interface UnlockRequest {
  id: string;
  requestId?: string;
  imei: string;
  phoneNumber?: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  submittedAt: string;
  deadlineAt?: string;
  lastCheckedAt?: string;
  captchaDetected: boolean;
  errorMessage?: string;
  statusDetails?: string;
}

export interface SystemLog {
  id: string;
  level: string;
  message: string;
  source: string;
  requestId?: string;
  timestamp: string;
  metadata?: any;
}

export interface BotConfig {
  id: string;
  key: string;
  value: string;
  updatedAt: string;
}

export const api = {
  // Dashboard
  async getDashboardStats(): Promise<DashboardStats> {
    const response = await apiRequest('GET', '/api/dashboard/stats');
    return response.json();
  },

  // Unlock Requests
  async getUnlockRequests(): Promise<UnlockRequest[]> {
    const response = await apiRequest('GET', '/api/requests');
    return response.json();
  },

  async createUnlockRequest(data: {
    imei: string;
    phoneNumber?: string;
    firstName: string;
    lastName: string;
    email: string;
  }): Promise<{ request: UnlockRequest; submissionResult: any }> {
    const response = await apiRequest('POST', '/api/requests', data);
    return response.json();
  },

  async checkRequestStatus(requestId: string): Promise<{ statusResult: any; request: UnlockRequest }> {
    const response = await apiRequest('POST', `/api/requests/${requestId}/check-status`);
    return response.json();
  },

  // Status Check
  async manualStatusCheck(data: { imei: string; requestId: string }): Promise<any> {
    const response = await apiRequest('POST', '/api/status-check', data);
    return response.json();
  },

  // System Logs
  async getLogs(limit?: number, level?: string): Promise<SystemLog[]> {
    const params = new URLSearchParams();
    if (limit) params.set('limit', limit.toString());
    if (level) params.set('level', level);
    
    const response = await apiRequest('GET', `/api/logs?${params}`);
    return response.json();
  },

  async clearLogs(): Promise<void> {
    await apiRequest('DELETE', '/api/logs');
  },

  // Configuration
  async getConfig(): Promise<BotConfig[]> {
    const response = await apiRequest('GET', '/api/config');
    return response.json();
  },

  async updateConfig(key: string, value: string): Promise<BotConfig> {
    const response = await apiRequest('POST', '/api/config', { key, value });
    return response.json();
  },

  // Health
  async getHealth(): Promise<any> {
    const response = await apiRequest('GET', '/api/health');
    return response.json();
  },

  async updateActivity(): Promise<void> {
    await apiRequest('POST', '/api/activity');
  }
};
