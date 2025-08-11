// src/components/Chat/VisualFinanceMode.js - Complete file
import React, { useState, useEffect } from 'react';
import {
	BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
	Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import './VisualFinanceMode.css';

// COLORS for consistent visual styling
const COLORS = ['#28a745', '#20c997', '#17a2b8', '#6610f2', '#e83e8c', '#dc3545'];

// This component adds a visual mode toggle to the CLAU chat interface
// and renders interactive visualizations for financial concepts
const processFinancialData = (financialData, concept) => {
	if (!financialData || !concept) return null;

	// Create a processed data object
	const processedData = {};

	try {
		// Process based on concept
		switch (concept) {
			case 'budgeting':
				// Process real spending by category
				if (financialData.transactions?.length > 0) {
					const categorizedSpending = {};

					// Group transactions by category
					financialData.transactions.forEach(transaction => {
						if (transaction.amount < 0 && transaction.category) {
							const category = transaction.category;
							const amount = Math.abs(transaction.amount);

							if (categorizedSpending[category]) {
								categorizedSpending[category] += amount;
							} else {
								categorizedSpending[category] = amount;
							}
						}
					});

					// Convert to array for chart data
					const realSpendingData = Object.entries(categorizedSpending)
						.map(([category, amount]) => ({ category, amount }))
						.sort((a, b) => b.amount - a.amount)
						.slice(0, 7); // Take top 7 categories

					if (realSpendingData.length > 0) {
						processedData.spending = realSpendingData;
					}

					// Calculate real budget vs actual
					const currentMonth = new Date().getMonth();
					const lastSixMonths = Array.from({ length: 6 }, (_, i) => {
						const date = new Date();
						date.setMonth(currentMonth - i);
						return date.toLocaleString('default', { month: 'short' });
					}).reverse();

					// Calculate monthly totals
					const monthlyData = lastSixMonths.map(month => {
						// Estimate budget as average monthly income
						const avgIncome = financialData.transactions
							.filter(tx => tx.amount > 0)
							.reduce((sum, tx) => sum + tx.amount, 0) / 6;

						// Calculate actual spending for this month
						const monthlySpending = financialData.transactions
							.filter(tx => {
								const txDate = new Date(tx.date);
								const txMonth = txDate.toLocaleString('default', { month: 'short' });
								return txMonth === month && tx.amount < 0;
							})
							.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

						return {
							month,
							budget: Math.round(avgIncome),
							actual: Math.round(monthlySpending)
						};
					});

					if (monthlyData.length > 0) {
						processedData.comparison = monthlyData;
					}
				}
				break;

			case 'saving':
				// Process savings rate and growth data
				if (financialData.transactions?.length > 0) {
					// Calculate monthly income and expenses to determine savings rate
					const incomeTransactions = financialData.transactions.filter(tx => tx.amount > 0);
					const expenseTransactions = financialData.transactions.filter(tx => tx.amount < 0);

					const totalIncome = incomeTransactions.reduce((sum, tx) => sum + tx.amount, 0);
					const totalExpenses = expenseTransactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

					// Calculate savings rate (if income > 0)
					if (totalIncome > 0) {
						const savingsRate = Math.round(((totalIncome - totalExpenses) / totalIncome) * 100);

						// Create savings rate trend data (estimate previous rates based on current)
						const savingsRateData = [
							{ period: '2021', rate: Math.max(0, Math.round(savingsRate * 0.7)) },
							{ period: '2022', rate: Math.max(0, Math.round(savingsRate * 0.8)) },
							{ period: '2023', rate: Math.max(0, Math.round(savingsRate * 0.9)) },
							{ period: '2024', rate: Math.max(0, savingsRate) },
							{ period: '2025', rate: Math.max(0, Math.round(savingsRate * 1.1)) }
						];

						processedData.savingsRate = savingsRateData;
					}

					// Generate savings growth projection based on current savings
					const savingsAccounts = financialData.accounts.filter(a =>
						a.type?.toLowerCase().includes('saving') || a.name?.toLowerCase().includes('saving')
					);

					if (savingsAccounts.length > 0) {
						const currentSavings = savingsAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);

						// Create a 6-month savings growth projection with 1% monthly growth
						const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
						const growthRate = 1.01; // 1% monthly growth

						const savingsGrowth = months.map((month, i) => ({
							month,
							amount: Math.round(currentSavings * Math.pow(growthRate, i))
						}));

						processedData.savingsGrowth = savingsGrowth;
					}
				}
				break;

			case 'investing':
				// Create investment-related data if appropriate accounts exist
				const investmentAccounts = financialData.accounts.filter(a =>
					a.type?.toLowerCase().includes('invest') ||
					a.name?.toLowerCase().includes('401k') ||
					a.name?.toLowerCase().includes('ira')
				);

				if (investmentAccounts.length > 0) {
					// Extract investment balances
					const totalInvestments = investmentAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);

					// Create estimated asset allocation based on account types
					const assetAllocation = [
						{ name: 'Stocks', value: Math.round(totalInvestments * 0.6), fill: '#28a745' },
						{ name: 'Bonds', value: Math.round(totalInvestments * 0.25), fill: '#20c997' },
						{ name: 'Real Estate', value: Math.round(totalInvestments * 0.1), fill: '#17a2b8' },
						{ name: 'Cash', value: Math.round(totalInvestments * 0.05), fill: '#6610f2' }
					];

					processedData.assetAllocation = assetAllocation;

					// Create compound interest projection
					const compoundInterest = Array.from({ length: 30 }, (_, i) => ({
						year: i + 1,
						value: Math.round(totalInvestments * Math.pow(1.07, i))
					}));

					processedData.compoundInterest = compoundInterest;
				}
				break;

			case 'debt':
				// Process debt-related data
				const debtAccounts = financialData.accounts.filter(a =>
					a.type?.toLowerCase().includes('loan') ||
					a.type?.toLowerCase().includes('credit') ||
					a.balance < 0
				);

				if (debtAccounts.length > 0) {
					// Create debt breakdown by type
					const debtTypes = debtAccounts.map((account, i) => ({
						name: account.name || `Debt ${i + 1}`,
						value: Math.abs(account.balance),
						fill: COLORS[i % COLORS.length]
					}));

					processedData.debtTypes = debtTypes;

					// Calculate total debt for payoff projections
					const totalDebt = debtAccounts.reduce((sum, a) => sum + Math.abs(a.balance), 0);

					// Create debt payoff strategies comparison
					const payoffStrategies = Array.from({ length: 7 }, (_, i) => {
						const month = i * 6; // 0, 6, 12, 18, 24, 30, 36
						const avalancheRemaining = Math.max(0, Math.round(totalDebt * (1 - (month * 0.03))));
						const snowballRemaining = Math.max(0, Math.round(totalDebt * (1 - (month * 0.025))));

						return {
							month: month === 0 ? 1 : month,
							avalanche: avalancheRemaining,
							snowball: snowballRemaining
						};
					});

					processedData.payoffStrategies = payoffStrategies;
				}
				break;

			default:
				// For general financial overview
				if (financialData.transactions?.length > 0 && financialData.accounts?.length > 0) {
					// Calculate financial health metrics
					const totalAssets = financialData.accounts
						.filter(a => a.balance > 0)
						.reduce((sum, a) => sum + a.balance, 0);

					const totalLiabilities = financialData.accounts
						.filter(a => a.balance < 0)
						.reduce((sum, a) => sum + Math.abs(a.balance), 0);

					// Calculate metrics as percentages (0-100)
					const getSavingsScore = () => {
						const savingsAccounts = financialData.accounts.filter(a =>
							a.type?.toLowerCase().includes('saving') || a.name?.toLowerCase().includes('saving')
						);
						const totalSavings = savingsAccounts.reduce((sum, a) => sum + a.balance, 0);
						const income = financialData.transactions
							.filter(tx => tx.amount > 0)
							.reduce((sum, tx) => sum + tx.amount, 0);

						// Score based on savings as percentage of monthly income
						return Math.min(100, Math.round((totalSavings / (income || 1)) * 25));
					};

					const getDebtScore = () => {
						if (totalLiabilities === 0) return 100; // No debt = perfect score
						const debtToAssetRatio = totalAssets / (totalLiabilities || 1);
						return Math.min(100, Math.round(debtToAssetRatio * 25));
					};

					const getSpendingScore = () => {
						const income = financialData.transactions
							.filter(tx => tx.amount > 0)
							.reduce((sum, tx) => sum + tx.amount, 0);

						const expenses = financialData.transactions
							.filter(tx => tx.amount < 0)
							.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

						if (income === 0) return 50; // No income data
						const savingsRate = (income - expenses) / income;
						return Math.min(100, Math.max(0, Math.round(savingsRate * 100)));
					};

					// Create financial health metrics
					const financialHealth = [
						{ category: 'Savings', value: getSavingsScore() },
						{ category: 'Debt', value: getDebtScore() },
						{ category: 'Spending', value: getSpendingScore() },
						{ category: 'Investing', value: Math.round(Math.random() * 40) + 30 }, // Placeholder
						{ category: 'Protection', value: Math.round(Math.random() * 30) + 50 } // Placeholder
					];

					processedData.financialHealth = financialHealth;

					// Create income vs expenses data
					const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
					const incomeVsExpenses = months.map(month => {
						// Generate realistic monthly data
						const baseIncome = financialData.transactions
							.filter(tx => tx.amount > 0)
							.reduce((sum, tx) => sum + tx.amount, 0) / months.length;

						const baseExpenses = financialData.transactions
							.filter(tx => tx.amount < 0)
							.reduce((sum, tx) => sum + Math.abs(tx.amount), 0) / months.length;

						// Add some variation
						const variationFactor = 0.9 + (Math.random() * 0.2); // 0.9 to 1.1

						return {
							month,
							income: Math.round(baseIncome * variationFactor),
							expenses: Math.round(baseExpenses * variationFactor)
						};
					});

					processedData.incomeVsExpenses = incomeVsExpenses;

					// Create net worth trend
					const years = [2020, 2021, 2022, 2023, 2024];
					const currentNetWorth = totalAssets - totalLiabilities;

					// Estimate historical net worth with a growth trend
					const netWorthTrend = years.map((year, i) => {
						const yearFactor = 0.7 + (i * 0.075); // 0.7, 0.775, 0.85, 0.925, 1.0

						// Estimate assets and liabilities for previous years
						return {
							year,
							assets: Math.round(totalAssets * yearFactor),
							liabilities: Math.round(totalLiabilities * (1 + (0.2 * (4 - i)))) // Liabilities decrease over time
						};
					});

					processedData.netWorthTrend = netWorthTrend;
				}
				break;
		}

		return processedData;
	} catch (error) {
		console.error('Error processing financial data for visualization:', error);
		return null;
	}
};

const VisualFinanceMode = ({
	enabled = false,
	onToggle,
	financialData = null,
	conceptData = null,
	loading = false
}) => {
	const [activeTab, setActiveTab] = useState('overview');
	const [animateCharts, setAnimateCharts] = useState(false);
	const [chartData, setChartData] = useState(null);

	// COLORS for consistent visual styling
	const COLORS = ['#28a745', '#20c997', '#17a2b8', '#6610f2', '#e83e8c', '#dc3545'];

	useEffect(() => {
		// Reset activeTab when concept changes
		if (enabled && conceptData) {
			setActiveTab('overview');
			setAnimateCharts(false);
			generateChartData(conceptData.concept);

			// Re-trigger animation after a short delay
			const timer = setTimeout(() => {
				setAnimateCharts(true);
			}, 300);
			return () => clearTimeout(timer);
		}
	}, [enabled, conceptData?.concept]); // Note the dependency on conceptData.concept specifically

	useEffect(() => {
		// Animate charts after a short delay when they're first shown
		if (enabled && chartData) {
			const timer = setTimeout(() => {
				setAnimateCharts(true);
			}, 300);
			return () => clearTimeout(timer);
		}
	}, [enabled, chartData]);

	// Generate appropriate chart data based on the financial concept
	const generateChartData = (concept) => {
		let data = {};

		switch (concept) {
			case 'budgeting':
				data = {
					budget: [
						{ name: 'Needs', value: 50, fill: COLORS[0] },
						{ name: 'Wants', value: 30, fill: COLORS[1] },
						{ name: 'Savings', value: 20, fill: COLORS[2] }
					],
					spending: [
						{ category: 'Housing', amount: 1200 },
						{ category: 'Food', amount: 600 },
						{ category: 'Transport', amount: 400 },
						{ category: 'Utilities', amount: 300 },
						{ category: 'Entertainment', amount: 200 },
						{ category: 'Shopping', amount: 250 },
						{ category: 'Savings', amount: 500 }
					],
					comparison: [
						{ month: 'Jan', budget: 3000, actual: 3100 },
						{ month: 'Feb', budget: 3000, actual: 2900 },
						{ month: 'Mar', budget: 3000, actual: 3200 },
						{ month: 'Apr', budget: 3000, actual: 2800 },
						{ month: 'May', budget: 3000, actual: 3050 },
						{ month: 'Jun', budget: 3000, actual: 2950 }
					]
				};
				break;

			case 'saving':
				data = {
					savingsGoals: [
						{ name: 'Emergency Fund', target: 10000, current: 4000 },
						{ name: 'Vacation', target: 5000, current: 2500 },
						{ name: 'Down Payment', target: 50000, current: 12000 }
					],
					savingsGrowth: [
						{ month: 'Jan', amount: 10000 },
						{ month: 'Feb', amount: 10500 },
						{ month: 'Mar', amount: 11025 },
						{ month: 'Apr', amount: 11576 },
						{ month: 'May', amount: 12155 },
						{ month: 'Jun', amount: 12763 }
					],
					savingsRate: [
						{ period: '2020', rate: 5 },
						{ period: '2021', rate: 7 },
						{ period: '2022', rate: 10 },
						{ period: '2023', rate: 12 },
						{ period: '2024', rate: 15 }
					]
				};
				break;

			case 'investing':
				data = {
					assetAllocation: [
						{ name: 'Stocks', value: 60, fill: COLORS[0] },
						{ name: 'Bonds', value: 25, fill: COLORS[1] },
						{ name: 'Real Estate', value: 10, fill: COLORS[2] },
						{ name: 'Cash', value: 5, fill: COLORS[3] }
					],
					returns: [
						{ year: '2020', stocks: 12, bonds: 5, cash: 1 },
						{ year: '2021', stocks: 25, bonds: 3, cash: 0.5 },
						{ year: '2022', stocks: -15, bonds: -5, cash: 1 },
						{ year: '2023', stocks: 18, bonds: 4, cash: 3 },
						{ year: '2024', stocks: 10, bonds: 6, cash: 4 }
					],
					compoundInterest: Array.from({ length: 30 }, (_, i) => ({
						year: i + 1,
						value: Math.round(10000 * Math.pow(1.07, i))
					}))
				};
				break;

			case 'debt':
				data = {
					debtTypes: [
						{ name: 'Mortgage', value: 250000, fill: COLORS[0] },
						{ name: 'Student Loans', value: 35000, fill: COLORS[1] },
						{ name: 'Auto Loan', value: 18000, fill: COLORS[2] },
						{ name: 'Credit Cards', value: 7000, fill: COLORS[3] }
					],
					payoffStrategies: [
						{ month: 1, avalanche: 310000, snowball: 310000 },
						{ month: 6, avalanche: 295000, snowball: 298000 },
						{ month: 12, avalanche: 280000, snowball: 286000 },
						{ month: 18, avalanche: 265000, snowball: 274000 },
						{ month: 24, avalanche: 250000, snowball: 262000 },
						{ month: 30, avalanche: 235000, snowball: 250000 },
						{ month: 36, avalanche: 220000, snowball: 238000 }
					],
					interestComparison: [
						{ rate: '3%', payment: 1265, totalInterest: 152440 },
						{ rate: '4%', payment: 1432, totalInterest: 215520 },
						{ rate: '5%', payment: 1610, totalInterest: 284600 },
						{ rate: '6%', payment: 1799, totalInterest: 359640 },
						{ rate: '7%', payment: 1996, totalInterest: 440560 }
					]
				};
				break;

			case 'credit':
				data = {
					scoreFactors: [
						{ name: 'Payment History', value: 35, fill: COLORS[0] },
						{ name: 'Credit Utilization', value: 30, fill: COLORS[1] },
						{ name: 'Length of History', value: 15, fill: COLORS[2] },
						{ name: 'New Credit', value: 10, fill: COLORS[3] },
						{ name: 'Credit Mix', value: 10, fill: COLORS[4] }
					],
					scoreImprovement: [
						{ month: 'Jan', score: 650 },
						{ month: 'Feb', score: 660 },
						{ month: 'Mar', score: 675 },
						{ month: 'Apr', score: 690 },
						{ month: 'May', score: 705 },
						{ month: 'Jun', score: 720 }
					],
					utilizationImpact: [
						{ utilization: '10%', score: 750 },
						{ utilization: '20%', score: 725 },
						{ utilization: '30%', score: 700 },
						{ utilization: '50%', score: 650 },
						{ utilization: '75%', score: 600 },
						{ utilization: '90%', score: 550 }
					]
				};
				break;

			case 'retirement':
				data = {
					retirementSources: [
						{ name: 'Social Security', value: 30, fill: COLORS[0] },
						{ name: '401(k)/IRA', value: 45, fill: COLORS[1] },
						{ name: 'Pension', value: 10, fill: COLORS[2] },
						{ name: 'Personal Savings', value: 15, fill: COLORS[3] }
					],
					savingsProjection: Array.from({ length: 30 }, (_, i) => ({
						year: 2025 + i,
						conservative: Math.round(100000 * Math.pow(1.05, i)),
						moderate: Math.round(100000 * Math.pow(1.07, i)),
						aggressive: Math.round(100000 * Math.pow(1.09, i))
					})),
					withdrawalRates: [
						{ rate: '3%', years: 50 },
						{ rate: '4%', years: 33 },
						{ rate: '5%', years: 25 },
						{ rate: '6%', years: 20 },
						{ rate: '7%', years: 17 }
					]
				};
				break;

			default:
				// For any other concepts or general financial education
				data = {
					financialHealth: [
						{ category: 'Savings', value: 65 },
						{ category: 'Debt', value: 78 },
						{ category: 'Spending', value: 55 },
						{ category: 'Investing', value: 40 },
						{ category: 'Protection', value: 70 }
					],
					incomeVsExpenses: [
						{ month: 'Jan', income: 5000, expenses: 4200 },
						{ month: 'Feb', income: 5000, expenses: 4500 },
						{ month: 'Mar', income: 5200, expenses: 4100 },
						{ month: 'Apr', income: 5000, expenses: 4300 },
						{ month: 'May', income: 5100, expenses: 4200 },
						{ month: 'Jun', income: 5000, expenses: 4000 }
					],
					netWorthTrend: [
						{ year: 2020, assets: 120000, liabilities: 100000 },
						{ year: 2021, assets: 135000, liabilities: 95000 },
						{ year: 2022, assets: 150000, liabilities: 90000 },
						{ year: 2023, assets: 170000, liabilities: 85000 },
						{ year: 2024, assets: 190000, liabilities: 80000 }
					]
				};
		}

		setChartData(data);
	};

	// If real financial data is available, use it to create customized visualizations
	useEffect(() => {
		if (enabled && financialData && conceptData) {
			// Process actual user financial data to create relevant visualizations
			const processedData = processFinancialData(financialData, conceptData.concept);

			if (processedData) {
				// Update chart data with processed real data
				setChartData(prevData => ({
					...prevData,
					...processedData
				}));
			}
		}
	}, [enabled, financialData, conceptData]);

	// Custom tab component
	const Tab = ({ active, label, onClick }) => (
		<button
			className={`px-4 py-2 rounded-t-md border-none ${active
				? 'bg-green-600 text-white font-medium'
				: 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
			onClick={onClick}
		>
			{label}
		</button>
	);

	// Custom card component
	const Card = ({ title, children }) => (
		<div className="bg-gray-800 rounded-lg shadow-md overflow-hidden mb-4">
			<div className="p-4">
				{title && <h3 className="text-xl text-white mb-3">{title}</h3>}
				{children}
			</div>
		</div>
	);

	// Render budgeting visualizations
	const renderBudgetingVisuals = () => (
		<div className="space-y-4">
			<div className="flex space-x-2 mb-4 border-b border-gray-700">
				<Tab
					active={activeTab === 'overview'}
					label="50/30/20 Rule"
					onClick={() => setActiveTab('overview')}
				/>
				<Tab
					active={activeTab === 'details'}
					label="Spending Categories"
					onClick={() => setActiveTab('details')}
				/>
			</div>

			{activeTab === 'overview' ? (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<Card title="Budget Allocation">
						<div style={{ height: 300 }}>
							<ResponsiveContainer width="100%" height="100%">
								<PieChart>
									<Pie
										data={chartData.budget}
										cx="50%"
										cy="50%"
										labelLine={false}
										outerRadius={animateCharts ? 80 : 0}
										label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
										dataKey="value"
										animationDuration={1000}
										animationBegin={0}
									>
										{chartData.budget.map((entry, index) => (
											<Cell key={`cell-${index}`} fill={entry.fill} />
										))}
									</Pie>
									<Tooltip formatter={(value) => `${value}%`} />
								</PieChart>
							</ResponsiveContainer>
						</div>
						<p className="text-center text-gray-300 mt-2">
							The 50/30/20 rule suggests allocating 50% of your income to needs, 30% to wants, and 20% to savings.
						</p>
					</Card>

					<Card title="Budget vs. Actual">
						<div style={{ height: 300 }}>
							<ResponsiveContainer width="100%" height="100%">
								<LineChart data={chartData.comparison}>
									<CartesianGrid strokeDasharray="3 3" stroke="#444" />
									<XAxis dataKey="month" stroke="#fff" />
									<YAxis stroke="#fff" />
									<Tooltip
										contentStyle={{ backgroundColor: '#333', border: '1px solid #555' }}
										formatter={(value) => `$${value}`}
									/>
									<Legend />
									<Line
										type="monotone"
										dataKey="budget"
										stroke="#28a745"
										activeDot={{ r: 8 }}
										strokeWidth={2}
										animationDuration={1500}
										animationBegin={0}
										isAnimationActive={animateCharts}
									/>
									<Line
										type="monotone"
										dataKey="actual"
										stroke="#17a2b8"
										activeDot={{ r: 8 }}
										strokeWidth={2}
										animationDuration={1500}
										animationBegin={200}
										isAnimationActive={animateCharts}
									/>
								</LineChart>
							</ResponsiveContainer>
						</div>
						<p className="text-center text-gray-300 mt-2">
							Comparing your monthly budget to actual spending helps identify areas to adjust.
						</p>
					</Card>
				</div>
			) : (
				<Card title="Spending by Category">
					<div style={{ height: 400 }}>
						<ResponsiveContainer width="100%" height="100%">
							<BarChart data={chartData.spending}>
								<CartesianGrid strokeDasharray="3 3" stroke="#444" />
								<XAxis dataKey="category" stroke="#fff" />
								<YAxis stroke="#fff" />
								<Tooltip
									contentStyle={{ backgroundColor: '#333', border: '1px solid #555' }}
									formatter={(value) => `$${value}`}
								/>
								<Bar
									dataKey="amount"
									fill="#28a745"
									animationDuration={1500}
									animationBegin={0}
									isAnimationActive={animateCharts}
								/>
							</BarChart>
						</ResponsiveContainer>
					</div>
					<div className="mt-4">
						<h4 className="text-white text-lg mb-2">Tips for Effective Budgeting:</h4>
						<ul className="list-disc pl-5 text-gray-300">
							<li>Track all expenses, even small ones</li>
							<li>Review your budget regularly and adjust as needed</li>
							<li>Use budgeting apps to automate tracking</li>
							<li>Plan for irregular expenses like car maintenance</li>
						</ul>
					</div>
				</Card>
			)}
		</div>
	);

	// Render saving visualizations
	const renderSavingVisuals = () => (
		<div className="space-y-4">
			<div className="flex space-x-2 mb-4 border-b border-gray-700">
				<Tab
					active={activeTab === 'overview'}
					label="Savings Goals"
					onClick={() => setActiveTab('overview')}
				/>
				<Tab
					active={activeTab === 'rate'}
					label="Savings Rate"
					onClick={() => setActiveTab('rate')}
				/>
			</div>

			{activeTab === 'overview' ? (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<Card title="Progress Toward Goals">
						<div style={{ height: 300 }}>
							<ResponsiveContainer width="100%" height="100%">
								<BarChart
									layout="vertical"
									data={chartData.savingsGoals}
									margin={{ top: 20, right: 30, left: 60, bottom: 5 }}
								>
									<CartesianGrid strokeDasharray="3 3" stroke="#444" />
									<XAxis type="number" stroke="#fff" />
									<YAxis dataKey="name" type="category" stroke="#fff" />
									<Tooltip
										contentStyle={{ backgroundColor: '#333', border: '1px solid #555' }}
										formatter={(value) => `$${value.toLocaleString()}`}
									/>
									<Legend />
									<Bar
										dataKey="target"
										stackId="a"
										fill="#555"
										name="Target"
										animationDuration={1500}
										animationBegin={0}
										isAnimationActive={animateCharts}
									/>
									<Bar
										dataKey="current"
										stackId="a"
										fill="#28a745"
										name="Current"
										animationDuration={1500}
										animationBegin={200}
										isAnimationActive={animateCharts}
									/>
								</BarChart>
							</ResponsiveContainer>
						</div>
						<p className="text-center text-gray-300 mt-2">
							Tracking progress toward specific savings goals helps maintain motivation.
						</p>
					</Card>

					<Card title="Savings Growth">
						<div style={{ height: 300 }}>
							<ResponsiveContainer width="100%" height="100%">
								<AreaChart data={chartData.savingsGrowth}>
									<CartesianGrid strokeDasharray="3 3" stroke="#444" />
									<XAxis dataKey="month" stroke="#fff" />
									<YAxis stroke="#fff" />
									<Tooltip
										contentStyle={{ backgroundColor: '#333', border: '1px solid #555' }}
										formatter={(value) => `$${value.toLocaleString()}`}
									/>
									<Area
										type="monotone"
										dataKey="amount"
										stroke="#28a745"
										fill="#28a74580"
										animationDuration={1500}
										animationBegin={0}
										isAnimationActive={animateCharts}
									/>
								</AreaChart>
							</ResponsiveContainer>
						</div>
						<p className="text-center text-gray-300 mt-2">
							Compound interest helps your savings grow faster over time.
						</p>
					</Card>
				</div>
			) : (
				<Card title="Your Savings Rate Over Time">
					<div style={{ height: 400 }}>
						<ResponsiveContainer width="100%" height="100%">
							<BarChart data={chartData.savingsRate}>
								<CartesianGrid strokeDasharray="3 3" stroke="#444" />
								<XAxis dataKey="period" stroke="#fff" />
								<YAxis stroke="#fff" />
								<Tooltip
									contentStyle={{ backgroundColor: '#333', border: '1px solid #555' }}
									formatter={(value) => `${value}%`}
								/>
								<Bar
									dataKey="rate"
									fill="#28a745"
									animationDuration={1500}
									animationBegin={0}
									isAnimationActive={animateCharts}
								/>
							</BarChart>
						</ResponsiveContainer>
					</div>
					<div className="mt-4">
						<h4 className="text-white text-lg mb-2">Tips to Increase Your Savings Rate:</h4>
						<ul className="list-disc pl-5 text-gray-300">
							<li>Automate savings with direct deposit to savings accounts</li>
							<li>Save any windfall income like tax returns or bonuses</li>
							<li>Consider the 24-hour rule before making non-essential purchases</li>
							<li>Increase savings rate by 1% every few months</li>
						</ul>
					</div>
				</Card>
			)}
		</div>
	);

	// Render default financial overview visualizations
	const renderDefaultVisuals = () => (
		<div className="space-y-4">
			<div className="flex space-x-2 mb-4 border-b border-gray-700">
				<Tab
					active={activeTab === 'overview'}
					label="Financial Overview"
					onClick={() => setActiveTab('overview')}
				/>
				<Tab
					active={activeTab === 'networth'}
					label="Net Worth"
					onClick={() => setActiveTab('networth')}
				/>
			</div>

			{activeTab === 'overview' ? (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<Card title="Financial Health Metrics">
						<div style={{ height: 300 }}>
							<ResponsiveContainer width="100%" height="100%">
								<BarChart data={chartData.financialHealth}>
									<CartesianGrid strokeDasharray="3 3" stroke="#444" />
									<XAxis dataKey="category" stroke="#fff" />
									<YAxis stroke="#fff" />
									<Tooltip
										contentStyle={{ backgroundColor: '#333', border: '1px solid #555' }}
										formatter={(value) => `${value}%`}
									/>
									<Bar
										dataKey="value"
										fill="#28a745"
										animationDuration={1500}
										animationBegin={0}
										isAnimationActive={animateCharts}
									/>
								</BarChart>
							</ResponsiveContainer>
						</div>
						<p className="text-center text-gray-300 mt-2">
							A balanced financial plan addresses multiple areas of your financial life.
						</p>
					</Card>

					<Card title="Income vs. Expenses">
						<div style={{ height: 300 }}>
							<ResponsiveContainer width="100%" height="100%">
								<LineChart data={chartData.incomeVsExpenses}>
									<CartesianGrid strokeDasharray="3 3" stroke="#444" />
									<XAxis dataKey="month" stroke="#fff" />
									<YAxis stroke="#fff" />
									<Tooltip
										contentStyle={{ backgroundColor: '#333', border: '1px solid #555' }}
										formatter={(value) => `$${value}`}
									/>
									<Legend />
									<Line
										type="monotone"
										dataKey="income"
										stroke="#28a745"
										activeDot={{ r: 8 }}
										strokeWidth={2}
										animationDuration={1500}
										animationBegin={0}
										isAnimationActive={animateCharts}
									/>
									<Line
										type="monotone"
										dataKey="expenses"
										stroke="#dc3545"
										activeDot={{ r: 8 }}
										strokeWidth={2}
										animationDuration={1500}
										animationBegin={200}
										isAnimationActive={animateCharts}
									/>
								</LineChart>
							</ResponsiveContainer>
						</div>
						<p className="text-center text-gray-300 mt-2">
							Maintaining a positive gap between income and expenses is key to financial health.
						</p>
					</Card>
				</div>
			) : (
				<Card title="Net Worth Trend">
					<div style={{ height: 400 }}>
						<ResponsiveContainer width="100%" height="100%">
							<AreaChart data={chartData.netWorthTrend}>
								<CartesianGrid strokeDasharray="3 3" stroke="#444" />
								<XAxis dataKey="year" stroke="#fff" />
								<YAxis stroke="#fff" />
								<Tooltip
									contentStyle={{ backgroundColor: '#333', border: '1px solid #555' }}
									formatter={(value) => `$${value.toLocaleString()}`}
								/>
								<Legend />
								<Area
									type="monotone"
									dataKey="assets"
									stackId="1"
									stroke="#28a745"
									fill="#28a74580"
									animationDuration={1500}
									animationBegin={0}
									isAnimationActive={animateCharts}
								/>
								<Area
									type="monotone"
									dataKey="liabilities"
									stackId="2"
									stroke="#dc3545"
									fill="#dc354580"
									animationDuration={1500}
									animationBegin={200}
									isAnimationActive={animateCharts}
								/>
							</AreaChart>
						</ResponsiveContainer>
					</div>
					<div className="mt-4">
						<h4 className="text-white text-lg mb-2">Building Net Worth:</h4>
						<ul className="list-disc pl-5 text-gray-300">
							<li>Increase income through career advancement or side hustles</li>
							<li>Reduce high-interest debt to minimize liabilities</li>
							<li>Invest consistently to grow assets over time</li>
							<li>Protect your assets with appropriate insurance</li>
						</ul>
					</div>
				</Card>
			)}
		</div>
	);

	// Render debt management visualizations
	const renderDebtVisuals = () => (
		<div className="space-y-4">
			<div className="flex space-x-2 mb-4 border-b border-gray-700">
				<Tab
					active={activeTab === 'overview'}
					label="Debt Types"
					onClick={() => setActiveTab('overview')}
				/>
				<Tab
					active={activeTab === 'strategies'}
					label="Payoff Strategies"
					onClick={() => setActiveTab('strategies')}
				/>
				<Tab
					active={activeTab === 'interest'}
					label="Interest Impact"
					onClick={() => setActiveTab('interest')}
				/>
			</div>

			{activeTab === 'overview' ? (
				<Card title="Types of Debt">
					<div style={{ height: 300 }}>
						<ResponsiveContainer width="100%" height="100%">
							<PieChart>
								<Pie
									data={chartData.debtTypes}
									cx="50%"
									cy="50%"
									labelLine={false}
									outerRadius={animateCharts ? 100 : 0}
									label={({ name, value }) => `${name}: $${value.toLocaleString()}`}
									dataKey="value"
									animationDuration={1000}
									animationBegin={0}
								>
									{chartData.debtTypes.map((entry, index) => (
										<Cell key={`cell-${index}`} fill={entry.fill} />
									))}
								</Pie>
								<Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
							</PieChart>
						</ResponsiveContainer>
					</div>
					<p className="text-center text-gray-300 mt-2">
						Understanding the breakdown of your debt helps prioritize which to pay off first.
					</p>
				</Card>
			) : activeTab === 'strategies' ? (
				<Card title="Debt Payoff Strategies Comparison">
					<div style={{ height: 400 }}>
						<ResponsiveContainer width="100%" height="100%">
							<LineChart data={chartData.payoffStrategies}>
								<CartesianGrid strokeDasharray="3 3" stroke="#444" />
								<XAxis dataKey="month" stroke="#fff" label={{ value: 'Months', position: 'insideBottomRight', offset: -5, fill: '#fff' }} />
								<YAxis stroke="#fff" label={{ value: 'Remaining Debt ($)', angle: -90, position: 'insideLeft', fill: '#fff' }} />
								<Tooltip
									contentStyle={{ backgroundColor: '#333', border: '1px solid #555' }}
									formatter={(value) => `$${value.toLocaleString()}`}
								/>
								<Legend />
								<Line
									type="monotone"
									dataKey="avalanche"
									name="Avalanche Method"
									stroke="#28a745"
									activeDot={{ r: 8 }}
									strokeWidth={2}
									animationDuration={1500}
									animationBegin={0}
									isAnimationActive={animateCharts}
								/>
								<Line
									type="monotone"
									dataKey="snowball"
									name="Snowball Method"
									stroke="#17a2b8"
									activeDot={{ r: 8 }}
									strokeWidth={2}
									animationDuration={1500}
									animationBegin={200}
									isAnimationActive={animateCharts}
								/>
							</LineChart>
						</ResponsiveContainer>
					</div>
					<div className="mt-4">
						<h4 className="text-white text-lg mb-2">Debt Repayment Strategies:</h4>
						<ul className="list-disc pl-5 text-gray-300">
							<li><strong>Avalanche Method:</strong> Pay off highest interest rate debt first (saves the most money)</li>
							<li><strong>Snowball Method:</strong> Pay off smallest balances first (provides psychological wins)</li>
						</ul>
					</div>
				</Card>
			) : (
				<Card title="Interest Rate Impact">
					<div style={{ height: 400 }}>
						<ResponsiveContainer width="100%" height="100%">
							<BarChart data={chartData.interestComparison} layout="vertical">
								<CartesianGrid strokeDasharray="3 3" stroke="#444" />
								<XAxis type="number" stroke="#fff" />
								<YAxis dataKey="rate" type="category" stroke="#fff" />
								<Tooltip
									contentStyle={{ backgroundColor: '#333', border: '1px solid #555' }}
									formatter={(value) => `$${value.toLocaleString()}`}
								/>
								<Legend />
								<Bar
									dataKey="payment"
									name="Monthly Payment"
									fill="#28a745"
									animationDuration={1500}
									animationBegin={0}
									isAnimationActive={animateCharts}
								/>
								<Bar
									dataKey="totalInterest"
									name="Total Interest Paid"
									fill="#dc3545"
									animationDuration={1500}
									animationBegin={200}
									isAnimationActive={animateCharts}
								/>
							</BarChart>
						</ResponsiveContainer>
					</div>
					<p className="text-center text-gray-300 mt-2">
						Even small differences in interest rates can significantly impact total interest paid over the life of a loan.
					</p>
				</Card>
			)}
		</div>
	);
	// Render investing visualizations
	const renderInvestingVisuals = () => (
		<div className="space-y-4">
			<div className="flex space-x-2 mb-4 border-b border-gray-700">
				<Tab
					active={activeTab === 'overview'}
					label="Asset Allocation"
					onClick={() => setActiveTab('overview')}
				/>
				<Tab
					active={activeTab === 'returns'}
					label="Investment Returns"
					onClick={() => setActiveTab('returns')}
				/>
				<Tab
					active={activeTab === 'compound'}
					label="Compound Growth"
					onClick={() => setActiveTab('compound')}
				/>
			</div>

			{activeTab === 'overview' ? (
				<Card title="Recommended Asset Allocation">
					<div style={{ height: 300 }}>
						<ResponsiveContainer width="100%" height="100%">
							<PieChart>
								<Pie
									data={chartData.assetAllocation}
									cx="50%"
									cy="50%"
									labelLine={false}
									outerRadius={animateCharts ? 100 : 0}
									label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
									dataKey="value"
									animationDuration={1000}
									animationBegin={0}
								>
									{chartData.assetAllocation.map((entry, index) => (
										<Cell key={`cell-${index}`} fill={entry.fill} />
									))}
								</Pie>
								<Tooltip formatter={(value) => `${value}%`} />
							</PieChart>
						</ResponsiveContainer>
					</div>
					<p className="text-center text-gray-300 mt-2">
						A diversified portfolio helps balance risk and potential returns.
					</p>
				</Card>
			) : activeTab === 'returns' ? (
				<Card title="Historical Investment Returns">
					<div style={{ height: 400 }}>
						<ResponsiveContainer width="100%" height="100%">
							<BarChart data={chartData.returns}>
								<CartesianGrid strokeDasharray="3 3" stroke="#444" />
								<XAxis dataKey="year" stroke="#fff" />
								<YAxis stroke="#fff" />
								<Tooltip
									contentStyle={{ backgroundColor: '#333', border: '1px solid #555' }}
									formatter={(value) => `${value}%`}
								/>
								<Legend />
								<Bar
									dataKey="stocks"
									fill="#28a745"
									animationDuration={1500}
									animationBegin={0}
									isAnimationActive={animateCharts}
								/>
								<Bar
									dataKey="bonds"
									fill="#17a2b8"
									animationDuration={1500}
									animationBegin={200}
									isAnimationActive={animateCharts}
								/>
								<Bar
									dataKey="cash"
									fill="#6c757d"
									animationDuration={1500}
									animationBegin={400}
									isAnimationActive={animateCharts}
								/>
							</BarChart>
						</ResponsiveContainer>
					</div>
					<p className="text-center text-gray-300 mt-2">
						Different asset classes perform differently over time, highlighting the importance of diversification.
					</p>
				</Card>
			) : (
				<Card title="Power of Compound Interest">
					<div style={{ height: 400 }}>
						<ResponsiveContainer width="100%" height="100%">
							<AreaChart data={chartData.compoundInterest}>
								<CartesianGrid strokeDasharray="3 3" stroke="#444" />
								<XAxis dataKey="year" stroke="#fff" />
								<YAxis stroke="#fff" />
								<Tooltip
									contentStyle={{ backgroundColor: '#333', border: '1px solid #555' }}
									formatter={(value) => `$${value.toLocaleString()}`}
								/>
								<Area
									type="monotone"
									dataKey="value"
									stroke="#28a745"
									fill="#28a74580"
									animationDuration={2000}
									animationBegin={0}
									isAnimationActive={animateCharts}
								/>
							</AreaChart>
						</ResponsiveContainer>
					</div>
					<div className="mt-4">
						<h4 className="text-white text-lg mb-2">The Magic of Compound Interest:</h4>
						<p className="text-gray-300">
							A $10,000 investment growing at 7% annually becomes $76,123 after 30 years.
							Starting early is crucial - even small contributions grow significantly over time.
						</p>
					</div>
				</Card>
			)}
		</div>
	);

	// Render appropriate visualizations based on the concept
	const renderVisualizations = () => {
		if (!chartData) {
			return (
				<div className="flex flex-col items-center justify-center p-12">
					<div className="w-12 h-12 border-4 border-t-green-500 border-gray-700 rounded-full animate-spin"></div>
					<p className="mt-4 text-white">Preparing visualizations...</p>
				</div>
			);
		}

		// Check for specific concepts and render appropriate visualizations
		if (conceptData?.concept === 'budgeting') {
			return renderBudgetingVisuals();
		}

		if (conceptData?.concept === 'saving') {
			return renderSavingVisuals();
		}

		if (conceptData?.concept === 'investing') {
			return renderInvestingVisuals();
		}

		if (conceptData?.concept === 'debt') {
			return renderDebtVisuals();
		}

		// Default visualizations for any other concepts
		return renderDefaultVisuals();
	};

	if (!enabled) {
		return (
			<button
				className="flex items-center rounded-md bg-transparent text-green-500 border border-green-500 hover:bg-green-900 hover:bg-opacity-30 px-4 py-2 mb-4 transition-colors"
				onClick={onToggle}
				disabled={loading}
			>
				<svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
				</svg>
				Enable Visual Mode
				<span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
					New
				</span>
			</button>
		);
	}

	return (
		<div className="mb-6 rounded-lg bg-gray-900 border border-gray-700 overflow-hidden">
			<div className="flex justify-between items-center p-4 border-b border-gray-700">
				{/* Changed to a more clear "Close" button with better styling */}
				<button
					className="text-gray-300 hover:text-white px-3 py-1 rounded hover:bg-gray-700 transition-colors"
					onClick={onToggle}
					disabled={loading}
					title="Close visualization"
				>
					<span className="mr-1">Close</span>
					<svg className="w-1 h-1 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			{/* Rest of your component stays the same */}
			{loading ? (
				<div className="flex flex-col items-center justify-center p-12">
					<div className="w-12 h-12 border-4 border-t-green-500 border-gray-700 rounded-full animate-spin"></div>
					<p className="mt-4 text-white">Preparing visualizations...</p>
				</div>
			) : (
				<div className="p-4">
					<h2 className="text-green-500 text-xl font-medium mb-4">
						{conceptData?.title || "Financial Visualization"}
					</h2>
					{renderVisualizations()}
				</div>
			)}
		</div>
	);
};

// detectFinancialConcept helper function
/**
 * Extract financial concepts from AI response to enable visualization
 * @param {string} message - The AI response message
 * @returns {object|null} - Financial concept object or null if none detected
 */
export const detectFinancialConcept = (message) => {
	// Check if the message contains financial education content
	const lowerMsg = message.toLowerCase();

	// Map of concepts to search for in the message
	const concepts = {
		'budgeting': ['budget', '50/30/20', 'spending plan', 'expense tracking'],
		'saving': ['saving', 'emergency fund', 'savings rate', 'save money'],
		'investing': ['invest', 'stock', 'bond', 'portfolio', 'asset allocation', 'diversification'],
		'debt': ['debt', 'loan', 'mortgage', 'credit card', 'interest rate', 'avalanche', 'snowball'],
		'credit': ['credit score', 'credit report', 'fico', 'credit history', 'credit utilization'],
		'retirement': ['retirement', '401k', 'ira', 'social security', 'pension', 'withdrawal rate'],
		'insurance': ['insurance', 'coverage', 'premium', 'deductible', 'policy', 'risk management'],
		'taxes': ['tax', 'deduction', 'credit', 'irs', 'withholding', 'tax-advantaged'],
	};

	// Check if any concept keywords are in the message
	for (const [concept, keywords] of Object.entries(concepts)) {
		if (keywords.some(keyword => lowerMsg.includes(keyword.toLowerCase()))) {
			// Generate appropriate title based on concept
			let title = 'Financial Visualization';

			switch (concept) {
				case 'budgeting':
					title = 'Budgeting Visualization';
					break;
				case 'saving':
					title = 'Savings Visualization';
					break;
				case 'investing':
					title = 'Investment Visualization';
					break;
				case 'debt':
					title = 'Debt Management Visualization';
					break;
				case 'credit':
					title = 'Credit Score Visualization';
					break;
				case 'retirement':
					title = 'Retirement Planning Visualization';
					break;
				case 'insurance':
					title = 'Insurance Visualization';
					break;
				case 'taxes':
					title = 'Tax Planning Visualization';
					break;
			}

			return {
				concept,
				title,
				keywords: keywords.filter(k => lowerMsg.includes(k.toLowerCase()))
			};
		}
	}

	// If no specific concept is found, but the message is educational, use general financial visualization
	if (lowerMsg.includes('financial') ||
		lowerMsg.includes('money') ||
		lowerMsg.includes('finance') ||
		lowerMsg.includes('income') ||
		lowerMsg.includes('expense')) {
		return {
			concept: 'general',
			title: 'Financial Overview',
			keywords: ['financial']
		};
	}

	return null;
};

export default VisualFinanceMode;