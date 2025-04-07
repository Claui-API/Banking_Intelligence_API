# Banking Intelligence Frontend

A React-based frontend application for the Banking Intelligence API, providing users with financial insights, account management, and AI-powered financial recommendations.

## Features

- **Client Authentication**: Secure client registration and JWT-based authentication
- **Financial Dashboard**: Overview of accounts, recent transactions, and financial summary
- **AI-Powered Insights**: Personalized financial insights generated via Cohere AI
- **Responsive Design**: Mobile-friendly interface for on-the-go financial management

## Prerequisites

- Node.js (v14.x or higher)
- npm or yarn
- Banking Intelligence API backend running

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/banking-intelligence-frontend.git
   cd banking-intelligence-frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Create a `.env` file in the root directory:
   ```
   REACT_APP_API_URL=http://localhost:3000/api
   ```

4. Start the development server:
   ```bash
   npm start
   # or
   yarn start
   ```

5. Open [http://localhost:3000](http://localhost:3000) to view the app in your browser

## Connecting to the Backend

Ensure your Banking Intelligence API is running on the specified URL in your `.env` file. By default, the frontend expects the API to be available at `http://localhost:3000/api`.

## Project Structure

```
src/
├── components/
│   ├── Auth/             # Authentication components
│   ├── Dashboard/        # Dashboard and financial components
│   ├── Layout/           # Header, footer, and layout components
│   └── HomePage.js       # Landing page
├── services/             # API service integrations
├── utils/                # Utility functions and formatters
├── context/              # React context providers
└── App.js                # Main application component
```

## API Integration

The frontend connects to the following API endpoints:

- `/auth/register` - Register a new client application
- `/auth/login` - Authenticate and obtain JWT tokens
- `/auth/refresh` - Refresh authentication tokens
- `/insights/summary` - Get financial summary data
- `/insights/generate` - Generate AI-powered financial insights

## Development

### Available Scripts

- `npm start` - Runs the app in development mode
- `npm test` - Launches the test runner
- `npm run build` - Builds the app for production
- `npm run eject` - Ejects from Create React App

### Adding New Features

1. Create new components in the appropriate directories
2. Update service files if new API endpoints are needed
3. Add routes in `App.js` for new pages

## Deployment

1. Build the production version:
   ```bash
   npm run build
   # or
   yarn build
   ```

2. Deploy the contents of the `build` directory to your web server or hosting provider

3. For AWS deployment:
   ```bash
   aws s3 sync build/ s3://your-bucket-name
   ```

## Environment Variables

- `REACT_APP_API_URL` - Base URL for the Banking Intelligence API

## License

[MIT](LICENSE)

## Acknowledgements

- [React](https://reactjs.org/)
- [React Router](https://reactrouter.com/)
- [Axios](https://axios-http.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [JWT](https://jwt.io/)

## Troubleshooting

### Common Issues

#### API Connection Problems

If you're having trouble connecting to the API:

1. Check that your backend server is running
2. Verify the API URL in your `.env` file
3. Check browser console for CORS errors (you may need to enable CORS on your backend)
4. Ensure the API routes match the ones expected by the frontend

#### Authentication Issues

If login doesn't work correctly:

1. Check the authentication endpoint responses in the browser network tab
2. Verify that JWT tokens are being stored correctly in localStorage
3. Ensure the format of the login credentials matches what the API expects

### Logs and Debugging

To enable detailed logging, add this to your `.env` file:
```
REACT_APP_DEBUG=true
```

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin feature/my-new-feature`
5. Submit a pull request