# Financial Intelligence API Documentation

This documentation provides details on how to integrate the Financial Intelligence API into your mobile applications. The API allows you to access financial insights, account information, transaction data, and more.

## Table of Contents

1. [Authentication](#authentication)
2. [Base URL](#base-url)
3. [API Endpoints](#api-endpoints)
   - [Authentication](#authentication-endpoints)
   - [Insights](#insights-endpoints)
   - [Accounts & Transactions](#accounts--transactions-endpoints)
   - [Plaid Integration](#plaid-integration-endpoints)
   - [Mobile-Specific](#mobile-specific-endpoints)
   - [Notifications](#notifications-endpoints)
   - [Sync](#sync-endpoints)
4. [Error Handling](#error-handling)
5. [Mobile Optimization](#mobile-optimization)
6. [Sample Code](#sample-code)

## Authentication

All API requests (except for registration and login) require authentication using JWT tokens. 

1. Register your client application to obtain credentials
2. Authenticate with these credentials to obtain a JWT token
3. Include the token in the Authorization header for all subsequent requests

```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

## Base URL

```
https://api.financial-intelligence.com
```

For development and testing:
```
http://localhost:3000
```

## API Endpoints

### Authentication Endpoints

#### Register Client Application

```
POST /api/auth/register
```

**Request Body:**
```json
{
  "clientName": "Your App Name",
  "description": "Description of your application"
}

### Handling Sync (JavaScript)

```javascript
// Download sync package for offline use
async function downloadSyncPackage(lastSyncTimestamp) {
  const token = localStorage.getItem('accessToken');
  
  let url = 'https://api.financial-intelligence.com/api/v1/sync/package';
  
  // Add timestamp for delta sync if available
  if (lastSyncTimestamp) {
    url += `?lastSyncTimestamp=${encodeURIComponent(lastSyncTimestamp)}`;
  }
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  
  if (data.success) {
    // Store sync data locally
    localStorage.setItem('syncData', JSON.stringify(data.data));
    localStorage.setItem('lastSyncTimestamp', data.data.timestamp);
    localStorage.setItem('syncId', data.data.syncId);
    return data.data;
  } else {
    throw new Error(data.message);
  }
}

// Upload local changes when back online
async function uploadSyncChanges(changes) {
  const token = localStorage.getItem('accessToken');
  const syncId = localStorage.getItem('syncId');
  
  const response = await fetch('https://api.financial-intelligence.com/api/v1/sync/changes', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      syncId,
      changes
    })
  });
  
  const data = await response.json();
  
  if (data.success) {
    return data.data;
  } else {
    throw new Error(data.message);
  }
}
```

### Registering for Push Notifications (JavaScript)

```javascript
async function registerDeviceForNotifications(deviceToken, platform) {
  const token = localStorage.getItem('accessToken');
  
  const response = await fetch('https://api.financial-intelligence.com/api/v1/notifications/register-device', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      token: deviceToken,
      platform: platform, // 'ios', 'android', or 'web'
      deviceInfo: {
        model: 'iPhone 16 Pro',
        osVersion: 'iOS 18.2',
        appVersion: '1.2.0'
      }
    })
  });
  
  const data = await response.json();
  
  if (data.success) {
    return data.data;
  } else {
    throw new Error(data.message);
  }
}
```

### Swift (iOS) Example

```swift
// Authentication
func login(clientId: String, clientSecret: String, completion: @escaping (Result<AuthResponse, Error>) -> Void) {
    let url = URL(string: "https://api.financial-intelligence.com/api/auth/login")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.addValue("application/json", forHTTPHeaderField: "Content-Type")
    
    let body: [String: Any] = [
        "clientId": clientId,
        "clientSecret": clientSecret
    ]
    
    request.httpBody = try? JSONSerialization.data(withJSONObject: body)
    
    URLSession.shared.dataTask(with: request) { data, response, error in
        if let error = error {
            completion(.failure(error))
            return
        }
        
        guard let data = data else {
            completion(.failure(NSError(domain: "NoData", code: 0)))
            return
        }
        
        do {
            let decoder = JSONDecoder()
            let response = try decoder.decode(AuthResponse.self, from: data)
            
            // Store tokens securely
            KeychainService.save(key: "accessToken", data: response.data.accessToken)
            KeychainService.save(key: "refreshToken", data: response.data.refreshToken)
            
            completion(.success(response))
        } catch {
            completion(.failure(error))
        }
    }.resume()
}

// Financial Summary
func getFinancialSummary(completion: @escaping (Result<FinancialSummary, Error>) -> Void) {
    guard let token = KeychainService.load(key: "accessToken") else {
        completion(.failure(NSError(domain: "NoToken", code: 401)))
        return
    }
    
    let url = URL(string: "https://api.financial-intelligence.com/api/insights/summary")!
    var request = URLRequest(url: url)
    request.httpMethod = "GET"
    request.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    request.addValue("application/json", forHTTPHeaderField: "Content-Type")
    
    // Add battery optimization if needed
    if UIDevice.current.batteryLevel < 0.2 {
        request.addValue("low", forHTTPHeaderField: "x-battery-status")
    }
    
    URLSession.shared.dataTask(with: request) { data, response, error in
        if let error = error {
            completion(.failure(error))
            return
        }
        
        guard let data = data else {
            completion(.failure(NSError(domain: "NoData", code: 0)))
            return
        }
        
        do {
            let decoder = JSONDecoder()
            let response = try decoder.decode(FinancialSummaryResponse.self, from: data)
            completion(.success(response.data))
        } catch {
            completion(.failure(error))
        }
    }.resume()
}
```

### Kotlin (Android) Example

```kotlin
// Authentication
fun login(clientId: String, clientSecret: String, callback: (Result<AuthResponse>) -> Unit) {
    val url = "https://api.financial-intelligence.com/api/auth/login"
    val json = JSONObject().apply {
        put("clientId", clientId)
        put("clientSecret", clientSecret)
    }
    
    val request = Request.Builder()
        .url(url)
        .post(json.toString().toRequestBody("application/json".toMediaType()))
        .build()
    
    OkHttpClient().newCall(request).enqueue(object : Callback {
        override fun onFailure(call: Call, e: IOException) {
            callback(Result.failure(e))
        }
        
        override fun onResponse(call: Call, response: Response) {
            val responseBody = response.body?.string()
            if (responseBody != null) {
                try {
                    val authResponse = Gson().fromJson(responseBody, AuthResponse::class.java)
                    
                    // Store tokens securely
                    securePreferences.edit()
                        .putString("accessToken", authResponse.data.accessToken)
                        .putString("refreshToken", authResponse.data.refreshToken)
                        .apply()
                    
                    callback(Result.success(authResponse))
                } catch (e: Exception) {
                    callback(Result.failure(e))
                }
            } else {
                callback(Result.failure(IOException("Empty response")))
            }
        }
    })
}

// Mobile-Optimized Financial Snapshot
fun getFinancialSnapshot(callback: (Result<FinancialSnapshot>) -> Unit) {
    val token = securePreferences.getString("accessToken", null)
    if (token == null) {
        callback(Result.failure(Exception("Not authenticated")))
        return
    }
    
    val url = "https://api.financial-intelligence.com/api/v1/mobile/financial-snapshot"
    
    val builder = Request.Builder()
        .url(url)
        .get()
        .addHeader("Authorization", "Bearer $token")
        .addHeader("Content-Type", "application/json")
    
    // Add battery status header if battery is low
    val batteryManager = getSystemService(Context.BATTERY_SERVICE) as BatteryManager
    val batteryLevel = batteryManager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
    if (batteryLevel < 20) {
        builder.addHeader("x-battery-status", "low")
    }
    
    val request = builder.build()
    
    OkHttpClient().newCall(request).enqueue(object : Callback {
        override fun onFailure(call: Call, e: IOException) {
            callback(Result.failure(e))
        }
        
        override fun onResponse(call: Call, response: Response) {
            val responseBody = response.body?.string()
            if (responseBody != null) {
                try {
                    val snapshotResponse = Gson().fromJson(responseBody, FinancialSnapshotResponse::class.java)
                    callback(Result.success(snapshotResponse.data))
                } catch (e: Exception) {
                    callback(Result.failure(e))
                }
            } else {
                callback(Result.failure(IOException("Empty response")))
            }
        }
    })
}
```

## WebSocket Support

For real-time updates on transactions and account information, the API also provides WebSocket connections:

```
wss://api.financial-intelligence.com/ws
```

To connect to WebSockets, you'll need to include your access token as a query parameter:

```
wss://api.financial-intelligence.com/ws?token=your-access-token
```

### WebSocket Events

- `transaction`: Fired when a new transaction occurs
- `account_update`: Fired when account information changes
- `balance_alert`: Fired when account balance drops below threshold
- `insight`: Fired when a new insight is generated

### WebSocket Example (JavaScript)

```javascript
const token = localStorage.getItem('accessToken');
const ws = new WebSocket(`wss://api.financial-intelligence.com/ws?token=${token}`);

ws.onopen = () => {
  console.log('WebSocket connected');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch(data.type) {
    case 'transaction':
      console.log('New transaction:', data.transaction);
      break;
    case 'account_update':
      console.log('Account updated:', data.account);
      break;
    case 'balance_alert':
      console.log('Balance alert:', data.alert);
      break;
    case 'insight':
      console.log('New insight:', data.insight);
      break;
  }
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('WebSocket disconnected');
};
```

## Rate Limiting

The API implements rate limiting to ensure fair usage. Rate limits are applied on a per-client basis:

- 100 requests per 15-minute window for regular endpoints
- 500 requests per hour for mobile endpoints

Rate limit headers are included in all responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1616932800
```

When a rate limit is exceeded, the API returns a 429 status code with a JSON response:

```json
{
  "success": false,
  "message": "Too many requests, please try again later."
}
```

For mobile clients with low battery, certain rate limits are relaxed to allow bulk operations during good battery conditions.

## Conclusion

This API is designed to provide rich financial insights while remaining mobile-friendly. By using the mobile-specific endpoints and optimization headers, you can create high-performance apps that work well even in low-battery or limited-connectivity situations.

For additional support, please contact api-support@financial-intelligence.com.
```

**Response:**
```json
{
  "success": true,
  "message": "Client registered successfully",
  "data": {
    "clientId": "your-client-id",
    "clientSecret": "your-client-secret",
    "note": "Store your client secret securely. It will not be shown again."
  }
}
```

#### Login (Obtain Access Token)

```
POST /api/auth/login
```

**Request Body:**
```json
{
  "clientId": "your-client-id",
  "clientSecret": "your-client-secret"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "jwt-access-token",
    "refreshToken": "jwt-refresh-token",
    "expiresIn": 7200
  }
}
```

#### Refresh Token

```
POST /api/auth/refresh
```

**Request Body:**
```json
{
  "refreshToken": "your-refresh-token"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "new-jwt-access-token",
    "expiresIn": 7200
  }
}
```

### Insights Endpoints

#### Generate Financial Insights

```
POST /api/insights/generate
```

**Request Body:**
```json
{
  "query": "How can I save more money?"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "query": "How can I save more money?",
    "insights": {
      "insight": "Based on your spending patterns, you could save an additional $250 per month by reducing your dining expenses...",
      "timestamp": "2025-03-26T14:30:00.000Z"
    },
    "timestamp": "2025-03-26T14:30:00.000Z"
  }
}
```

#### Get Financial Summary

```
GET /api/insights/summary
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalBalance": 19800.25,
    "netWorth": 18550.60,
    "accountCount": 3,
    "accounts": [
      {
        "accountId": "acc-1234",
        "name": "Primary Checking",
        "type": "Checking",
        "balance": 5000.75,
        "currency": "USD"
      },
      ...
    ],
    "recentTransactions": [
      {
        "transactionId": "txn-001",
        "accountId": "acc-1234",
        "date": "2025-03-25T10:30:00.000Z",
        "description": "Coffee Shop",
        "amount": -4.50,
        "category": "Food"
      },
      ...
    ],
    "timestamp": "2025-03-26T14:30:00.000Z"
  }
}
```

### Accounts & Transactions Endpoints

These endpoints are typically accessed via Plaid integration but can be accessed directly if needed.

#### Get Accounts

```
GET /api/plaid/accounts?accessToken=your-plaid-access-token
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "accountId": "account-id",
      "name": "Checking Account",
      "type": "Checking",
      "balance": 1000.50,
      "availableBalance": 950.25,
      "currency": "USD",
      "mask": "1234",
      "officialName": "Standard Checking"
    },
    ...
  ]
}
```

#### Get Transactions

```
GET /api/plaid/transactions?accessToken=your-plaid-access-token&startDate=2025-02-26&endDate=2025-03-26
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "transactionId": "transaction-id",
      "accountId": "account-id",
      "date": "2025-03-25",
      "description": "Grocery Store",
      "amount": -65.72,
      "category": "Food",
      "subCategory": "Groceries",
      "type": "expense",
      "merchantName": "Whole Foods",
      "location": "New York, NY",
      "pending": false
    },
    ...
  ]
}
```

### Plaid Integration Endpoints

#### Create Link Token

```
POST /api/plaid/create-link-token
```

**Request Body:**
```json
{
  "products": ["transactions", "auth"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "link_token": "link-sandbox-abc123",
    "expiration": "2025-03-27T14:30:00.000Z"
  }
}
```

#### Exchange Public Token

```
POST /api/plaid/exchange-public-token
```

**Request Body:**
```json
{
  "publicToken": "public-sandbox-abc123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Bank account connected successfully",
  "data": {
    "itemId": "item-id"
  }
}
```

### Mobile-Specific Endpoints

#### Get Financial Snapshot (Mobile)

```
GET /api/v1/mobile/financial-snapshot
```

**Headers:**
```
x-battery-status: normal | low  (optional)
x-prefer-reduced-data: true | false  (optional)
x-cache-time: 300  (optional, in seconds)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalBalance": 19800.25,
    "netWorth": 18550.60,
    "accountCount": 3,
    "accounts": [
      {
        "id": "acc-1234",
        "name": "Primary Checking",
        "type": "Checking",
        "balance": 5000.75
      },
      ...
    ],
    "recentTransactions": [
      {
        "id": "txn-001",
        "date": "2025-03-25T10:30:00.000Z",
        "description": "Coffee Shop",
        "amount": -4.50,
        "category": "Food"
      },
      ...
    ],
    "timestamp": "2025-03-26T14:30:00.000Z"
  }
}
```

#### Quick Insight (Mobile)

```
POST /api/v1/mobile/quick-insight
```

**Request Body:**
```json
{
  "query": "How much did I spend on dining this month?"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "insight": "You've spent $320.45 on dining this month, which is 15% higher than last month. Your biggest restaurant expense was $85.20 at City Grill on March 15.",
    "timestamp": "2025-03-26T14:30:00.000Z"
  }
}
```

### Notifications Endpoints

#### Register Device for Notifications

```
POST /api/v1/notifications/register-device
```

**Request Body:**
```json
{
  "token": "device-token-from-fcm-or-apn",
  "platform": "ios | android | web",
  "deviceInfo": {
    "model": "iPhone 16 Pro",
    "osVersion": "iOS 18.2",
    "appVersion": "1.2.0"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Device registered successfully",
  "data": {
    "deviceId": "device-id",
    "platform": "ios"
  }
}
```

#### Unregister Device

```
POST /api/v1/notifications/unregister-device
```

**Request Body:**
```json
{
  "token": "device-token-from-fcm-or-apn"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Device unregistered successfully"
}
```

#### Update Notification Preferences

```
PUT /api/v1/notifications/preferences
```

**Request Body:**
```json
{
  "preferences": {
    "lowBalance": true,
    "unusualActivity": true,
    "billReminders": true,
    "savingsOpportunities": true,
    "financialInsights": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Notification preferences updated successfully"
}
```

### Sync Endpoints

#### Get Sync Package

```
GET /api/v1/sync/package?lastSyncTimestamp=2025-03-20T14:30:00.000Z
```

**Response:**
```json
{
  "success": true,
  "data": {
    "timestamp": "2025-03-26T14:30:00.000Z",
    "accounts": [...],
    "transactions": [...],
    "checksums": {
      "accounts": [...],
      "transactions": [...]
    },
    "syncType": "delta",
    "syncId": "sync-id"
  }
}
```

#### Process Sync Changes

```
POST /api/v1/sync/changes
```

**Request Body:**
```json
{
  "syncId": "sync-id",
  "changes": {
    "transactions": [
      {
        "transactionId": "txn-001",
        "description": "Updated description",
        "category": "Updated category",
        "_baseChecksum": "original-checksum"
      }
    ]
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Changes processed",
  "data": {
    "accepted": [
      {
        "id": "txn-001",
        "type": "update"
      }
    ],
    "rejected": [],
    "conflicts": []
  }
}
```

## Error Handling

The API returns consistent error formats across all endpoints:

```json
{
  "success": false,
  "message": "Error message explaining what went wrong",
  "errors": [
    {
      "field": "fieldName",
      "message": "Specific error for this field"
    }
  ]
}
```

Common HTTP status codes:

- `200` - Success
- `400` - Bad request (invalid parameters)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Resource not found
- `429` - Rate limit exceeded
- `500` - Server error

## Mobile Optimization

The API includes several features designed specifically for mobile applications:

1. **Battery-aware processing**: Include `x-battery-status: low` header to receive simplified responses when the device's battery is low.

2. **Bandwidth optimization**: Include `x-prefer-reduced-data: true` header to receive smaller response payloads.

3. **Mobile-specific endpoints**: The `/api/v1/mobile/*` endpoints are optimized for mobile with reduced payload sizes.

4. **Offline support**: The sync endpoints allow mobile apps to function offline and sync changes later.

5. **Compression**: The API automatically applies compression for mobile clients.

## Sample Code

### Authentication (JavaScript)

```javascript
// Request access token
async function login(clientId, clientSecret) {
  const response = await fetch('https://api.financial-intelligence.com/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ clientId, clientSecret })
  });
  
  const data = await response.json();
  
  if (data.success) {
    // Store tokens securely
    localStorage.setItem('accessToken', data.data.accessToken);
    localStorage.setItem('refreshToken', data.data.refreshToken);
    return data.data;
  } else {
    throw new Error(data.message);
  }
}

// Make authenticated request
async function getFinancialSummary() {
  const token = localStorage.getItem('accessToken');
  
  const response = await fetch('https://api.financial-intelligence.com/api/insights/summary', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  
  if (data.success) {
    return data.data;
  } else {
    throw new Error(data.message);
  }
}
```

### Generating Insights (JavaScript)

```javascript
async function generateInsight(query) {
  const token = localStorage.getItem('accessToken');
  
  const response = await fetch('https://api.financial-intelligence.com/api/insights/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });
  
  const data = await response.json();
  
  if (data.success) {
    return data.data.insights;
  } else {
    throw new Error(data.message);
  }
}
```

### Mobile-Optimized Request (JavaScript)

```javascript
async function getFinancialSnapshot(batteryStatus, preferReducedData) {
  const token = localStorage.getItem('accessToken');
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  
  // Add optional headers for mobile optimization
  if (batteryStatus) {
    headers['x-battery-status'] = batteryStatus;
  }
  
  if (preferReducedData) {
    headers['x-prefer-reduced-data'] = 'true';
  }
  
  const response = await fetch('https://api.financial-intelligence.com/api/v1/mobile/financial-snapshot', {
    method: 'GET',
    headers: headers
  });
  
  const data = await response.json();
  
  if (data.success) {
    return data.data;
  } else {
    throw new Error(data.message);
  }
}