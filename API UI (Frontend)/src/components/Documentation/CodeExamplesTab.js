import React, { useState } from 'react';
import { Tab, Tabs, Nav } from 'react-bootstrap';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Custom styled CodeBlock component
const CodeBlock = ({ code, language = 'javascript' }) => (
	<div className="bg-black p-3 rounded" style={{ overflowX: 'auto' }}>
		<SyntaxHighlighter language={language} style={oneDark} wrapLongLines customStyle={{ fontSize: '0.9rem', margin: 0 }}>
			{code}
		</SyntaxHighlighter>
	</div>
);

// Custom styled tab component to maintain dark theme
const DarkThemeTab = ({ eventKey, title, active, onClick }) => (
	<li className="nav-item">
		<button
			className={`nav-link ${active ? 'active' : ''}`}
			onClick={onClick}
			style={{
				backgroundColor: active ? '#1a1a1a' : '#222222',
				color: active ? '#28a745' : '#aaaaaa',
				border: '1px solid #333333',
				borderBottom: active ? '1px solid #1a1a1a' : '1px solid #333333',
				borderTopLeftRadius: '0.25rem',
				borderTopRightRadius: '0.25rem',
				padding: '0.5rem 1rem',
				marginRight: '0.25rem',
				cursor: 'pointer',
				transition: 'all 0.2s ease',
			}}
			onMouseOver={(e) => {
				if (!active) {
					e.currentTarget.style.backgroundColor = '#333333';
					e.currentTarget.style.color = '#dddddd';
				}
			}}
			onMouseOut={(e) => {
				if (!active) {
					e.currentTarget.style.backgroundColor = '#222222';
					e.currentTarget.style.color = '#aaaaaa';
				}
			}}
		>
			{title}
		</button>
	</li>
);

const CodeExamplesTab = () => {
	const [activeLanguage, setActiveLanguage] = useState('javascript');

	// JavaScript/Node.js example
	const jsExample = `// JavaScript/Node.js example for direct data integration
const axios = require('axios');

// Base configuration
const API_BASE_URL = 'https://bankingintelligenceapi.com';
const API_KEY = 'YOUR_API_KEY';

// API client setup
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Authorization': \`Bearer \${API_KEY}\`,
    'Content-Type': 'application/json'
  }
});

// Create or update a bank user
async function createBankUser(userData) {
  try {
    const response = await apiClient.post('/api/bank/users', userData);
    console.log('User created:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error creating user:', error.response?.data || error.message);
    throw error;
  }
}

// Upload accounts for a bank user
async function uploadAccounts(bankUserId, accounts) {
  try {
    const response = await apiClient.post(\`/api/bank/users/\${bankUserId}/accounts\`, {
      accounts: accounts
    });
    console.log('Accounts uploaded:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error uploading accounts:', error.response?.data || error.message);
    throw error;
  }
}

// Upload transactions for a bank user
async function uploadTransactions(bankUserId, transactions) {
  try {
    const response = await apiClient.post(\`/api/bank/users/\${bankUserId}/transactions\`, {
      transactions: transactions
    });
    console.log('Transactions uploaded:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error uploading transactions:', error.response?.data || error.message);
    throw error;
  }
}

// Generate insights for a bank user
async function generateInsights(bankUserId, query) {
  try {
    const response = await apiClient.post(\`/api/bank/users/\${bankUserId}/insights\`, {
      query: query
    });
    console.log('Insights:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error generating insights:', error.response?.data || error.message);
    throw error;
  }
}

// Example usage
async function main() {
  // Create a bank user
  const userData = {
    bankUserId: 'user-123456',
    name: 'John Doe',
    email: 'john.doe@example.com'
  };
  
  const userResponse = await createBankUser(userData);
  
  // Upload accounts
  const accounts = [
    {
      accountId: 'acc-checking-001',
      name: 'Primary Checking',
      type: 'Checking',
      balance: 2500.75,
      availableBalance: 2450.50,
      currency: 'USD'
    },
    {
      accountId: 'acc-savings-001',
      name: 'Savings Account',
      type: 'Savings',
      balance: 15000.50,
      availableBalance: 15000.50,
      currency: 'USD'
    }
  ];
  
  await uploadAccounts(userData.bankUserId, accounts);
  
  // Upload transactions
  const transactions = [
    {
      transactionId: 'txn-001',
      accountId: 'acc-checking-001',
      date: '2025-05-06T00:00:00.000Z',
      description: 'Grocery Store',
      amount: -120.35,
      category: 'Food',
      merchantName: 'Whole Foods'
    },
    {
      transactionId: 'txn-002',
      accountId: 'acc-checking-001',
      date: '2025-05-05T00:00:00.000Z',
      description: 'Monthly Salary',
      amount: 4000.00,
      category: 'Income',
      merchantName: 'COMPANY INC'
    }
  ];
  
  await uploadTransactions(userData.bankUserId, transactions);
  
  // Generate insights
  const insightQuery = 'How can I save more money?';
  const insights = await generateInsights(userData.bankUserId, insightQuery);
  
  console.log('Process completed successfully!');
}

main().catch(console.error);`;

	// Python example
	const pythonExample = `# Python example for direct data integration
import requests
import json
from datetime import datetime

# Base configuration
API_BASE_URL = 'https://bankingintelligenceapi.com'
API_KEY = 'YOUR_API_KEY'

# API client setup
headers = {
    'Authorization': f'Bearer {API_KEY}',
    'Content-Type': 'application/json'
}

# Create or update a bank user
def create_bank_user(user_data):
    try:
        response = requests.post(
            f'{API_BASE_URL}/api/bank/users',
            headers=headers,
            json=user_data
        )
        response.raise_for_status()
        print('User created:', response.json())
        return response.json()
    except requests.exceptions.RequestException as e:
        print('Error creating user:', e)
        if hasattr(e, 'response') and e.response:
            print(e.response.text)
        raise

# Upload accounts for a bank user
def upload_accounts(bank_user_id, accounts):
    try:
        response = requests.post(
            f'{API_BASE_URL}/api/bank/users/{bank_user_id}/accounts',
            headers=headers,
            json={'accounts': accounts}
        )
        response.raise_for_status()
        print('Accounts uploaded:', response.json())
        return response.json()
    except requests.exceptions.RequestException as e:
        print('Error uploading accounts:', e)
        if hasattr(e, 'response') and e.response:
            print(e.response.text)
        raise

# Upload transactions for a bank user
def upload_transactions(bank_user_id, transactions):
    try:
        response = requests.post(
            f'{API_BASE_URL}/api/bank/users/{bank_user_id}/transactions',
            headers=headers,
            json={'transactions': transactions}
        )
        response.raise_for_status()
        print('Transactions uploaded:', response.json())
        return response.json()
    except requests.exceptions.RequestException as e:
        print('Error uploading transactions:', e)
        if hasattr(e, 'response') and e.response:
            print(e.response.text)
        raise

# Generate insights for a bank user
def generate_insights(bank_user_id, query):
    try:
        response = requests.post(
            f'{API_BASE_URL}/api/bank/users/{bank_user_id}/insights',
            headers=headers,
            json={'query': query}
        )
        response.raise_for_status()
        print('Insights:', response.json())
        return response.json()
    except requests.exceptions.RequestException as e:
        print('Error generating insights:', e)
        if hasattr(e, 'response') and e.response:
            print(e.response.text)
        raise

# Example usage
def main():
    # Create a bank user
    user_data = {
        'bankUserId': 'user-123456',
        'name': 'John Doe',
        'email': 'john.doe@example.com'
    }
    
    user_response = create_bank_user(user_data)
    
    # Upload accounts
    accounts = [
        {
            'accountId': 'acc-checking-001',
            'name': 'Primary Checking',
            'type': 'Checking',
            'balance': 2500.75,
            'availableBalance': 2450.50,
            'currency': 'USD'
        },
        {
            'accountId': 'acc-savings-001',
            'name': 'Savings Account',
            'type': 'Savings',
            'balance': 15000.50,
            'availableBalance': 15000.50,
            'currency': 'USD'
        }
    ]
    
    upload_accounts(user_data['bankUserId'], accounts)
    
    # Upload transactions
    transactions = [
        {
            'transactionId': 'txn-001',
            'accountId': 'acc-checking-001',
            'date': '2025-05-06T00:00:00.000Z',
            'description': 'Grocery Store',
            'amount': -120.35,
            'category': 'Food',
            'merchantName': 'Whole Foods'
        },
        {
            'transactionId': 'txn-002',
            'accountId': 'acc-checking-001',
            'date': '2025-05-05T00:00:00.000Z',
            'description': 'Monthly Salary',
            'amount': 4000.00,
            'category': 'Income',
            'merchantName': 'COMPANY INC'
        }
    ]
    
    upload_transactions(user_data['bankUserId'], transactions)
    
    # Generate insights
    insight_query = 'How can I save more money?'
    insights = generate_insights(user_data['bankUserId'], insight_query)
    
    print('Process completed successfully!')

if __name__ == '__main__':
    main()`;

	// C# example
	const csharpExample = `// C# (.NET) example for direct data integration
using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace BankingIntelligenceAPI
{
    public class BankingApiClient
    {
        private readonly HttpClient _httpClient;
        private readonly string _apiBaseUrl = "https://bankingintelligenceapi.com";
        
        public BankingApiClient(string apiKey)
        {
            _httpClient = new HttpClient();
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            _httpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        }
        
        // Create or update a bank user
        public async Task<JsonDocument> CreateBankUserAsync(object userData)
        {
            string endpoint = $"{_apiBaseUrl}/api/bank/users";
            
            var content = new StringContent(
                JsonSerializer.Serialize(userData),
                Encoding.UTF8,
                "application/json"
            );
            
            HttpResponseMessage response = await _httpClient.PostAsync(endpoint, content);
            response.EnsureSuccessStatusCode();
            
            string responseBody = await response.Content.ReadAsStringAsync();
            return JsonDocument.Parse(responseBody);
        }
        
        // Upload accounts for a bank user
        public async Task<JsonDocument> UploadAccountsAsync(string bankUserId, IEnumerable<object> accounts)
        {
            string endpoint = $"{_apiBaseUrl}/api/bank/users/{bankUserId}/accounts";
            
            var payload = new { accounts };
            var content = new StringContent(
                JsonSerializer.Serialize(payload),
                Encoding.UTF8,
                "application/json"
            );
            
            HttpResponseMessage response = await _httpClient.PostAsync(endpoint, content);
            response.EnsureSuccessStatusCode();
            
            string responseBody = await response.Content.ReadAsStringAsync();
            return JsonDocument.Parse(responseBody);
        }
        
        // Upload transactions for a bank user
        public async Task<JsonDocument> UploadTransactionsAsync(string bankUserId, IEnumerable<object> transactions)
        {
            string endpoint = $"{_apiBaseUrl}/api/bank/users/{bankUserId}/transactions";
            
            var payload = new { transactions };
            var content = new StringContent(
                JsonSerializer.Serialize(payload),
                Encoding.UTF8,
                "application/json"
            );
            
            HttpResponseMessage response = await _httpClient.PostAsync(endpoint, content);
            response.EnsureSuccessStatusCode();
            
            string responseBody = await response.Content.ReadAsStringAsync();
            return JsonDocument.Parse(responseBody);
        }
        
        // Generate insights for a bank user
        public async Task<JsonDocument> GenerateInsightsAsync(string bankUserId, string query)
        {
            string endpoint = $"{_apiBaseUrl}/api/bank/users/{bankUserId}/insights";
            
            var payload = new { query };
            var content = new StringContent(
                JsonSerializer.Serialize(payload),
                Encoding.UTF8,
                "application/json"
            );
            
            HttpResponseMessage response = await _httpClient.PostAsync(endpoint, content);
            response.EnsureSuccessStatusCode();
            
            string responseBody = await response.Content.ReadAsStringAsync();
            return JsonDocument.Parse(responseBody);
        }
    }
    
    // Example usage
    public class Program
    {
        public static async Task Main(string[] args)
        {
            var apiClient = new BankingApiClient("YOUR_API_KEY");
            
            try
            {
                // Create a bank user
                var userData = new
                {
                    bankUserId = "user-123456",
                    name = "John Doe",
                    email = "john.doe@example.com"
                };
                
                var userResponse = await apiClient.CreateBankUserAsync(userData);
                Console.WriteLine("User created successfully");
                
                // Upload accounts
                var accounts = new[]
                {
                    new
                    {
                        accountId = "acc-checking-001",
                        name = "Primary Checking",
                        type = "Checking",
                        balance = 2500.75,
                        availableBalance = 2450.50,
                        currency = "USD"
                    },
                    new
                    {
                        accountId = "acc-savings-001",
                        name = "Savings Account",
                        type = "Savings",
                        balance = 15000.50,
                        availableBalance = 15000.50,
                        currency = "USD"
                    }
                };
                
                var accountsResponse = await apiClient.UploadAccountsAsync("user-123456", accounts);
                Console.WriteLine("Accounts uploaded successfully");
                
                // Upload transactions
                var transactions = new[]
                {
                    new
                    {
                        transactionId = "txn-001",
                        accountId = "acc-checking-001",
                        date = "2025-05-06T00:00:00.000Z",
                        description = "Grocery Store",
                        amount = -120.35,
                        category = "Food",
                        merchantName = "Whole Foods"
                    },
                    new
                    {
                        transactionId = "txn-002",
                        accountId = "acc-checking-001",
                        date = "2025-05-05T00:00:00.000Z",
                        description = "Monthly Salary",
                        amount = 4000.00,
                        category = "Income",
                        merchantName = "COMPANY INC"
                    }
                };
                
                var transactionsResponse = await apiClient.UploadTransactionsAsync("user-123456", transactions);
                Console.WriteLine("Transactions uploaded successfully");
                
                // Generate insights
                string insightQuery = "How can I save more money?";
                
                var insightsResponse = await apiClient.GenerateInsightsAsync("user-123456", insightQuery);
                Console.WriteLine("Insights received successfully");
                
                Console.WriteLine("Process completed successfully!");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error: {ex.Message}");
            }
        }
    }
}`;

	// Java example
	const javaExample = `// Java example for direct data integration
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

public class BankingIntelligenceAPIClient {
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final String apiBaseUrl = "https://bankingintelligenceapi.com";
    private final String apiKey;
    
    public BankingIntelligenceAPIClient(String apiKey) {
        this.apiKey = apiKey;
        this.httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_2)
                .connectTimeout(Duration.ofSeconds(10))
                .build();
        this.objectMapper = new ObjectMapper();
    }
    
    // Create or update a bank user
    public String createBankUser(Map<String, Object> userData) throws IOException, InterruptedException {
        String endpoint = apiBaseUrl + "/api/bank/users";
        
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(userData)))
                .build();
        
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        
        if (response.statusCode() >= 200 && response.statusCode() < 300) {
            System.out.println("User created successfully");
            return response.body();
        } else {
            throw new IOException("HTTP error: " + response.statusCode() + " - " + response.body());
        }
    }
    
    // Upload accounts for a bank user
    public String uploadAccounts(String bankUserId, List<Map<String, Object>> accounts) throws IOException, InterruptedException {
        String endpoint = apiBaseUrl + "/api/bank/users/" + bankUserId + "/accounts";
        
        ObjectNode requestBody = objectMapper.createObjectNode();
        ArrayNode accountsArray = requestBody.putArray("accounts");
        
        for (Map<String, Object> account : accounts) {
            ObjectNode accountNode = objectMapper.valueToTree(account);
            accountsArray.add(accountNode);
        }
        
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(requestBody.toString()))
                .build();
        
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        
        if (response.statusCode() >= 200 && response.statusCode() < 300) {
            System.out.println("Accounts uploaded successfully");
            return response.body();
        } else {
            throw new IOException("HTTP error: " + response.statusCode() + " - " + response.body());
        }
    }
    
    // Upload transactions for a bank user
    public String uploadTransactions(String bankUserId, List<Map<String, Object>> transactions) throws IOException, InterruptedException {
        String endpoint = apiBaseUrl + "/api/bank/users/" + bankUserId + "/transactions";
        
        ObjectNode requestBody = objectMapper.createObjectNode();
        ArrayNode transactionsArray = requestBody.putArray("transactions");
        
        for (Map<String, Object> transaction : transactions) {
            ObjectNode transactionNode = objectMapper.valueToTree(transaction);
            transactionsArray.add(transactionNode);
        }
        
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(requestBody.toString()))
                .build();
        
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        
        if (response.statusCode() >= 200 && response.statusCode() < 300) {
            System.out.println("Transactions uploaded successfully");
            return response.body();
        } else {
            throw new IOException("HTTP error: " + response.statusCode() + " - " + response.body());
        }
    }
    
    // Generate insights for a bank user
    public String generateInsights(String bankUserId, String query) throws IOException, InterruptedException {
        String endpoint = apiBaseUrl + "/api/bank/users/" + bankUserId + "/insights";
        
        ObjectNode requestBody = objectMapper.createObjectNode();
        requestBody.put("query", query);
        
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(requestBody.toString()))
                .build();
        
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        
        if (response.statusCode() >= 200 && response.statusCode() < 300) {
            System.out.println("Insights generated successfully");
            return response.body();
        } else {
            throw new IOException("HTTP error: " + response.statusCode() + " - " + response.body());
        }
    }

    // Main method with example usage
    public static void main(String[] args) {
        try {
            BankingIntelligenceAPIClient client = new BankingIntelligenceAPIClient("YOUR_API_KEY");
            
            // Create bank user example would go here
            
            System.out.println("Process completed successfully!");
        } catch (Exception e) {
            System.err.println("Error: " + e.getMessage());
            e.printStackTrace();
        }
    }
}`;

	return (
		<div>
			<h2 className="mb-4 text-white">Code Examples</h2>
			<p className="mb-4">These examples demonstrate how to integrate with our API directly across different programming languages.</p>

			{/* Custom dark-themed tabs */}
			<div className="custom-tabs">
				<div className="tab-container" style={{ borderBottom: '1px solid #333333' }}>
					<ul className="nav nav-tabs" style={{ border: 'none' }}>
						<DarkThemeTab
							eventKey="javascript"
							title="JavaScript/Node.js"
							active={activeLanguage === 'javascript'}
							onClick={() => setActiveLanguage('javascript')}
						/>
						<DarkThemeTab
							eventKey="python"
							title="Python"
							active={activeLanguage === 'python'}
							onClick={() => setActiveLanguage('python')}
						/>
						<DarkThemeTab
							eventKey="csharp"
							title="C# (.NET)"
							active={activeLanguage === 'csharp'}
							onClick={() => setActiveLanguage('csharp')}
						/>
						<DarkThemeTab
							eventKey="java"
							title="Java"
							active={activeLanguage === 'java'}
							onClick={() => setActiveLanguage('java')}
						/>
					</ul>
				</div>

				<div className="tab-content mt-4" style={{ backgroundColor: '#1a1a1a', borderRadius: '0.25rem', padding: '1rem' }}>
					{activeLanguage === 'javascript' && (
						<div>
							<CodeBlock code={jsExample} language="javascript" />
						</div>
					)}

					{activeLanguage === 'python' && (
						<div>
							<CodeBlock code={pythonExample} language="python" />
						</div>
					)}

					{activeLanguage === 'csharp' && (
						<div>
							<CodeBlock code={csharpExample} language="csharp" />
						</div>
					)}

					{activeLanguage === 'java' && (
						<div>
							<CodeBlock code={javaExample} language="java" />
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default CodeExamplesTab;