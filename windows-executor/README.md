# FX Platform Windows Executor

A secure, high-performance trading bridge between MT5 and the FX Platform web interface, built with Electron, React, and TypeScript.

## Features

- **Secure Connection**: Encrypted communication between MT5 and the web platform
- **Real-time Monitoring**: Live performance metrics and system health monitoring
- **Safety Controls**: Advanced safety limits and emergency stop functionality
- **Auto-installation**: Automatic detection and installation of MT5 components
- **Cross-platform**: Windows, macOS, and Linux support
- **Modern UI**: Clean, responsive interface built with React and Tailwind CSS

## Architecture

The application consists of several key components:

- **Main Controller**: Central orchestrator that manages all services
- **Pusher Service**: Handles real-time communication with the web platform
- **ZeroMQ Service**: Manages communication with MT5
- **Command Service**: Processes and executes trading commands
- **Safety Service**: Enforces trading limits and safety rules
- **Monitoring Service**: Tracks system performance and health
- **Security Service**: Handles authentication, encryption, and security events

## Installation

### Prerequisites

- Node.js 18.0.0 or higher
- npm 9.0.0 or higher
- MT5 Terminal (for trading functionality)

### Setup

1. Clone the repository
```bash
git clone https://github.com/fx-platform/windows-executor.git
cd windows-executor
```

2. Install dependencies
```bash
npm install
```

3. Rebuild native modules
```bash
npm run rebuild
```

## Development

### Running in Development Mode

```bash
npm run dev
```

This will start both the React development server and the Electron application.

### Building for Production

```bash
npm run build
```

### Packaging the Application

#### Windows
```bash
npm run package:win
```

#### All Platforms
```bash
npm run package:all
```

## Configuration

The application requires configuration to connect to the FX Platform and MT5. Configuration is stored securely using Electron's safeStorage.

### Required Configuration

- `executorId`: Unique identifier for this executor instance
- `apiKey`: API key for the FX Platform
- `apiSecret`: API secret for the FX Platform
- `platformUrl`: URL of the FX Platform
- `pusherKey`: Pusher key for real-time communication
- `pusherCluster`: Pusher cluster
- `zmqPort`: ZeroMQ port for MT5 communication
- `zmqHost`: ZeroMQ host for MT5 communication

## Usage

### Initial Setup

1. Launch the application
2. Follow the setup wizard to configure your connection
3. The application will automatically detect MT5 installations
4. Complete the setup to start trading

### Monitoring

The dashboard provides real-time monitoring of:
- Connection status
- Trading activity
- System performance
- Safety limits
- Recent activity logs

### Safety Controls

The application includes several safety features:
- Daily loss limits
- Maximum position limits
- Drawdown protection
- Emergency stop functionality

## Security

The application implements several security measures:
- End-to-end encryption for all communications
- Secure storage of API credentials
- Rate limiting to prevent abuse
- Comprehensive audit logging
- Security threat detection

## Troubleshooting

### Common Issues

#### MT5 Not Detected
- Ensure MT5 is properly installed
- Check that MT5 is not running in portable mode
- Restart the application

#### Connection Issues
- Verify your network connection
- Check firewall settings
- Ensure the platform URL is correct

#### Performance Issues
- Check system resources
- Reduce the number of active strategies
- Restart the application

### Logs

Application logs are stored in the `logs` directory and can be viewed in the application's Logs page.

## API Reference

### Electron API

The application exposes a secure API to the renderer process through a preload script:

```typescript
// Get application status
const status = await window.electronAPI.getStatus();

// Get connection status
const connectionStatus = await window.electronAPI.getConnectionStatus();

// Execute a command
const result = await window.electronAPI.executeCommand(command);

// Emergency stop
await window.electronAPI.emergencyStop('Manual activation');
```

### Event Listeners

The application emits various events that can be listened to:

```typescript
// Listen for connection status changes
window.electronAPI.onConnectionStatusChanged((status) => {
  console.log('Connection status changed:', status);
});

// Listen for safety alerts
window.electronAPI.onSafetyAlert((data) => {
  console.log('Safety alert:', data);
});
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## Testing

### Running Tests

```bash
npm test
```

### Running Tests in Watch Mode

```bash
npm run test:watch
```

### Generating Coverage Reports

```bash
npm run test:coverage
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please contact the FX Platform team or create an issue on the GitHub repository.