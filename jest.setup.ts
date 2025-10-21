import '@testing-library/jest-dom';

// Ensure React runs in development mode for tests
// Set NODE_ENV for tests
Object.defineProperty(process, 'env', {
  value: { ...process.env, NODE_ENV: 'test' },
  writable: true,
});
