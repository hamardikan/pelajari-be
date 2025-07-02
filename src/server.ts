// Load environment variables FIRST before any other imports
import { config } from 'dotenv';
config();

import { startServer } from './app.js';

// Start the server
startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
}); 