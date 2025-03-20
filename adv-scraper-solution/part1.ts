import * as playwright from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '../configService';
import { LogService } from '../../utils/logService';
import { IdentityManager } from '../identityManager';
import { ProxyManager } from '../proxyManager';
import { BrowserFingerprint, BrowserSettings } from '../../types/context';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

/**
 * Status da sessão de navegador
 */
type BrowserSessionStatus = 'initializing' | 'ready' | 'running' | 'error' | 'closed';

/**
 * Tipo de browser suportado
 */
type BrowserType = 'chromium' | 'firefox' | 'webkit';

/**
 * Tipo de ação de mouse
 */
type MouseAction = 'click' | 'move' | 'hover' | 'doubleClick';

/**
 * Ação a ser executada
 */
interface BrowserAction {
  type: 'click' | 'type' | 'navigate' | 'wait' | 'screenshot' | 'scrollTo' | 'extractData' | 'evaluate' | 'setViewport';
  selector?: string;
  text?: string;
  url?: string;
  timeout?: number;
  x?: number;
  y?: number;
  function?: string;
  width?: number;
  height?: number;
  humanLike?: boolean;
}

/**
 * Evento da sessão de navegador
 */
interface BrowserSessionEvent {
  type: 'navigation' | 'requestFailed' | 'requestFinished' | 'console' | 'dialog' | 'error' | 'interceptionDetected';
  timestamp: number;
  data: any;
}

/**
 * Interface para resultado de ação
 */
interface ActionResult {
  success: boolean;
  data?: any;
  error?: string;
  screenshot?: string;
}

/**
 * Opções para a captura de screenshot
 */
interface ScreenshotOptions {
  fullPage?: boolean;
  path?: string;
  type?: 'png' | 'jpeg';
  quality?: number;
  omitBackground?: boolean;
}

/**
 * Informações sobre uma sessão de navegador
 */
interface BrowserSession {
  id: string;
  createdAt: Date;
  lastActivity: Date;
  profileId: string;
  proxyId?: string;
  browser: playwright.Browser | null;
  context: playwright.BrowserContext | null;
  page: playwright.Page | null;
  status: BrowserSessionStatus;
  type: BrowserType;
  userAgent: string;
  viewportSize: { width: number; height: number };
  events: BrowserSessionEvent[];
  blockedDomains: string[];
  intercepts: {
    patterns: string[];
    handlers: Record<string, (request: playwright.Request) => Promise<void>>;
  };
  humanBehavior: {
    typing: {
      minDelay: number;
      maxDelay: number;
      mistakeProbability: number;
    };
    mouse: {
      moveSpeed: number;
      clickDelay: number;
      naturalMovement: boolean;
    };
    wait: {
      minDelay: number;
      maxDelay: number;
    };
    viewport: {
      width: number;
      height: number;
    };
  };
}
