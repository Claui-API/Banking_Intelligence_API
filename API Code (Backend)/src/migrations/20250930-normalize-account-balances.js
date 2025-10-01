'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		console.log('Starting balance normalization migration...');

		// First, add the dataQualityFlags column if it doesn't exist
		try {
			await queryInterface.addColumn('Accounts', 'dataQualityFlags', {
				type: Sequelize.JSONB,
				allowNull: true,
				comment: 'Tracks any data quality issues like inferred balances'
			});
		} catch (error) {
			console.log('dataQualityFlags column may already exist, continuing...');
		}

		// Fix accounts where balance is null but availableBalance exists
		const balanceNullResult = await queryInterface.sequelize.query(`
      UPDATE "Accounts" 
      SET 
        balance = "availableBalance",
        "dataQualityFlags" = COALESCE("dataQualityFlags", '{}')::jsonb || 
          '{"balanceNormalization": ["balance_inferred_from_available"], "migratedAt": "'||NOW()||'"}'::jsonb
      WHERE balance IS NULL 
      AND "availableBalance" IS NOT NULL;
    `);

		// Fix accounts where availableBalance is null but balance exists  
		const availableNullResult = await queryInterface.sequelize.query(`
      UPDATE "Accounts" 
      SET 
        "availableBalance" = balance,
        "dataQualityFlags" = COALESCE("dataQualityFlags", '{}')::jsonb || 
          '{"balanceNormalization": ["available_inferred_from_balance"], "migratedAt": "'||NOW()||'"}'::jsonb
      WHERE "availableBalance" IS NULL 
      AND balance IS NOT NULL;
    `);

		// Set both to 0 if both are null
		const bothNullResult = await queryInterface.sequelize.query(`
      UPDATE "Accounts" 
      SET 
        balance = 0, 
        "availableBalance" = 0,
        "dataQualityFlags" = COALESCE("dataQualityFlags", '{}')::jsonb || 
          '{"balanceNormalization": ["both_defaulted_to_zero"], "migratedAt": "'||NOW()||'"}'::jsonb
      WHERE balance IS NULL 
      AND "availableBalance" IS NULL;
    `);

		console.log(`Migration completed:
      - Fixed ${balanceNullResult[0].rowCount || 0} accounts with null balance
      - Fixed ${availableNullResult[0].rowCount || 0} accounts with null availableBalance  
      - Fixed ${bothNullResult[0].rowCount || 0} accounts with both null`);

		// Make columns NOT NULL with defaults
		await queryInterface.changeColumn('Accounts', 'balance', {
			type: Sequelize.DECIMAL(12, 2),
			allowNull: false,
			defaultValue: 0
		});

		await queryInterface.changeColumn('Accounts', 'availableBalance', {
			type: Sequelize.DECIMAL(12, 2),
			allowNull: false,
			defaultValue: 0
		});

		console.log('Columns updated to NOT NULL with defaults');
	},

	down: async (queryInterface, Sequelize) => {
		// Rollback: Allow nulls again
		await queryInterface.changeColumn('Accounts', 'balance', {
			type: Sequelize.DECIMAL(12, 2),
			allowNull: true
		});

		await queryInterface.changeColumn('Accounts', 'availableBalance', {
			type: Sequelize.DECIMAL(12, 2),
			allowNull: true
		});

		// Remove the dataQualityFlags column
		await queryInterface.removeColumn('Accounts', 'dataQualityFlags');

		console.log('Rollback completed');
	}
};