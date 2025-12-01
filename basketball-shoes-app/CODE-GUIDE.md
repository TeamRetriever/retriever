# 📚 Code Guide - Understanding the Basketball Shoes App

This guide breaks down each file and explains what it does.

---

## 📁 File Structure Overview

```
basketball-shoes-app/
├── .github/workflows/
│   └── build-images.yml          # Auto-builds Docker images
├── services/                      # Backend microservices
│   ├── api-gateway/
│   ├── product-service/
│   ├── cart-service/
│   ├── order-service/
│   ├── payment-service/
│   └── recommendation-service/
├── frontend/                      # React frontend
├── docker_testing_compose.yml     # Main Docker Compose file
├── flagd-config.json             # Feature flags configuration
└── build-arm64.sh                # ARM64 image build script
```

---

## 🐳 docker_testing_compose.yml

**Purpose:** Orchestrates all 14 services for the complete observability stack

### Structure Breakdown:

#### 1. Networks
```yaml
networks:
  jaeger-test:
    driver: bridge
```
- Creates isolated network for all services to communicate
- Services reference each other by container name (e.g., `http://product-service:3001`)

#### 2. Secrets
```yaml
secrets:
  slack_webhook:
    file: ./slack_webhook.txt
  slack_channel:
    file: ./slack_channel.txt
```
- Loads Slack credentials from files
- Used by AlertManager for notifications

#### 3. Jaeger Infrastructure (4 services)

**Collector:**
```yaml
collector:
  image: jaegertracing/jaeger:2.11.0
  command: ["--config", "/etc/collector/config.yml"]
  ports:
    - "4317:4317"    # OTLP gRPC
    - "4318:4318"    # OTLP HTTP
    - "8889:8889"    # Metrics endpoint
```
- Receives traces from basketball app
- Stores in OpenSearch
- Generates metrics via spanmetrics connector
- Exposes metrics on port 8889 for Prometheus

**Query:**
```yaml
query:
  image: jaegertracing/jaeger:2.11.0
  ports:
    - "16686:16686"  # Web UI
```
- Provides web UI for viewing traces
- Queries OpenSearch for trace data

**OpenSearch:**
```yaml
opensearch:
  image: opensearchproject/opensearch:2.11.1
  environment:
    - OPENSEARCH_JAVA_OPTS=-Xms512m -Xmx512m
  ports:
    - "9200:9200"
```
- Persistent storage for traces
- 512MB heap size (adjust for production)
- Collector writes traces here
- Query reads traces from here

**Prometheus:**
```yaml
prometheus:
  image: prom/prometheus:latest
  volumes:
    - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
    - ./prometheus/alert_rules.yml:/etc/prometheus/alert_rules.yml
```
- Scrapes metrics from collector (port 8889)
- Evaluates alert rules
- Stores metrics time-series data

#### 4. Basketball Shoes App (7 services)

**flagd:**
```yaml
flagd:
  image: ghcr.io/open-feature/flagd:latest
  command: ["start", "--uri", "file:/etc/flagd/flagd-config.json"]
  volumes:
    - ./flagd-config.json:/etc/flagd/flagd-config.json
```
- Serves feature flags to backend services
- Reads config from mounted JSON file
- Services query it via OpenFeature SDK

**api-gateway:**
```yaml
api-gateway:
  image: ghcr.io/kcstills17/basketball-shoes-app/api-gateway:latest
  ports:
    - "3010:3000"
  environment:
    - PRODUCT_SERVICE=http://product-service:3001
    - CART_SERVICE=http://cart-service:3002
    # ... other service URLs
  volumes:
    - ./flagd-config.json:/app/flagd-config.json
```
- Entry point for all frontend requests
- Routes to appropriate backend service
- Has `build:` fallback if image not available
- Mounts flagd config for local flag evaluation

**Backend Services (5 services):**
```yaml
product-service:
  image: ghcr.io/kcstills17/basketball-shoes-app/product-service:latest
  ports:
    - "3001:3001"
  environment:
    - JAEGER_ENDPOINT=http://collector:4318/v1/traces
    - FLAGD_HOST=flagd
    - FLAGD_PORT=8013
```
- Each service has its own port (3001-3005)
- All send traces to collector
- All connect to flagd for feature flags
- Use `build:` section as fallback

**frontend:**
```yaml
frontend:
  image: ghcr.io/kcstills17/basketball-shoes-app/frontend:latest
  ports:
    - "80:80"
```
- Nginx serves React build
- Calls API Gateway on port 3010
- No tracing (browser-side)

---

## 🚩 flagd-config.json

**Purpose:** Defines 25+ feature flags for chaos engineering

### Structure:

```json
{
  "$schema": "https://flagd.dev/schema/v0/flags.json",
  "flags": {
    "flag-name": {
      "description": "What this flag does",
      "state": "ENABLED",
      "variants": {
        "on": true,
        "off": false
      },
      "defaultVariant": "off"
    }
  }
}
```

### Key Flag Types:

**1. Error Simulation:**
```json
"cart-service-failure": {
  "description": "Simulates cart service being down - returns 503 errors",
  "defaultVariant": "off"
}
```
- When `on`: Service returns 503 errors
- Tests error handling in dependent services

**2. Latency Injection:**
```json
"slow-product-api": {
  "description": "Adds 3-5 second delays to product service responses",
  "defaultVariant": "off"
}
```
- When `on`: Adds artificial delays
- Tests timeout handling and user experience

**3. Data Corruption:**
```json
"invalid-product-data": {
  "description": "Returns corrupted/malformed product data",
  "defaultVariant": "off"
}
```
- When `on`: Returns malformed JSON
- Tests error handling for bad data

**4. Feature Toggles:**
```json
"enable-discounts": {
  "description": "Enables discount calculations in cart",
  "defaultVariant": "on"
}
```
- Controls feature availability
- Can be toggled without deployment

**5. Configuration:**
```json
"error-rate-percentage": {
  "variants": {
    "0": 0,
    "10": 10,
    "25": 25,
    "50": 50
  },
  "defaultVariant": "0"
}
```
- Numeric configuration
- Controls failure rate percentage

### How Services Use Flags:

```typescript
// In service code
const client = OpenFeature.getClient();
const isSlowMode = await client.getBooleanValue('slow-product-api', false);

if (isSlowMode) {
  await sleep(3000); // Add delay
}
```

---

## 🏗️ build-arm64.sh

**Purpose:** Builds frontend ARM64 image on Apple Silicon Macs

### Script Breakdown:

**1. Configuration:**
```bash
REGISTRY="ghcr.io"
NAMESPACE="kcstills17/basketball-shoes-app"
TAG="latest"
PLATFORM="linux/arm64"
```
- Sets registry and namespace for images
- Hardcoded to ARM64 platform

**2. Login Check:**
```bash
if ! docker info 2>/dev/null | grep -q "Username"; then
  echo "Not logged in"
  exit 1
fi
```
- Verifies Docker is logged into GHCR
- Prevents build failures due to authentication

**3. Build and Push:**
```bash
docker buildx build $NO_CACHE \
  --platform $PLATFORM \
  -t "$REGISTRY/$NAMESPACE/$service:$TAG" \
  -f "$context/Dockerfile" \
  --push \
  "$context"
```
- Uses `buildx` for multi-platform builds
- `--platform linux/arm64`: Native ARM64 build (no emulation)
- `--push`: Pushes to GHCR immediately after build
- `$context`: Path to service directory

**Why Only Frontend?**
- Backend services build ARM64 via GitHub Actions (QEMU works fine)
- Frontend crashes QEMU due to heavy npm/Vite build
- Native ARM64 build on Mac is fast (~2-3 min)

---

## ⚙️ .github/workflows/build-images.yml

**Purpose:** Auto-builds and publishes Docker images to GHCR

### Workflow Breakdown:

**1. Triggers:**
```yaml
on:
  push:
    branches:
      - main
    paths:
      - 'services/**'
      - 'frontend/**'
  workflow_dispatch:
```
- Runs on push to `main` when services/frontend change
- Can be manually triggered

**2. Matrix Strategy:**
```yaml
strategy:
  matrix:
    service:
      - name: api-gateway
        context: ./services/api-gateway
      - name: product-service
        context: ./services/product-service
      # ... 5 more services
```
- Builds all 7 services in parallel
- Each gets its own job

**3. Platform Detection:**
```yaml
- name: Determine platforms
  run: |
    if [ "${{ matrix.service.name }}" = "frontend" ]; then
      echo "platforms=linux/amd64" >> $GITHUB_OUTPUT
    else
      echo "platforms=linux/amd64,linux/arm64" >> $GITHUB_OUTPUT
    fi
```
- Frontend: AMD64 only (QEMU crashes)
- Backend: AMD64 + ARM64 (QEMU works)

**4. Build and Push:**
```yaml
- name: Build and push
  uses: docker/build-push-action@v5
  with:
    context: ${{ matrix.service.context }}
    push: true
    tags: ${{ steps.meta.outputs.tags }}
    platforms: ${{ steps.platforms.outputs.platforms }}
    cache-from: type=gha
    cache-to: type=gha,mode=max
```
- Builds Docker image from context
- Pushes to `ghcr.io/kcstills17/basketball-shoes-app/`
- Uses GitHub Actions cache for faster builds
- Multi-platform build (AMD64 + ARM64 for backend)

**5. Automatic Tagging:**
```yaml
tags: |
  type=raw,value=latest,enable={{is_default_branch}}
  type=sha,prefix=,format=short
  type=ref,event=branch
```
- `latest`: Latest from main branch
- `<sha>`: Specific commit (e.g., `abc1234`)
- `<branch>`: Branch name

---

## 🎯 Service Architecture

### API Gateway (`services/api-gateway/`)

**Purpose:** Routes requests to backend services

**Key Files:**
- `src/index.ts`: Express server setup
- `src/tracing.ts`: OpenTelemetry initialization

**Flow:**
```
Frontend → API Gateway → Routes to service → Returns response
                ↓
          Sends trace to Collector
```

**Example Route:**
```typescript
app.get('/api/products', async (req, res) => {
  const response = await axios.get('http://product-service:3001/products');
  res.json(response.data);
});
```

### Product Service (`services/product-service/`)

**Purpose:** Manages product catalog

**Key Features:**
- Returns list of basketball shoes
- Simulates latency based on feature flags
- Generates product detail traces

**Data Structure:**
```typescript
interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  description: string;
}
```

### Cart Service (`services/cart-service/`)

**Purpose:** Manages shopping cart state

**Operations:**
- `GET /cart/:userId`: Get user's cart
- `POST /cart/:userId/add`: Add item to cart
- `DELETE /cart/:userId/item/:itemId`: Remove item

**In-Memory Storage:**
```typescript
const carts = new Map<string, CartItem[]>();
```

### Order Service (`services/order-service/`)

**Purpose:** Creates and tracks orders

**Flow:**
```
1. Receive order request
2. Call cart service to get items
3. Call payment service to process payment
4. Create order record
5. Return order confirmation
```

**Cross-Service Communication:**
```typescript
const cartResponse = await axios.get(`http://cart-service:3002/cart/${userId}`);
const paymentResponse = await axios.post('http://payment-service:3004/process', {...});
```

### Payment Service (`services/payment-service/`)

**Purpose:** Simulates payment processing

**Features:**
- Validates payment details
- Simulates failures based on feature flags
- Returns transaction ID

### Recommendation Service (`services/recommendation-service/`)

**Purpose:** Generates product recommendations

**Algorithm:**
```typescript
// Simple recommendation logic
function getRecommendations(productId: string) {
  // Return 3 random products excluding current
  return products.filter(p => p.id !== productId).slice(0, 3);
}
```

---

## 🎨 Frontend (`frontend/`)

**Purpose:** React-based e-commerce UI

### Key Files:

**`src/pages/`**
- `HomePage.tsx`: Landing page with featured products
- `ProductListPage.tsx`: Browse all products
- `ProductDetailPage.tsx`: Individual product view
- `CartPage.tsx`: Shopping cart
- `CheckoutPage.tsx`: Checkout form
- `OrderConfirmationPage.tsx`: Order success
- `FeatureFlagsPage.tsx`: Toggle feature flags

**`src/components/`**
- `Header.tsx`: Navigation with cart count
- `Toast.tsx`: Notification system

**API Calls:**
```typescript
// All API calls go through API Gateway
const response = await fetch('http://localhost:3010/api/products');
```

**Feature Flag UI:**
```typescript
// Allows toggling flags via frontend
const toggleFlag = async (flagName: string) => {
  await fetch(`http://localhost:3010/api/flags/${flagName}/toggle`, {
    method: 'POST'
  });
};
```

---

## 🔄 Data Flow Example

### Complete Checkout Flow:

```
1. User clicks "Checkout" on CartPage
   └─> POST http://localhost:3010/api/orders
       ↓
2. API Gateway receives request
   └─> Forwards to Order Service
       ↓
3. Order Service:
   └─> GET http://cart-service:3002/cart/user123
   └─> POST http://payment-service:3004/process
   └─> Creates order
       ↓
4. All services send traces:
   └─> OTLP to http://collector:4318/v1/traces
       ↓
5. Collector:
   └─> Stores traces in OpenSearch
   └─> Generates metrics (calls_total, duration_milliseconds)
       ↓
6. Prometheus:
   └─> Scrapes metrics from collector:8889
   └─> Evaluates alert rules
       ↓
7. Jaeger Query:
   └─> User views traces at localhost:16686
```

---

## 🚀 Deployment Flow

### For Users (Retriever Repo):

```bash
git clone https://github.com/YOU/retriever
cd retriever/docker_testing
docker compose pull    # Pulls pre-built images from GHCR
docker compose up -d   # Starts all 14 services
```

### For Maintainers (Basketball-Shoes-App Repo):

```bash
# 1. Make code changes
git add .
git commit -m "feat: add new feature"
git push origin main

# 2. GitHub Actions automatically:
#    - Builds 7 services (AMD64 for all, ARM64 for 6 backend)
#    - Pushes to ghcr.io/kcstills17/basketball-shoes-app/

# 3. Build frontend ARM64 manually (one-time):
./build-arm64.sh

# 4. Users pull latest:
docker compose pull
docker compose up -d
```

---

## 📊 Observability Flow

### Trace Generation:

```typescript
// Each service initializes tracing
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('product-service');

app.get('/products', async (req, res) => {
  const span = tracer.startSpan('getProducts');

  // Check feature flag
  const isSlowMode = await flagClient.getBooleanValue('slow-product-api', false);
  if (isSlowMode) {
    span.setAttribute('slow_mode', true);
    await sleep(3000);
  }

  const products = getProducts();
  span.end();

  res.json(products);
});
```

### Metrics Generation:

Collector's spanmetrics connector automatically creates:

```promql
# From traces → metrics
calls_total{service_name="product-service",http_method="GET",http_status_code="200"}
duration_milliseconds_bucket{service_name="product-service",le="100"}
```

### Alert Evaluation:

```yaml
# prometheus/alert_rules.yml
- alert: HighLatency
  expr: histogram_quantile(0.95, rate(duration_milliseconds_bucket[5m])) > 100
  for: 5m
```

When triggered → AlertManager → Slack notification

---

## 🎓 Key Concepts

### Why Separate Collector and Query?

**Traditional Jaeger (All-in-One):**
```
App → Jaeger All-in-One (Collector + Query + Storage)
```

**Distributed Jaeger (This Setup):**
```
App → Collector → OpenSearch ← Query UI
              ↓
          Prometheus
```

**Benefits:**
- Scale collector and query independently
- Persistent storage in OpenSearch
- Automatic metrics generation
- Production-ready architecture

### Why Feature Flags?

```typescript
// Without flags: Need deployment to change behavior
const SLOW_MODE = true; // Hardcoded

// With flags: Change behavior instantly
const isSlowMode = await flagClient.getBooleanValue('slow-product-api', false);
```

**Use Cases:**
- Test error handling without code changes
- A/B testing
- Gradual rollouts
- Kill switches
- Chaos engineering

### Why Pre-built Images?

**Without:**
```bash
docker compose build  # 7-13 minutes
docker compose up     # 2-3 minutes
# Total: 9-16 minutes
```

**With:**
```bash
docker compose pull   # 30 seconds
docker compose up     # 2-3 minutes
# Total: 2-3 minutes
```

**Savings:** 5-10 minutes per deployment

---

## 🔧 Configuration Files

### `prometheus/prometheus.yml`
```yaml
scrape_configs:
  - job_name: 'jaeger-collector'
    static_configs:
      - targets: ['collector:8889']
```
- Tells Prometheus where to scrape metrics
- Every 15 seconds by default

### `prometheus/alert_rules.yml`
```yaml
groups:
  - name: microservices
    rules:
      - alert: ServiceError
        expr: rate(calls_total{http_status_code=~"5.."}[1m]) > 0
```
- Defines when alerts fire
- `for: 30s` means alert must be active for 30s before firing

### `alertmanager/alertmanager.yml`
```yaml
receivers:
  - name: 'slack-alerts'
    slack_configs:
      - channel: '#alerts'
        text: 'Alert: {{ .GroupLabels.alertname }}'
```
- Routes alerts to Slack
- Can have multiple receivers (PagerDuty, email, etc.)

---

## 💡 Tips

### Debugging Services:

```bash
# View logs
docker compose logs -f product-service

# Check if service is sending traces
docker compose logs collector | grep product-service

# Verify feature flags
curl http://localhost:8013/api/v1/flags
```

### Testing Locally:

```bash
# Build services locally
cd services/product-service
npm run build
npm start

# Test without Docker
JAEGER_ENDPOINT=http://localhost:4318/v1/traces \
FLAGD_HOST=localhost \
npm start
```

### Modifying Flags:

```bash
# Edit flagd-config.json
vim flagd-config.json

# Restart flagd to reload
docker compose restart flagd
```

---

This guide covers the essential components. For specific implementation details, check the source code in each service directory.
