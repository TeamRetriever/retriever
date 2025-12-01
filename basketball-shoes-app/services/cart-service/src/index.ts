/**
 * Cart Service
 *
 * Manages shopping cart operations including item management and price calculations.
 *
 * Key Features:
 * - Add/remove/clear cart items per user
 * - Automatic discount calculation (10% off orders > $200)
 * - Chaos engineering via feature flags (service failures, data corruption)
 * - OpenTelemetry distributed tracing
 * - In-memory storage (would be Redis/database in production)
 *
 * Configuration Flags Available:
 * - Service health validation
 * - Retry logic testing
 * - Pricing calculation modes
 * - Data consistency checks
 */

import { initTracing } from './tracing';
initTracing();

import express, { Request, Response } from 'express';
import { OpenFeature } from '@openfeature/server-sdk';
import { FlagdProvider } from '@openfeature/flagd-provider';
import { trace, SpanStatusCode, context } from '@opentelemetry/api';
import { suppressTracing } from '@opentelemetry/core';

const app = express();
const PORT = process.env.PORT || 3002;
const FLAGD_HOST = process.env.FLAGD_HOST || 'flagd';
const FLAGD_PORT = process.env.FLAGD_PORT || '8013';

const tracer = trace.getTracer('cart-service', '1.0.0');

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

interface Cart {
  userId: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
}

/**
 * In-memory cart storage keyed by userId.
 * In production, this would be Redis or a persistent database.
 */
const carts = new Map<string, Cart>();

/**
 * Connects to flagd service for dynamic feature flag evaluation.
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
 * This makes flag evaluations invisible to trace analysis while preserving
 * all error and performance data from the actual application logic.
 */
async function getFlagValue(flagKey: string, defaultValue: boolean): Promise<boolean> {
  const client = OpenFeature.getClient();
  return await context.with(suppressTracing(context.active()), async () => {
    return await client.getBooleanValue(flagKey, defaultValue);
  });
}

app.use(express.json());

/**
 * Middleware: Service Configuration Check
 *
 * Validates service configuration flags before processing requests.
 * Applied to all cart routes automatically via app.use()
 */
async function serviceFailureCheck(req: Request, res: Response, next: Function) {
  return tracer.startActiveSpan('validate-service-availability', async (span) => {
    try {
      const serviceDown = await getFlagValue('a3f7b2c8', false);
      const intermittentFailure = await getFlagValue('d4e8c9f1', false);

      if (serviceDown) {
        console.error('❌ Service health check failed - Returning 503');
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'Cart service temporarily unavailable' });
        span.end();
        return res.status(503).json({
          error: 'Cart service is temporarily unavailable',
          message: 'Please try again later',
        });
      }

      // Retry logic test mode
      if (intermittentFailure && Math.random() < 0.5) {
        console.error('❌ Service unavailable - Retry required');
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'Cart service temporarily unavailable' });
        span.end();
        return res.status(503).json({
          error: 'Cart service temporarily unavailable',
          message: 'Please retry your request',
          retryable: true,
        });
      }

      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
      next();
    } catch (error: any) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.recordException(error);
      span.end();
      next();
    }
  });
}

app.use(serviceFailureCheck);

/**
 * Helper: Calculate Cart Totals
 *
 * Computes subtotal, discount, and total for a cart.
 *
 * Business Logic:
 * - Subtotal = sum of (price × quantity) for all items
 * - Discount = 10% off if subtotal > $200 (when pricing mode enabled)
 * - Total = subtotal - discount
 */
async function calculateTotals(cart: Cart): Promise<void> {
  return tracer.startActiveSpan('calculate-cart-totals', async (span) => {
    try {
      const discountsEnabled = await getFlagValue('5b2d7e9a', true);
      const dataCorruption = await getFlagValue('8c1f4a6b', false);

      cart.subtotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      // Data consistency check mode
      if (dataCorruption) {
        cart.items.forEach(item => {
          item.quantity = Math.max(1, item.quantity + Math.floor(Math.random() * 10) - 5);
        });
        cart.subtotal *= (1 + (Math.random() * 0.4 - 0.2));
        console.error('💥 Data consistency check active - recalculating values');
      }

      if (discountsEnabled && cart.subtotal > 200) {
        // 10% discount for orders over $200
        cart.discount = cart.subtotal * 0.1;
        console.log(`💰 DISCOUNT APPLIED: $${cart.discount.toFixed(2)} (10% off)`);
      } else {
        cart.discount = 0;
      }

      cart.total = cart.subtotal - cart.discount;
      span.setAttribute('cart.subtotal', cart.subtotal);
      span.setAttribute('cart.total', cart.total);

      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error: any) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.recordException(error);
    } finally {
      span.end();
    }
  });
}

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'cart-service' });
});

/**
 * GET /cart/:userId - Retrieve user's shopping cart
 *
 * Creates empty cart if user doesn't have one yet.
 * Recalculates totals and discounts on every fetch.
 */
app.get('/cart/:userId', async (req: Request, res: Response) => {
  return tracer.startActiveSpan('get-cart', async (span) => {
    try {
      const { userId } = req.params;
      span.setAttribute('user.id', userId);

      if (!carts.has(userId)) {
        carts.set(userId, {
          userId,
          items: [],
          subtotal: 0,
          discount: 0,
          total: 0,
        });
      }

      const cart = carts.get(userId)!;
      await calculateTotals(cart);

      console.log(`🛒 Fetching cart for user ${userId}: ${cart.items.length} items, total $${cart.total.toFixed(2)}`);

      res.json(cart);
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error: any) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.recordException(error);
      res.status(500).json({ error: 'Failed to fetch cart' });
    } finally {
      span.end();
    }
  });
});

/**
 * POST /cart/:userId/items - Add product to cart
 *
 * Request body: { productId, name, price, quantity, image }
 *
 * Logic:
 * - If product already in cart, increments quantity
 * - Otherwise, adds new item to cart
 * - Recalculates totals after modification
 */
app.post('/cart/:userId/items', async (req: Request, res: Response) => {
  return tracer.startActiveSpan('add-to-cart', async (span) => {
    try {
      const { userId } = req.params;
      const { productId, name, price, quantity, image } = req.body;

      span.setAttribute('user.id', userId);
      span.setAttribute('product.id', productId);
      span.setAttribute('quantity', quantity);

      if (!carts.has(userId)) {
        carts.set(userId, {
          userId,
          items: [],
          subtotal: 0,
          discount: 0,
          total: 0,
        });
      }

      const cart = carts.get(userId)!;

      // Check if product already exists in cart
      const existingItem = cart.items.find(item => item.productId === productId);

      if (existingItem) {
        existingItem.quantity += quantity;
        console.log(`🛒 Updated quantity for ${name}: ${existingItem.quantity}`);
      } else {
        cart.items.push({ productId, name, price, quantity, image });
        console.log(`🛒 Added ${name} to cart (${quantity}x)`);
      }

      await calculateTotals(cart);

      res.json(cart);
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error: any) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.recordException(error);
      res.status(500).json({ error: 'Failed to add item to cart' });
    } finally {
      span.end();
    }
  });
});

/**
 * DELETE /cart/:userId/items/:productId - Remove specific product from cart
 *
 * Returns 404 if cart or item not found.
 * Recalculates totals after removal.
 */
app.delete('/cart/:userId/items/:productId', async (req: Request, res: Response) => {
  return tracer.startActiveSpan('remove-from-cart', async (span) => {
    try {
      const { userId, productId } = req.params;

      span.setAttribute('user.id', userId);
      span.setAttribute('product.id', productId);

      if (!carts.has(userId)) {
        return res.status(404).json({ error: 'Cart not found' });
      }

      const cart = carts.get(userId)!;
      const itemIndex = cart.items.findIndex(item => item.productId === productId);

      if (itemIndex === -1) {
        return res.status(404).json({ error: 'Item not found in cart' });
      }

      const removedItem = cart.items[itemIndex];
      cart.items.splice(itemIndex, 1);
      console.log(`🛒 Removed ${removedItem.name} from cart`);

      await calculateTotals(cart);

      res.json(cart);
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error: any) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.recordException(error);
      res.status(500).json({ error: 'Failed to remove item from cart' });
    } finally {
      span.end();
    }
  });
});

/**
 * DELETE /cart/:userId - Clear all items from user's cart
 *
 * Resets cart to empty state (called after successful order placement).
 */
app.delete('/cart/:userId', async (req: Request, res: Response) => {
  return tracer.startActiveSpan('clear-cart', async (span) => {
    try {
      const { userId } = req.params;
      span.setAttribute('user.id', userId);

      carts.set(userId, {
        userId,
        items: [],
        subtotal: 0,
        discount: 0,
        total: 0,
      });

      console.log(`🛒 Cleared cart for user ${userId}`);

      res.json({ message: 'Cart cleared successfully' });
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error: any) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.recordException(error);
      res.status(500).json({ error: 'Failed to clear cart' });
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
      console.log(`Cart Service listening on port ${PORT}`);
      console.log(`Connected to flagd at ${FLAGD_HOST}:${FLAGD_PORT}`);
    });
  } catch (error) {
    console.error('Failed to start service:', error);
    process.exit(1);
  }
}

start();
