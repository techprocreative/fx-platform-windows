import { jsx as _jsx } from "react/jsx-runtime";
console.log("╔════════════════════════════════════════╗");
console.log("║  🎯 MAIN.TSX ENTRY POINT!             ║");
console.log("║  JavaScript is executing!             ║");
console.log("╚════════════════════════════════════════╝");
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import './index.css';
console.log("✅ All imports loaded successfully!");
console.log("📍 window.location:", window.location.href);
// Check if we're running in Electron
const isElectron = window.navigator.userAgent.includes('Electron');
console.log("📍 isElectron:", isElectron);
// Create root element
const root = ReactDOM.createRoot(document.getElementById('root'));
// Render the app
root.render(_jsx(React.StrictMode, { children: _jsx(App, {}) }));
// Log environment info
console.log(`Running in ${isElectron ? 'Electron' : 'Browser'} environment`);
