# Integration Guide: Basketball Shoes App → Distributed Jaeger Setup

This guide shows you how to integrate the basketball shoes e-commerce app into your existing distributed Jaeger project.

## 📂 Final Directory Structure

```
your-main-project/
├── basketball-shoes-app/           # ← Your e-commerce app goes here
│   ├── services/
│   │   ├── api-gateway/
│   │   ├── cart-service/
│   │   ├── product-service/
│   │   ├── order-service/
│   │   ├── payment-service/
│   │   └── recommendation-service/
│   ├── frontend/
│   ├── flagd-config.json
│   └── docker-compose.yml          # Original (for standalone use)
│
├── docker_testing/
│   ├── compose.yml                 # ← Main compose file (updated)
│   ├── collector/
│   │   └── config.yml
│   ├── query/
│   │   ├── config.yml
│   │   └── config-ui.json
│   ├── prometheus/
│   │   ├── prometheus.yml
│   │   └── alert_rules.yml
│   ├── alertmanager/
│   │   └── alertmanager.yml
│   ├── slack_webhook.txt
│   └── slack_channel.txt
│
├── retriever_mcp/
│   └── ...
│
└── README.md
```

## 🚀 Step-by-Step Integration

### Step 1: Copy Basketball App to Main Project

```bash
# Navigate to your main project directory
cd /path/to/your-main-project

# Copy the basketball app (adjust source path as needed)
cp -r /home/user/basketball-shoes-feature-flag-app ./basketball-shoes-app

# Or if you prefer to move it:
# mv /home/user/basketball-shoes-feature-flag-app ./basketball-shoes-app
```

### Step 2: Backup Your Current Compose File

```bash
cd docker_testing

# Backup the current compose.yml
cp compose.yml compose.yml.backup
```

### Step 3: Replace compose.yml

Copy the file `docker_testing_compose.yml` (that I just created) to replace your `docker_testing/compose.yml`:

```bash
# From the basketball-shoes-app directory
cp docker_testing_compose.yml ../docker_testing/compose.yml
```

Or manually copy the contents of `docker_testing_compose.yml` into `docker_testing/compose.yml`.

### Step 4: Verify Path Structure

The new compose file uses relative paths like `../basketball-shoes-app/...`. Verify your structure matches:

```bash
# From docker_testing directory, these paths should work:
ls ../basketball-shoes-app/flagd-config.json
ls ../basketball-shoes-app/services/api-gateway
ls ../basketball-shoes-app/frontend
```

If paths don't match, adjust the `context:` and `volumes:` paths in `compose.yml`.

### Step 5: Build the Services

```bash
cd docker_testing

# Build all basketball app images
docker compose build api-gateway product-service cart-service \
  order-service payment-service recommendation-service frontend
```

### Step 6: Start the Full Stack

**Without AlertManager:**
```bash
docker compose up -d
```

**With AlertManager (requires Slack configuration):**
```bash
docker compose --profile alerts up -d
```

### Step 7: Verify Services

```bash
# Check all containers are running
docker compose ps

# Should see:
# - collector
# - query
# - opensearch
# - prometheus
# - mcp
# - flagd
# - api-gateway
# - product-service
# - cart-service
# - order-service
# - payment-service
# - recommendation-service
# - frontend
# - (optional) alertmanager

# Check OpenSearch health
curl http://localhost:9200/_cluster/health

# Check collector metrics
curl http://localhost:8889/metrics | grep -i trace
```

## 🌐 Access Your Services

| Service | URL | Description |
|---------|-----|-------------|
| **Basketball App** | http://localhost | Main e-commerce site |
| **Feature Flags** | http://localhost/flags | Toggle chaos flags |
| **Jaeger UI** | http://localhost:16686 | View distributed traces |
| **Prometheus** | http://localhost:9090 | Metrics & queries |
| **AlertManager** | http://localhost:9093 | Alert dashboard |
| **OpenSearch** | http://localhost:9200 | Storage backend API |

## 🎮 Quick Demo Workflow

### 1. Generate Traces

```bash
# Visit the app
open http://localhost

# Browse products, add to cart, complete checkout
# Each action generates distributed traces
```

### 2. View Traces in Jaeger

```bash
# Open Jaeger UI
open http://localhost:16686

# Select service: api-gateway, order-service, or cart-service
# Click "Find Traces"
# Explore the distributed traces showing all microservices
```

### 3. Enable Chaos

```bash
# Open Feature Flags UI
open http://localhost/flags

# Toggle some flags:
# - slow-product-api (ON)
# - intermittent-cart-failure (ON)

# Click "Save Changes"

# Restart flagd to apply changes
docker compose restart flagd

# Wait 2-3 seconds, then use the app again
# View the failures and delays in Jaeger!
```

### 4. View Span Metrics

```bash
# Open Prometheus
open http://localhost:9090

# Try these queries:

# 1. Request rate by service
rate(calls_total[5m])

# 2. P95 latency
histogram_quantile(0.95, rate(duration_bucket[5m]))

# 3. Error rate (5xx responses)
rate(calls_total{status_code=~"5.."}[5m])

# 4. Requests to cart service
calls_total{service_name="cart-service"}
```

## 🔧 Path Customization

If your basketball app is in a different location, update these paths in `compose.yml`:

```yaml
# Example: If basketball app is at ./apps/basketball-shoes/

flagd:
  volumes:
    - ./apps/basketball-shoes/flagd-config.json:/etc/flagd/flagd-config.json  # ← Update

api-gateway:
  build:
    context: ./apps/basketball-shoes/services/api-gateway  # ← Update
  volumes:
    - ./apps/basketball-shoes/flagd-config.json:/app/flagd-config.json  # ← Update

# And so on for each service...
```

## 🛠️ Troubleshooting

### Build Errors

```bash
# Clean rebuild
docker compose build --no-cache api-gateway

# Check Docker disk space
docker system df

# Clean up old images
docker system prune -a
```

### Services Won't Start

```bash
# Check logs
docker compose logs collector
docker compose logs opensearch
docker compose logs api-gateway

# Restart individual service
docker compose restart api-gateway
```

### No Traces Appearing

```bash
# 1. Verify collector is running
docker compose ps collector

# 2. Check collector is receiving traces
docker compose logs collector | grep -i "trace"

# 3. Verify app services are sending traces
docker compose logs api-gateway | grep -i "jaeger"

# 4. Check OpenSearch has trace data
curl "http://localhost:9200/_cat/indices?v" | grep jaeger
```

### Port Conflicts

If you get port binding errors:

```yaml
# In compose.yml, change the ports:
frontend:
  ports:
    - "8080:80"  # Changed from 80:80

api-gateway:
  ports:
    - "3100:3000"  # Changed from 3000:3000
```

Then access the app at http://localhost:8080 instead.

## 📊 What You Get

With this integration, you now have:

✅ **7 Microservices** sending traces to distributed Jaeger
✅ **Persistent Storage** in OpenSearch (traces survive restarts)
✅ **Automatic Metrics** generated from spans (RED metrics)
✅ **Prometheus Monitoring** with span-derived metrics
✅ **Alert Management** with Slack notifications
✅ **Chaos Engineering** via 25 feature flags
✅ **Production-Grade** observability stack

## 🎯 Next Steps

1. **Add Custom Dashboards**: Create Grafana dashboards for span metrics
2. **Configure Alerts**: Customize `prometheus/alert_rules.yml`
3. **Set Sampling**: Add trace sampling for high-traffic scenarios
4. **Add More Services**: Extend the basketball app with new microservices
5. **Deploy to Cloud**: Use Terraform configs to deploy to AWS/GCP/Azure

## 📚 Additional Resources

- **Basketball App Docs**: See `basketball-shoes-app/README.md`
- **Distributed Jaeger Docs**: See `DISTRIBUTED-JAEGER-SETUP.md`
- **Feature Flags**: 25 chaos flags at http://localhost/flags
- **Jaeger Docs**: https://www.jaegertracing.io/docs/
- **OpenTelemetry**: https://opentelemetry.io/docs/

## 🆘 Getting Help

If you encounter issues:

1. Check the logs: `docker compose logs [service-name]`
2. Verify network connectivity: `docker compose exec api-gateway ping collector`
3. Check OpenSearch health: `curl http://localhost:9200/_cluster/health`
4. Review the integration guide again
5. Check GitHub issues in the basketball-shoes-app repo

---

**You're all set!** Your basketball shoes e-commerce app is now integrated with a production-grade distributed Jaeger observability stack. 🎉
