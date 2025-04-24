// scripts/setup-rds.js
const AWS = require('aws-sdk');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Load environment variables
dotenv.config();

// Initialize AWS SDK
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

// Create RDS client
const rds = new AWS.RDS();

// Interactive command line interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Ask for input with Promise
function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

// Main function
async function setupRdsInstance() {
  try {
    console.log('Setting up AWS RDS instance for Banking API');
    console.log('------------------------------------------');
    
    // Gather parameters
    const dbName = await question('Enter database name [banking_api]: ') || 'banking_api';
    const dbUser = await question('Enter master username [postgres]: ') || 'postgres';
    const dbPassword = await question('Enter master password (min 8 chars): ');
    
    if (!dbPassword || dbPassword.length < 8) {
      console.error('Error: Password must be at least 8 characters long');
      rl.close();
      return;
    }
    
    const instanceClass = await question('Enter instance class [db.t3.micro]: ') || 'db.t3.micro';
    const allocatedStorage = parseInt(await question('Enter allocated storage in GB [20]: ') || '20');
    const vpcSecurityGroupId = await question('Enter VPC Security Group ID: ');
    
    if (!vpcSecurityGroupId) {
      console.error('Error: VPC Security Group ID is required');
      rl.close();
      return;
    }
    
    console.log('\nPreparing to create RDS instance with the following configuration:');
    console.log(`- Database name: ${dbName}`);
    console.log(`- Master username: ${dbUser}`);
    console.log(`- Instance class: ${instanceClass}`);
    console.log(`- Allocated storage: ${allocatedStorage} GB`);
    console.log(`- Region: ${AWS.config.region}`);
    
    const confirm = await question('\nContinue with these settings? (y/n): ');
    
    if (confirm.toLowerCase() !== 'y') {
      console.log('Setup cancelled');
      rl.close();
      return;
    }
    
    console.log('\nCreating RDS instance...');
    
    // Create DB instance
    const params = {
      DBName: dbName,
      DBInstanceIdentifier: `banking-api-${Date.now().toString().substring(7)}`,
      AllocatedStorage: allocatedStorage,
      DBInstanceClass: instanceClass,
      Engine: 'postgres',
      MasterUsername: dbUser,
      MasterUserPassword: dbPassword,
      VpcSecurityGroupIds: [vpcSecurityGroupId],
      BackupRetentionPeriod: 7,
      MultiAZ: false,
      EngineVersion: '13.7',
      AutoMinorVersionUpgrade: true,
      PubliclyAccessible: true,
      Tags: [
        {
          Key: 'Environment',
          Value: 'Development'
        },
        {
          Key: 'Project',
          Value: 'BankingAPI'
        }
      ],
      StorageType: 'gp2',
      EnablePerformanceInsights: false,
      DeletionProtection: false // Set to true for production
    };
    
    const result = await rds.createDBInstance(params).promise();
    
    console.log('\nRDS instance creation initiated successfully!');
    console.log('Instance details:');
    console.log(`- Identifier: ${result.DBInstance.DBInstanceIdentifier}`);
    console.log(`- Status: ${result.DBInstance.DBInstanceStatus}`);
    console.log(`- Engine: ${result.DBInstance.Engine} ${result.DBInstance.EngineVersion}`);
    
    console.log('\nImportant: It may take 5-10 minutes for the instance to become available.');
    console.log('You can check the status in the AWS RDS Console.');
    
    // Update .env file with the new connection details
    console.log('\nUpdating .env file with connection details...');
    
    const envPath = path.resolve(process.cwd(), '.env');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Update DB connection settings in .env
    const dbHostRegex = /DB_HOST=.*/;
    const dbNameRegex = /DB_NAME=.*/;
    const dbUserRegex = /DB_USER=.*/;
    const dbPasswordRegex = /DB_PASSWORD=.*/;
    
    // The endpoint will be available once the instance is created
    const endpoint = `${result.DBInstance.DBInstanceIdentifier}.xxxxxxxxxxxx.${AWS.config.region}.rds.amazonaws.com`;
    
    if (dbHostRegex.test(envContent)) {
      envContent = envContent.replace(dbHostRegex, `DB_HOST=${endpoint}`);
    } else {
      envContent += `\nDB_HOST=${endpoint}`;
    }
    
    if (dbNameRegex.test(envContent)) {
      envContent = envContent.replace(dbNameRegex, `DB_NAME=${dbName}`);
    } else {
      envContent += `\nDB_NAME=${dbName}`;
    }
    
    if (dbUserRegex.test(envContent)) {
      envContent = envContent.replace(dbUserRegex, `DB_USER=${dbUser}`);
    } else {
      envContent += `\nDB_USER=${dbUser}`;
    }
    
    if (dbPasswordRegex.test(envContent)) {
      envContent = envContent.replace(dbPasswordRegex, `DB_PASSWORD=${dbPassword}`);
    } else {
      envContent += `\nDB_PASSWORD=${dbPassword}`;
    }
    
    fs.writeFileSync(envPath, envContent);
    
    console.log('\nEnvironment variables updated successfully.');
    console.log('\nNext steps:');
    console.log('1. Wait for the RDS instance to become available');
    console.log('2. Run database migrations: node migrations/setup.js');
    console.log('3. Seed the database: node migrations/seed.js');
    console.log('4. Start your application: npm start');
    
  } catch (error) {
    console.error('Error setting up RDS instance:', error);
  } finally {
    rl.close();
  }
}

// Run the script
if (require.main === module) {
  setupRdsInstance();
}