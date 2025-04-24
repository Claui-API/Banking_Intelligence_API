# AWS RDS Security Checklist for Financial Applications

This checklist provides a comprehensive set of security controls and best practices for securing AWS RDS databases used in financial applications. Given the sensitive nature of financial data, implementing these measures is critical for ensuring data privacy, regulatory compliance, and protection against threats.

## Initial RDS Configuration

- [ ] **Enable encryption at rest** using AWS KMS keys for all database instances
- [ ] **Use a non-default port** instead of standard database engine ports
- [ ] **Place database in a private subnet** within a VPC, not publicly accessible
- [ ] **Configure multiple Availability Zones** for high availability
- [ ] **Enable automated backups** with appropriate retention period (minimum 7 days)
- [ ] **Set up parameter groups** with secure defaults for your database engine
- [ ] **Enable deletion protection** to prevent accidental database deletion
- [ ] **Create separate database accounts** for different application functions
- [ ] **Disable public accessibility** for all database instances

## Network Security

- [ ] **Set up restrictive security groups** that only allow necessary traffic
- [ ] **Configure Network ACLs** as an additional security layer
- [ ] **Use VPC endpoints** for AWS services to avoid traversing the public internet
- [ ] **Implement secure transit using SSL/TLS** for all database connections
- [ ] **Force SSL connections** at the database engine level
- [ ] **Use site-to-site VPN or Direct Connect** for on-premises to AWS connectivity
- [ ] **Set up bastion hosts** for secure administrative access
- [ ] **Implement network traffic monitoring** using VPC Flow Logs

## Identity and Access Management

- [ ] **Enforce principle of least privilege** for all database users and roles
- [ ] **Use IAM database authentication** when supported by database engine
- [ ] **Set up IAM policies** that restrict who can modify RDS instances
- [ ] **Implement Multi-Factor Authentication (MFA)** for all administrative access
- [ ] **Rotate credentials regularly** using AWS Secrets Manager
- [ ] **Don't use master credentials** in applications; create limited-privilege users
- [ ] **Use IAM roles for EC2** rather than storing credentials on instances
- [ ] **Implement role-based access control** (RBAC) within database
- [ ] **Store application credentials** in AWS Secrets Manager, not in code

## Monitoring and Logging

- [ ] **Enable AWS CloudTrail** for auditing all API calls to RDS
- [ ] **Set up RDS Enhanced Monitoring** for detailed OS metrics
- [ ] **Configure Performance Insights** for database performance monitoring
- [ ] **Implement database audit logging** appropriate for your database engine
- [ ] **Set up CloudWatch alarms** for unusual access patterns or behavior
- [ ] **Enable GuardDuty** for threat detection of potential malicious activities
- [ ] **Use AWS Config Rules** to continuously audit RDS configurations
- [ ] **Implement automated compliance checks** using AWS Security Hub
- [ ] **Set up database activity streams** to capture database activity in real-time

## Operational Security

- [ ] **Apply database patches regularly** during maintenance windows
- [ ] **Implement a process for database version upgrades**
- [ ] **Perform regular security assessments** of database configurations
- [ ] **Back up encryption keys** used for database encryption
- [ ] **Test restoration of database backups** regularly
- [ ] **Implement disaster recovery procedures** and test them
- [ ] **Document all configurations and security controls**
- [ ] **Train administrators** on security best practices
- [ ] **Set up a security incident response plan** for database breaches

## Data Protection

- [ ] **Implement data classification** to identify and protect sensitive data
- [ ] **Consider data tokenization or masking** for highly sensitive information
- [ ] **Encrypt sensitive data in application layer** before storing in database
- [ ] **Implement row-level security** when needed for multi-tenant applications
- [ ] **Set up data access logs** to track who accessed what data
- [ ] **Configure snapshot encryption** for all database snapshots
- [ ] **Control snapshot sharing** to prevent unauthorized data access
- [ ] **Implement proper data retention policies** in compliance with regulations

## Compliance Requirements

- [ ] **Document database controls** mapped to compliance requirements (PCI DSS, SOC 2, etc.)
- [ ] **Generate compliance reports** on database security controls
- [ ] **Implement geofencing** to ensure data residency requirements are met
- [ ] **Set up automated compliance monitoring** with notifications
- [ ] **Maintain detailed audit trail** of all database changes
- [ ] **Configure automated database logging archival** for long-term storage
- [ ] **Ensure cross-region replicas** comply with data sovereignty requirements
- [ ] **Document data flows** to maintain chain of custody

## Financial-Specific Controls

- [ ] **Implement transaction logging** for all financial transactions
- [ ] **Set up dual control mechanisms** for critical financial data modifications
- [ ] **Configure alerts for abnormal transaction patterns**
- [ ] **Implement strict isolation** between test and production environments
- [ ] **Set up special protection for personally identifiable financial information (PIFI)**
- [ ] **Configure database timeouts** to limit active sessions
- [ ] **Implement rate limiting** at application level to prevent abuse
- [ ] **Set up function-level access controls** for financial operations

## Regular Review and Testing

- [ ] **Perform periodic security assessments** of database security
- [ ] **Conduct penetration testing** against database infrastructure
- [ ] **Review access logs** to detect suspicious activity
- [ ] **Test backup and restore procedures** quarterly
- [ ] **Verify encryption implementation** is working correctly
- [ ] **Conduct disaster recovery drills** including database recovery
- [ ] **Review IAM permissions** to ensure they remain appropriate
- [ ] **Test security incident response plan** for database breaches

## Regulatory Considerations

Different financial regulations may require additional specific controls. Ensure compliance with:

- **PCI DSS** - For payment card data
- **GDPR** - For EU customer data
- **CCPA/CPRA** - For California resident data
- **SOX** - For financial reporting data
- **GLBA** - For consumer financial information
- **Basel frameworks** - For banking risk management
- **Local banking regulations** - Country-specific requirements

## Documentation

Maintain comprehensive documentation of:

- [ ] **Database architecture** including security controls
- [ ] **Access control matrices** showing who has access to what
- [ ] **Data flow diagrams** showing how data moves through systems
- [ ] **Security control implementations** mapped to regulatory requirements
- [ ] **Evidence of regular security testing**
- [ ] **Incident response procedures** specific to database breaches
- [ ] **Backup and recovery procedures**
- [ ] **Change management process** for database changes

Remember that security is a continuous process. Regularly revisit this checklist and update your security controls as new threats emerge and as AWS introduces new security features for RDS.