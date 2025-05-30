# Banking Intelligence API - Data Deletion & Retention Policy

## 1. Introduction

This Data Deletion and Retention Policy ("Policy") governs how VIVY TECH USA INC. ("we," "our," or "us") collects, processes, stores, and deletes data through the Banking Intelligence API Service ("the Service"). This Policy is designed to ensure that we handle user data responsibly, transparently, and in compliance with applicable data protection laws and regulations.

## 2. Data Categories

The Service processes the following categories of data:

### 2.1 User Account Data
- User profiles and authentication information
- Client credentials and API tokens
- Two-factor authentication (2FA) secrets and backup codes
- Account activity logs

### 2.2 Financial Data
- Bank account information
- Transaction data
- Account balances and account types
- Spending patterns and financial metrics

### 2.3 Generated Insights
- AI-generated financial insights
- Query history and responses
- Usage metrics and analytics

### 2.4 Plaid Integration Data
- Plaid access tokens and item IDs
- Institution information
- Financial data retrieved through Plaid

## 3. Data Retention Periods

We retain different categories of data for varying periods based on business needs, legal requirements, and user preferences:

### 3.1 User Account Data
- **Active Accounts**: For as long as the user maintains an active account with the Service
- **Account Credentials**: Encrypted and retained for the duration of account activity
- **Authentication Logs**: Retained for 12 months for security auditing purposes

### 3.2 Financial Data
- **Connected Bank Data**: Retained for as long as the user maintains the bank connection
- **Transaction Data**: Stored for 24 months from date of retrieval
- **Cached Financial Summaries**: Stored for 30 days

### 3.3 Generated Insights
- **Query Results**: Stored for 12 months
- **Usage Metrics**: Anonymized after 24 months and retained for analytical purposes
- **System Performance Metrics**: Retained for 24 months

### 3.4 Plaid Integration Data
- **Plaid Access Tokens**: Retained until the user disconnects the institution or closes their account
- **Connection Information**: Retained for 12 months after disconnection for troubleshooting purposes

## 4. Data Deletion Mechanisms

### 4.1 User-Initiated Deletions

Users can request deletion of their data through the following mechanisms:

#### 4.1.1 Account Closure
When a user closes their account:
- User account data is marked for deletion
- Financial data is immediately delinked from the user
- Complete deletion occurs after a 30-day grace period (in case of accidental closure)
- Users receive confirmation once deletion is complete

#### 4.1.2 Bank Account Disconnection
When a user disconnects a bank account:
- Plaid access tokens are immediately invalidated
- Bank account data is removed from active storage
- Transaction data associated with the account is removed after 30 days

#### 4.1.3 Specific Data Deletion
Users may request deletion of specific data by:
- Contacting support with specific deletion requests
- Using self-service data management features in the account settings

### 4.2 Automatic Deletions

The system automatically deletes certain data according to the following schedule:

#### 4.2.1 Expired Tokens
- **API Tokens**: Deleted 7 days after expiration
- **Refresh Tokens**: Deleted 30 days after expiration
- **Revoked Tokens**: Deleted 90 days after revocation

#### 4.2.2 Inactive Accounts
- Accounts inactive for 12 consecutive months receive notification
- After 15 months of inactivity, accounts are marked for deletion
- Complete deletion occurs after an additional 30-day grace period

#### 4.2.3 Temporary Data
- **Failed Login Attempts**: Purged after 7 days
- **Temporary Authentication Codes**: Deleted after use or expiration
- **Session Data**: Cleared after session timeout or logout

## 5. Data Retention Exceptions

Certain data may be retained beyond standard retention periods in the following cases:

### 5.1 Legal and Regulatory Requirements
- Data subject to legal hold or preservation orders
- Information required for tax, financial, or regulatory compliance
- Records necessary for dispute resolution or fraud investigation

### 5.2 Anonymized Data
- Data that has been anonymized (with all identifying information removed) may be retained indefinitely for:
  - Service improvement and research
  - Statistical analysis
  - Product development

### 5.3 Backups
- System backups may contain user data even after deletion from production systems
- Backups are retained for a maximum of 90 days
- Deleted data will be removed from backups when they expire or are recycled

## 6. Security During Retention

While data is retained, we implement the following security measures:

### 6.1 Encryption
- All sensitive personal data and financial information is encrypted at rest
- API tokens, client secrets, and 2FA secrets are hashed using industry-standard algorithms
- Plaid access tokens are encrypted with additional layers of protection

### 6.2 Access Controls
- Access to user data is restricted to authorized personnel only
- Role-based access controls limit data visibility based on job function
- All data access is logged and monitored

### 6.3 Storage Segmentation
- Active data, archived data, and data marked for deletion are stored separately
- Different retention rules apply to each storage tier

## 7. User Rights and Controls

Users have the following rights regarding their data:

### 7.1 Right to Access
- Users can view their stored personal information and financial data
- Account settings provide transparency about what data is collected

### 7.2 Right to Correction
- Users can update inaccurate personal information

### 7.3 Right to Deletion
- Users can request deletion of their data subject to this Policy
- Requests are processed within 30 days

### 7.4 Right to Data Portability
- Users can export their financial data in standard formats

### 7.5 Notification of Changes
- Users will be notified of material changes to this Policy
- Updates to retention periods will be communicated via email

## 8. Administrative Procedures

### 8.1 Deletion Verification
- Automated systems verify that data is deleted according to policy
- Regular audits confirm compliance with retention schedules
- Verification reports are maintained for compliance purposes

### 8.2 Documentation
- All deletion requests are documented
- Logs of automated deletions are maintained
- Exception approvals are documented and periodically reviewed

### 8.3 Staff Training
- Personnel handling user data receive training on this Policy
- Training is refreshed annually and when material changes occur

## 9. Policy Updates

We reserve the right to update this Policy to reflect:
- Changes in our practices
- New legal requirements
- Improved security measures

Material changes will be communicated to users at least 30 days before they take effect.

## 10. Contact Information

For questions about this Data Deletion and Retention Policy or to exercise your rights regarding your data, please contact:

- Email: privacy@bankingintelligenceapi.com
- Postal Mail: VIVY TECH USA INC., ATTN: Privacy Office, [POSTAL ADDRESS]

Last Updated: May 14, 2025