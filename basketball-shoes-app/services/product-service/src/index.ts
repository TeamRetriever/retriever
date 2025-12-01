/**
 * Product Service
 *
 * Manages product catalog operations for the e-commerce platform.
 *
 * Key Features:
 * - Product listing and detail retrieval
 * - Chaos engineering via feature flags (slow API, rate limiting, stale cache, invalid data)
 * - OpenTelemetry distributed tracing for observability
 * - Integration with flagd for dynamic feature flag management
 *
 * Configuration Flags Available:
 * - API response timing configuration
 * - Request throttling configuration
 * - Cache coherency test mode
 * - Response payload size configuration
 * - Product data validation mode
 */

import { initTracing } from './tracing';
initTracing();

import express, { Request, Response } from 'express';
import { OpenFeature } from '@openfeature/server-sdk';
import { FlagdProvider } from '@openfeature/flagd-provider';
import { trace, SpanStatusCode, context } from '@opentelemetry/api';
import { suppressTracing } from '@opentelemetry/core';
import { products } from './data';

const app = express();
const PORT = process.env.PORT || 3001;
const FLAGD_HOST = process.env.FLAGD_HOST || 'flagd';
const FLAGD_PORT = process.env.FLAGD_PORT || '8013';

const tracer = trace.getTracer('product-service', '1.0.0');

/**
 * Connects to the flagd service to enable dynamic feature flag evaluation.
 * Flags can be updated in real-time without restarting the service.
 */
async function initFeatureFlags() {
  await OpenFeature.setProviderAndWait(
    new FlagdProvider({
      host: FLAGD_HOST,
      port: parseInt(FLAGD_PORT),
    })
  );
  console.log('Feature flags initialized with flagd provider');
}

/**
 * Helper: Evaluate feature flag without tracing
 *
 * Wraps OpenFeature flag evaluation in a suppressed context to prevent
 * gRPC ResolveBoolean operations from appearing in traces.
 */
async function getFlagValue(flagKey: string, defaultValue: boolean): Promise<boolean> {
  const client = OpenFeature.getClient();
  return await context.with(suppressTracing(context.active()), async () => {
    return await client.getBooleanValue(flagKey, defaultValue);
  });
}

app.use(express.json());

/**
 * In-memory tracker for rate limiting.
 * Stores request count and reset time per client IP address.
 */
const requestTracker = new Map<string, { count: number; resetTime: number }>();

/**
 * Middleware: API Configuration Check
 *
 * This middleware validates API configuration flags before handling requests:
 * 1. Request throttling configuration
 * 2. Response timing configuration
 *
 * Applied to all product routes automatically via app.use()
 */
async function slowApiMiddleware(req: Request, res: Response, next: Function) {
  return tracer.startActiveSpan('api-request-validation', async (span) => {
    try {
      const slowApiEnabled = await getFlagValue('f2a9d3e7', false);
      const rateLimitEnabled = await getFlagValue('b5c8e1f4', false);

      /**
       * Rate Limiting Logic:
       * - Tracks requests per client IP with 1-minute rolling window
       * - Rejects requests after 5 within the window with 429 status
       * - Returns time until reset in retryAfter header
       */
      if (rateLimitEnabled) {
        const clientId = req.ip || 'unknown';
        const now = Date.now();
        const tracker = requestTracker.get(clientId) || { count: 0, resetTime: now + 60000 };

        if (now > tracker.resetTime) {
          tracker.count = 0;
          tracker.resetTime = now + 60000;
        }

        tracker.count++;
        requestTracker.set(clientId, tracker);

        if (tracker.count > 5) {
          console.error(`🚫 Request throttling active - Client ${clientId} exceeded threshold`);
          span.setStatus({ code: SpanStatusCode.ERROR, message: 'Rate limit exceeded' });
          span.end();
          return res.status(429).json({
            error: 'Rate limit exceeded',
            message: 'Maximum 5 requests per minute allowed',
            retryAfter: Math.ceil((tracker.resetTime - now) / 1000),
          });
        }
      }

      if (slowApiEnabled) {
        const delay = 3000 + Math.random() * 2000;
        console.log(`⚠️  Response timing configuration active - Adding ${Math.round(delay)}ms delay`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      span.setStatus({ code: SpanStatusCode.OK });
      next();
    } catch (error: any) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.recordException(error);
      next();
    } finally {
      span.end();
    }
  });
}

app.use(slowApiMiddleware);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'product-service' });
});

/**
 * GET /products - Returns all products in the catalog
 *
 * Configuration behaviors:
 * - Cache coherency test mode
 * - Response payload size configuration
 *
 * Normal response: { products: Product[], total: number }
 */
app.get('/products', async (req: Request, res: Response) => {
  return tracer.startActiveSpan('get-all-products', async (span) => {
    try {
      const staleCacheEnabled = await getFlagValue('6d7f2a3c', false);
      const responseBloat = await getFlagValue('9e4b1c8f', false);

      span.setAttribute('product.count', products.length);

      let responseProducts = [...products];

      // Cache coherency test mode
      if (staleCacheEnabled) {
        responseProducts = responseProducts.map(p => ({
          ...p,
          price: p.price * 1.2,
        }));
        console.error('💾 Cache coherency test active - adjusting price data');
      }

      // Response payload configuration
      if (responseBloat) {
        const bloatData = Array(1000).fill({ dummy: 'x'.repeat(100) });
        console.error('💥 Response payload size configuration active');
        res.json({
          products: responseProducts,
          total: responseProducts.length,
          bloat: bloatData,
          metadata: { warning: 'Response artificially bloated for testing' },
        });
      } else {
        console.log(`📦 Fetching ${products.length} products`);
        res.json({
          products: responseProducts,
          total: responseProducts.length,
        });
      }

      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error: any) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.recordException(error);
      res.status(500).json({ error: 'Failed to fetch products' });
    } finally {
      span.end();
    }
  });
});

/**
 * GET /products/:id - Returns a single product by ID
 *
 * Configuration behaviors:
 * - Product data validation mode
 * - Cache coherency test mode
 *
 * Normal response: Product object or 404 if not found
 */
app.get('/products/:id', async (req: Request, res: Response) => {
  return tracer.startActiveSpan('get-product-by-id', async (span) => {
    try {
      const { id } = req.params;
      const invalidDataEnabled = await getFlagValue('3a7e5d2b', false);
      const staleCacheEnabled = await getFlagValue('6d7f2a3c', false);

      span.setAttribute('product.id', id);

      const product = products.find(p => p.id === id);

      if (!product) {
        span.setAttribute('product.found', false);
        res.status(404).json({ error: 'Product not found' });
      } else {
        span.setAttribute('product.found', true);
        span.setAttribute('product.name', product.name);

        // Product data validation mode
        if (invalidDataEnabled) {
          console.error('💥 Product data validation mode active');
          res.json({
            id: product.id,
            name: undefined,
            price: 'not-a-number',
            description: null,
            corruptedData: true,
          });
        } else if (staleCacheEnabled) {
          console.error('💾 Cache coherency test active - adjusting price data');
          res.json({
            ...product,
            price: product.price * 1.2,
          });
        } else {
          console.log(`📦 Fetching product: ${product.name}`);
          res.json(product);
        }
      }

      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error: any) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.recordException(error);
      res.status(500).json({ error: 'Failed to fetch product' });
    } finally {
      span.end();
    }
  });
});

// Start server
async function start() {
  try {
    await initFeatureFlags();

    app.listen(PORT, () => {
      console.log(`Product Service listening on port ${PORT}`);
      console.log(`Connected to flagd at ${FLAGD_HOST}:${FLAGD_PORT}`);
      console.log(`Loaded ${products.length} products`);
    });
  } catch (error) {
    console.error('Failed to start service:', error);
    process.exit(1);
  }
}

start();
