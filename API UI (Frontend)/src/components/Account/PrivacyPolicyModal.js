// src/components/Account/PrivacyPolicyModal.js
import React, { useState } from 'react';
import { Modal, Button } from 'react-bootstrap';

/**
 * Component for displaying Privacy Policy in a modal
 */
const PrivacyPolicyModal = () => {
	const [show, setShow] = useState(false);

	const handleClose = () => setShow(false);
	const handleShow = () => setShow(true);

	return (
		<>
			{/* This button will replace your <a href> link */}
			<Button
				variant="link"
				className="p-0 text-decoration-underline"
				onClick={handleShow}
				style={{ color: '#007bff' }}
			>
				Privacy and Data Retention Policy
			</Button>

			<Modal
				show={show}
				onHide={handleClose}
				size="lg"
				centered
				scrollable
			>
				<Modal.Header closeButton>
					<Modal.Title>Privacy Policy & Data Retention Policy</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					<h2 className="fs-4 mb-2">Banking Intelligence API</h2>
					<p className="text-muted fst-italic mb-4">Last Updated: August 9th 2025</p>

					<p>
						At Banking Intelligence a product by VIVY TECH USA INC ("we," "our," or "us"), we are
						committed to protecting your privacy and handling your data with the highest standards of
						security, transparency, and responsibility. This Privacy Policy outlines how we collect, use,
						share, and retain your personal information when you use our services.
					</p>

					<h3 className="fs-5 mt-4 mb-3 border-bottom pb-2">1. Information We Collect</h3>
					<p>We collect the following types of information when you use our platform:</p>
					<ul>
						<li><strong>Account Information:</strong> Name, email address, phone number, and any identifiers required
							to open or maintain your account.</li>
						<li><strong>Financial Data:</strong> Information retrieved from your connected bank accounts, credit unions,
							or other financial institutions (with your explicit consent).</li>
						<li><strong>Usage Data:</strong> Technical information about your device, IP address, browser type, and
							activity within our platform.</li>
						<li><strong>Communications:</strong> Records of your interactions with our customer support or through in-app messaging.</li>
					</ul>
					<p>
						We only collect data necessary to operate our services, fulfill contractual obligations with you,
						and comply with applicable laws.
					</p>

					<h3 className="fs-5 mt-4 mb-3 border-bottom pb-2">2. How We Use Your Information</h3>
					<p>Your information is used strictly for:</p>
					<ul>
						<li>Delivering our services, including secure connection and communication with your bank.</li>
						<li>Generating analytics and insights for your use (e.g., financial health reports, transaction
							analysis).</li>
						<li>Maintaining account security and fraud prevention.</li>
						<li>Complying with legal, regulatory, and contractual obligations.</li>
					</ul>
					<p>
						We do not sell, rent, or share your personal data with third parties for marketing purposes.
					</p>

					<h3 className="fs-5 mt-4 mb-3 border-bottom pb-2">3. Data Sharing and Disclosure</h3>
					<p>We only share your personal information in the following circumstances:</p>
					<ol>
						<li><strong>With Your Bank or Financial Institution</strong> – Data you agree to share (such as transaction
							history, spending patterns, or requested reports) is transmitted securely to your bank
							solely for the purposes you authorize.</li>
						<li><strong>With Service Providers</strong> – Only when necessary to operate our platform (e.g., secure
							cloud storage providers, payment processors). These providers are contractually bound to
							maintain confidentiality and data security.</li>
						<li><strong>When Required by Law</strong> – In response to valid legal requests from government or
							regulatory authorities.</li>
					</ol>
					<p>
						We never sell your personal data to third parties under any circumstances.
					</p>

					<h3 className="fs-5 mt-4 mb-3 border-bottom pb-2">4. Data Retention Policy</h3>
					<p>
						We follow strict data retention principles to protect your privacy while ensuring we meet our
						operational and legal obligations.
					</p>

					<h4 className="fs-6 mt-3 mb-2 fw-bold">4.1 Retention Periods</h4>
					<ul>
						<li><strong>Transactional Data:</strong> Stored for up to 24 months from the date of collection to allow for
							accurate financial analysis, reporting, and compliance.</li>
						<li><strong>Account Information:</strong> Retained for as long as your account is active, plus 12 months
							after closure to resolve disputes or meet regulatory requirements.</li>
						<li><strong>Logs and Security Data:</strong> Retained for 12 months for fraud prevention, security audits,
							and troubleshooting.</li>
					</ul>
					<p>
						After the applicable retention period, your data is securely deleted or anonymized, unless
						required to be retained longer by applicable law.
					</p>

					<h4 className="fs-6 mt-3 mb-2 fw-bold">4.2 Secure Cloud Storage</h4>
					<p>
						All personal and financial data is stored in encrypted form on our secure cloud infrastructure,
						hosted by AWS with compliance to ISO 27001, SOC 2, and applicable financial data regulations.
					</p>
					<ul>
						<li>Data in transit is encrypted using TLS 1.2 or higher.</li>
						<li>Data at rest is encrypted using AES-256.</li>
						<li>Regular security audits and penetration tests are conducted to ensure data integrity.</li>
					</ul>

					<h4 className="fs-6 mt-3 mb-2 fw-bold">4.3 User Control Over Data</h4>
					<p>You may request:</p>
					<ul>
						<li>Access to your stored data.</li>
						<li>Correction of inaccurate information.</li>
						<li>Deletion of your personal data (subject to legal obligations).</li>
					</ul>
					<p>
						Requests can be submitted via support@vivytech.com and will be processed within
						the timeframes required by law.
					</p>

					<h3 className="fs-5 mt-4 mb-3 border-bottom pb-2">5. Your Rights</h3>
					<p>Depending on your jurisdiction, you may have rights to:</p>
					<ul>
						<li>Access and obtain a copy of your data.</li>
						<li>Request correction or deletion.</li>
						<li>Restrict or object to certain processing.</li>
						<li>Withdraw consent for data sharing at any time (this may limit service functionality).</li>
					</ul>

					<h3 className="fs-5 mt-4 mb-3 border-bottom pb-2">6. Children's Privacy</h3>
					<p>
						Our services are not directed to individuals under 18, and we do not knowingly collect
						information from minors.
					</p>

					<h3 className="fs-5 mt-4 mb-3 border-bottom pb-2">7. Changes to this Policy</h3>
					<p>
						We may update this policy periodically. Any changes will be posted with an updated "Effective
						Date" and, if material, communicated directly to you.
					</p>

					<h3 className="fs-5 mt-4 mb-3 border-bottom pb-2">8. Contact Us</h3>
					<p>
						If you have any questions or concerns about this Privacy Policy or Data Retention Policy, please
						contact us at:
					</p>
					<p>
						VIVY TECH USA INC<br />
						Email: support@vivytech.com<br />
						Address: 100 Arlington St, Boston Mass, Office 11C
					</p>
				</Modal.Body>
				<Modal.Footer>
					<Button variant="secondary" onClick={handleClose}>
						Close
					</Button>
				</Modal.Footer>
			</Modal>
		</>
	);
};

export default PrivacyPolicyModal;