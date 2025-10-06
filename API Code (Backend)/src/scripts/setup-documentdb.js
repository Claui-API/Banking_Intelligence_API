// scripts/setup-documentdb.js
const AWS = require('aws-sdk');
const dotenv = require('dotenv');
const fs = require('fs');
const https = require('https');
const path = require('path');
const logger = require('../utils/logger');

// Load environment variables from .env file
dotenv.config();

/**
 * Downloads the AWS DocumentDB certificate bundle
 * @param {string} outputPath - Path to save the certificate
 * @returns {Promise} - Promise resolving when download is complete
 */
function downloadCertificate(outputPath) {
  return new Promise((resolve, reject) => {
    const certUrl = 'https://s3.amazonaws.com/rds-downloads/rds-combined-ca-bundle.pem';
    const file = fs.createWriteStream(outputPath);
    
    https.get(certUrl, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        logger.info(`Certificate downloaded to ${outputPath}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {}); // Delete the file on error
      reject(err);
    });
  });
}

/**
 * Creates an AWS DocumentDB cluster
 */
async function createDocumentDBCluster() {
  try {
    // Configure AWS SDK
    const docdb = new AWS.DocDB({
      region: process.env.AWS_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    });
    
    // Check if required environment variables are set
    const requiredVars = [
      'AWS_REGION', 
      'AWS_ACCESS_KEY_ID', 
      'AWS_SECRET_ACCESS_KEY',
      'VPC_SECURITY_GROUP_ID',
      'DB_SUBNET_GROUP_NAME',
      'DB_USERNAME',
      'DB_PASSWORD'
    ];
    
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
      logger.info('Please ensure all required variables are set in your .env file');
      process.exit(1);
    }
    
    // Parameters for creating a DocumentDB cluster
    const clusterParams = {
      DBClusterIdentifier: 'banking-intelligence-db',
      Engine: 'docdb',
      MasterUsername: process.env.DB_USERNAME,
      MasterUserPassword: process.env.DB_PASSWORD,
      VpcSecurityGroupIds: [
        process.env.VPC_SECURITY_GROUP_ID
      ],
      DBSubnetGroupName: process.env.DB_SUBNET_GROUP_NAME,
      BackupRetentionPeriod: 7,
      DeletionProtection: true
    };
    
    // Check if cluster already exists
    try {
      logger.info('Checking if DocumentDB cluster already exists...');
      const describeParams = {
        DBClusterIdentifier: 'banking-intelligence-db'
      };
      
      const data = await docdb.describeDBClusters(describeParams).promise();
      if (data.DBClusters && data.DBClusters.length > 0) {
        const cluster = data.DBClusters[0];
        logger.info(`DocumentDB cluster already exists with endpoint: ${cluster.Endpoint}`);
        
        // Save the endpoint to .env file if DB_ENDPOINT is not set
        if (!process.env.DB_ENDPOINT) {
          const envContent = fs.readFileSync('.env', 'utf8');
          const updatedContent = envContent + `\nDB_ENDPOINT=${cluster.Endpoint}\n`;
          fs.writeFileSync('.env', updatedContent);
          logger.info('Updated .env file with DB_ENDPOINT');
        }
        
        return cluster;
      }
    } catch (error) {
      if (error.code !== 'DBClusterNotFoundFault') {
        throw error;
      }
      // If the error is that the cluster doesn't exist, continue with creation
    }
    
    // Create the cluster
    logger.info('Creating DocumentDB cluster...');
    const createResult = await docdb.createDBCluster(clusterParams).promise();
    logger.info('DocumentDB cluster creation initiated.');
    logger.info('Cluster creation can take 10-15 minutes to complete.');
    logger.info(`Cluster Endpoint: ${createResult.DBCluster.Endpoint}`);
    
    // Save the endpoint to .env file
    const envContent = fs.readFileSync('.env', 'utf8');
    const updatedContent = envContent + `\nDB_ENDPOINT=${createResult.DBCluster.Endpoint}\n`;
    fs.writeFileSync('.env', updatedContent);
    logger.info('Updated .env file with DB_ENDPOINT');
    
    // Create a DB instance in the cluster
    const instanceParams = {
      DBClusterIdentifier: 'banking-intelligence-db',
      DBInstanceIdentifier: 'banking-intelligence-instance-1',
      DBInstanceClass: 'db.r5.large', // Adjust based on your needs
      Engine: 'docdb'
    };
    
    logger.info('Creating DocumentDB instance...');
    const instanceResult = await docdb.createDBInstance(instanceParams).promise();
    logger.info('DocumentDB instance creation initiated.');
    logger.info(`DB Instance: ${instanceResult.DBInstance.DBInstanceIdentifier}`);
    
    return createResult.DBCluster;
  } catch (error) {
    logger.error('Error creating DocumentDB cluster:', error);
    throw error;
  }
}

/**
 * Main function to set up DocumentDB
 */
async function setupDocumentDB() {
  try {
    logger.info('Starting DocumentDB setup...');
    
    // Download the certificate
    const certPath = path.join(__dirname, '..', 'rds-combined-ca-bundle.pem');
    if (!fs.existsSync(certPath)) {
      logger.info('Downloading DocumentDB certificate...');
      await downloadCertificate(certPath);
    } else {
      logger.info('Certificate already exists, skipping download');
    }
    
    // Create the DocumentDB cluster
    const cluster = await createDocumentDBCluster();
    
    logger.info('DocumentDB setup completed successfully');
    logger.info('-------------------------------------');
    logger.info('Connection Information:');
    logger.info(`Endpoint: ${cluster.Endpoint}`);
    logger.info(`Port: 27017`);
    logger.info(`Username: ${process.env.DB_USERNAME}`);
    logger.info('Password: [HIDDEN]');
    logger.info('-------------------------------------');
    logger.info('Next steps:');
    logger.info('1. Wait for cluster and instance to become available (10-15 minutes)');
    logger.info('2. Update your security group to allow access from your application');
    logger.info('3. Use the connection string in your application to connect to DocumentDB');
    
    return cluster;
  } catch (error) {
    logger.error('Error setting up DocumentDB:', error);
    throw error;
  }
}

// Entry point
if (require.main === module) {
  setupDocumentDB()
    .then(() => {
      logger.info('Setup script completed.');
    })
    .catch((error) => {
      logger.error('Setup script failed:', error);
      process.exit(1);
    });
} else {
  module.exports = {
    setupDocumentDB,
    downloadCertificate,
    createDocumentDBCluster
  };
}