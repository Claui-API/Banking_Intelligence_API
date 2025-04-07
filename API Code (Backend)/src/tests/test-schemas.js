// test-schemas.js
const mongoose = require('mongoose');

// Load models
const Transaction = require('E:/Documents/Prof_Docs/VivyTech/VivyTech_Codes/API Code/financial-insights-api/src/models/Transaction.js');
const Account = require('E:/Documents/Prof_Docs/VivyTech/VivyTech_Codes/API Code/financial-insights-api/src/models/Account');
const UserProfile = require('E:/Documents/Prof_Docs/VivyTech/VivyTech_Codes/API Code/financial-insights-api/src/models/UserProfile');
const SpendingPattern = require('E:/Documents/Prof_Docs/VivyTech/VivyTech_Codes/API Code/financial-insights-api/src/models/SpendingPattern');

// Validate schema definitions without connecting to a database
console.log('Transaction Schema:', Object.keys(Transaction.schema.paths));
console.log('Account Schema:', Object.keys(Account.schema.paths));
console.log('UserProfile Schema:', Object.keys(UserProfile.schema.paths));
console.log('SpendingPattern Schema:', Object.keys(SpendingPattern.schema.paths));

console.log('All schemas loaded successfully!');