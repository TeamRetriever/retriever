/**
 * Payment Service
 *
 * Handles payment processing for orders.
 *
 * Key Features:
 * - Mock payment processing (validates card details, generates transaction IDs)
 * - Chaos engineering via feature flags (payment failures)
 * - OpenTelemetry distributed tracing
 * - Payment validation and error handling
 *
 * Payment Flow:
 * 1. Receive payment request with order details and card info
 * 2. Check for payment error chaos flag
 * 3. Validate card details (basic validation)
 * 4. Simulate processing delay (500-1000ms)
 * 5. Return success with transaction ID or failure
 *
 * Configuration Flags Available:
 * - Payment transaction processing mode
 *
 * Note: This is a mock service - in production, this would integrate with
 * Stripe, PayPal, or other payment gateways.
 */

import { initTracing } from './tracing';
initTracing();

import express, { Request, Response } from 'express';
import { OpenFeature } from '@openfeature/server-sdk';
import { FlagdProvider } from '@openfeature/flagd-provider';
import { trace, SpanStatusCode, context } from '@opentelemetry/api';
import { suppressTracing } from '@opentelemetry/core';

const app = express();
const PORT = process.env.PORT || 3004;
const FLAGD_HOST = process.env.FLAGD_HOST || 'flagd';
const FLAGD_PORT = process.env.FLAGD_PORT || '8013';

const tracer = trace.getTracer('payment-service', '1.0.0');

interface PaymentRequest {
  orderId: string;
  amount: number;
  cardNumber: string;
  cardHolder: string;
  expiryDate: string;
  cvv: string;
}

interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  orderId: string;
  amount: number;
  timestamp: string;
  error?: string;
}

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
  res.json({ status: 'healthy', service: 'payment-service' });
});

/**
 * POST /payment/process - Process a payment for an order
 *
 * Request body: { orderId, amount, cardNumber, cardHolder, expiryDate, cvv }
 *
 * Processing Steps:
 * 1. Check payment processing configuration
 * 2. Validate card details (basic validation)
 * 3. Simulate processing delay (500-1000ms)
 * 4. Generate mock transaction ID
 * 5. Return success/failure response
 *
 * Returns: { success, transactionId?, orderId, amount, timestamp, error? }
 */
app.post('/payment/process', async (req: Request, res: Response) => {
  return tracer.startActiveSpan('process-payment', async (span) => {
    try {
      const paymentRequest: PaymentRequest = req.body;

      span.setAttribute('payment.order_id', paymentRequest.orderId);
      span.setAttribute('payment.amount', paymentRequest.amount);

      // Check payment processing configuration
      const paymentErrorEnabled = await getFlagValue('4c2f8a6e', false);

      if (paymentErrorEnabled) {
        console.error(`❌ Payment processing configuration active - transaction declined for order ${paymentRequest.orderId}`);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: 'Payment processing failed',
        });

        const errorResponse: PaymentResponse = {
          success: false,
          orderId: paymentRequest.orderId,
          amount: paymentRequest.amount,
          timestamp: new Date().toISOString(),
          error: 'Payment gateway timeout - please try again',
        };

        span.end();
        return res.status(500).json(errorResponse);
      }

      // Simulate payment processing with external gateway
      console.log(`💳 Processing payment for order ${paymentRequest.orderId}: $${paymentRequest.amount.toFixed(2)}`);

      // Simulate network delay to payment gateway
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));

      // Basic card validation (in production, gateway handles this)
      if (!paymentRequest.cardNumber || paymentRequest.cardNumber.length < 13) {
        throw new Error('Invalid card number');
      }

      // Generate mock transaction ID (in production, gateway provides this)
      const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const successResponse: PaymentResponse = {
        success: true,
        transactionId,
        orderId: paymentRequest.orderId,
        amount: paymentRequest.amount,
        timestamp: new Date().toISOString(),
      };

      console.log(`✅ Payment successful for order ${paymentRequest.orderId}, transaction: ${transactionId}`);

      span.setAttribute('payment.success', true);
      span.setAttribute('payment.transaction_id', transactionId);
      span.setStatus({ code: SpanStatusCode.OK });

      res.json(successResponse);
    } catch (error: any) {
      console.error(`❌ Payment failed: ${error.message}`);

      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.recordException(error);

      const errorResponse: PaymentResponse = {
        success: false,
        orderId: req.body.orderId,
        amount: req.body.amount,
        timestamp: new Date().toISOString(),
        error: error.message,
      };

      res.status(400).json(errorResponse);
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
      console.log(`Payment Service listening on port ${PORT}`);
      console.log(`Connected to flagd at ${FLAGD_HOST}:${FLAGD_PORT}`);
    });
  } catch (error) {
    console.error('Failed to start service:', error);
    process.exit(1);
  }
}

start();
