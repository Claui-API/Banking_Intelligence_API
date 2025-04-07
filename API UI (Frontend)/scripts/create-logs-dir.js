// scripts/create-logs-dir.js
const fs = require('fs');
const path = require('path');

const logDir = path.join(process.cwd(), 'logs');

// Create logs directory if it doesn't exist
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
  console.log(`Logs directory created at: ${logDir}`);
}