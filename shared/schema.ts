import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const unlockRequests = pgTable("unlock_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: text("request_id"), // AT&T Request ID like NUL117557332822
  imei: text("imei").notNull(),
  phoneNumber: text("phone_number"), // Optional AT&T number
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  status: text("status").notNull().default("pending"), // pending, approved, denied, unknown
  submittedAt: timestamp("submitted_at").defaultNow(),
  deadlineAt: timestamp("deadline_at"), // 24h after submission
  lastCheckedAt: timestamp("last_checked_at"),
  captchaDetected: boolean("captcha_detected").default(false),
  errorMessage: text("error_message"),
  statusDetails: text("status_details"),
  metadata: jsonb("metadata"), // Additional data from AT&T
});

export const systemLogs = pgTable("system_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  level: text("level").notNull(), // info, warn, error, debug
  message: text("message").notNull(),
  source: text("source").notNull(), // bot, automation, status-checker, etc.
  requestId: text("request_id"), // Link to unlock request if applicable
  metadata: jsonb("metadata"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const botConfig = pgTable("bot_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Validation schemas
export const insertUnlockRequestSchema = createInsertSchema(unlockRequests).omit({
  id: true,
  submittedAt: true,
  lastCheckedAt: true,
}).extend({
  imei: z.string().regex(/^\d{15}$/, "IMEI debe tener 15 dígitos"),
  phoneNumber: z.string().regex(/^\d{10}$/, "Número debe tener 10 dígitos").optional(),
  email: z.string().email("Email inválido"),
  firstName: z.string().min(1, "Nombre requerido"),
  lastName: z.string().min(1, "Apellido requerido"),
});

export const statusCheckSchema = z.object({
  imei: z.string().regex(/^\d{15}$/, "IMEI debe tener 15 dígitos"),
  requestId: z.string().min(1, "Request ID requerido"),
});

export const insertLogSchema = createInsertSchema(systemLogs).omit({
  id: true,
  timestamp: true,
});

export const configUpdateSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});

// Types
export type UnlockRequest = typeof unlockRequests.$inferSelect;
export type InsertUnlockRequest = z.infer<typeof insertUnlockRequestSchema>;
export type SystemLog = typeof systemLogs.$inferSelect;
export type InsertSystemLog = z.infer<typeof insertLogSchema>;
export type BotConfig = typeof botConfig.$inferSelect;
export type StatusCheck = z.infer<typeof statusCheckSchema>;

// Status enums
export const RequestStatus = {
  PENDING: "pending",
  APPROVED: "approved", 
  DENIED: "denied",
  UNKNOWN: "unknown",
} as const;

export const LogLevel = {
  INFO: "info",
  WARN: "warn", 
  ERROR: "error",
  DEBUG: "debug",
} as const;
