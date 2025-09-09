# Overview

AT&T Device Unlock Bot is an automated Telegram bot system designed to manage and process AT&T device unlock requests. The application combines a Telegram bot interface with headless browser automation to interact with AT&T's official unlock portal, along with a React-based web dashboard for monitoring and management. The system automates the submission of unlock requests, monitors their status, and provides notifications while respecting CAPTCHA requirements and maintaining robust error handling.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The client is built with React 18+ using TypeScript and modern tooling:
- **UI Framework**: React with Vite for fast development and building
- **Styling**: Tailwind CSS with shadcn/ui component library for consistent design
- **State Management**: TanStack Query for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation schemas
- **Build System**: Vite with custom configuration for multi-environment support

## Backend Architecture
The server follows a service-oriented architecture pattern:
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Architecture Pattern**: Service layer pattern with dependency injection
- **Data Layer**: Drizzle ORM with PostgreSQL schema definitions
- **Storage**: Configurable storage interface supporting both in-memory and persistent storage

## Core Services
- **Telegram Bot Service**: Handles bot interactions, command processing, and user validation
- **Browser Automation Service**: Playwright-based headless browser for AT&T portal automation
- **ATT Flow Service**: Orchestrates the multi-step unlock request submission process
- **Status Checker Service**: Monitors and updates request statuses
- **Logger Service**: Centralized logging with configurable levels and metadata

## Data Management
- **Schema Design**: Drizzle ORM with PostgreSQL schemas for unlock requests, system logs, and bot configuration
- **Data Models**: Structured entities for UnlockRequest, SystemLog, and BotConfig with validation
- **Storage Abstraction**: Interface-based storage layer allowing for different persistence strategies

## Security and Access Control
- **Bot Access Control**: Single owner authentication using Telegram user ID verification
- **Environment Variables**: Secure configuration management through Replit Secrets or .env files
- **Input Validation**: Comprehensive validation for IMEI numbers, phone numbers, and email addresses

## Browser Automation Strategy
- **Headless Browser**: Playwright with Chromium for reliable web automation
- **CAPTCHA Handling**: Detection without bypass attempts, triggering manual intervention notifications
- **Error Recovery**: Robust error handling with screenshot capture for debugging
- **Multi-path Support**: Handles both AT&T customer and non-customer unlock flows

## Monitoring and Observability
- **Structured Logging**: Multi-level logging with request correlation and metadata
- **Dashboard Analytics**: Real-time statistics and request monitoring
- **Status Tracking**: Automated status checking with configurable intervals
- **Error Reporting**: Comprehensive error capture and user notification

# External Dependencies

## Core Infrastructure
- **Replit Platform**: Primary hosting and development environment
- **PostgreSQL Database**: Persistent data storage via Neon or similar providers
- **Node.js Runtime**: Server-side JavaScript execution environment

## Telegram Integration
- **Telegram Bot API**: Bot communication and command handling
- **node-telegram-bot-api**: Node.js library for Telegram bot functionality

## Browser Automation
- **Playwright**: Headless browser automation library
- **Chromium Browser**: Web automation engine for AT&T portal interaction

## Email Notifications
- **Google Apps Script**: External email forwarding service (user-configurable)
- **AT&T Official Portal**: Target automation endpoints for unlock requests

## Development and Build Tools
- **Vite**: Frontend build tool and development server
- **TypeScript**: Type safety and enhanced development experience
- **Tailwind CSS**: Utility-first CSS framework
- **ESBuild**: Fast JavaScript bundling for production builds

## UI Component Libraries
- **Radix UI**: Accessible component primitives
- **shadcn/ui**: Pre-built component library
- **Lucide React**: Icon library for user interface elements

## Data and Validation
- **Drizzle ORM**: Type-safe database toolkit
- **Zod**: Runtime type validation and schema definition
- **React Hook Form**: Form state management and validation