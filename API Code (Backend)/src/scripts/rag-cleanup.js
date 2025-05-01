#!/usr/bin/env node
// scripts/rag-cleanup.js
/**
 * This script safely removes or archives RAG-related files
 * Run with: node scripts/rag-cleanup.js
 * 
 * It will:
 * 1. Identify all RAG-related files
 * 2. Create a backup archive of these files
 * 3. Optionally remove the files if --delete flag is provided
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m'
};

// List of RAG-related files to remove
const ragFiles = [
  // Services
  'src/services/cohere-rag.service.js',
  
  // Scripts
  'src/scripts/setup-postgres-rag.js',
  'src/scripts/fix-postgres-rag.js',
  
  // Middleware
  'src/middleware/rag-metrics.middleware.js',
  
  // Routes
  'src/routes/rag-metrics.routes.js',
  
  // Controllers
  'src/controllers/rag-metrics.controller.js',
  
  // Frontend components
  'src/components/Admin/RagMetricsPanel.js',
  'src/components/Admin/UserRagMetrics.js'
];

// Function to check if a file exists
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (err) {
    return false;
  }
}

// Function to create a backup archive
async function createBackup(filesToBackup) {
  try {
    console.log(`${colors.blue}Creating backup of RAG files...${colors.reset}`);
    
    // Create a backup directory
    const backupDir = path.join(process.cwd(), 'rag-backup');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // Copy each file to the backup directory
    const backedUpFiles = [];
    for (const filePath of filesToBackup) {
      if (fileExists(filePath)) {
        // Create directory structure in backup
        const destPath = path.join(backupDir, filePath);
        const destDir = path.dirname(destPath);
        
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }
        
        // Copy the file
        fs.copyFileSync(filePath, destPath);
        backedUpFiles.push(filePath);
        console.log(`${colors.green}Backed up: ${filePath}${colors.reset}`);
      } else {
        console.log(`${colors.yellow}Skipped (not found): ${filePath}${colors.reset}`);
      }
    }
    
    // Create a zip archive of the backup directory
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveName = `rag-backup-${timestamp}.zip`;
    
    try {
      console.log(`${colors.blue}Creating zip archive ${archiveName}...${colors.reset}`);
      
      // Use different commands depending on the platform
      if (process.platform === 'win32') {
        // Windows
        execSync(`powershell Compress-Archive -Path ".\\rag-backup\\*" -DestinationPath "${archiveName}"`);
      } else {
        // Unix-like
        execSync(`zip -r "${archiveName}" rag-backup`);
      }
      
      console.log(`${colors.green}Archive created: ${archiveName}${colors.reset}`);
      
      // Clean up the temporary backup directory
      fs.rmSync(backupDir, { recursive: true, force: true });
      
      return {
        success: true,
        archivePath: path.join(process.cwd(), archiveName),
        backedUpFiles
      };
    } catch (error) {
      console.log(`${colors.yellow}Could not create zip archive. Files are still backed up in: ${backupDir}${colors.reset}`);
      console.error(error);
      
      return {
        success: false,
        backupDir,
        backedUpFiles
      };
    }
  } catch (error) {
    console.error(`${colors.red}Error creating backup:${colors.reset}`, error);
    return { success: false };
  }
}

// Function to delete RAG files
function deleteRagFiles(filesToDelete) {
  const deletedFiles = [];
  
  for (const filePath of filesToDelete) {
    if (fileExists(filePath)) {
      try {
        fs.unlinkSync(filePath);
        deletedFiles.push(filePath);
        console.log(`${colors.green}Deleted: ${filePath}${colors.reset}`);
      } catch (error) {
        console.error(`${colors.red}Error deleting ${filePath}:${colors.reset}`, error);
      }
    }
  }
  
  return deletedFiles;
}

// Main function
async function main() {
  console.log(`${colors.blue}=== RAG System Cleanup Tool ====${colors.reset}\n`);
  
  // Check for command line arguments
  const args = process.argv.slice(2);
  const shouldDelete = args.includes('--delete');
  
  // Count existing files
  const existingFiles = ragFiles.filter(fileExists);
  
  console.log(`Found ${existingFiles.length} RAG-related files out of ${ragFiles.length} in the list:`);
  
  // Show existing files
  existingFiles.forEach(filePath => {
    console.log(`${colors.yellow}- ${filePath}${colors.reset}`);
  });
  
  if (existingFiles.length === 0) {
    console.log(`${colors.green}No RAG files found. No action needed.${colors.reset}`);
    rl.close();
    return;
  }
  
  // Create backup
  const backupResult = await createBackup(existingFiles);
  
  if (!backupResult.success) {
    const answer = await new Promise(resolve => {
      rl.question(`${colors.yellow}Backup failed. Do you want to continue? (y/N): ${colors.reset}`, resolve);
    });
    
    if (answer.toLowerCase() !== 'y') {
      console.log(`${colors.blue}Operation cancelled.${colors.reset}`);
      rl.close();
      return;
    }
  }
  
  // Delete files if --delete flag is provided or user confirms
  if (shouldDelete) {
    const deletedFiles = deleteRagFiles(existingFiles);
    console.log(`${colors.green}Deleted ${deletedFiles.length} RAG files.${colors.reset}`);
  } else {
    const answer = await new Promise(resolve => {
      rl.question(`${colors.yellow}Do you want to delete the RAG files? (y/N): ${colors.reset}`, resolve);
    });
    
    if (answer.toLowerCase() === 'y') {
      const deletedFiles = deleteRagFiles(existingFiles);
      console.log(`${colors.green}Deleted ${deletedFiles.length} RAG files.${colors.reset}`);
    } else {
      console.log(`${colors.blue}Files were backed up but not deleted.${colors.reset}`);
    }
  }
  
  console.log(`${colors.blue}RAG cleanup completed.${colors.reset}`);
  rl.close();
}

// Run the main function
main().catch(error => {
  console.error(`${colors.red}Unexpected error:${colors.reset}`, error);
  process.exit(1);
});