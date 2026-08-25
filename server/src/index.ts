import path from 'node:path';
import dotenv from 'dotenv';

// Load .env before initializing app components
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { app } from './app.js';

const PORT = process.env.PORT || 3001;

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔐 Auth API:    http://localhost:${PORT}/api/auth`);
  console.log(`👥 Clients API: http://localhost:${PORT}/api/clients`);
  console.log(`📦 Products API: http://localhost:${PORT}/api/products`);
  console.log(`📋 Inventory API: http://localhost:${PORT}/api/inventory`);
  console.log(`🚚 Suppliers API: http://localhost:${PORT}/api/suppliers`);
  console.log(`📝 Orders API:    http://localhost:${PORT}/api/orders`);
});

export default server;
