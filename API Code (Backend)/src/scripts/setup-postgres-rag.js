// scripts/setup-postgres-rag.js
const { Client } = require('pg');
const dotenv = require('dotenv');
const logger = require('../utils/logger');

// Load environment variables
dotenv.config();

/**
 * Setup PostgreSQL for RAG with vector search capabilities
 * This script:
 * 1. Creates necessary extensions (vector)
 * 2. Creates tables if they don't exist
 * 3. Sets up indexes for efficient retrieval
 */
async function setupPostgresForRag() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    // Enable SSL if in production
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false
    } : false
  });

  try {
    logger.info('Connecting to PostgreSQL...');
    await client.connect();
    logger.info('Connected to PostgreSQL successfully');

    // Define schema and table prefix
    const schema = process.env.COHERE_RAG_DATABASE_SCHEMA || 'public';
    const tablePrefix = process.env.COHERE_RAG_DATABASE_PREFIX || 'cohere_rag_';

    // Check if we can use the vector extension
    logger.info('Checking for pgvector extension...');
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
      logger.info('pgvector extension is available and enabled');
      
      // Create vector column and index
      logger.info('Setting up vector columns and indexes...');
      
      // Add vector column to documents table if it doesn't exist
      await client.query(`
        ALTER TABLE IF EXISTS ${schema}.${tablePrefix}documents 
        ADD COLUMN IF NOT EXISTS embedding vector(1536);
      `);
      
      // Create index for vector similarity search if it doesn't exist
      try {
        await client.query(`
          CREATE INDEX IF NOT EXISTS ${tablePrefix}documents_embedding_idx 
          ON ${schema}.${tablePrefix}documents 
          USING ivfflat (embedding vector_cosine_ops)
          WITH (lists = 100);
        `);
        logger.info('Vector index created successfully');
      } catch (indexError) {
        // If we can't create an ivfflat index, try a simpler index
        logger.warn('Error creating ivfflat index:', indexError.message);
        logger.info('Trying to create a simpler vector index...');
        
        try {
          await client.query(`
            CREATE INDEX IF NOT EXISTS ${tablePrefix}documents_embedding_simple_idx
            ON ${schema}.${tablePrefix}documents
            USING hnsw (embedding vector_cosine_ops);
          `);
          logger.info('Simple vector index created successfully');
        } catch (simpleIndexError) {
          logger.warn('Could not create vector index:', simpleIndexError.message);
        }
      }
    } catch (vectorError) {
      logger.warn('pgvector extension is not available:', vectorError.message);
      logger.warn('Vector similarity search will not be available');
      logger.info('You can install pgvector extension on your PostgreSQL instance to enable vector search');
    }

    // Create function for similarity search if pgvector is available
    try {
      await client.query(`
        CREATE OR REPLACE FUNCTION ${schema}.search_documents(
          p_user_id UUID,
          p_query_embedding VECTOR(1536),
          p_limit INT DEFAULT 5
        )
        RETURNS TABLE (
          id UUID,
          title TEXT,
          text TEXT,
          similarity FLOAT
        )
        LANGUAGE plpgsql
        AS $$
        BEGIN
          RETURN QUERY
          SELECT 
            d.id,
            d.title,
            d.text,
            1 - (d.embedding <=> p_query_embedding) AS similarity
          FROM ${schema}.${tablePrefix}documents d
          WHERE d.user_id = p_user_id
            AND d.embedding IS NOT NULL
          ORDER BY d.embedding <=> p_query_embedding
          LIMIT p_limit;
        END;
        $$;
      `);
      logger.info('Created similarity search function');
    } catch (functionError) {
      logger.warn('Could not create similarity search function:', functionError.message);
    }

    // Create function to update timestamps
    try {
      await client.query(`
        CREATE OR REPLACE FUNCTION ${schema}.update_timestamp()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS update_${tablePrefix}documents_timestamp ON ${schema}.${tablePrefix}documents;
        CREATE TRIGGER update_${tablePrefix}documents_timestamp
        BEFORE UPDATE ON ${schema}.${tablePrefix}documents
        FOR EACH ROW
        EXECUTE FUNCTION ${schema}.update_timestamp();

        DROP TRIGGER IF EXISTS update_${tablePrefix}query_history_timestamp ON ${schema}.${tablePrefix}query_history;
        CREATE TRIGGER update_${tablePrefix}query_history_timestamp
        BEFORE UPDATE ON ${schema}.${tablePrefix}query_history
        FOR EACH ROW
        EXECUTE FUNCTION ${schema}.update_timestamp();
      `);
      logger.info('Created timestamp update triggers');
    } catch (triggerError) {
      logger.warn('Could not create timestamp triggers:', triggerError.message);
    }

    // Create indexes for improved query performance
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS ${tablePrefix}documents_user_id_idx
        ON ${schema}.${tablePrefix}documents (user_id);
        
        CREATE INDEX IF NOT EXISTS ${tablePrefix}query_history_user_id_idx
        ON ${schema}.${tablePrefix}query_history (user_id);
        
        CREATE INDEX IF NOT EXISTS ${tablePrefix}query_history_query_type_idx
        ON ${schema}.${tablePrefix}query_history (query_type);
        
        CREATE INDEX IF NOT EXISTS ${tablePrefix}query_history_created_at_idx
        ON ${schema}.${tablePrefix}query_history (created_at);
      `);
      logger.info('Created performance indexes');
    } catch (indexError) {
      logger.warn('Could not create performance indexes:', indexError.message);
    }

    logger.info('PostgreSQL RAG setup completed successfully');
  } catch (error) {
    logger.error('Error setting up PostgreSQL for RAG:', error);
    throw error;
  } finally {
    await client.end();
    logger.info('PostgreSQL connection closed');
  }
}

// Run the setup if executed directly
if (require.main === module) {
  setupPostgresForRag()
    .then(() => {
      logger.info('Setup script completed');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Setup script failed:', error);
      process.exit(1);
    });
}

module.exports = setupPostgresForRag;