// plaidDataAdapter.service.js
export const plaidDataAdapter = {
  transformAccounts(plaidAccounts) {
    return plaidAccounts.map(account => ({
      accountId: account.account_id,
      name: account.name,
      type: account.type,
      subtype: account.subtype,
      balance: account.balances.current,
      availableBalance: account.balances.available,
      currency: account.balances.iso_currency_code
    }));
  },

  transformTransactions(plaidTransactions) {
    return plaidTransactions.map(transaction => {
      // Handle different possible category formats
      let category = 'Uncategorized';

      if (transaction.category) {
        // If category is an array, take the first element
        if (Array.isArray(transaction.category) && transaction.category.length > 0) {
          category = transaction.category[0];
        }
        // If category is already a string, use it directly
        else if (typeof transaction.category === 'string') {
          category = transaction.category;
        }
      }

      return {
        transactionId: transaction.transaction_id,
        accountId: transaction.account_id,
        date: transaction.date,
        description: transaction.name,
        amount: transaction.amount,
        category: category,
        merchantName: transaction.merchant_name,
        // Store the full category array for reference if needed
        categoryDetail: Array.isArray(transaction.category) ? transaction.category : [category]
      };
    });
  }
};