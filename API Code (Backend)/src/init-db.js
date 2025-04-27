// src/init-db.js
require('dotenv').config();                 // <-- loads your .env
const { sequelize } = require('../src/config/database');
const { User, Client } = require('../src/models/User');
const Token = require('../src/models/Token');
const logger = require('../src/utils/logger');

async function initDB() {
  try {
    logger.info('🔌 Connecting to database…');
    await sequelize.authenticate();
    logger.info('✅ Connected.');

    logger.info('🗄  Dropping & re-creating all tables (force: true)…');
    await sequelize.sync({ force: true });
    logger.info('✅ Tables created.');

    // --- seed an admin user + client ---
    logger.info('👤 Seeding admin user…');
    const admin = await User.create({
      clientName: 'Admin',
      email: 'admin@example.com',
      passwordHash: '$2b$10$qaF59JPNNnT6VPkzNzHZ/e1tH41WJ/jL19d5xXCyD6D6u7Vox.NKG',
      description: 'System administrator',
      status: 'active'
    });

    logger.info('🔑 Seeding admin client credentials…');
    await Client.create({
      userId: admin.id,
      clientId: 'admin-client',
      clientSecret: '5a0c55f33c477e0298b90d48c6628675b5d9e9c76d7e8c163cc8939c7f958c20',
      description: 'Admin client',
      status: 'active'
    });

    logger.info('🎉 Database setup complete.');
    process.exit(0);
  } catch (err) {
    logger.error('❌ Database setup failed:', err);
    process.exit(1);
  }
}

initDB();