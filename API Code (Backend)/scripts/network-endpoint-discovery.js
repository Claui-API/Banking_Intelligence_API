// scripts/network-endpoint-discovery.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('../src/utils/logger');
const os = require('os');
const axios = require('axios');

/**
 * Network Endpoint Discovery Tool
 * This script helps identify and record all network endpoints (assets) connected to your networks
 */

// Configuration
const CONFIG = {
	outputDir: path.join(__dirname, '..', 'security-reports'),
	assetInventoryFile: 'network-assets.json',
	scanFrequency: 'daily', // 'daily', 'weekly', 'monthly'
	awsEnabled: true,
	localNetworkScan: true
};

// Ensure output directory exists
if (!fs.existsSync(CONFIG.outputDir)) {
	fs.mkdirSync(CONFIG.outputDir, { recursive: true });
}

// Asset inventory file path
const assetInventoryPath = path.join(CONFIG.outputDir, CONFIG.assetInventoryFile);

// Load existing asset inventory if available
let assetInventory = {};
if (fs.existsSync(assetInventoryPath)) {
	try {
		assetInventory = JSON.parse(fs.readFileSync(assetInventoryPath, 'utf8'));
		logger.info(`Loaded existing asset inventory with ${Object.keys(assetInventory.assets || {}).length} assets`);
	} catch (error) {
		logger.error('Error loading asset inventory:', error);
		assetInventory = { assets: {}, lastUpdated: null };
	}
} else {
	assetInventory = { assets: {}, lastUpdated: null };
}

/**
 * Discover local machine information
 */
async function discoverLocalMachine() {
	logger.info('Discovering local machine information...');

	const localMachine = {
		hostname: os.hostname(),
		platform: os.platform(),
		type: 'workstation',
		ip: {
			internal: Object.values(os.networkInterfaces())
				.flat()
				.filter(iface => !iface.internal && iface.family === 'IPv4')
				.map(iface => iface.address)[0]
		},
		lastSeen: new Date().toISOString(),
		osInfo: {
			type: os.type(),
			platform: os.platform(),
			release: os.release(),
			arch: os.arch()
		},
		cpu: os.cpus()[0].model,
		memory: {
			total: Math.round(os.totalmem() / (1024 * 1024 * 1024)) + ' GB',
			free: Math.round(os.freemem() / (1024 * 1024 * 1024)) + ' GB'
		}
	};

	// Get external IP
	try {
		const { data } = await axios.get('https://api.ipify.org?format=json');
		localMachine.ip.external = data.ip;
	} catch (error) {
		logger.error('Error getting external IP:', error);
	}

	// Update asset inventory with local machine
	assetInventory.assets[localMachine.hostname] = {
		...assetInventory.assets[localMachine.hostname],
		...localMachine
	};

	logger.info(`Discovered local machine: ${localMachine.hostname}`);
	return localMachine;
}

/**
 * Discover AWS resources if available
 */
async function discoverAwsResources() {
	if (!CONFIG.awsEnabled) {
		logger.info('AWS resource discovery is disabled');
		return [];
	}

	logger.info('Discovering AWS resources...');
	const awsResources = [];

	try {
		// Check if AWS CLI is installed and credentials are configured
		try {
			// Test AWS CLI with a simple command
			execSync('aws sts get-caller-identity', { stdio: 'ignore' });
		} catch (error) {
			logger.warn('AWS CLI is not installed or credentials are not configured');
			logger.info('To configure AWS credentials, run: aws configure');
			// Continue with other discovery methods
			return [];
		}

		// Get AWS EC2 instances - fixing the query syntax
		try {
			// Fixed query syntax by properly escaping quotes
			const ec2Result = execSync(`aws ec2 describe-instances --query "Reservations[].Instances[].[InstanceId,State.Name,InstanceType,PublicIpAddress,PrivateIpAddress,Tags[?Key=='Name'].Value|[0]]" --output json`, { encoding: 'utf8' });

			// Parse the result (only if it's not empty)
			let instances = [];
			if (ec2Result && ec2Result.trim()) {
				instances = JSON.parse(ec2Result);

				instances.forEach(instance => {
					const [instanceId, state, instanceType, publicIp, privateIp, name] = instance;

					if (instanceId) {
						const resource = {
							id: instanceId,
							name: name || instanceId,
							type: 'ec2-instance',
							platform: instanceType,
							ip: {
								public: publicIp,
								private: privateIp
							},
							state,
							provider: 'aws',
							lastSeen: new Date().toISOString()
						};

						awsResources.push(resource);

						// Update asset inventory
						assetInventory.assets[instanceId] = {
							...assetInventory.assets[instanceId],
							...resource
						};
					}
				});

				logger.info(`Discovered ${instances.length} EC2 instances`);
			} else {
				logger.info('No EC2 instances found or empty response');
			}
		} catch (error) {
			logger.error('Error discovering EC2 instances:', error);
		}

		// Get AWS RDS instances - fixing the query
		try {
			const rdsResult = execSync('aws rds describe-db-instances --query "DBInstances[].[DBInstanceIdentifier,DBInstanceStatus,DBInstanceClass,Endpoint.Address,Engine,EngineVersion]" --output json', { encoding: 'utf8' });

			// Parse the result (only if it's not empty)
			let instances = [];
			if (rdsResult && rdsResult.trim()) {
				instances = JSON.parse(rdsResult);

				instances.forEach(instance => {
					const [instanceId, state, instanceType, endpoint, engine, version] = instance;

					if (instanceId) {
						const resource = {
							id: instanceId,
							name: instanceId,
							type: 'rds-instance',
							platform: instanceType,
							endpoint: endpoint,
							engine: `${engine} ${version}`,
							state,
							provider: 'aws',
							lastSeen: new Date().toISOString()
						};

						awsResources.push(resource);

						// Update asset inventory
						assetInventory.assets[instanceId] = {
							...assetInventory.assets[instanceId],
							...resource
						};
					}
				});

				logger.info(`Discovered ${instances.length} RDS instances`);
			} else {
				logger.info('No RDS instances found or empty response');
			}
		} catch (error) {
			logger.error('Error discovering RDS instances:', error);
		}
	} catch (error) {
		logger.error('Error discovering AWS resources:', error);
	}

	return awsResources;
}

/**
 * Run a network scan on the local network to discover devices
 */
async function scanLocalNetwork() {
	if (!CONFIG.localNetworkScan) {
		logger.info('Local network scan is disabled');
		return [];
	}

	logger.info('Scanning local network for devices...');
	const networkDevices = [];

	try {
		// Get local network CIDR
		const ifaces = Object.values(os.networkInterfaces())
			.flat()
			.filter(iface => !iface.internal && iface.family === 'IPv4');

		if (ifaces.length === 0) {
			logger.warn('No suitable network interface found for scanning');
			return [];
		}

		const primaryIface = ifaces[0];
		const ipParts = primaryIface.address.split('.');
		const networkCidr = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.0/24`;

		logger.info(`Scanning network: ${networkCidr}`);

		// Try to use simple ping scan without nmap
		logger.info('Using simple ping-based network discovery');

		// Only scan a limited range to avoid long scan times
		const scanRange = 20; // Limit to 20 addresses for quick scan

		// Create promises for all ping operations
		const pingPromises = [];

		for (let i = 1; i <= scanRange; i++) {
			const ip = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.${i}`;

			// Create a promise for each ping
			const pingPromise = new Promise((resolve) => {
				const pingProc = require('child_process').spawn(
					process.platform === 'win32' ? 'ping' : 'ping',
					process.platform === 'win32' ? ['-n', '1', '-w', '1000', ip] : ['-c', '1', '-W', '1', ip],
					{ stdio: ['ignore', 'pipe', 'ignore'] }
				);

				let output = '';

				pingProc.stdout.on('data', (data) => {
					output += data.toString();
				});

				pingProc.on('close', (code) => {
					if (code === 0) {
						// Success - host is alive
						resolve({
							ip,
							alive: true,
							output
						});
					} else {
						// Failure - host is not alive
						resolve({
							ip,
							alive: false,
							output
						});
					}
				});
			});

			pingPromises.push(pingPromise);
		}

		// Execute all pings concurrently
		const results = await Promise.all(pingPromises);
		const aliveHosts = results.filter(result => result.alive);

		// Create device entries for alive hosts
		for (const host of aliveHosts) {
			const device = {
				id: `local-${host.ip.replace(/\./g, '-')}`,
				name: host.ip,
				type: 'network-device',
				ip: {
					internal: host.ip
				},
				lastSeen: new Date().toISOString()
			};

			networkDevices.push(device);

			// Update asset inventory
			assetInventory.assets[device.id] = {
				...assetInventory.assets[device.id],
				...device
			};
		}

		logger.info(`Discovered ${networkDevices.length} network devices using simplified method`);

		// Also, try to get current machine's hostname and add it
		try {
			const hostname = os.hostname();
			const localIp = primaryIface.address;

			const localDevice = {
				id: `local-host-${hostname.replace(/\W/g, '-')}`,
				name: hostname,
				type: 'workstation',
				ip: {
					internal: localIp
				},
				platform: os.platform(),
				osType: os.type(),
				osRelease: os.release(),
				lastSeen: new Date().toISOString()
			};

			networkDevices.push(localDevice);

			// Update asset inventory
			assetInventory.assets[localDevice.id] = {
				...assetInventory.assets[localDevice.id],
				...localDevice
			};

			logger.info(`Added local machine: ${hostname} (${localIp})`);
		} catch (err) {
			logger.error('Error adding local machine:', err);
		}
	} catch (error) {
		logger.error('Error scanning local network:', error);
	}

	return networkDevices;
}

/**
 * Run the network endpoint discovery
 */
async function runDiscovery() {
	const startTime = Date.now();
	logger.info('Starting network endpoint discovery...');

	try {
		// Discover local machine
		const localMachine = await discoverLocalMachine();

		// Discover AWS resources
		const awsResources = await discoverAwsResources();

		// Scan local network
		const networkDevices = await scanLocalNetwork();

		// Calculate inactive assets (previously seen but not in this scan)
		const currentAssetIds = [
			localMachine.hostname,
			...awsResources.map(r => r.id),
			...networkDevices.map(d => d.id)
		];

		const allAssetIds = Object.keys(assetInventory.assets);
		const inactiveAssets = allAssetIds.filter(id => !currentAssetIds.includes(id));

		// Mark inactive assets
		inactiveAssets.forEach(id => {
			if (assetInventory.assets[id]) {
				assetInventory.assets[id].active = false;
				assetInventory.assets[id].lastActive = assetInventory.assets[id].lastSeen;
			}
		});

		// Update asset inventory metadata
		assetInventory.lastUpdated = new Date().toISOString();
		assetInventory.stats = {
			total: Object.keys(assetInventory.assets).length,
			active: currentAssetIds.length,
			inactive: inactiveAssets.length,
			byType: Object.values(assetInventory.assets).reduce((acc, asset) => {
				acc[asset.type] = (acc[asset.type] || 0) + 1;
				return acc;
			}, {})
		};

		// Save asset inventory to file
		fs.writeFileSync(
			assetInventoryPath,
			JSON.stringify(assetInventory, null, 2)
		);

		logger.info(`Discovery completed in ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
		logger.info(`Total assets: ${assetInventory.stats.total} (${assetInventory.stats.active} active, ${assetInventory.stats.inactive} inactive)`);

		// Output summary
		console.log('\nNetwork Endpoint Discovery Summary:');
		console.log('==================================');
		console.log(`Total assets: ${assetInventory.stats.total}`);
		console.log(`Active assets: ${assetInventory.stats.active}`);
		console.log(`Inactive assets: ${assetInventory.stats.inactive}`);
		console.log('\nAssets by type:');
		Object.entries(assetInventory.stats.byType).forEach(([type, count]) => {
			console.log(`  ${type}: ${count}`);
		});
		console.log(`\nInventory saved to: ${assetInventoryPath}`);
	} catch (error) {
		logger.error('Error in discovery process:', error);
	}
}

// Run the discovery
runDiscovery();

module.exports = {
	runDiscovery,
	discoverLocalMachine,
	discoverAwsResources,
	scanLocalNetwork,
	CONFIG
};