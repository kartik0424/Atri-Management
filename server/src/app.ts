import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { healthRouter } from './routes/health.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { clientsRouter } from './modules/clients/clients.routes.js';
import { productsRouter } from './modules/products/products.routes.js';
import { inventoryRouter } from './modules/inventory/inventory.routes.js';
import { suppliersRouter } from './modules/suppliers/suppliers.routes.js';
import { ordersRouter } from './modules/orders/orders.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  // Core Middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Root Info
  app.get('/', (_req, res) => {
    res.json({
      name: 'Atri Management API',
      version: '1.0.0',
      modules: ['auth', 'clients', 'products', 'inventory', 'suppliers', 'orders'],
      docs: '/api/health',
    });
  });

  // Health route (public)
  app.use('/api/health', healthRouter);

  // API Modules
  app.use('/api/auth', authRouter);
  app.use('/api/clients', clientsRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/suppliers', suppliersRouter);
  app.use('/api/orders', ordersRouter);

  // 404 & Error Handling Middleware
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
