
// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';

// First import Bootstrap CSS
import 'bootstrap/dist/css/bootstrap.min.css';
// Then import your custom styles
import './index.css';

import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);