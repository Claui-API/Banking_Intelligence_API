// src/utils/pdf-generator.js
const PDFDocument = require('pdfkit');
const moment = require('moment');

/**
 * Generate a PDF document from user data
 * @param {Object} exportData - The exported user data
 * @returns {Promise<Buffer>} - Promise resolving to PDF buffer
 */
async function generatePDF(exportData) {
	return new Promise((resolve, reject) => {
		try {
			// Create a PDF document with better settings
			const doc = new PDFDocument({
				margin: 50,
				size: 'A4',
				bufferPages: true,
				info: {
					Title: `Financial Data Export - ${moment().format('YYYY-MM-DD')}`,
					Author: 'Banking Intelligence API',
					Subject: 'User Data Export',
					Keywords: 'financial, data, export',
					CreationDate: new Date()
				}
			});

			// Create a buffer to store the PDF
			const buffers = [];
			doc.on('data', buffers.push.bind(buffers));
			doc.on('end', () => {
				const pdfBuffer = Buffer.concat(buffers);
				resolve(pdfBuffer);
			});

			// Helper function to add a heading
			const addHeading = (text, level = 1) => {
				if (level === 1) {
					doc.font('Helvetica-Bold').fontSize(16).text(text, { underline: true });
				} else {
					doc.font('Helvetica-Bold').fontSize(14).text(text);
				}
				doc.moveDown(0.5);
			};

			// Helper function to add a section
			const addSection = (title, content) => {
				addHeading(title);
				doc.font('Helvetica').fontSize(12);

				if (typeof content === 'string') {
					doc.text(content);
				} else if (typeof content === 'function') {
					content();
				}

				doc.moveDown(1);
			};

			// Add header and title
			doc.font('Helvetica-Bold')
				.fontSize(24)
				.text('Banking Intelligence', { align: 'center' })
				.fontSize(18)
				.text('Financial Data Export', { align: 'center' })
				.moveDown(0.5);

			doc.font('Helvetica')
				.fontSize(12)
				.text(`Export Date: ${moment(exportData.exportDate).format('MMMM D, YYYY')}`, { align: 'center' })
				.moveDown(1.5);

			// User Profile Section
			addSection('User Profile', () => {
				const profile = exportData.userProfile || {};
				doc.text(`Name: ${profile.name || 'N/A'}`)
					.text(`Email: ${profile.email || 'N/A'}`)
					.text(`Account Created: ${profile.createdAt ? moment(profile.createdAt).format('MMMM D, YYYY') : 'N/A'}`)
					.text(`Last Login: ${profile.lastLoginAt ? moment(profile.lastLoginAt).format('MMMM D, YYYY') : 'N/A'}`);
			});

			// Clients Section
			if (exportData.clients && exportData.clients.length > 0) {
				addSection('API Clients', () => {
					exportData.clients.forEach((client, index) => {
						doc.font('Helvetica-Bold').text(`Client ${index + 1}:`);
						doc.font('Helvetica')
							.text(`  Client ID: ${client.clientId || 'N/A'}`)
							.text(`  Description: ${client.description || 'N/A'}`)
							.text(`  Status: ${client.status || 'N/A'}`)
							.text(`  Created: ${client.createdAt ? moment(client.createdAt).format('MMMM D, YYYY') : 'N/A'}`)
							.text(`  Last Used: ${client.lastUsedAt ? moment(client.lastUsedAt).format('MMMM D, YYYY') : 'Never'}`)
							.text(`  Usage Count: ${client.usageCount || 0}`);

						if (index < exportData.clients.length - 1) {
							doc.moveDown(0.5);
						}
					});
				});
			}

			// Financial Accounts Section
			if (exportData.financialData && exportData.financialData.accounts) {
				addSection('Financial Accounts', () => {
					if (!exportData.financialData.accounts.length) {
						doc.text('No accounts found.');
					} else {
						exportData.financialData.accounts.forEach((account, index) => {
							doc.font('Helvetica-Bold').text(`Account ${index + 1}:`);
							doc.font('Helvetica')
								.text(`  Name: ${account.name || account.accountName || 'N/A'}`)
								.text(`  Type: ${account.type || account.accountType || 'N/A'}`)
								.text(`  Institution: ${account.institutionName || 'N/A'}`)
								.text(`  Balance: $${parseFloat(account.balance || 0).toFixed(2)}`)
								.text(`  Currency: ${account.currencyCode || 'USD'}`);

							if (index < exportData.financialData.accounts.length - 1) {
								doc.moveDown(0.5);
							}
						});
					}
				});
			}

			// Transactions Section
			if (exportData.financialData &&
				exportData.financialData.transactions &&
				exportData.financialData.transactions.length > 0) {

				doc.addPage();
				addHeading('Recent Transactions');

				// Create transaction table
				const transactionsToShow = exportData.financialData.transactions.slice(0, 50);

				// Define table formatting
				const pageWidth = doc.page.width - 100;
				const dateWidth = pageWidth * 0.15;
				const descWidth = pageWidth * 0.45;
				const catWidth = pageWidth * 0.2;
				const amountWidth = pageWidth * 0.2;

				// Function to draw a table row
				function drawTableRow(date, desc, category, amount, isHeader = false) {
					const y = doc.y;
					const startX = 50;

					// Set font based on whether this is a header
					if (isHeader) {
						doc.font('Helvetica-Bold').fontSize(10);
					} else {
						doc.font('Helvetica').fontSize(10);
					}

					// Trim long descriptions
					const maxDescLength = 35;
					if (desc && desc.length > maxDescLength) {
						desc = desc.substring(0, maxDescLength) + '...';
					}

					// Handle wrapping for description text
					doc.text(date, startX, y, { width: dateWidth, align: 'left' });
					doc.text(desc, startX + dateWidth, y, { width: descWidth, align: 'left' });
					doc.text(category, startX + dateWidth + descWidth, y, { width: catWidth, align: 'left' });
					doc.text(amount, startX + dateWidth + descWidth + catWidth, y, { width: amountWidth, align: 'right' });

					// Return the new Y position
					return doc.y + 5;
				}

				// Draw table header
				let currentY = drawTableRow('Date', 'Description', 'Category', 'Amount', true);

				// Draw header line
				doc.moveTo(50, currentY - 2)
					.lineTo(doc.page.width - 50, currentY - 2)
					.stroke();

				currentY += 5;

				// Draw rows
				transactionsToShow.forEach((tx, i) => {
					// Check if we need a new page
					if (currentY > doc.page.height - 70) {
						doc.addPage();
						addHeading('Recent Transactions (continued)');
						currentY = doc.y + 5;

						// Redraw the header on the new page
						currentY = drawTableRow('Date', 'Description', 'Category', 'Amount', true);

						// Draw header line
						doc.moveTo(50, currentY - 2)
							.lineTo(doc.page.width - 50, currentY - 2)
							.stroke();

						currentY += 5;
					}

					const date = tx.date ? moment(tx.date).format('MM/DD/YYYY') : 'N/A';
					const desc = tx.description || tx.name || 'N/A';
					const category = tx.category || 'Uncategorized';
					const amount = tx.amount ? `$${parseFloat(tx.amount).toFixed(2)}` : 'N/A';

					currentY = drawTableRow(date, desc, category, amount);

					// Draw row separator if not the last row
					if (i < transactionsToShow.length - 1) {
						doc.moveTo(50, currentY - 3)
							.lineTo(doc.page.width - 50, currentY - 3)
							.opacity(0.2)
							.stroke()
							.opacity(1);
					}
				});

				// Add note if there are more transactions
				if (exportData.financialData.transactions.length > 50) {
					doc.moveDown(1)
						.font('Helvetica-Italic')
						.fontSize(10)
						.text(`Note: Only showing the first 50 of ${exportData.financialData.transactions.length} transactions. The complete list is available in the JSON export.`, { align: 'center' });
				}
			}

			// Insights Section
			if (exportData.insights && exportData.insights.length > 0) {
				doc.addPage();
				addHeading('Financial Insights');

				// Limit to first 25 insights
				const insightsToShow = exportData.insights.slice(0, 25);

				insightsToShow.forEach((insight, index) => {
					doc.font('Helvetica-Bold').text(`Insight ${index + 1}:`);
					doc.font('Helvetica')
						.text(`Query: ${insight.query || 'N/A'}`)
						.text(`Type: ${insight.queryType || 'General'}`)
						.text(`Date: ${insight.timestamp ? moment(insight.timestamp).format('MMMM D, YYYY') : 'N/A'}`);

					if (index < insightsToShow.length - 1) {
						doc.moveDown(0.5);
					}
				});

				if (exportData.insights.length > 25) {
					doc.moveDown(1)
						.font('Helvetica-Italic')
						.fontSize(10)
						.text(`Note: Only showing the first 25 of ${exportData.insights.length} insights. The complete list is available in the JSON export.`, { align: 'center' });
				}
			}

			// Add footer with page numbers
			const pageCount = doc.bufferedPageRange().count;
			for (let i = 0; i < pageCount; i++) {
				doc.switchToPage(i);

				// Add footer line
				doc.moveTo(50, doc.page.height - 60)
					.lineTo(doc.page.width - 50, doc.page.height - 60)
					.stroke();

				// Add page numbers
				doc.font('Helvetica')
					.fontSize(9)
					.text(
						`Page ${i + 1} of ${pageCount}`,
						50,
						doc.page.height - 50,
						{ align: 'center', width: doc.page.width - 100 }
					);

				// Add copyright
				doc.text(
					'Banking Intelligence API - Confidential',
					50,
					doc.page.height - 40,
					{ align: 'center', width: doc.page.width - 100 }
				);
			}

			// Finalize the PDF
			doc.end();
		} catch (error) {
			reject(error);
		}
	});
}

module.exports = { generatePDF };