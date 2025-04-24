// scripts/rds-monitor.js
const AWS = require('aws-sdk');
const dotenv = require('dotenv');
const readline = require('readline');
const Table = require('cli-table3');

// Load environment variables
dotenv.config();

// Initialize AWS SDK
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

// Create RDS and CloudWatch clients
const rds = new AWS.RDS();
const cloudwatch = new AWS.CloudWatch();

// Interactive command line interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Ask for input with Promise
function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

// Display a menu and get the user's choice
async function displayMenu() {
  console.log('\n==== AWS RDS Monitoring Utility ====');
  console.log('1. List RDS instances');
  console.log('2. Get detailed instance information');
  console.log('3. View performance metrics');
  console.log('4. Create database snapshot');
  console.log('5. List database snapshots');
  console.log('6. View connection information');
  console.log('7. Exit');
  
  const choice = await question('\nEnter your choice (1-7): ');
  return choice;
}

// Format timestamp
function formatTimestamp(timestamp) {
  return new Date(timestamp).toLocaleString();
}

// List RDS instances
async function listInstances() {
  try {
    const data = await rds.describeDBInstances().promise();
    
    if (data.DBInstances.length === 0) {
      console.log('No RDS instances found in this region.');
      return;
    }
    
    // Create a table for better visualization
    const table = new Table({
      head: ['Identifier', 'Engine', 'Status', 'Size', 'Endpoint', 'Created']
    });
    
    data.DBInstances.forEach(instance => {
      table.push([
        instance.DBInstanceIdentifier,
        `${instance.Engine} ${instance.EngineVersion}`,
        instance.DBInstanceStatus,
        instance.DBInstanceClass,
        instance.Endpoint ? instance.Endpoint.Address : 'N/A',
        formatTimestamp(instance.InstanceCreateTime)
      ]);
    });
    
    console.log(table.toString());
  } catch (error) {
    console.error('Error listing RDS instances:', error);
  }
}

// Get detailed instance information
async function getInstanceDetails() {
  try {
    const instanceId = await question('Enter RDS instance identifier: ');
    
    const params = {
      DBInstanceIdentifier: instanceId
    };
    
    const data = await rds.describeDBInstances(params).promise();
    
    if (data.DBInstances.length === 0) {
      console.log(`No instance found with identifier: ${instanceId}`);
      return;
    }
    
    const instance = data.DBInstances[0];
    
    console.log('\n==== Instance Details ====');
    console.log(`Identifier: ${instance.DBInstanceIdentifier}`);
    console.log(`Engine: ${instance.Engine} ${instance.EngineVersion}`);
    console.log(`Status: ${instance.DBInstanceStatus}`);
    console.log(`Instance Class: ${instance.DBInstanceClass}`);
    console.log(`Storage: ${instance.AllocatedStorage} GB (${instance.StorageType})`);
    console.log(`Multi-AZ: ${instance.MultiAZ ? 'Yes' : 'No'}`);
    console.log(`Publicly Accessible: ${instance.PubliclyAccessible ? 'Yes' : 'No'}`);
    console.log(`Storage Encrypted: ${instance.StorageEncrypted ? 'Yes' : 'No'}`);
    console.log(`Automated Backups: ${instance.BackupRetentionPeriod} days`);
    console.log(`Created: ${formatTimestamp(instance.InstanceCreateTime)}`);
    
    if (instance.Endpoint) {
      console.log('\n==== Connection Information ====');
      console.log(`Endpoint: ${instance.Endpoint.Address}`);
      console.log(`Port: ${instance.Endpoint.Port}`);
      console.log(`Database Name: ${instance.DBName || 'N/A'}`);
    }
    
    console.log('\n==== Security Information ====');
    console.log('VPC Security Groups:');
    instance.VpcSecurityGroups.forEach(sg => {
      console.log(`- ${sg.VpcSecurityGroupId} (${sg.Status})`);
    });
    
    console.log('\n==== Parameter Groups ====');
    instance.DBParameterGroups.forEach(pg => {
      console.log(`- ${pg.DBParameterGroupName} (${pg.ParameterApplyStatus})`);
    });
  } catch (error) {
    console.error('Error getting instance details:', error);
  }
}

// View performance metrics
async function viewPerformanceMetrics() {
  try {
    const instanceId = await question('Enter RDS instance identifier: ');
    
    const metrics = [
      { name: 'CPUUtilization', label: 'CPU Utilization', unit: 'Percent' },
      { name: 'DatabaseConnections', label: 'DB Connections', unit: 'Count' },
      { name: 'FreeableMemory', label: 'Freeable Memory', unit: 'Bytes' },
      { name: 'FreeStorageSpace', label: 'Free Storage Space', unit: 'Bytes' },
      { name: 'ReadIOPS', label: 'Read IOPS', unit: 'Count/Second' },
      { name: 'WriteIOPS', label: 'Write IOPS', unit: 'Count/Second' }
    ];
    
    // Get metrics for the last hour
    const endTime = new Date();
    const startTime = new Date(endTime - 60 * 60 * 1000); // 1 hour ago
    
    console.log('\n==== Performance Metrics (Last Hour) ====');
    
    for (const metric of metrics) {
      const params = {
        Namespace: 'AWS/RDS',
        MetricName: metric.name,
        Dimensions: [
          {
            Name: 'DBInstanceIdentifier',
            Value: instanceId
          }
        ],
        StartTime: startTime,
        EndTime: endTime,
        Period: 300, // 5-minute intervals
        Statistics: ['Average']
      };
      
      const data = await cloudwatch.getMetricStatistics(params).promise();
      
      let value = 'N/A';
      
      if (data.Datapoints.length > 0) {
        // Sort datapoints by timestamp and get the most recent
        data.Datapoints.sort((a, b) => b.Timestamp - a.Timestamp);
        const latestDatapoint = data.Datapoints[0];
        
        // Format the value based on unit
        if (metric.unit === 'Bytes') {
          value = `${(latestDatapoint.Average / (1024 * 1024 * 1024)).toFixed(2)} GB`;
        } else if (metric.unit === 'Percent') {
          value = `${latestDatapoint.Average.toFixed(2)}%`;
        } else {
          value = latestDatapoint.Average.toFixed(2);
        }
      }
      
      console.log(`${metric.label}: ${value}`);
    }
  } catch (error) {
    console.error('Error getting performance metrics:', error);
  }
}

// Create database snapshot
async function createSnapshot() {
  try {
    const instanceId = await question('Enter RDS instance identifier: ');
    const snapshotId = await question('Enter snapshot identifier: ');
    
    console.log(`Creating snapshot ${snapshotId} from instance ${instanceId}...`);
    
    const params = {
      DBInstanceIdentifier: instanceId,
      DBSnapshotIdentifier: snapshotId
    };
    
    const data = await rds.createDBSnapshot(params).promise();
    
    console.log('Snapshot creation initiated:');
    console.log(`- Snapshot ID: ${data.DBSnapshot.DBSnapshotIdentifier}`);
    console.log(`- Status: ${data.DBSnapshot.Status}`);
    console.log(`- Created: ${formatTimestamp(data.DBSnapshot.SnapshotCreateTime)}`);
    console.log('Note: Snapshot creation may take several minutes to complete.');
  } catch (error) {
    console.error('Error creating snapshot:', error);
  }
}

// List database snapshots
async function listSnapshots() {
  try {
    const instanceId = await question('Enter RDS instance identifier (leave empty for all snapshots): ');
    
    const params = {};
    if (instanceId) {
      params.DBInstanceIdentifier = instanceId;
    }
    
    const data = await rds.describeDBSnapshots(params).promise();
    
    if (data.DBSnapshots.length === 0) {
      console.log('No snapshots found.');
      return;
    }
    
    // Create a table for better visualization
    const table = new Table({
      head: ['Snapshot ID', 'Instance', 'Status', 'Created', 'Size (GB)']
    });
    
    data.DBSnapshots.forEach(snapshot => {
      table.push([
        snapshot.DBSnapshotIdentifier,
        snapshot.DBInstanceIdentifier,
        snapshot.Status,
        formatTimestamp(snapshot.SnapshotCreateTime),
        snapshot.AllocatedStorage
      ]);
    });
    
    console.log(table.toString());
  } catch (error) {
    console.error('Error listing snapshots:', error);
  }
}

// View connection information
async function viewConnectionInfo() {
  try {
    const instanceId = await question('Enter RDS instance identifier: ');
    
    const params = {
      DBInstanceIdentifier: instanceId
    };
    
    const data = await rds.describeDBInstances(params).promise();
    
    if (data.DBInstances.length === 0) {
      console.log(`No instance found with identifier: ${instanceId}`);
      return;
    }
    
    const instance = data.DBInstances[0];
    
    console.log('\n==== Connection Information ====');
    
    if (instance.Endpoint) {
      console.log(`Host: ${instance.Endpoint.Address}`);
      console.log(`Port: ${instance.Endpoint.Port}`);
      console.log(`Database: ${instance.DBName || 'N/A'}`);
      console.log(`Username: ${instance.MasterUsername}`);
      console.log('Password: [HIDDEN]');
      
      console.log('\n==== Connection String Examples ====');
      
      console.log('PostgreSQL:');
      console.log(`postgres://${instance.MasterUsername}:[PASSWORD]@${instance.Endpoint.Address}:${instance.Endpoint.Port}/${instance.DBName || 'postgres'}`);
      
      console.log('\nNode.js (Sequelize):');
      console.log(`const sequelize = new Sequelize('${instance.DBName || 'postgres'}', '${instance.MasterUsername}', '[PASSWORD]', {`);
      console.log(`  host: '${instance.Endpoint.Address}',`);
      console.log(`  port: ${instance.Endpoint.Port},`);
      console.log("  dialect: 'postgres',");
      console.log("  dialectOptions: {");
      console.log("    ssl: {");
      console.log("      require: true,");
      console.log("      rejectUnauthorized: false");
      console.log("    }");
      console.log("  }");
      console.log("});");
      
      console.log('\nDotenv (.env) format:');
      console.log(`DB_HOST=${instance.Endpoint.Address}`);
      console.log(`DB_PORT=${instance.Endpoint.Port}`);
      console.log(`DB_NAME=${instance.DBName || 'postgres'}`);
      console.log(`DB_USER=${instance.MasterUsername}`);
      console.log(`DB_PASSWORD=[YOUR_PASSWORD]`);
    } else {
      console.log('Instance endpoint not available. The instance may still be creating or in a failed state.');
    }
  } catch (error) {
    console.error('Error getting connection information:', error);
  }
}

// Main function
async function main() {
  try {
    let exit = false;
    
    while (!exit) {
      const choice = await displayMenu();
      
      switch (choice) {
        case '1':
          await listInstances();
          break;
        case '2':
          await getInstanceDetails();
          break;
        case '3':
          await viewPerformanceMetrics();
          break;
        case '4':
          await createSnapshot();
          break;
        case '5':
          await listSnapshots();
          break;
        case '6':
          await viewConnectionInfo();
          break;
        case '7':
          console.log('Exiting...');
          exit = true;
          break;
        default:
          console.log('Invalid choice. Please try again.');
      }
      
      if (!exit) {
        await question('\nPress Enter to continue...');
      }
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    rl.close();
  }
}

// Run the script
if (require.main === module) {
  main();
}