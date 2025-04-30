// scripts/fix-postgres-rag.js
const { Client } = require('pg');
const dotenv = require('dotenv');
const logger = require('../utils/logger');

// Load environment variables
dotenv.config();

/**
 * Fix PostgreSQL setup issues for RAG
 * This script addresses the warnings from the initial setup:
 * 1. Creates a basic vector index that should work on all PostgreSQL versions with pgvector
 * 2. Creates simple timestamp triggers
 * 3. Creates standard indexes without advanced options
 */
async function fixPostgresRag() {
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

    // Make sure tables exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${schema}.${tablePrefix}documents (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL,
        title VARCHAR(255) NOT NULL,
        text TEXT NOT NULL,
        metadata JSONB,
        embedding vector(1536),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ${schema}.${tablePrefix}query_history (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL,
        query TEXT NOT NULL,
        query_type VARCHAR(50) NOT NULL,
        response TEXT NOT NULL,
        used_cohere_rag BOOLEAN DEFAULT TRUE,
        document_ids UUID[],
        metrics JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    logger.info('Tables verified');

    // Try creating a simpler vector index
    try {
      logger.info('Creating simpler vector index...');
      await client.query(`
        CREATE INDEX IF NOT EXISTS ${tablePrefix}documents_embedding_simple_idx
        ON ${schema}.${tablePrefix}documents
        USING ivfflat (embedding vector_cosine_ops);
      `);
      logger.info('Simple vector index created successfully');
    } catch (vectorError) {
      logger.warn('Could not create ivfflat index:', vectorError.message);
      
      try {
        logger.info('Trying GiST index instead...');
        await client.query(`
          CREATE INDEX IF NOT EXISTS ${tablePrefix}documents_embedding_gist_idx
          ON ${schema}.${tablePrefix}documents
          USING gist (embedding vector_ops);
        `);
        logger.info('GiST vector index created successfully');
      } catch (gistError) {
        logger.warn('Could not create GiST index:', gistError.message);
        logger.info('Vector searching will be slower but still functional');
      }
    }

    // Create simpler timestamp triggers without using functions
    try {
      logger.info('Creating simpler timestamp triggers...');
      await client.query(`
        -- Drop any existing triggers first
        DROP TRIGGER IF EXISTS update_${tablePrefix}documents_timestamp ON ${schema}.${tablePrefix}documents;
        DROP TRIGGER IF EXISTS update_${tablePrefix}query_history_timestamp ON ${schema}.${tablePrefix}query_history;
        
        -- Create new triggers (PostgreSQL 9.5+)
        CREATE OR REPLACE TRIGGER update_${tablePrefix}documents_timestamp
        BEFORE UPDATE ON ${schema}.${tablePrefix}documents
        FOR EACH ROW
        EXECUTE FUNCTION ${schema}.update_modified_column();
      `);
      logger.info('Created document timestamp trigger');
    } catch (triggerError) {
      logger.warn('Could not create new timestamp triggers:', triggerError.message);
      
      // Try an alternative approach
      try {
        logger.info('Creating timestamp update function...');
        
        await client.query(`
          -- Create the function if it doesn't exist
          CREATE OR REPLACE FUNCTION ${schema}.update_modified_column()
          RETURNS TRIGGER AS $$
          BEGIN
              NEW.updated_at = NOW();
              RETURN NEW;
          END;
          $$ LANGUAGE plpgsql;
        `);
        
        await client.query(`
          -- Try creating trigger again after creating function
          CREATE TRIGGER update_${tablePrefix}documents_timestamp
          BEFORE UPDATE ON ${schema}.${tablePrefix}documents
          FOR EACH ROW
          EXECUTE FUNCTION ${schema}.update_modified_column();
          
          CREATE TRIGGER update_${tablePrefix}query_history_timestamp
          BEFORE UPDATE ON ${schema}.${tablePrefix}query_history
          FOR EACH ROW
          EXECUTE FUNCTION ${schema}.update_modified_column();
        `);
        logger.info('Created timestamp triggers using update function');
      } catch (funcError) {
        logger.warn('Could not create timestamp update function:', funcError.message);
        logger.info('Will rely on application-level timestamp management');
      }
    }

    // Create basic indexes without advanced options
    try {
      logger.info('Creating standard indexes...');
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
      logger.info('Created standard indexes successfully');
    } catch (indexError) {
      logger.warn('Could not create all standard indexes:', indexError.message);
      
      // Try creating indexes one by one
      try {
        await client.query(`
          CREATE INDEX IF NOT EXISTS ${tablePrefix}documents_user_id_idx
          ON ${schema}.${tablePrefix}documents (user_id);
        `);
        logger.info('Created documents user_id index');
      } catch (e) {
        logger.warn('Failed to create documents user_id index:', e.message);
      }
      
      try {
        await client.query(`
          CREATE INDEX IF NOT EXISTS ${tablePrefix}query_history_user_id_idx
          ON ${schema}.${tablePrefix}query_history (user_id);
        `);
        logger.info('Created query_history user_id index');
      } catch (e) {
        logger.warn('Failed to create query_history user_id index:', e.message);
      }
    }

    // Create basic similarity function without using pgvector's specialized operators
    try {
      logger.info('Creating basic similarity function...');
      await client.query(`
        CREATE OR REPLACE FUNCTION ${schema}.cosine_similarity(a vector, b vector)
        RETURNS float AS $$
        DECLARE
          result float;
        BEGIN
          SELECT a <=> b INTO result;
          RETURN 1.0 - result;
        END;
        $$ LANGUAGE plpgsql IMMUTABLE STRICT;
      `);
      logger.info('Created cosine similarity function');
      
      // Create a function to find similar documents
      await client.query(`
        CREATE OR REPLACE FUNCTION ${schema}.find_similar_documents(
          p_user_id UUID,
          p_embedding vector,
          p_limit INT DEFAULT 5
        )
        RETURNS TABLE (
          id UUID,
          title TEXT,
          text TEXT,
          similarity FLOAT
        )
        AS $$
        BEGIN
          RETURN QUERY
          SELECT 
            d.id,
            d.title,
            d.text,
            ${schema}.cosine_similarity(d.embedding, p_embedding) AS similarity
          FROM ${schema}.${tablePrefix}documents d
          WHERE d.user_id = p_user_id
            AND d.embedding IS NOT NULL
          ORDER BY ${schema}.cosine_similarity(d.embedding, p_embedding) DESC
          LIMIT p_limit;
        END;
        $$ LANGUAGE plpgsql;
      `);
      logger.info('Created document similarity search function');
    } catch (funcError) {
      logger.warn('Could not create similarity functions:', funcError.message);
    }

    logger.info('PostgreSQL RAG fixes completed successfully');
  } catch (error) {
    logger.error('Error fixing PostgreSQL for RAG:', error);
    throw error;
  } finally {
    await client.end();
    logger.info('PostgreSQL connection closed');
  }
}

// Run the fixes if executed directly
if (require.main === module) {
  fixPostgresRag()
    .then(() => {
      logger.info('Fix script completed');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Fix script failed:', error);
      process.exit(1);
    });
}

module.exports = fixPostgresRag;