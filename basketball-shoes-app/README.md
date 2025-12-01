# SkyBound Shoes - Microservices E-commerce with Feature Flags & Observability

A production-ready TypeScript microservices application demonstrating distributed tracing, feature flags, and observability patterns in an e-commerce context.

## Overview

This is a basketball shoe e-commerce platform built with:
- **7 Microservices**: API Gateway, Product, Cart, Order, Payment, Recommendation services, and Frontend
- **Feature Flags**: OpenFeature with flagd for dynamic behavior control
- **Distributed Tracing**: OpenTelemetry with Jaeger for complete request tracing
- **TypeScript**: Type-safe implementation across all services
- **Docker Compose**: Easy deployment and orchestration

## Table of Contents

- [Quick Reference](#quick-reference)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Using the Application](#using-the-application)
- [Feature Flags](#feature-flags)
- [Observability Demonstrations](#observability-demonstrations)
- [Technical Deep Dive](#technical-deep-dive)
- [Services Reference](#services-reference)
- [Development](#development)
- [Troubleshooting](#troubleshooting)

## Quick Reference

**Access Points:**
- Frontend: http://localhost
- API Gateway: http://localhost:3010
- Jaeger UI: http://localhost:16686
- Prometheus: http://localhost:9090
- flagd: http://localhost:8013

**Key Files:**
- `flagd-config.json` - Feature flag configuration
- `frontend/nginx.conf` - nginx routing rules
- `services/api-gateway/src/index.ts` - API Gateway routes
- `docker_testing_compose.yml` - Full stack with Jaeger + monitoring

**Common Commands:**
```bash
# Start everything
docker-compose up --build

# View logs
docker-compose logs -f api-gateway

# Restart single service
docker-compose restart cart-service

# Restart flagd after config changes
docker-compose restart flagd

# Stop everything
docker-compose down
```

**Request Flow:**
```
Browser → nginx:80 → API Gateway:3000 → Backend Service → flagd/Jaeger
```

## Architecture

This application follows **N-Tier Architecture** principles, separating concerns into distinct layers.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  TIER 1: PRESENTATION LAYER (Client-Side)                   │
│  ┌─────────────┐                                            │
│  │   Browser   │  - User interface                          │
│  │   (React)   │  - Renders UI, handles user interactions   │
│  └─────────────┘  - Makes API calls                         │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/HTTPS
┌────────────────────────┼────────────────────────────────────┐
│  TIER 2: WEB SERVER LAYER                                   │
│  ┌──────────────────────────────────────────────┐           │
│  │  nginx:80 (Web Server)                       │           │
│  │  • Serves static files (HTML/CSS/JS)         │           │
│  │  • Reverse proxy for API requests            │           │
│  └──────────────────────────────────────────────┘           │
└────────────────────────┬────────────────────────────────────┘
                         │ Internal Network
┌────────────────────────┼────────────────────────────────────┐
│  TIER 3: APPLICATION LAYER (Business Logic)                 │
│                        ↓                                     │
│  ┌──────────────────────────────────────────────┐           │
│  │  API Gateway (Express:3000)                  │           │
│  │  • Request routing & orchestration           │           │
│  └────────┬─────────────────────────────────────┘           │
│           │                                                  │
│      ┌────┴────┬─────────┬──────────┬───────────┐           │
│      ↓         ↓         ↓          ↓           ↓           │
│  ┌────────┐ ┌──────┐ ┌───────┐ ┌─────────┐ ┌──────────┐    │
│  │Product │ │ Cart │ │ Order │ │ Payment │ │  Recom.  │    │
│  │Service │ │Svc   │ │Svc    │ │ Svc     │ │  Service │    │
│  │  3001  │ │ 3002 │ │ 3003  │ │  3004   │ │   3005   │    │
│  └────────┘ └──────┘ └───────┘ └─────────┘ └──────────┘    │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┼─────────────────────────────────────┐
│  TIER 4: DATA LAYER                                          │
│  • In-memory stores (each service has its own)               │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  Observability Platform                                      │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                │
│  │  flagd   │    │  Jaeger  │    │Prometheus│                │
│  │  :8013   │    │Collector │    │  :9090   │                │
│  │Feature   │    │Distributed    │Metrics   │                │
│  │Flags     │    │Tracing   │    │Monitoring│                │
│  └──────────┘    └──────────┘    └──────────┘                │
└──────────────────────────────────────────────────────────────┘
```

**Key Components:**
- **Tier 1 (Presentation)**: React frontend in the browser
- **Tier 2 (Web Server)**: nginx serves static files and proxies API requests
- **Tier 3 (Application)**: API Gateway + 5 microservices with business logic
- **Tier 4 (Data)**: In-memory stores (JavaScript data structures)
- **Observability**: Jaeger (tracing), Prometheus (metrics), flagd (feature flags)

Want to understand how each tier works? See the [Technical Deep Dive](#technical-deep-dive) section.


### Access the Application

- **Frontend**: http://localhost
- **Jaeger UI**: http://localhost:16686
- **Prometheus**: http://localhost:9090

## Using the Application

### Normal Shopping Flow

1. **Browse Products**
   - Visit http://localhost
   - Click "Shop Now" to view the product catalog

2. **View Product Details**
   - Click on any basketball shoe
   - See product images, prices, and descriptions

3. **Add to Cart**
   - Select a size
   - Click "Add to Cart"
   - Notice the cart badge updates

4. **View Cart**
   - Click "Cart" in the navigation
   - See your items and total

5. **Checkout**
   - Click "Proceed to Checkout"
   - Fill in shipping information

6. **Payment**
   - Enter mock payment details (any card number with 13+ digits)
   - Submit payment

7. **Confirmation**
   - View your order confirmation with order ID

### Viewing Distributed Traces

Every action creates traces you can view in Jaeger:

1. Open Jaeger UI: http://localhost:16686
2. Select a service from the dropdown (e.g., `api-gateway`)
3. Click "Find Traces"
4. Click on any trace to see the complete request flow

You'll see:
- Which services were called
- How long each service took
- Any errors that occurred
- Feature flags that were checked

## Feature Flags

Feature flags let you change application behavior without restarting services. This is powerful for A/B testing, gradual rollouts, and chaos engineering.

### Available Feature Flags

#### Service Failure Flags (Chaos Engineering)
| Flag Name | Default | Description |
|-----------|---------|-------------|
| `cart-service-failure` | `off` | Simulates cart service returning 503 errors |
| `payment-processing-error` | `off` | Causes payment processing to fail |
| `order-service-timeout` | `off` | Simulates order service timeouts |

#### Performance Degradation Flags
| Flag Name | Default | Description |
|-----------|---------|-------------|
| `slow-product-api` | `off` | Adds 3-5 second delays to product service |
| `slow-recommendation-api` | `off` | Adds 5-10 second delays to recommendations |

#### Business Logic Flags
| Flag Name | Default | Description |
|-----------|---------|-------------|
| `enable-discounts` | `on` | Enables 10% discount for orders over $200 |
| `show-recommendations` | `on` | Shows product recommendations |

#### UI Variation Flags
| Flag Name | Default | Values | Description |
|-----------|---------|--------|-------------|
| `product-display-mode` | `grid` | `grid`, `list` | Controls product listing display |
| `checkout-flow-variant` | `multi-step` | `single-page`, `multi-step` | Checkout flow variation |

### How to Toggle Feature Flags

**Method 1: Edit the config file directly**

1. Open `flagd-config.json` in your editor
2. Find the flag you want to change:
   ```json
   "cart-service-failure": {
     "description": "Simulates cart service being down",
     "state": "ENABLED",
     "variants": {
       "on": true,
       "off": false
     },
     "defaultVariant": "off"  // Change this to "on"
   }
   ```
3. Change `defaultVariant` from `"off"` to `"on"`
4. Save the file
5. Restart flagd: `docker-compose restart flagd`

**Method 2: Use the API**

```bash
# Get current config
curl http://localhost:3010/api/flags/config

# Update config (replace with your desired configuration)
curl -X PUT http://localhost:3010/api/flags/config \
  -H "Content-Type: application/json" \
  -d @flagd-config.json

# Restart flagd to apply changes
docker-compose restart flagd
```

### Experimenting with Flags

Try these experiments:

**Experiment 1: Simulate Cart Service Outage**
1. Enable `cart-service-failure` flag
2. Try to add items to your cart
3. Observe the 503 error in the browser
4. Check Jaeger to see the error trace
5. Disable the flag to restore service

**Experiment 2: Slow Down Product API**
1. Enable `slow-product-api` flag
2. Browse to the product page
3. Notice the 3-5 second delay
4. Check Jaeger to see the increased span duration
5. Check Prometheus to see if latency metrics increased

**Experiment 3: Disable Discounts**
1. Add $250 worth of items to cart (see 10% discount applied)
2. Disable `enable-discounts` flag
3. Refresh your cart
4. Discount disappears
5. Re-enable to restore discount logic

### Adding New Feature Flags

1. Add flag definition to `flagd-config.json`:
   ```json
   "my-new-flag": {
     "description": "Description of what this flag does",
     "state": "ENABLED",
     "variants": {
       "on": true,
       "off": false
     },
     "defaultVariant": "off"
   }
   ```

2. Use flag in service code:
   ```typescript
   const client = OpenFeature.getClient();
   const myFlag = await client.getBooleanValue('my-new-flag', false);

   if (myFlag) {
     // Feature enabled
   } else {
     // Feature disabled
   }
   ```

3. Restart flagd: `docker-compose restart flagd`

### Adding New Microservice

1. Create service directory: `services/my-service/`
2. Add to `docker-compose.yml`:
   ```yaml
   my-service:
     build:
       context: ./services/my-service
     ports:
       - "3006:3006"
     environment:
       - JAEGER_ENDPOINT=http://collector:4318/v1/traces
       - FLAGD_HOST=flagd
     networks:
       - jaeger-test
   ```

## Observability Demonstrations

These scenarios demonstrate how observability helps you understand and debug distributed systems.

### Scenario 1: Successful Order Flow

**See how a normal order works:**

1. Complete a normal order from cart to confirmation
2. Open Jaeger UI: http://localhost:16686
3. Select service: `api-gateway`
4. Click "Find Traces"
5. Click on the most recent trace

**What you'll observe:**
- Complete request flow: API Gateway → Order Service → Cart Service → Payment Service
- Timing for each service call
- Feature flags that were checked
- Total end-to-end duration

### Scenario 2: Simulated Service Failure

**See how errors propagate through the system:**

1. Enable `cart-service-failure` flag
2. Restart flagd: `docker-compose restart flagd`
3. Try to view your cart
4. Observe the 503 error in the browser
5. Check Jaeger traces

**What you'll observe:**
- API Gateway receives the request
- Forwards to Cart Service
- Cart Service returns 503
- Error propagates back to frontend
- Error highlighted in red in Jaeger UI
- Exact error message and stack trace

### Scenario 3: Payment Failure

**See service orchestration fail partway through:**

1. Enable `payment-processing-error` flag
2. Add items to cart
3. Proceed to checkout and submit payment
4. Observe payment failure message
5. Check Jaeger traces

**What you'll observe:**
- Order Service successfully retrieves cart
- Order Service calls Payment Service
- Payment Service fails with injected error
- Order marked as failed
- Error details in span attributes
- Cart remains unchanged (transaction failed)

### Scenario 4: Performance Degradation

**See how slow services impact user experience:**

1. Enable `slow-product-api` flag
2. Browse to product listing page
3. Notice the 3-5 second delay
4. Check Jaeger traces

**What you'll observe:**
- Increased span duration for product service
- Feature flag attribute showing `slow-product-api = true`
- Delay amount recorded in span
- Impact on total request time

### Scenario 5: Cascading Failures

**See how multiple failures compound:**

1. Enable both `cart-service-failure` and `payment-processing-error`
2. Try to complete an order
3. Observe multiple failure points
4. Check Jaeger to see the full failure cascade

**What you'll observe:**
- Order fails at cart retrieval (first failure)
- Payment never attempted (cascading failure prevented)
- Multiple error spans in the trace
- Clear visualization of failure propagation

### Using Jaeger Effectively

**Finding Specific Traces:**
- Filter by service name
- Filter by operation (e.g., `create-order`, `add-to-cart`)
- Filter by tags (e.g., `error=true`)
- Filter by duration (find slow requests)

**Understanding Span Attributes:**
- `feature.flag.*`: Which flags were checked and their values
- `cart.total`: Cart total amount
- `payment.transaction_id`: Payment transaction ID
- `product.count`: Number of products
- `delay.ms`: Injected delay amount
- `error`: Error status and message

**Trace Visualization:**
- Timeline shows duration of each operation
- Parent-child relationships show service calls
- Gaps in timeline show network latency
- Color coding shows errors (red) vs success (blue)

## Technical Deep Dive



### Tier Responsibilities

#### **Tier 1: Presentation Layer**
**Components:** React Frontend (in Browser)

**Responsibilities:**
- User interface rendering
- User input handling
- Client-side validation
- State management (React state, context)
- API consumption

**Why Separate?**
- Can be replaced without touching backend (e.g., swap React for Vue)
- Enables mobile apps, CLI tools to use same backend
- Different teams can work on frontend vs backend

#### **Tier 2: Web Server Layer**
**Components:** nginx

**Responsibilities:**
- Serving static assets (HTML, CSS, JavaScript, images)
- SSL/TLS termination
- Reverse proxy (routing /api to backend)
- Load balancing across multiple API Gateway instances
- Caching static content
- Gzip compression

**Why Separate?**
- nginx excels at serving static files (10x faster than Node.js)
- Single entry point (port 80/443)
- Security boundary - backend never exposed directly
- Can scale independently (add more nginx instances)

#### **Tier 3: Application Layer**
**Components:** API Gateway + Microservices

**Sub-Layer 3A: API Gateway (Facade Pattern)**
- Single entry point for all client requests
- Service discovery and routing
- Request/response transformation
- Cross-cutting concerns (logging, tracing, CORS)

**Sub-Layer 3B: Business Services (Microservices Pattern)**
- **Product Service**: Catalog management, search, filtering
- **Cart Service**: Shopping cart CRUD, discount calculation
- **Order Service**: Order orchestration (coordinates cart + payment)
- **Payment Service**: Payment processing (mock in demo)
- **Recommendation Service**: Product recommendations

**Why Microservices?**
- **Scalability**: Scale only the services that need it
- **Fault Isolation**: If Payment Service fails, cart still works
- **Independent Deployment**: Update one service without touching others
- **Technology Flexibility**: Each service can use different tech stacks
- **Team Autonomy**: Different teams own different services

**Why API Gateway?**
- Prevents clients from knowing about multiple services
- Reduces chattiness (gateway can aggregate multiple service calls)
- Centralized security, rate limiting, caching

#### **Tier 4: Data Layer**
**Components:** In-memory stores (each service manages its own)

**Responsibilities:**
- Data persistence
- Data integrity and consistency
- Transactions
- Queries and indexing

**Pattern Used:** Database per Service
- Each microservice has its own data store via Javascript data structures
- Services don't share databases
- Enforces loose coupling
- Currently uses in-memory storage for demo purposes

**Why Separate?**
- Business logic doesn't depend on storage technology
- Services are independently deployable and scalable
- Each service can choose the best storage solution for its needs

### The Observability Stack

These components don't fit into traditional application tiers—they span all layers to provide comprehensive **observability** into the system.

#### **The Three Pillars of Observability**

**1. Distributed Tracing (Jaeger + OpenTelemetry)**

**What it does:**
- Tracks a single request as it flows through multiple services
- Records timing information for each operation
- Shows the complete call graph across your microservices
- Captures errors and their context

**How it works:**
- Every service instruments code with OpenTelemetry SDK
- Creates "spans" for each operation (database query, HTTP call, business logic)
- Spans linked together by trace ID (forms a complete request trace)
- All spans sent to Jaeger Collector via OTLP protocol
- Stored in OpenSearch for querying

**Why it matters:**
- In microservices, a single user action triggers calls across multiple services
- Without tracing, you can't see which service is slow or failing
- Tracing shows: "Order creation took 156ms: 12ms in Cart, 89ms in Payment"
- Essential for debugging distributed systems

**2. Metrics & Monitoring (Prometheus + AlertManager)**

**What it does:**
- Collects numeric metrics over time (request rate, error rate, duration)
- Evaluates alert rules against metrics
- Sends notifications when thresholds exceeded

**How it works:**
- Prometheus scrapes metrics endpoints every 15 seconds
- Stores time-series data
- Evaluates alert rules: "IF error_rate > 5% FOR 5 minutes THEN alert"
- AlertManager receives alerts, deduplicates, and routes to Slack

**Why it matters:**
- Metrics show trends over time
- Alerts notify you of problems before users complain
- Provides aggregate system-wide view

**3. Feature Flags (flagd + OpenFeature)**

**What it does:**
- Controls application behavior at runtime without code changes
- Enables A/B testing, gradual rollouts, and emergency kill switches

**How it works:**
- Services check flags via OpenFeature SDK
- flagd service returns flag values based on configuration
- Each flag check recorded in distributed traces
- Can be toggled without redeploying services

**Why it matters for observability:**
- Correlate behavior changes with flag toggles
- Answer: "Did enabling payment-gateway-v2 increase errors?"
- See in traces which code path was executed
- Safe experimentation: toggle flag, observe metrics, rollback if needed

#### **How Observability Components Work Together**

**Real-world scenario: Payment Service starts failing**

```
1. Jaeger Traces show errors in payment-service spans
   → "Payment processing failed: timeout after 30s"

2. Prometheus alerts fire
   → "payment-service error rate: 15% (threshold: 5%)"

3. AlertManager sends Slack notification
   → "🚨 High error rate in payment-service"

4. Engineer investigates in Jaeger UI
   → Sees traces: payment-service calling external API, timing out
   → Sees feature flag: payment-gateway-v2 = enabled

5. Engineer toggles flag via API Gateway
   → PUT /api/flags/config (disable payment-gateway-v2)
   → Restart flagd

6. Observe recovery in real-time
   → Jaeger traces: no more timeout errors
   → Prometheus metrics: error rate drops to 0%
   → AlertManager: alert auto-resolves
```

This demonstrates: **detect, investigate, resolve, and verify** - all through the observability stack.

### How It Works: Complete Request Flow

#### Example: User Adds Shoes to Cart

```
1. User clicks "Add to Cart" in browser
   ↓
2. React app sends: POST http://localhost/api/cart/user123/items
   Body: {productId: 1, quantity: 1}
   ↓
3. nginx (frontend:80) receives the request
   • Matches location /api in nginx.conf
   • Proxies to http://api-gateway:3000/api/cart/user123/items
   ↓
4. API Gateway (services/api-gateway/src/index.ts:159)
   • Creates OpenTelemetry span "proxy-to-cart-service"
   • Logs: "POST /api/cart/user123/items"
   • Forwards to http://cart-service:3002/cart/user123/items
   ↓
5. Cart Service (services/cart-service/src/index.ts)
   • Receives request with trace context
   • Checks feature flag "enable-discounts" via flagd:8013
   • Adds item to in-memory cart
   • Calculates total (applies 10% discount if flag enabled)
   • Sends trace span to Jaeger Collector:4318
   • Returns: {userId: "user123", items: [...], total: 170}
   ↓
6. Response flows back: Cart → API Gateway → nginx → Browser
   ↓
7. React updates UI: "Cart (1)" badge appears
   ↓
8. Behind the scenes:
   • Jaeger Collector stores trace in OpenSearch
   • Prometheus scrapes metrics from Jaeger
   • You can view the complete trace in Jaeger UI:16686
```

#### Example: User Places Order (Service Orchestration)

```
1. User clicks "Checkout" → POST /api/orders
   ↓
2. nginx → API Gateway → Order Service:3003
   ↓
3. Order Service orchestrates multiple service calls:

   a) GET http://cart-service:3002/cart/user123
      • Retrieves cart items
      • Returns: {items: [...], total: 170}

   b) POST http://payment-service:3004/payment/process
      • Payment Service checks "payment-gateway-v2" flag
      • Processes payment (mock in demo)
      • Returns: {status: "success", transactionId: "txn_123"}

   c) Order Service creates order record
      • Returns: {orderId: "order_xyz", status: "confirmed"}
   ↓
4. Single distributed trace shows entire workflow:
   • api-gateway: "proxy-to-order-service" (156ms total)
     └─ order-service: "create-order" (154ms)
        ├─ order-service → cart-service: "fetch-cart" (12ms)
        └─ order-service → payment-service: "process-payment" (89ms)
```

#### How nginx and API Gateway Work Together

**nginx's Role** (frontend/nginx.conf):
- **Static Files**: Serves React app HTML/JS/CSS from `/usr/share/nginx/html`
- **SPA Routing**: `try_files $uri $uri/ /index.html` enables React Router
- **API Proxy**: All `/api/*` requests forwarded to API Gateway
- **Why?** Single entry point at port 80, no CORS issues, unified domain

**API Gateway's Role** (services/api-gateway/src/index.ts):
- **Service Router**: Maps `/api/products` → product-service:3001, etc.
- **Tracing**: Creates parent span, propagates context to downstream services
- **Error Handling**: Catches service errors, returns appropriate status codes
- **Feature Management**: Provides `/api/flags/config` endpoint for flag updates

#### How Feature Flags Work

```
1. Service needs to check a feature flag:
   const client = OpenFeature.getClient();
   const enabled = await client.getBooleanValue('enable-discounts', false);
   ↓
2. OpenFeature SDK sends gRPC request to flagd:8013
   ↓
3. flagd reads /etc/flagd/flagd-config.json:
   {
     "flags": {
       "enable-discounts": {
         "state": "ENABLED",
         "defaultVariant": "on",
         "variants": {"on": true, "off": false}
       }
     }
   }
   ↓
4. flagd returns: true
   ↓
5. Service executes feature-flagged code path
   if (enabled) {
     // Apply 10% discount
   }
   ↓
6. Flag check recorded in OpenTelemetry span attributes
```


## Services Reference

### Backend Services
- **API Gateway** (Port 3010): Routes requests and manages service orchestration
- **Product Service** (Port 3001): Manages shoe catalog and inventory
- **Cart Service** (Port 3002): Shopping cart management with discount logic
- **Order Service** (Port 3003): Order processing and coordination
- **Payment Service** (Port 3004): Mock payment processing
- **Recommendation Service** (Port 3005): Product recommendations

### Frontend
- **React Application** (Port 80): Modern SPA with feature flag integration

### Observability Platform
- **flagd** (Port 8013): OpenFeature-compliant feature flag service
- **Jaeger Collector** (Port 4318): Trace ingestion
- **Jaeger Query** (Port 16686): Distributed tracing UI
- **Prometheus** (Port 9090): Metrics collection and alerting
- **OpenSearch** (Port 9200): Trace storage backend

## Development

### Running Services Locally

Each service can be run independently for development:

```bash
cd services/product-service
npm install
npm run dev
```



3. Add route to API Gateway: `services/api-gateway/src/index.ts`

## Troubleshooting

### Services not starting
```bash
docker-compose down
docker-compose up --build
```

### Port conflicts
Check if ports 80, 3000-3005, 8013, or 16686 are in use:
```bash
lsof -i :80
lsof -i :3000
```

### Traces not appearing in Jaeger
1. Wait 10-15 seconds for traces to be exported
2. Verify Jaeger is running: http://localhost:16686
3. Check service logs for OpenTelemetry errors:
   ```bash
   docker-compose logs cart-service
   ```

### Feature flags not working
1. Verify flagd is running: `docker-compose ps`
2. Check flag syntax in `flagd-config.json`
3. Restart services after config changes: `docker-compose restart flagd`

### Container memory issues
If services are crashing, increase Docker memory:
- Docker Desktop → Settings → Resources → Memory (increase to 4GB+)

### Logs show connection refused
Services are starting in wrong order. Add health checks or increase `depends_on` delays.

## Use Cases

This application demonstrates:

1. **Microservices Communication**: Service-to-service calls with proper context propagation
2. **Error Propagation**: How failures cascade through distributed systems
3. **Feature Flag Patterns**: Runtime behavior modification without redeployment
4. **Distributed Tracing**: Complete request visibility across service boundaries
5. **Performance Monitoring**: Identifying slow services and bottlenecks
6. **Chaos Engineering**: Controlled failure injection for testing resilience

## Technology Stack

- **Backend**: TypeScript, Express.js, Node.js
- **Frontend**: React, TypeScript, Vite
- **Web Server**: nginx
- **Tracing**: OpenTelemetry, Jaeger, OpenSearch
- **Feature Flags**: OpenFeature, flagd
- **Monitoring**: Prometheus, AlertManager
- **Containerization**: Docker, Docker Compose
- **API Style**: REST

## License

MIT

## Contributing

Contributions welcome! Please open an issue or submit a pull request.
