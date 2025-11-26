/**
 * Recommendation Service
 *
 * Provides product recommendations based on collaborative filtering.
 *
 * Key Features:
 * - Product recommendation engine (mock collaborative filtering)
 * - Chaos engineering via feature flags (slow API, disabled recommendations)
 * - OpenTelemetry distributed tracing
 * - Configurable recommendation display via feature flags
 *
 * Recommendation Logic:
 * - Uses pre-defined recommendation map (hardcoded)
 * - In production, this would use ML models trained on user behavior
 * - Returns up to 3 recommended products per product ID
 *
 * Configuration Flags Available:
 * - Recommendation service processing delay
 * - Product recommendation visibility
 *
 * Note: This is a mock service - in production, this would integrate with
 * ML models, recommendation engines like AWS Personalize, or collaborative filtering systems.
 */

import { initTracing } from './tracing';
initTracing();

import express, { Request, Response } from 'express';
import { OpenFeature } from '@openfeature/server-sdk';
import { FlagdProvider } from '@openfeature/flagd-provider';
import { trace, SpanStatusCode, context } from '@opentelemetry/api';
import { suppressTracing } from '@opentelemetry/core';

const app = express();
const PORT = process.env.PORT || 3005;
const FLAGD_HOST = process.env.FLAGD_HOST || 'flagd';
const FLAGD_PORT = process.env.FLAGD_PORT || '8013';

const tracer = trace.getTracer('recommendation-service', '1.0.0');

/**
 * Mock recommendation data mapping product IDs to related product IDs.
 * In production, this would be computed by ML models based on:
 * - User browsing history
 * - Purchase patterns
 * - Product similarity
 * - Collaborative filtering
 */
const recommendationMap: Record<string, string[]> = {
  '1': ['2', '5', '8'],
  '2': ['1', '3', '7'],
  '3': ['1', '6', '4'],
  '4': ['2', '7', '5'],
  '5': ['1', '8', '3'],
  '6': ['3', '1', '8'],
  '7': ['4', '2', '5'],
  '8': ['5', '1', '6'],
};

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

/**
 * Middleware: API Configuration Check
 *
 * Checks processing delay configuration.
 *
 * Applied to all recommendation routes automatically via app.use()
 */
async function slowApiMiddleware(req: Request, res: Response, next: Function) {
  return tracer.startActiveSpan('api-request-validation', async (span) => {
    try {
      const slowApiEnabled = await getFlagValue('1e9b4f7c', false);

      if (slowApiEnabled) {
        const delay = 5000 + Math.random() * 5000;
        console.log(`⚠️  Processing delay configuration active - Adding ${Math.round(delay)}ms delay`);
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
  res.json({ status: 'healthy', service: 'recommendation-service' });
});

/**
 * GET /recommendations/:productId - Get product recommendations
 *
 * Returns a list of recommended product IDs based on the given product.
 *
 * Feature Flag Controls:
 * - Recommendation visibility configuration (for A/B testing)
 *
 * Response: {
 *   productId: string,
 *   recommendations: string[],  // Array of recommended product IDs
 *   algorithm: 'collaborative-filtering'
 * }
 *
 * Returns empty array if:
 * - Product ID not found in recommendation map
 * - Recommendation visibility is disabled
 */
app.get('/recommendations/:productId', async (req: Request, res: Response) => {
  return tracer.startActiveSpan('get-recommendations', async (span) => {
    try {
      const { productId } = req.params;
      span.setAttribute('product.id', productId);

      // Check recommendation visibility configuration
      const showRecommendations = await getFlagValue('5a3d8e2f', true);

      if (!showRecommendations) {
        console.log('🚫 Recommendation visibility configuration set to hidden');
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        return res.json({ recommendations: [] });
      }

      // Lookup recommendations from our mock collaborative filtering map
      const recommendations = recommendationMap[productId] || [];

      console.log(`🎯 Generating ${recommendations.length} recommendations for product ${productId}`);

      span.setAttribute('recommendations.count', recommendations.length);
      span.setStatus({ code: SpanStatusCode.OK });

      res.json({
        productId,
        recommendations,
        algorithm: 'collaborative-filtering',
      });
    } catch (error: any) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.recordException(error);
      res.status(500).json({ error: 'Failed to fetch recommendations' });
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
      console.log(`Recommendation Service listening on port ${PORT}`);
      console.log(`Connected to flagd at ${FLAGD_HOST}:${FLAGD_PORT}`);
    });
  } catch (error) {
    console.error('Failed to start service:', error);
    process.exit(1);
  }
}

start();
