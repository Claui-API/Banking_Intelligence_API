// scripts/implement-2fa-frontend.js
const fs = require('fs');
const path = require('path');
const logger = require('../src/utils/logger');

/**
 * Specialized script to add 2FA support to the frontend Auth service
 */

// Configuration
const CONFIG = {
	frontendAuthService: path.join(__dirname, '..', '..', 'API UI (Frontend)', 'src', 'services', 'auth.js'),
	backupDir: path.join(__dirname, '..', 'backups', `2fa-frontend-${Date.now()}`),
	dryRun: false // Set to true for testing without making changes
};

// Ensure backup directory exists
if (!CONFIG.dryRun) {
	fs.mkdirSync(CONFIG.backupDir, { recursive: true });
}

/**
 * Backup a file before modifying it
 */
function backupFile(filePath) {
	if (CONFIG.dryRun) return;

	try {
		const fileName = path.basename(filePath);
		const backupPath = path.join(CONFIG.backupDir, fileName);

		fs.copyFileSync(filePath, backupPath);
		logger.info(`Backed up ${fileName} to ${backupPath}`);
	} catch (error) {
		logger.error(`Error backing up file ${filePath}:`, error);
	}
}

/**
 * Add 2FA support to the frontend Auth service
 */
async function addFrontend2FASupport() {
	const filePath = CONFIG.frontendAuthService;

	if (!fs.existsSync(filePath)) {
		logger.error(`Frontend Auth service file not found: ${filePath}`);
		return false;
	}

	logger.info(`Adding 2FA support to frontend Auth service: ${filePath}`);

	try {
		// Backup file
		backupFile(filePath);

		// Read file content
		let content = fs.readFileSync(filePath, 'utf8');

		// Check if 2FA methods already exist
		if (content.includes('verify2FA') || content.includes('generateSecret')) {
			logger.info('2FA methods already exist in frontend Auth service');
			return true;
		}

		// Determine where to add 2FA methods
		const authServiceEnd = content.match(/export (default|const) authService;?\s*$/);
		const exportDefault = content.match(/export default authService;?\s*$/);

		if (!authServiceEnd && !exportDefault) {
			logger.error('Could not find export statement in Auth service');
			return false;
		}

		// Add 2FA methods to the authService object
		const authServiceMatch = content.match(/export const authService = {[^]*?(};?\s*$)/m);

		if (!authServiceMatch) {
			logger.error('Could not find authService object definition');
			return false;
		}

		const serviceEnd = authServiceMatch[1];
		const newMethods = `,

  // Generate 2FA secret
  generate2FASecret: async () => {
    try {
      const response = await api.post('/auth/generate-2fa');
      
      if (response.data && response.data.success) {
        logger.info('2FA secret generated');
        return response.data.data;
      }
      
      throw new Error(response.data?.message || 'Failed to generate 2FA secret');
    } catch (error) {
      logger.logError('2FA Secret Generation Failed', error);
      
      if (error.response) {
        const errorMessage = error.response.data?.message || 'Failed to generate 2FA secret';
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('No response from server. Please check your network connection.');
      } else {
        throw new Error('Error setting up 2FA secret generation request');
      }
    }
  },
  
  // Enable 2FA
  enable2FA: async (secret, token) => {
    try {
      const response = await api.post('/auth/enable-2fa', { 
        secret, 
        token 
      });
      
      if (response.data && response.data.success) {
        logger.info('2FA enabled successfully');
        return response.data.data;
      }
      
      throw new Error(response.data?.message || 'Failed to enable 2FA');
    } catch (error) {
      logger.logError('2FA Enablement Failed', error);
      
      if (error.response) {
        const errorMessage = error.response.data?.message || 'Failed to enable 2FA';
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('No response from server. Please check your network connection.');
      } else {
        throw new Error('Error setting up 2FA enablement request');
      }
    }
  },
  
  // Disable 2FA
  disable2FA: async (token) => {
    try {
      const response = await api.post('/auth/disable-2fa', { token });
      
      if (response.data && response.data.success) {
        logger.info('2FA disabled successfully');
        return true;
      }
      
      throw new Error(response.data?.message || 'Failed to disable 2FA');
    } catch (error) {
      logger.logError('2FA Disablement Failed', error);
      
      if (error.response) {
        const errorMessage = error.response.data?.message || 'Failed to disable 2FA';
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('No response from server. Please check your network connection.');
      } else {
        throw new Error('Error setting up 2FA disablement request');
      }
    }
  },
  
  // Verify 2FA during login
  verify2FA: async (userId, token) => {
    try {
      const response = await api.post('/auth/verify-2fa', { 
        userId, 
        token 
      });
      
      if (response.data && response.data.success) {
        // Store tokens
        localStorage.setItem('token', response.data.data.accessToken);
        if (response.data.data.refreshToken) {
          localStorage.setItem('refreshToken', response.data.data.refreshToken);
        }
        
        logger.info('2FA verification successful');
        return response.data.data;
      }
      
      throw new Error(response.data?.message || 'Failed to verify 2FA token');
    } catch (error) {
      logger.logError('2FA Verification Failed', error);
      
      if (error.response) {
        const errorMessage = error.response.data?.message || 'Failed to verify 2FA token';
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('No response from server. Please check your network connection.');
      } else {
        throw new Error('Error setting up 2FA verification request');
      }
    }
  },
  
  // Verify 2FA with backup code
  verifyBackupCode: async (userId, backupCode) => {
    try {
      const response = await api.post('/auth/verify-2fa', { 
        userId, 
        backupCode 
      });
      
      if (response.data && response.data.success) {
        // Store tokens
        localStorage.setItem('token', response.data.data.accessToken);
        if (response.data.data.refreshToken) {
          localStorage.setItem('refreshToken', response.data.data.refreshToken);
        }
        
        logger.info('Backup code verification successful');
        return response.data.data;
      }
      
      throw new Error(response.data?.message || 'Failed to verify backup code');
    } catch (error) {
      logger.logError('Backup Code Verification Failed', error);
      
      if (error.response) {
        const errorMessage = error.response.data?.message || 'Failed to verify backup code';
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('No response from server. Please check your network connection.');
      } else {
        throw new Error('Error setting up backup code verification request');
      }
    }
  }`;

		// Replace the end of the authService object
		content = content.replace(serviceEnd, newMethods + serviceEnd);

		// Update login method to handle 2FA
		const loginMethod = content.match(/login\s*:\s*async\s*\(([^)]*)\)\s*=>\s*{[^}]*}/);

		if (loginMethod) {
			const originalLoginMethod = loginMethod[0];

			// Extract return statement from login method
			const returnMatch = originalLoginMethod.match(/return\s+([^;]+);/);

			if (returnMatch) {
				const updatedLoginMethod = originalLoginMethod.replace(
					returnMatch[0],
					`// Check for 2FA requirement
      if (data.requireTwoFactor) {
        logger.info('2FA verification required');
        return {
          requireTwoFactor: true,
          userId: data.userId,
          email: data.email,
          clientId: data.clientId
        };
      }
      
      ${returnMatch[0]}`
				);

				content = content.replace(originalLoginMethod, updatedLoginMethod);
			}
		}

		// Write the updated content
		if (!CONFIG.dryRun) {
			fs.writeFileSync(filePath, content);
			logger.info('Added 2FA support to frontend Auth service');
		} else {
			logger.info('Dry run: Would add 2FA support to frontend Auth service');
		}

		return true;
	} catch (error) {
		logger.error('Error adding 2FA support to frontend Auth service:', error);
		return false;
	}
}

/**
 * Add 2FA components to the frontend UI
 */
async function addFrontend2FAComponents() {
	const frontendDir = path.join(__dirname, '..', '..', 'API UI (Frontend)');
	const componentsDir = path.join(frontendDir, 'src', 'components', 'Auth');

	if (!fs.existsSync(componentsDir)) {
		logger.warn(`Auth components directory not found: ${componentsDir}`);

		// Try to create it
		try {
			fs.mkdirSync(componentsDir, { recursive: true });
		} catch (error) {
			logger.error(`Error creating Auth components directory:`, error);
			return false;
		}
	}

	// Create 2FA components
	try {
		// Create TwoFactorSetup component
		const twoFactorSetupPath = path.join(componentsDir, 'TwoFactorSetup.js');

		if (!fs.existsSync(twoFactorSetupPath)) {
			const twoFactorSetupContent = `// src/components/Auth/TwoFactorSetup.js
import React, { useState, useEffect } from 'react';
import { Card, Form, Button, Alert, Spinner, InputGroup } from 'react-bootstrap';
import { authService } from '../../services/auth';

const TwoFactorSetup = ({ onComplete }) => {
  const [secret, setSecret] = useState(null);
  const [qrCode, setQrCode] = useState('');
  const [token, setToken] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('generate'); // generate, verify, complete
  
  // Generate 2FA secret on component mount
  useEffect(() => {
    const generateSecret = async () => {
      try {
        setLoading(true);
        const response = await authService.generate2FASecret();
        
        setSecret(response.secret);
        setQrCode(response.qrCodeUrl);
      } catch (err) {
        setError(err.message || 'Failed to generate 2FA secret');
      } finally {
        setLoading(false);
      }
    };
    
    generateSecret();
  }, []);
  
  // Handle token verification and 2FA enablement
  const handleVerify = async (e) => {
    e.preventDefault();
    
    if (!token.trim()) {
      setError('Please enter the verification code');
      return;
    }
    
    try {
      setVerifying(true);
      setError('');
      
      const result = await authService.enable2FA(secret, token);
      
      // Save backup codes
      setBackupCodes(result.backupCodes || []);
      
      // Move to completion step
      setStep('complete');
    } catch (err) {
      setError(err.message || 'Failed to verify token');
    } finally {
      setVerifying(false);
    }
  };
  
  // Handle completion
  const handleComplete = () => {
    if (typeof onComplete === 'function') {
      onComplete();
    }
  };
  
  // Render setup steps
  const renderStep = () => {
    switch (step) {
      case 'generate':
        return (
          <>
            <Card.Title className="mb-4">Set Up Two-Factor Authentication</Card.Title>
            
            {error && (
              <Alert variant="danger" className="mb-4">
                {error}
              </Alert>
            )}
            
            {loading ? (
              <div className="text-center py-5">
                <Spinner animation="border" variant="primary" />
                <p className="mt-3">Generating your 2FA secret...</p>
              </div>
            ) : (
              <>
                <p>
                  Scan this QR code with your authenticator app (like Google Authenticator, 
                  Microsoft Authenticator, or Authy) to set up two-factor authentication.
                </p>
                
                <div className="qr-container text-center mb-4">
                  <img 
                    src={qrCode} 
                    alt="2FA QR Code" 
                    className="img-fluid border rounded" 
                    style={{ maxWidth: '200px' }}
                  />
                </div>
                
                <Alert variant="info" className="mb-4">
                  <strong>Manual Setup:</strong> If you can't scan the QR code, enter this 
                  secret key manually: <code className="mx-1">{secret}</code>
                </Alert>
                
                <Form onSubmit={handleVerify}>
                  <Form.Group className="mb-3">
                    <Form.Label>Verification Code</Form.Label>
                    <InputGroup>
                      <Form.Control
                        type="text"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="Enter the 6-digit code"
                        required
                      />
                      <Button 
                        type="submit" 
                        variant="primary"
                        disabled={verifying || !token.trim()}
                      >
                        {verifying ? (
                          <>
                            <Spinner animation="border" size="sm" className="me-2" />
                            Verifying...
                          </>
                        ) : 'Verify & Enable'}
                      </Button>
                    </InputGroup>
                    <Form.Text className="text-muted">
                      Enter the verification code from your authenticator app
                    </Form.Text>
                  </Form.Group>
                </Form>
              </>
            )}
          </>
        );
        
      case 'complete':
        return (
          <>
            <Card.Title className="mb-3 text-success">
              <i className="bi bi-shield-check me-2"></i>
              Two-Factor Authentication Enabled
            </Card.Title>
            
            <Alert variant="success" className="mb-4">
              <p className="mb-0">
                <strong>Success!</strong> Your account is now protected with two-factor authentication.
              </p>
            </Alert>
            
            <div className="mb-4">
              <h5>Your Backup Codes</h5>
              <p className="text-muted small">
                Save these backup codes in a secure place. You can use them to sign in if you lose access 
                to your authenticator app. Each code can only be used once.
              </p>
              
              <div className="backup-codes bg-light p-3 rounded mb-3">
                <div className="row">
                  {backupCodes.map((code, index) => (
                    <div className="col-6 mb-2" key={index}>
                      <code>{code}</code>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="d-flex justify-content-between">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => {
                    const text = backupCodes.join('\\n');
                    navigator.clipboard.writeText(text);
                  }}
                >
                  <i className="bi bi-clipboard me-1"></i>
                  Copy Codes
                </Button>
                
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={() => {
                    const element = document.createElement("a");
                    const file = new Blob([backupCodes.join('\\n')], {type: 'text/plain'});
                    element.href = URL.createObjectURL(file);
                    element.download = "2fa-backup-codes.txt";
                    document.body.appendChild(element);
                    element.click();
                  }}
                >
                  <i className="bi bi-download me-1"></i>
                  Download Codes
                </Button>
              </div>
            </div>
            
            <div className="text-center mt-4">
              <Button 
                variant="primary" 
                onClick={handleComplete}
              >
                Continue
              </Button>
            </div>
          </>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <Card>
      <Card.Body className="p-4">
        {renderStep()}
      </Card.Body>
    </Card>
  );
};

export default TwoFactorSetup;
`;

			if (!CONFIG.dryRun) {
				fs.writeFileSync(twoFactorSetupPath, twoFactorSetupContent);
				logger.info(`Created TwoFactorSetup component at ${twoFactorSetupPath}`);
			} else {
				logger.info(`Dry run: Would create TwoFactorSetup component at ${twoFactorSetupPath}`);
			}
		}

		// Create TwoFactorLogin component
		const twoFactorLoginPath = path.join(componentsDir, 'TwoFactorLogin.js');

		if (!fs.existsSync(twoFactorLoginPath)) {
			const twoFactorLoginContent = `// src/components/Auth/TwoFactorLogin.js
import React, { useState } from 'react';
import { Card, Form, Button, Alert, Spinner, InputGroup, Tabs, Tab } from 'react-bootstrap';
import { authService } from '../../services/auth';

const TwoFactorLogin = ({ userId, email, onSuccess, onCancel }) => {
  const [token, setToken] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('token');
  
  // Handle token verification
  const handleVerifyToken = async (e) => {
    e.preventDefault();
    
    if (!token.trim()) {
      setError('Please enter the verification code');
      return;
    }
    
    try {
      setVerifying(true);
      setError('');
      
      const result = await authService.verify2FA(userId, token);
      
      if (typeof onSuccess === 'function') {
        onSuccess(result);
      }
    } catch (err) {
      setError(err.message || 'Failed to verify token');
      setVerifying(false);
    }
  };
  
  // Handle backup code verification
  const handleVerifyBackupCode = async (e) => {
    e.preventDefault();
    
    if (!backupCode.trim()) {
      setError('Please enter a backup code');
      return;
    }
    
    try {
      setVerifying(true);
      setError('');
      
      const result = await authService.verifyBackupCode(userId, backupCode);
      
      if (typeof onSuccess === 'function') {
        onSuccess(result);
      }
    } catch (err) {
      setError(err.message || 'Failed to verify backup code');
      setVerifying(false);
    }
  };
  
  return (
    <Card>
      <Card.Body className="p-4">
        <Card.Title className="mb-4">Two-Factor Authentication</Card.Title>
        
        {error && (
          <Alert variant="danger" className="mb-4">
            {error}
          </Alert>
        )}
        
        <div className="mb-3">
          <div className="text-muted small mb-3">
            Verifying for account: <strong>{email}</strong>
          </div>
        </div>
        
        <Tabs
          activeKey={activeTab}
          onSelect={setActiveTab}
          className="mb-3"
        >
          <Tab eventKey="token" title="Authentication Code">
            <Form onSubmit={handleVerifyToken} className="mt-3">
              <p>
                Open your authenticator app and enter the 6-digit code for this account.
              </p>
              
              <Form.Group className="mb-3">
                <Form.Label>Authentication Code</Form.Label>
                <InputGroup>
                  <Form.Control
                    type="text"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Enter 6-digit code"
                    disabled={verifying}
                    autoComplete="one-time-code"
                    maxLength={6}
                  />
                </InputGroup>
              </Form.Group>
              
              <div className="d-grid">
                <Button 
                  type="submit" 
                  variant="primary"
                  disabled={verifying || !token.trim()}
                >
                  {verifying ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Verifying...
                    </>
                  ) : 'Verify Code'}
                </Button>
              </div>
            </Form>
          </Tab>
          
          <Tab eventKey="backup" title="Backup Code">
            <Form onSubmit={handleVerifyBackupCode} className="mt-3">
              <p>
                If you can't access your authenticator app, enter one of your backup codes.
              </p>
              
              <Form.Group className="mb-3">
                <Form.Label>Backup Code</Form.Label>
                <InputGroup>
                  <Form.Control
                    type="text"
                    value={backupCode}
                    onChange={(e) => setBackupCode(e.target.value)}
                    placeholder="Enter backup code"
                    disabled={verifying}
                  />
                </InputGroup>
              </Form.Group>
              
              <div className="d-grid">
                <Button 
                  type="submit" 
                  variant="primary"
                  disabled={verifying || !backupCode.trim()}
                >
                  {verifying ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Verifying...
                    </>
                  ) : 'Use Backup Code'}
                </Button>
              </div>
            </Form>
          </Tab>
        </Tabs>
        
        <div className="text-center mt-4">
          <Button 
            variant="link" 
            className="text-muted" 
            onClick={onCancel}
            disabled={verifying}
          >
            Cancel
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
};

export default TwoFactorLogin;
`;

			if (!CONFIG.dryRun) {
				fs.writeFileSync(twoFactorLoginPath, twoFactorLoginContent);
				logger.info(`Created TwoFactorLogin component at ${twoFactorLoginPath}`);
			} else {
				logger.info(`Dry run: Would create TwoFactorLogin component at ${twoFactorLoginPath}`);
			}
		}

		// Modify Login component to support 2FA if it exists
		const loginComponentPath = path.join(componentsDir, 'Login.js');

		if (fs.existsSync(loginComponentPath)) {
			// Backup the file
			backupFile(loginComponentPath);

			let loginContent = fs.readFileSync(loginComponentPath, 'utf8');

			// Check if 2FA is already implemented
			if (!loginContent.includes('TwoFactorLogin') && !loginContent.includes('requireTwoFactor')) {
				logger.info(`Adding 2FA support to Login component`);

				// Add import statement
				const importStatements = loginContent.match(/import.*?\n/g) || [];
				const lastImport = importStatements[importStatements.length - 1];

				if (lastImport) {
					const twoFactorImport = `import TwoFactorLogin from './TwoFactorLogin';\n`;
					loginContent = loginContent.replace(lastImport, lastImport + twoFactorImport);
				}

				// Add 2FA state
				const stateStatements = loginContent.match(/const \[[a-zA-Z]+, set[a-zA-Z]+\] = useState\([^)]*\);/g) || [];
				const lastState = stateStatements[stateStatements.length - 1];

				if (lastState) {
					const twoFactorState = `  const [requireTwoFactor, setRequireTwoFactor] = useState(false);\n  const [twoFactorData, setTwoFactorData] = useState(null);\n`;
					loginContent = loginContent.replace(lastState, lastState + twoFactorState);
				}

				// Add 2FA handling to handleSubmit
				const handleSubmitFunction = loginContent.match(/const handleSubmit = async \(e\) => {[^}]*}/);

				if (handleSubmitFunction) {
					const originalFunction = handleSubmitFunction[0];

					// Look for successful login handling
					const successHandler = originalFunction.match(/const loginResult = await login\([^)]*\);.*?navigate\(['"]\//s);

					if (successHandler) {
						const original = successHandler[0];
						const modified = original.replace(
							/const loginResult = await login\(([^)]*)\);/,
							`const loginResult = await login($1);
            
      // Check if 2FA is required
      if (loginResult.requireTwoFactor) {
        setTwoFactorData({
          userId: loginResult.userId,
          email: loginResult.email
        });
        setRequireTwoFactor(true);
        return;
      }`
						);

						loginContent = loginContent.replace(original, modified);
					}
				}

				// Add 2FA completion handler
				const closingBrace = loginContent.match(/};(\s*)(export default Login;)/);

				if (closingBrace) {
					const twoFactorHandler = `
  /**
   * Handle successful 2FA verification
   */
  const handleTwoFactorSuccess = (authResult) => {
    setLoading(false);
    setRequireTwoFactor(false);
    
    // Store the token and navigate to dashboard
    localStorage.setItem('token', authResult.accessToken);
    if (authResult.refreshToken) {
      localStorage.setItem('refreshToken', authResult.refreshToken);
    }
    
    navigate('/dashboard');
  };

  /**
   * Cancel 2FA verification and go back to login form
   */
  const handleTwoFactorCancel = () => {
    setRequireTwoFactor(false);
    setTwoFactorData(null);
  };
`;

					loginContent = loginContent.replace(
						closingBrace[0],
						twoFactorHandler + '};\n\n' + closingBrace[2]
					);
				}

				// Add conditional rendering for 2FA
				const returnJSX = loginContent.match(/return \([^]*?<\/Container>\s*\);/s);

				if (returnJSX) {
					const originalReturn = returnJSX[0];

					const modifiedReturn = `return (
    <>
      {requireTwoFactor ? (
        <Container className="d-flex justify-content-center align-items-center vh-100">
          <div style={{ maxWidth: '500px', width: '100%' }}>
            <TwoFactorLogin
              userId={twoFactorData.userId}
              email={twoFactorData.email}
              onSuccess={handleTwoFactorSuccess}
              onCancel={handleTwoFactorCancel}
            />
          </div>
        </Container>
      ) : (${originalReturn.substring(originalReturn.indexOf('(') + 1, originalReturn.lastIndexOf(')'))}
      )}
    </>
  );`;

					loginContent = loginContent.replace(originalReturn, modifiedReturn);
				}

				// Save changes
				if (!CONFIG.dryRun) {
					fs.writeFileSync(loginComponentPath, loginContent);
					logger.info(`Updated Login component with 2FA support`);
				} else {
					logger.info(`Dry run: Would update Login component with 2FA support`);
				}
			} else {
				logger.info(`Login component already has 2FA support`);
			}
		} else {
			logger.warn(`Login component not found at ${loginComponentPath}`);
		}

		return true;
	} catch (error) {
		logger.error(`Error adding 2FA components to frontend:`, error);
		return false;
	}
}

/**
 * Run the implementation
 */
async function runImplementation() {
	console.log('Starting frontend 2FA implementation...');

	// Add 2FA methods to frontend Auth service
	const authServiceResult = await addFrontend2FASupport();

	// Add 2FA components to frontend
	const componentsResult = await addFrontend2FAComponents();

	console.log('\n2FA Frontend Implementation Summary:');
	console.log('==================================');
	console.log(`Auth Service: ${authServiceResult ? '✅ Updated' : '❌ Failed'}`);
	console.log(`UI Components: ${componentsResult ? '✅ Added' : '❌ Failed'}`);
	console.log('\nNext steps:');
	console.log('1. Make sure you have implemented the 2FA backend endpoints');
	console.log('2. Install required frontend dependencies: npm install qrcode');
	console.log('3. Test the 2FA flow in your application');
}

// Run the implementation
runImplementation();