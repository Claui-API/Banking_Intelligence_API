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
    return plaidTransactions.map(transaction => ({
      transactionId: transaction.transaction_id,
      accountId: transaction.account_id,
      date: transaction.date,
      description: transaction.name,
      amount: transaction.amount,
      category: transaction.category?.[0] || 'Uncategorized',
      merchantName: transaction.merchant_name
    }));
  }
};