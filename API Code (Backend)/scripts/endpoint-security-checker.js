// scripts/endpoint-security-checker.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');
const logger = require('../src/utils/logger');

/**
 * Endpoint Security Checker
 * This script checks the security status of endpoints and reports issues
 */

// Configuration
const CONFIG = {
	outputDir: path.join(__dirname, '..', 'security-reports'),
	securityReportFile: 'endpoint-security-report.json',
	assetInventoryFile: 'network-assets.json',
	checkFirewall: true,
	checkAntivirus: true,
	checkUpdates: true,
	checkDiskEncryption: true
};

// Ensure output directory exists
if (!fs.existsSync(CONFIG.outputDir)) {
	fs.mkdirSync(CONFIG.outputDir, { recursive: true });
}

// Security report file path
const securityReportPath = path.join(CONFIG.outputDir, CONFIG.securityReportFile);
const assetInventoryPath = path.join(CONFIG.outputDir, CONFIG.assetInventoryFile);

// Load existing security report if available
let securityReport = {
	lastCheck: null,
	endpoints: {},
	summary: {
		total: 0,
		secure: 0,
		issues: 0
	}
};

if (fs.existsSync(securityReportPath)) {
	try {
		securityReport = JSON.parse(fs.readFileSync(securityReportPath, 'utf8'));
		logger.info(`Loaded existing security report with ${Object.keys(securityReport.endpoints).length} endpoints`);
	} catch (error) {
		logger.error('Error loading security report:', error);
		securityReport = { lastCheck: null, endpoints: {}, summary: { total: 0, secure: 0, issues: 0 } };
	}
}

/**
 * Check if antivirus is installed and running
 */
function checkAntivirus() {
	if (!CONFIG.checkAntivirus) {
		logger.info('Antivirus check is disabled');
		return { installed: 'unknown', running: 'unknown', details: 'Check disabled' };
	}

	logger.info('Checking antivirus status...');

	const platform = os.platform();

	if (platform === 'win32') {
		try {
			// Check Windows Defender status
			const defenderStatus = execSync('powershell -command "Get-MpComputerStatus | Select-Object -Property AntivirusEnabled, RealTimeProtectionEnabled"', { encoding: 'utf8' });

			const enabled = defenderStatus.includes('True');
			const realTimeEnabled = defenderStatus.includes('RealTimeProtectionEnabled : True');

			return {
				installed: true,
				running: realTimeEnabled,
				name: 'Windows Defender',
				details: defenderStatus.trim()
			};
		} catch (error) {
			logger.error('Error checking Windows antivirus:', error);

			// Try alternative method
			try {
				const securityCenter = execSync('powershell -command "Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntiVirusProduct | Format-List"', { encoding: 'utf8' });

				// Parse output to extract AV name and status
				const avName = securityCenter.match(/displayName\s+:\s+(.*)/);
				const productState = securityCenter.match(/productState\s+:\s+(.*)/);

				return {
					installed: true,
					running: true, // Assuming if we can detect it, it's running
					name: avName ? avName[1].trim() : 'Unknown Antivirus',
					details: 'Detected through Security Center'
				};
			} catch (altError) {
				logger.error('Error checking antivirus through alternative method:', altError);
				return { installed: 'unknown', running: 'unknown', details: 'Failed to detect' };
			}
		}
	} else if (platform === 'darwin') {
		// macOS
		try {
			// Check for common macOS AV solutions
			let avInstalled = false;
			let avName = '';

			// Check Sophos
			try {
				const sophosOutput = execSync('pkgutil --pkg-info com.sophos.sophos-antivirus', { encoding: 'utf8' });
				avInstalled = true;
				avName = 'Sophos Antivirus';
			} catch (e) {
				// Not installed, continue
			}

			// Check ClamAV
			if (!avInstalled) {
				try {
					const clamOutput = execSync('clamscan --version', { encoding: 'utf8' });
					avInstalled = true;
					avName = 'ClamAV';
				} catch (e) {
					// Not installed, continue
				}
			}

			// Check Avast
			if (!avInstalled) {
				const avast = fs.existsSync('/Applications/Avast.app');
				if (avast) {
					avInstalled = true;
					avName = 'Avast';
				}
			}

			// Check AVG
			if (!avInstalled) {
				const avg = fs.existsSync('/Applications/AVG AntiVirus.app');
				if (avg) {
					avInstalled = true;
					avName = 'AVG';
				}
			}

			return {
				installed: avInstalled,
				running: avInstalled, // Assume running if installed
				name: avName || 'macOS Built-in Security',
				details: 'macOS includes XProtect malware detection'
			};
		} catch (error) {
			logger.error('Error checking macOS antivirus:', error);
			return { installed: 'unknown', running: 'unknown', details: 'Failed to detect' };
		}
	} else if (platform === 'linux') {
		// Linux
		try {
			// Check for common Linux AV solutions
			let avInstalled = false;
			let avName = '';

			// Check ClamAV
			try {
				const clamOutput = execSync('clamscan --version', { encoding: 'utf8' });
				avInstalled = true;
				avName = 'ClamAV';

				// Check if clamd is running
				try {
					const clamdStatus = execSync('systemctl status clamav-daemon', { encoding: 'utf8' });
					const running = clamdStatus.includes('Active: active (running)');

					return {
						installed: true,
						running,
						name: 'ClamAV',
						details: running ? 'ClamAV daemon is running' : 'ClamAV is installed but daemon is not running'
					};
				} catch (e) {
					// Service not found or not running
					return {
						installed: true,
						running: false,
						name: 'ClamAV',
						details: 'ClamAV is installed but daemon is not running'
					};
				}
			} catch (e) {
				// Not installed, continue
			}

			// Check for other security solutions
			try {
				const installed = execSync('whereis rkhunter chkrootkit lynis', { encoding: 'utf8' });
				if (installed.includes('/')) {
					avInstalled = true;
					avName = 'Linux Security Tools';

					return {
						installed: true,
						running: true,
						name: 'Linux Security Tools',
						details: installed
					};
				}
			} catch (e) {
				// Not installed or error
			}

			return {
				installed: avInstalled,
				running: avInstalled,
				name: avName,
				details: avInstalled ? 'Linux security tools detected' : 'No specific antivirus detected'
			};
		} catch (error) {
			logger.error('Error checking Linux antivirus:', error);
			return { installed: 'unknown', running: 'unknown', details: 'Failed to detect' };
		}
	} else {
		logger.warn(`Unsupported platform for antivirus check: ${platform}`);
		return { installed: 'unknown', running: 'unknown', details: 'Unsupported platform' };
	}
}

/**
 * Check if firewall is enabled
 */
function checkFirewall() {
	if (!CONFIG.checkFirewall) {
		logger.info('Firewall check is disabled');
		return { enabled: 'unknown', details: 'Check disabled' };
	}

	logger.info('Checking firewall status...');

	const platform = os.platform();

	if (platform === 'win32') {
		try {
			// Check Windows firewall status
			const firewallStatus = execSync('powershell -command "Get-NetFirewallProfile | Select-Object -Property Name, Enabled"', { encoding: 'utf8' });

			const domainEnabled = firewallStatus.includes('Domain') && firewallStatus.includes('True');
			const privateEnabled = firewallStatus.includes('Private') && firewallStatus.includes('True');
			const publicEnabled = firewallStatus.includes('Public') && firewallStatus.includes('True');

			const enabled = domainEnabled || privateEnabled || publicEnabled;

			return {
				enabled,
				profiles: {
					domain: domainEnabled,
					private: privateEnabled,
					public: publicEnabled
				},
				details: firewallStatus.trim()
			};
		} catch (error) {
			logger.error('Error checking Windows firewall:', error);
			return { enabled: 'unknown', details: 'Failed to check' };
		}
	} else if (platform === 'darwin') {
		// macOS
		try {
			const firewallStatus = execSync('sudo defaults read /Library/Preferences/com.apple.alf globalstate', { encoding: 'utf8' });

			// 0 = disabled, 1 = enabled for specific services, 2 = enabled
			const enabled = firewallStatus.trim() !== '0';

			return {
				enabled,
				details: enabled ? 'macOS firewall is enabled' : 'macOS firewall is disabled'
			};
		} catch (error) {
			logger.error('Error checking macOS firewall:', error);

			// Try alternative method without sudo
			try {
				// This doesn't require sudo but might not work on all macOS versions
				const firewallStatus = execSync('/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate', { encoding: 'utf8' });

				const enabled = firewallStatus.includes('enabled');

				return {
					enabled,
					details: enabled ? 'macOS firewall is enabled' : 'macOS firewall is disabled'
				};
			} catch (altError) {
				logger.error('Error checking macOS firewall with alternative method:', altError);
				return { enabled: 'unknown', details: 'Failed to check' };
			}
		}
	} else if (platform === 'linux') {
		// Linux - check for various firewalls
		try {
			// Check for UFW status
			try {
				const ufwStatus = execSync('sudo ufw status', { encoding: 'utf8' });

				const enabled = ufwStatus.includes('Status: active');

				return {
					enabled,
					type: 'ufw',
					details: ufwStatus.trim()
				};
			} catch (ufwError) {
				// UFW not available or not running, try firewalld
				try {
					const firewallDStatus = execSync('sudo firewall-cmd --state', { encoding: 'utf8' });

					const enabled = firewallDStatus.trim() === 'running';

					return {
						enabled,
						type: 'firewalld',
						details: enabled ? 'firewalld is running' : 'firewalld is not running'
					};
				} catch (firewallDError) {
					// firewalld not available or not running, try iptables
					try {
						const iptablesStatus = execSync('sudo iptables -L', { encoding: 'utf8' });

						// If there are any rules, consider it enabled (simplistic check)
						const enabled = !iptablesStatus.includes('Chain INPUT (policy ACCEPT)') ||
							!iptablesStatus.includes('Chain FORWARD (policy ACCEPT)') ||
							!iptablesStatus.includes('Chain OUTPUT (policy ACCEPT)');

						return {
							enabled,
							type: 'iptables',
							details: enabled ? 'iptables has rules configured' : 'iptables has no rules configured'
						};
					} catch (iptablesError) {
						logger.error('Error checking iptables:', iptablesError);
						return { enabled: 'unknown', details: 'Failed to check firewall status' };
					}
				}
			}
		} catch (error) {
			logger.error('Error checking Linux firewall:', error);
			return { enabled: 'unknown', details: 'Failed to check' };
		}
	} else {
		logger.warn(`Unsupported platform for firewall check: ${platform}`);
		return { enabled: 'unknown', details: 'Unsupported platform' };
	}
}

/**
 * Check if system updates are installed
 */
function checkSystemUpdates() {
	if (!CONFIG.checkUpdates) {
		logger.info('System updates check is disabled');
		return { upToDate: 'unknown', details: 'Check disabled' };
	}

	logger.info('Checking system updates status...');

	const platform = os.platform();

	if (platform === 'win32') {
		try {
			// Check Windows updates
			const updatesResult = execSync('powershell -command "Get-HotFix | Sort-Object -Property InstalledOn -Descending | Select-Object -First 5 | Format-Table -Property HotFixID, Description, InstalledOn"', { encoding: 'utf8' });

			// Check for pending updates
			const pendingUpdates = execSync('powershell -command "Get-WindowsUpdate -MicrosoftUpdate -ErrorAction SilentlyContinue | Measure-Object | Select-Object -ExpandProperty Count"', { encoding: 'utf8' });

			const pendingCount = parseInt(pendingUpdates.trim(), 10);
			const upToDate = isNaN(pendingCount) ? 'unknown' : (pendingCount === 0);

			return {
				upToDate,
				pendingUpdates: isNaN(pendingCount) ? 'unknown' : pendingCount,
				lastUpdated: updatesResult.includes('InstalledOn') ? 'See details' : 'Unknown',
				details: updatesResult.trim()
			};
		} catch (error) {
			logger.error('Error checking Windows updates:', error);

			// Try alternative method
			try {
				const lastUpdateCheck = execSync('powershell -command "Get-WULastScanSuccessDate"', { encoding: 'utf8' });

				return {
					upToDate: 'unknown',
					lastUpdateCheck: lastUpdateCheck.trim(),
					details: 'Could not determine update status, but system has checked for updates'
				};
			} catch (altError) {
				logger.error('Error checking Windows updates with alternative method:', altError);
				return { upToDate: 'unknown', details: 'Failed to check' };
			}
		}
	} else if (platform === 'darwin') {
		// macOS
		try {
			// Check software update
			const updateStatus = execSync('softwareupdate -l', { encoding: 'utf8' });

			const upToDate = updateStatus.includes('No new software available');

			return {
				upToDate,
				details: upToDate ? 'System is up to date' : updateStatus.trim()
			};
		} catch (error) {
			logger.error('Error checking macOS updates:', error);
			return { upToDate: 'unknown', details: 'Failed to check' };
		}
	} else if (platform === 'linux') {
		// Linux - check based on package manager
		try {
			// Check for apt (Debian/Ubuntu)
			try {
				const aptUpdates = execSync('apt-get -s upgrade', { encoding: 'utf8' });

				const upToDate = aptUpdates.includes('0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.');

				return {
					upToDate,
					packageManager: 'apt',
					details: upToDate ? 'System is up to date' : 'Updates are available'
				};
			} catch (aptError) {
				// apt not available, try yum (RHEL/CentOS)
				try {
					const yumUpdates = execSync('yum check-update --quiet', { encoding: 'utf8' });

					// If no updates needed, yum exits with code 0 and no output
					const upToDate = !yumUpdates.trim();

					return {
						upToDate,
						packageManager: 'yum',
						details: upToDate ? 'System is up to date' : 'Updates are available'
					};
				} catch (yumError) {
					// yum not available, try dnf (Fedora)
					try {
						const dnfUpdates = execSync('dnf check-update --quiet', { encoding: 'utf8' });

						const upToDate = !dnfUpdates.trim();

						return {
							upToDate,
							packageManager: 'dnf',
							details: upToDate ? 'System is up to date' : 'Updates are available'
						};
					} catch (dnfError) {
						logger.error('Error checking Linux updates with dnf:', dnfError);
						return { upToDate: 'unknown', details: 'Failed to check using known package managers' };
					}
				}
			}
		} catch (error) {
			logger.error('Error checking Linux updates:', error);
			return { upToDate: 'unknown', details: 'Failed to check' };
		}
	} else {
		logger.warn(`Unsupported platform for updates check: ${platform}`);
		return { upToDate: 'unknown', details: 'Unsupported platform' };
	}
}

/**
 * Check if disk encryption is enabled
 */
function checkDiskEncryption() {
	if (!CONFIG.checkDiskEncryption) {
		logger.info('Disk encryption check is disabled');
		return { encrypted: 'unknown', details: 'Check disabled' };
	}

	logger.info('Checking disk encryption status...');

	const platform = os.platform();

	if (platform === 'win32') {
		try {
			// Check BitLocker status
			const bitlockerStatus = execSync('powershell -command "Get-BitLockerVolume"', { encoding: 'utf8' });

			const systemDriveEncrypted = bitlockerStatus.includes('C:') && bitlockerStatus.includes('FullyEncrypted');

			return {
				encrypted: systemDriveEncrypted,
				type: 'BitLocker',
				details: systemDriveEncrypted ? 'System drive is encrypted with BitLocker' : 'System drive is not encrypted with BitLocker'
			};
		} catch (error) {
			logger.error('Error checking BitLocker status:', error);

			// Try alternative method for BitLocker status
			try {
				const altStatus = execSync('powershell -command "Get-WmiObject -Namespace \'Root\\cimv2\\Security\\MicrosoftVolumeEncryption\' -Class \'Win32_EncryptableVolume\' -Filter \'DriveLetter = \"C:\"\' | Select-Object -ExpandProperty ProtectionStatus"', { encoding: 'utf8' });

				const encrypted = altStatus.trim() === '1';

				return {
					encrypted,
					type: 'BitLocker',
					details: encrypted ? 'System drive is encrypted with BitLocker' : 'System drive is not encrypted with BitLocker'
				};
			} catch (altError) {
				logger.error('Error checking BitLocker status with alternative method:', altError);
				return { encrypted: 'unknown', details: 'Failed to check' };
			}
		}
	} else if (platform === 'darwin') {
		// macOS - FileVault
		try {
			const filevaultStatus = execSync('fdesetup status', { encoding: 'utf8' });

			const encrypted = filevaultStatus.includes('FileVault is On');

			return {
				encrypted,
				type: 'FileVault',
				details: filevaultStatus.trim()
			};
		} catch (error) {
			logger.error('Error checking FileVault status:', error);
			return { encrypted: 'unknown', details: 'Failed to check' };
		}
	} else if (platform === 'linux') {
		// Linux - LUKS
		try {
			// Check if root partition is encrypted
			const cryptsetupStatus = execSync('lsblk -f', { encoding: 'utf8' });

			const encrypted = cryptsetupStatus.includes('crypto_LUKS') || cryptsetupStatus.includes('crypt');

			return {
				encrypted,
				type: 'LUKS',
				details: encrypted ? 'LUKS encryption detected on one or more partitions' : 'No LUKS encryption detected'
			};
		} catch (error) {
			logger.error('Error checking Linux encryption status:', error);
			return { encrypted: 'unknown', details: 'Failed to check' };
		}
	} else {
		logger.warn(`Unsupported platform for disk encryption check: ${platform}`);
		return { encrypted: 'unknown', details: 'Unsupported platform' };
	}
}

/**
 * Check security status of the current endpoint
 */
async function checkEndpointSecurity() {
	logger.info('Checking endpoint security status...');

	try {
		// Get endpoint information
		const hostname = os.hostname();
		const platform = os.platform();
		const arch = os.arch();
		const type = os.type();
		const release = os.release();

		// Check security components
		const antivirusStatus = checkAntivirus();
		const firewallStatus = checkFirewall();
		const updatesStatus = checkSystemUpdates();
		const encryptionStatus = checkDiskEncryption();

		// Determine overall security status
		const antivirusSecure = antivirusStatus.installed === true && antivirusStatus.running === true;
		const firewallSecure = firewallStatus.enabled === true;
		const updatesSecure = updatesStatus.upToDate === true;
		const encryptionSecure = encryptionStatus.encrypted === true;

		const securityIssues = [];

		if (!antivirusSecure && antivirusStatus.installed !== 'unknown') {
			securityIssues.push({
				component: 'antivirus',
				issue: antivirusStatus.installed ? 'Antivirus is installed but not running' : 'No antivirus software detected',
				severity: 'high',
				recommendation: 'Install and enable antivirus software'
			});
		}

		if (!firewallSecure && firewallStatus.enabled !== 'unknown') {
			securityIssues.push({
				component: 'firewall',
				issue: 'Firewall is disabled',
				severity: 'high',
				recommendation: 'Enable the system firewall'
			});
		}

		if (!updatesSecure && updatesStatus.upToDate !== 'unknown') {
			securityIssues.push({
				component: 'updates',
				issue: 'System is not up to date',
				severity: 'medium',
				recommendation: 'Install available system updates'
			});
		}

		if (!encryptionSecure && encryptionStatus.encrypted !== 'unknown') {
			securityIssues.push({
				component: 'encryption',
				issue: 'Disk encryption is not enabled',
				severity: 'medium',
				recommendation: `Enable ${platform === 'win32' ? 'BitLocker' : platform === 'darwin' ? 'FileVault' : 'LUKS'} disk encryption`
			});
		}

		// Create endpoint security report
		const endpointReport = {
			hostname,
			platform,
			arch,
			type,
			release,
			checkTime: new Date().toISOString(),
			securityComponents: {
				antivirus: antivirusStatus,
				firewall: firewallStatus,
				updates: updatesStatus,
				encryption: encryptionStatus
			},
			securityIssues,
			secureComponents: {
				antivirus: antivirusSecure,
				firewall: firewallSecure,
				updates: updatesSecure,
				encryption: encryptionSecure
			},
			overallSecure: antivirusSecure && firewallSecure && updatesSecure && encryptionSecure
		};

		// Update security report
		securityReport.endpoints[hostname] = endpointReport;
		securityReport.lastCheck = new Date().toISOString();

		// Update summary
		const endpoints = Object.values(securityReport.endpoints);
		securityReport.summary = {
			total: endpoints.length,
			secure: endpoints.filter(e => e.overallSecure).length,
			issues: endpoints.reduce((total, endpoint) => total + endpoint.securityIssues.length, 0),
			componentStatus: {
				antivirus: {
					secure: endpoints.filter(e => e.secureComponents.antivirus).length,
					issues: endpoints.filter(e => !e.secureComponents.antivirus && e.securityComponents.antivirus.installed !== 'unknown').length
				},
				firewall: {
					secure: endpoints.filter(e => e.secureComponents.firewall).length,
					issues: endpoints.filter(e => !e.secureComponents.firewall && e.securityComponents.firewall.enabled !== 'unknown').length
				},
				updates: {
					secure: endpoints.filter(e => e.secureComponents.updates).length,
					issues: endpoints.filter(e => !e.secureComponents.updates && e.securityComponents.updates.upToDate !== 'unknown').length
				},
				encryption: {
					secure: endpoints.filter(e => e.secureComponents.encryption).length,
					issues: endpoints.filter(e => !e.secureComponents.encryption && e.securityComponents.encryption.encrypted !== 'unknown').length
				}
			}
		};

		// Save security report to file
		fs.writeFileSync(
			securityReportPath,
			JSON.stringify(securityReport, null, 2)
		);

		logger.info('Endpoint security check completed');
		logger.info(`Security issues found: ${endpointReport.securityIssues.length}`);

		// Output summary
		console.log('\nEndpoint Security Check Summary:');
		console.log('================================');
		console.log(`Hostname: ${hostname}`);
		console.log(`Platform: ${platform} ${arch}`);
		console.log('\nSecurity Components:');
		console.log(`  Antivirus: ${antivirusStatus.installed === true ? 'Installed' : antivirusStatus.installed === false ? 'Not Installed' : 'Unknown'} ${antivirusStatus.running === true ? '(Running)' : antivirusStatus.running === false ? '(Not Running)' : ''}`);
		console.log(`  Firewall: ${firewallStatus.enabled === true ? 'Enabled' : firewallStatus.enabled === false ? 'Disabled' : 'Unknown'}`);
		console.log(`  System Updates: ${updatesStatus.upToDate === true ? 'Up to Date' : updatesStatus.upToDate === false ? 'Updates Available' : 'Unknown'}`);
		console.log(`  Disk Encryption: ${encryptionStatus.encrypted === true ? 'Enabled' : encryptionStatus.encrypted === false ? 'Disabled' : 'Unknown'}`);

		console.log('\nIssues Found:');
		if (endpointReport.securityIssues.length === 0) {
			console.log('  No security issues found!');
		} else {
			endpointReport.securityIssues.forEach((issue, i) => {
				console.log(`  ${i + 1}. ${issue.issue} (${issue.severity}) - ${issue.recommendation}`);
			});
		}

		console.log(`\nReport saved to: ${securityReportPath}`);

		return endpointReport;
	} catch (error) {
		logger.error('Error checking endpoint security:', error);
	}
}

// Run the endpoint security check
checkEndpointSecurity();

module.exports = {
	checkEndpointSecurity,
	checkAntivirus,
	checkFirewall,
	checkSystemUpdates,
	checkDiskEncryption,
	CONFIG
};