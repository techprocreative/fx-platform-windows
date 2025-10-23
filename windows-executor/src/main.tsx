import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import './index.css';

// Check if we're running in Electron
const isElectron = window.navigator.userAgent.includes('Electron');

// Create root element
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

// Render the app
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Log environment info
console.log(`Running in ${isElectron ? 'Electron' : 'Browser'} environment`);