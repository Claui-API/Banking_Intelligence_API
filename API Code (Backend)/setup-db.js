// setup-db.js
const { sequelize } = require('./src/config/database');
const User = require('./src/models/User').User;
const Client = require('./src/models/User').Client;
const Token = require('./src/models/Token');
const logger = require('./src/utils/logger');

async function setupDatabase() {
  try {
    logger.info('Setting up database tables...');
    
    // Force: true will drop tables if they exist
    // Use with caution in production!
    await sequelize.sync({ force: true });
    
    logger.info('Database tables created successfully!');
    
    // Optionally create a test admin user
    const adminUser = await User.create({
      clientName: 'Admin',
      email: 'admin@example.com',
      passwordHash: '$2b$10$qaF59JPNNnT6VPkzNzHZ/e1tH41WJ/jL19d5xXCyD6D6u7Vox.NKG', // Password: Admin123!
      description: 'System administrator',
      status: 'active'
    });
    
    // Create admin client credentials
    await Client.create({
      userId: adminUser.id,
      clientId: 'admin-client',
      clientSecret: '5a0c55f33c477e0298b90d48c6628675b5d9e9c76d7e8c163cc8939c7f958c20',
      description: 'Admin client',
      status: 'active'
    });
    
    logger.info('Admin user created');
    
    return true;
  } catch (error) {
    logger.error('Error setting up database:', error);
    return false;
  }
}

// Run the setup
setupDatabase()
  .then(() => {
    logger.info('Database setup completed');
    process.exit(0);
  })
  .catch(error => {
    logger.error('Database setup failed:', error);
    process.exit(1);
  });