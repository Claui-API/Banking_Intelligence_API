// src/utils/logger.js
const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
};

class BrowserLogger {
  constructor() {
    this.logs = [];
    this.maxLogs = 100; // Limit log storage
  }

  _log(level, message, meta = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: typeof message === 'object' ? JSON.stringify(message) : message,
      meta: typeof meta === 'object' ? meta : { details: meta }
    };

    // Store log
    this.logs.push(logEntry);

    // Trim logs if exceeding max
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output
    switch(level) {
      case LOG_LEVELS.ERROR:
        console.error(this._formatLogMessage(logEntry));
        break;
      case LOG_LEVELS.WARN:
        console.warn(this._formatLogMessage(logEntry));
        break;
      case LOG_LEVELS.INFO:
        console.info(this._formatLogMessage(logEntry));
        break;
      case LOG_LEVELS.DEBUG:
        console.debug(this._formatLogMessage(logEntry));
        break;
      default:
        console.log(this._formatLogMessage(logEntry));
    }
  }

  _formatLogMessage(logEntry) {
    return `[${logEntry.timestamp}] ${logEntry.level.toUpperCase()}: ${logEntry.message}${
      Object.keys(logEntry.meta).length > 0 
        ? ` - ${JSON.stringify(logEntry.meta)}` 
        : ''
    }`;
  }

  error(message, meta = {}) {
    this._log(LOG_LEVELS.ERROR, message, meta);
  }

  warn(message, meta = {}) {
    this._log(LOG_LEVELS.WARN, message, meta);
  }

  info(message, meta = {}) {
    this._log(LOG_LEVELS.INFO, message, meta);
  }

  debug(message, meta = {}) {
    this._log(LOG_LEVELS.DEBUG, message, meta);
  }

  logError(context, error) {
    this.error(`[${context}] ${error.message}`, {
      stack: error.stack,
      name: error.name
    });
  }

  // Method to export logs (could be expanded to save to file/storage)
  exportLogs() {
    return this.logs;
  }

  // Clear logs
  clearLogs() {
    this.logs = [];
  }
}

// Export a singleton instance
const logger = new BrowserLogger();

export default logger;