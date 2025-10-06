// Replace your migrate-accounts.js with this corrected version:
const { sequelize } = require('./src/config/database');

async function migrateAccountBalances() {
	try {
		console.log('Starting account balance migration...');

		// Add the dataQualityFlags column
		console.log('Adding dataQualityFlags column...');
		try {
			await sequelize.getQueryInterface().addColumn('Accounts', 'dataQualityFlags', {
				type: sequelize.Sequelize.JSONB,
				allowNull: true,
				comment: 'Tracks any data quality issues like inferred balances'
			});
			console.log('✓ Column added');
		} catch (error) {
			if (error.message.includes('already exists')) {
				console.log('✓ Column already exists, continuing...');
			} else {
				throw error;
			}
		}

		// Get current timestamp for JSON
		const now = new Date().toISOString();

		// Fix null balances - CORRECTED JSON
		console.log('Fixing accounts with null balance...');
		const result1 = await sequelize.query(`
      UPDATE "Accounts" 
      SET 
        balance = "availableBalance",
        "dataQualityFlags" = COALESCE("dataQualityFlags", '{}'::jsonb) || 
          jsonb_build_object('balanceNormalization', '["balance_inferred_from_available"]'::jsonb, 'migratedAt', :now)
      WHERE balance IS NULL 
      AND "availableBalance" IS NOT NULL;
    `, {
			replacements: { now }
		});
		console.log(`✓ Fixed ${result1[0].rowCount || 0} accounts with null balance`);

		// Fix null availableBalance - CORRECTED JSON
		console.log('Fixing accounts with null availableBalance...');
		const result2 = await sequelize.query(`
      UPDATE "Accounts" 
      SET 
        "availableBalance" = balance,
        "dataQualityFlags" = COALESCE("dataQualityFlags", '{}'::jsonb) || 
          jsonb_build_object('balanceNormalization', '["available_inferred_from_balance"]'::jsonb, 'migratedAt', :now)
      WHERE "availableBalance" IS NULL 
      AND balance IS NOT NULL;
    `, {
			replacements: { now }
		});
		console.log(`✓ Fixed ${result2[0].rowCount || 0} accounts with null availableBalance`);

		// Fix accounts where both are null - CORRECTED JSON
		console.log('Fixing accounts with both balances null...');
		const result3 = await sequelize.query(`
      UPDATE "Accounts" 
      SET 
        balance = 0, 
        "availableBalance" = 0,
        "dataQualityFlags" = COALESCE("dataQualityFlags", '{}'::jsonb) || 
          jsonb_build_object('balanceNormalization', '["both_defaulted_to_zero"]'::jsonb, 'migratedAt', :now)
      WHERE balance IS NULL 
      AND "availableBalance" IS NULL;
    `, {
			replacements: { now }
		});
		console.log(`✓ Fixed ${result3[0].rowCount || 0} accounts with both null`);

		// Make columns NOT NULL
		console.log('Making balance columns NOT NULL...');
		await sequelize.getQueryInterface().changeColumn('Accounts', 'balance', {
			type: sequelize.Sequelize.DECIMAL(12, 2),
			allowNull: false,
			defaultValue: 0
		});

		await sequelize.getQueryInterface().changeColumn('Accounts', 'availableBalance', {
			type: sequelize.Sequelize.DECIMAL(12, 2),
			allowNull: false,
			defaultValue: 0
		});
		console.log('✓ Columns updated to NOT NULL');

		// Mark as completed in SequelizeMeta table
		await sequelize.query(`
      INSERT INTO "SequelizeMeta" (name) 
      VALUES ('20250930-normalize-account-balances.js')
      ON CONFLICT (name) DO NOTHING;
    `);
		console.log('✓ Migration marked as completed');

		console.log('🎉 Migration completed successfully!');

	} catch (error) {
		console.error('Migration failed:', error);
		throw error;
	} finally {
		await sequelize.close();
		process.exit(0);
	}
}

migrateAccountBalances();