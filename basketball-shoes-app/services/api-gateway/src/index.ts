/**
 * API Gateway
 *
 * Single entry point for all client requests to the e-commerce platform.
 *
 * Key Features:
 * - Routes requests to appropriate microservices
 * - CORS handling for frontend clients
 * - OpenTelemetry distributed tracing (trace propagation to downstream services)
 * - Request logging middleware
 * - Feature flag configuration management (read/update flagd config)
 *
 * Service Routing:
 * - /api/products → product-service
 * - /api/cart → cart-service
 * - /api/orders → order-service
 * - /api/payment → payment-service
 * - /api/recommendations → recommendation-service
 * - /api/flags → feature flag configuration management
 *
 * Architecture Pattern: API Gateway / Backend for Frontend (BFF)
 * - Aggregates multiple backend services
 * - Provides unified API for frontend
 * - Handles cross-cutting concerns (CORS, logging, tracing)
 */

import { initTracing } from './tracing';
initTracing();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import axios from 'axios';
import { trace, SpanStatusCode, context } from '@opentelemetry/api';
import fs from 'fs';

const app = express();
const PORT = process.env.PORT || 3000;

const tracer = trace.getTracer('api-gateway', '1.0.0');

/**
 * Backend service URLs.
 * Configured via environment variables for different deployment environments.
 */
const PRODUCT_SERVICE = process.env.PRODUCT_SERVICE || 'http://product-service:3001';
const CART_SERVICE = process.env.CART_SERVICE || 'http://cart-service:3002';
const ORDER_SERVICE = process.env.ORDER_SERVICE || 'http://order-service:3003';
const PAYMENT_SERVICE = process.env.PAYMENT_SERVICE || 'http://payment-service:3004';
const RECOMMENDATION_SERVICE = process.env.RECOMMENDATION_SERVICE || 'http://recommendation-service:3005';

app.use(cors());
app.use(express.json());

/**
 * Middleware: Request Logging
 *
 * Logs all incoming requests with method, path, status code, and duration.
 * Useful for monitoring API usage and debugging.
 */
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  next();
});

/**
 * Helper: Proxy Request to Backend Service
 *
 * Forwards requests to backend microservices with:
 * - OpenTelemetry trace context propagation
 * - Error handling and span recording
 * - Configurable timeout (30s default)
 *
 * Params:
 * - serviceName: Service identifier for span naming
 * - serviceUrl: Base URL of the backend service
 * - path: Request path (e.g., '/products/1')
 * - method: HTTP method (GET, POST, DELETE, etc.)
 * - data: Request body (optional)
 * - headers: Additional headers (optional)
 *
 * Returns: Response data from backend service
 * Throws: axios error if request fails
 */
async function proxyRequest(
  serviceName: string,
  serviceUrl: string,
  path: string,
  method: string,
  data?: any,
  headers?: any
) {
  return tracer.startActiveSpan(`proxy-to-${serviceName}`, async (span) => {
    try {
      span.setAttribute('http.method', method);
      span.setAttribute('http.url', `${serviceUrl}${path}`);
      span.setAttribute('service.name', serviceName);

      const response = await axios({
        method,
        url: `${serviceUrl}${path}`,
        data,
        headers,
        timeout: 30000,
      });

      span.setStatus({ code: SpanStatusCode.OK });
      return response.data;
    } catch (error: any) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  });
}

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'api-gateway' });
});

// Product routes
app.get('/api/products', async (req: Request, res: Response) => {
  try {
    const data = await proxyRequest('product-service', PRODUCT_SERVICE, '/products', 'GET');
    res.json(data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

app.get('/api/products/:id', async (req: Request, res: Response) => {
  try {
    const data = await proxyRequest('product-service', PRODUCT_SERVICE, `/products/${req.params.id}`, 'GET');
    res.json(data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// Cart routes
app.get('/api/cart/:userId', async (req: Request, res: Response) => {
  try {
    const data = await proxyRequest('cart-service', CART_SERVICE, `/cart/${req.params.userId}`, 'GET');
    res.json(data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

app.post('/api/cart/:userId/items', async (req: Request, res: Response) => {
  try {
    const data = await proxyRequest('cart-service', CART_SERVICE, `/cart/${req.params.userId}/items`, 'POST', req.body);
    res.json(data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

app.delete('/api/cart/:userId/items/:productId', async (req: Request, res: Response) => {
  try {
    const data = await proxyRequest('cart-service', CART_SERVICE, `/cart/${req.params.userId}/items/${req.params.productId}`, 'DELETE');
    res.json(data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// Order routes
app.post('/api/orders', async (req: Request, res: Response) => {
  try {
    const data = await proxyRequest('order-service', ORDER_SERVICE, '/orders', 'POST', req.body);
    res.json(data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

app.get('/api/orders/:orderId', async (req: Request, res: Response) => {
  try {
    const data = await proxyRequest('order-service', ORDER_SERVICE, `/orders/${req.params.orderId}`, 'GET');
    res.json(data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// Payment routes
app.post('/api/payment/process', async (req: Request, res: Response) => {
  try {
    const data = await proxyRequest('payment-service', PAYMENT_SERVICE, '/payment/process', 'POST', req.body);
    res.json(data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// Recommendation routes
app.get('/api/recommendations/:productId', async (req: Request, res: Response) => {
  try {
    const data = await proxyRequest('recommendation-service', RECOMMENDATION_SERVICE, `/recommendations/${req.params.productId}`, 'GET');
    res.json(data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

/**
 * Feature Flag Configuration Routes
 *
 * Allows reading and updating the flagd configuration file.
 * This enables dynamic feature flag changes without service restarts.
 *
 * Note: After updating the config, flagd service must be restarted
 * for changes to take effect (docker-compose restart flagd)
 */
const FLAGD_CONFIG_PATH = process.env.FLAGD_CONFIG_PATH || '/app/flagd-config.json';

/**
 * GET /api/flags/config - Retrieve current feature flag configuration
 *
 * Returns the complete flagd configuration JSON including all flags and their states.
 */
app.get('/api/flags/config', (req: Request, res: Response) => {
  try {
    const configData = fs.readFileSync(FLAGD_CONFIG_PATH, 'utf-8');
    const config = JSON.parse(configData);
    res.json(config);
  } catch (error: any) {
    console.error('Error reading flagd config:', error);
    res.status(500).json({ error: 'Failed to read flag configuration' });
  }
});

/**
 * PUT /api/flags/config - Update feature flag configuration
 *
 * Request body: Complete flagd configuration object with flags
 *
 * Validation:
 * - Ensures 'flags' object exists in config
 * - Writes to flagd config file
 *
 * Important: After updating, you must restart flagd service:
 *   docker-compose restart flagd
 *
 * Returns: { success: true, message: '...' }
 */
app.put('/api/flags/config', async (req: Request, res: Response) => {
  return tracer.startActiveSpan('write-config-file', async (span) => {
    try {
      const newConfig = req.body;

      // Validate the config structure
      if (!newConfig.flags || typeof newConfig.flags !== 'object') {
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'Invalid config structure' });
        span.end();
        return res.status(400).json({ error: 'Invalid configuration structure' });
      }

      // Write the new configuration
      fs.writeFileSync(FLAGD_CONFIG_PATH, JSON.stringify(newConfig, null, 2), 'utf-8');

      span.setStatus({ code: SpanStatusCode.OK });
      span.end();

      console.log('✅ Feature flags configuration saved');
      res.json({
        success: true,
        message: 'Configuration saved! Run: docker-compose restart flagd'
      });
    } catch (error: any) {
      console.error('Error updating flagd config:', error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.recordException(error);
      span.end();
      res.status(500).json({ error: 'Failed to update flag configuration' });
    }
  });
});

app.listen(PORT, () => {
  console.log(`API Gateway listening on port ${PORT}`);
  console.log('Service endpoints:');
  console.log(`  Product Service: ${PRODUCT_SERVICE}`);
  console.log(`  Cart Service: ${CART_SERVICE}`);
  console.log(`  Order Service: ${ORDER_SERVICE}`);
  console.log(`  Payment Service: ${PAYMENT_SERVICE}`);
  console.log(`  Recommendation Service: ${RECOMMENDATION_SERVICE}`);
});
