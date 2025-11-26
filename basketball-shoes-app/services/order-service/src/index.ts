/**
 * Order Service
 *
 * Orchestrates the order placement workflow across multiple services.
 *
 * Key Features:
 * - Creates orders from user carts
 * - Coordinates with cart-service, payment-service
 * - Order status tracking (pending → processing → completed/failed)
 * - Chaos engineering via feature flags (timeouts, partial responses)
 * - OpenTelemetry distributed tracing
 *
 * Order Flow:
 * 1. Fetch cart from cart-service
 * 2. Create order record with items and totals
 * 3. Process payment via payment-service
 * 4. Update order status based on payment result
 * 5. Clear cart if successful
 *
 * Configuration Flags Available:
 * - Order processing latency configuration
 * - Order response serialization mode
 */

import { initTracing } from './tracing';
initTracing();

import express, { Request, Response } from 'express';
import axios from 'axios';
import { OpenFeature } from '@openfeature/server-sdk';
import { FlagdProvider } from '@openfeature/flagd-provider';
import { trace, SpanStatusCode, context } from '@opentelemetry/api';
import { suppressTracing } from '@opentelemetry/core';

const app = express();
const PORT = process.env.PORT || 3003;
const FLAGD_HOST = process.env.FLAGD_HOST || 'flagd';
const FLAGD_PORT = process.env.FLAGD_PORT || '8013';
const CART_SERVICE = process.env.CART_SERVICE || 'http://cart-service:3002';
const PAYMENT_SERVICE = process.env.PAYMENT_SERVICE || 'http://payment-service:3004';

const tracer = trace.getTracer('order-service', '1.0.0');

interface Order {
  orderId: string;
  userId: string;
  items: any[];
  subtotal: number;
  discount: number;
  total: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  paymentTransactionId?: string;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

/**
 * In-memory order storage keyed by orderId.
 * In production, this would be a persistent database.
 */
const orders = new Map<string, Order>();

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
 */
async function getFlagValue(flagKey: string, defaultValue: boolean): Promise<boolean> {
  const client = OpenFeature.getClient();
  return await context.with(suppressTracing(context.active()), async () => {
    return await client.getBooleanValue(flagKey, defaultValue);
  });
}

app.use(express.json());

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'order-service' });
});

/**
 * POST /orders - Create a new order from user's cart
 *
 * Request body: { userId, paymentDetails }
 *
 * Workflow:
 * 1. Check processing latency configuration
 * 2. Fetch cart from cart-service
 * 3. Create order record with PROCESSING status
 * 4. Process payment via payment-service
 * 5. Update order status to COMPLETED or FAILED
 * 6. Clear cart on success
 *
 * Returns: Order object with status and payment details
 */
app.post('/orders', async (req: Request, res: Response) => {
  return tracer.startActiveSpan('create-order', async (span) => {
    try {
      const { userId, paymentDetails } = req.body;

      span.setAttribute('user.id', userId);

      // Check for latency configuration
      const timeoutEnabled = await getFlagValue('7b3f9d2e', false);

      if (timeoutEnabled) {
        console.error('❌ Processing latency configuration active');
        await new Promise(resolve => setTimeout(resolve, 35000));
      }

      // Step 1: Get cart from cart service
      console.log(`📦 Creating order for user ${userId}`);
      const cartSpan = tracer.startSpan('fetch-cart-from-cart-service');

      let cart;
      try {
        const cartResponse = await axios.get(`${CART_SERVICE}/cart/${userId}`);
        cart = cartResponse.data;
        cartSpan.setAttribute('cart.items_count', cart.items.length);
        cartSpan.setAttribute('cart.total', cart.total);
        cartSpan.setStatus({ code: SpanStatusCode.OK });
      } catch (error: any) {
        cartSpan.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        cartSpan.recordException(error);
        throw new Error(`Failed to fetch cart: ${error.message}`);
      } finally {
        cartSpan.end();
      }

      if (!cart.items || cart.items.length === 0) {
        throw new Error('Cart is empty');
      }

      // 2. Create order
      const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const order: Order = {
        orderId,
        userId,
        items: cart.items,
        subtotal: cart.subtotal,
        discount: cart.discount,
        total: cart.total,
        status: 'processing',
        createdAt: new Date().toISOString(),
      };

      orders.set(orderId, order);

      span.setAttribute('order.id', orderId);
      span.setAttribute('order.total', order.total);

      console.log(`📝 Order created: ${orderId}, total: $${order.total.toFixed(2)}`);

      // 3. Process payment
      const paymentSpan = tracer.startSpan('process-payment-with-payment-service');

      let paymentResult;
      try {
        const paymentResponse = await axios.post(`${PAYMENT_SERVICE}/payment/process`, {
          orderId,
          amount: order.total,
          ...paymentDetails,
        });
        paymentResult = paymentResponse.data;
        paymentSpan.setAttribute('payment.success', paymentResult.success);
        paymentSpan.setAttribute('payment.transaction_id', paymentResult.transactionId || 'none');
        paymentSpan.setStatus({ code: SpanStatusCode.OK });
      } catch (error: any) {
        paymentSpan.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        paymentSpan.recordException(error);

        order.status = 'failed';
        order.error = `Payment failed: ${error.response?.data?.error || error.message}`;
        orders.set(orderId, order);

        span.setStatus({ code: SpanStatusCode.ERROR, message: 'Payment failed' });
        span.end();

        return res.status(400).json(order);
      } finally {
        paymentSpan.end();
      }

      // 4. Complete order
      order.status = 'completed';
      order.paymentTransactionId = paymentResult.transactionId;
      order.completedAt = new Date().toISOString();
      orders.set(orderId, order);

      // 5. Clear cart
      const clearCartSpan = tracer.startSpan('clear-cart-in-cart-service');
      try {
        await axios.delete(`${CART_SERVICE}/cart/${userId}`);
        clearCartSpan.setStatus({ code: SpanStatusCode.OK });
      } catch (error: any) {
        clearCartSpan.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        clearCartSpan.recordException(error);
        console.warn('Failed to clear cart:', error.message);
      } finally {
        clearCartSpan.end();
      }

      console.log(`✅ Order completed: ${orderId}, transaction: ${paymentResult.transactionId}`);

      span.setStatus({ code: SpanStatusCode.OK });
      res.status(201).json(order);
    } catch (error: any) {
      console.error(`❌ Order creation failed: ${error.message}`);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.recordException(error);
      res.status(500).json({ error: error.message });
    } finally {
      span.end();
    }
  });
});

/**
 * GET /orders/:orderId - Retrieve order details by ID
 *
 * Configuration:
 * - Order response serialization mode
 *
 * Returns: Order object or 404 if not found
 */
app.get('/orders/:orderId', async (req: Request, res: Response) => {
  return tracer.startActiveSpan('get-order', async (span) => {
    try {
      const { orderId } = req.params;
      const partialResponse = await getFlagValue('e6a4c8f1', false);

      span.setAttribute('order.id', orderId);

      const order = orders.get(orderId);

      if (!order) {
        span.setAttribute('order.found', false);
        res.status(404).json({ error: 'Order not found' });
      } else {
        span.setAttribute('order.found', true);
        span.setAttribute('order.status', order.status);

        // Response serialization mode
        if (partialResponse) {
          console.error('💥 Response serialization mode active');
          res.json({
            orderId: order.orderId,
            userId: order.userId,
            total: order.total,
            status: order.status,
            incomplete: true,
          });
        } else {
          res.json(order);
        }
      }

      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error: any) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.recordException(error);
      res.status(500).json({ error: error.message });
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
      console.log(`Order Service listening on port ${PORT}`);
      console.log(`Connected to flagd at ${FLAGD_HOST}:${FLAGD_PORT}`);
      console.log(`Cart Service: ${CART_SERVICE}`);
      console.log(`Payment Service: ${PAYMENT_SERVICE}`);
    });
  } catch (error) {
    console.error('Failed to start service:', error);
    process.exit(1);
  }
}

start();
