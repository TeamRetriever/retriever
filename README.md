# 🔍 Retriever - Distributed Observability Stack

> A self-hosted observability platform with distributed tracing, metrics, and alerting

[![Jaeger](https://img.shields.io/badge/Jaeger-v2.11.0-60D5F0?logo=jaeger)](https://www.jaegertracing.io/)
[![Prometheus](https://img.shields.io/badge/Prometheus-latest-E6522C?logo=prometheus)](https://prometheus.io/)
[![Elasticsearch](https://img.shields.io/badge/Elasticsearch-8.11.0-005571?logo=elasticsearch)](https://www.elastic.co/)

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Quick Start](#-quick-start)
- [Services](#-services)
- [Configuration](#-configuration)
- [Testing](#-testing)
- [Troubleshooting](#-troubleshooting)
- [Monitoring & Alerts](#-monitoring--alerts)

---

## 🎯 Overview

Retriever integrates **Prometheus monitoring** and **AlertManager alerting** into a distributed Jaeger architecture. This setup provides comprehensive observability for microservices with:

- 📊 **Distributed Tracing** via Jaeger
- 📈 **Metrics Collection** via Prometheus
- 🚨 **Smart Alerting** via AlertManager
- 💾 **Persistent Storage** via Elasticsearch
- 🤖 **AI Integration** via MCP Server

---

## 🏗️ Architecture

```
┌─────────────┐
│   HotROD    │ Demo Application
│  (Traces)   │
└──────┬──────┘
       │ OTLP
       ▼
┌─────────────────────────────────────┐
│      Jaeger Collector               │
│  ┌──────────────┬──────────────┐   │
│  │   Storage    │  Spanmetrics │   │
│  └──────┬───────┴──────┬───────┘   │
└─────────┼──────────────┼───────────┘
          │              │
          ▼              ▼
   ┌─────────────┐  ┌──────────────┐
   │Elasticsearch│  │  Prometheus  │
   └──────┬──────┘  └──────┬───────┘
          │                │
          ▼                ▼
   ┌─────────────┐  ┌──────────────┐
   │   Query     │  │ AlertManager │
   │  (UI/API)   │  │              │
   └──────┬──────┘  └──────┬───────┘
          │                │
          ▼                ▼
   ┌─────────────┐  ┌──────────────┐
   │ MCP Server  │  │    Slack     │
   └─────────────┘  └──────────────┘
```

### 🔑 Key Components

| Component | Purpose | Port |
|-----------|---------|------|
| **Jaeger Collector** | Receives traces, generates metrics | 4317, 4318, 8889 |
| **Jaeger Query** | UI and API for querying traces | 16686 |
| **Elasticsearch** | Persistent trace storage | 9200 |
| **Prometheus** | Metrics aggregation and alerting | 9090 |
| **AlertManager** | Alert routing and notifications | 9093 |
| **HotROD** | Demo application for testing | 8080, 8083 |
| **MCP Server** | AI integration API | 3000 |

---


## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose

### 1️⃣ Setup Directory Structure
```bash
cd docker_testing
```

### 2️⃣ Choose Your Setup

#### Option A: Basic Setup (No Alerts)
```bash
# Start services without AlertManager
docker compose up -d

# Verify services
docker compose ps

# Stop services
docker compose down
```

#### Option B: With Slack Alerts
```bash
# 1. Configure Slack integration
echo "https://hooks.slack.com/services/YOUR/WEBHOOK/URL" > slack_webhook.txt
echo "#your-channel-name" > slack_channel.txt

# 2. Start services with AlertManager
docker compose --profile alerts up -d

# 3. Verify services
docker compose ps

# 4. Stop services
docker compose --profile alerts down
```


**To get your Slack webhook:**
1. Go to https://api.slack.com/messaging/webhooks
2. Create an incoming webhook for your workspace
3. Copy the webhook URL



All services should show as `Up` or `healthy`.

---

## 🌐 Services

### 🔍 Jaeger UI
**URL:** http://localhost:16686

View distributed traces, analyze service dependencies, and debug performance issues.

### 📊 Prometheus
**URL:** http://localhost:9090

Query metrics, visualize data, and view active alerts.

**Useful Queries:**
```promql
# Request rate
rate(calls_total[1m])

# Error rate
rate(calls_total{http_status_code=~"5.."}[1m])

# P95 Latency
histogram_quantile(0.95, rate(duration_milliseconds_bucket[5m]))
```

### 🚨 AlertManager
**URL:** http://localhost:9093

View active alerts and silences.

### 🚗 HotROD Demo
**URL:** http://localhost:8080

Generate realistic trace data by clicking buttons to simulate user requests.

### 🤖 MCP Server
**URL:** http://localhost:3000

API endpoint for AI integration with Claude Desktop.

---

## ⚙️ Configuration

### Spanmetrics Connector

The collector transforms traces into metrics automatically:

```yaml
connectors:
  spanmetrics:
    histogram:
      explicit:
        buckets: [100us, 1ms, 2ms, 6ms, 10ms, 100ms, 250ms]
    dimensions:
      - name: http.method
      - name: http.status_code
      - name: service_name
```

**Generated Metrics:**
- `calls_total` - Request counter (by service, method, status)
- `duration_milliseconds` - Latency histogram

### Alert Rules

Located in `prometheus/alert_rules.yml`:

| Alert | Condition | Threshold | Duration |
|-------|-----------|-----------|----------|
| **ServiceError** | Any 5xx errors | > 0 req/sec | 30s |
| **HighErrorRate** | Error percentage | > 5% | 2m |
| **HighLatency** | P95 latency | > 100ms | 5m |
| **CollectorDown** | Collector unreachable | N/A | 1m |
| **HighRequestRate** | Request rate | > 1000 req/sec | 2m |

### Slack Integration

Update `alertmanager/alertmanager.yml` with your webhook:

```yaml
global:
  slack_api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'

receivers:
  - name: 'slack-alerts'
    slack_configs:
      - channel: '#your-channel'
```

---

## 🧪 Testing

### Generate Traffic

1. Open HotROD: http://localhost:8080
2. Click customer buttons to generate requests
3. Try different services to create varied traces

### View Traces

1. Open Jaeger: http://localhost:16686
2. Select a service from the dropdown
3. Click "Find Traces"
4. Explore trace details and service dependencies

### Check Metrics

1. Open Prometheus: http://localhost:9090
2. Query: `calls_total`
3. Switch to "Graph" tab to visualize
4. Try: `rate(calls_total[1m])` for request rate

### Trigger Alerts

HotROD has built-in error scenarios:

1. Generate errors by clicking rapidly
2. Wait 30 seconds for alert to fire
3. Check Prometheus: http://localhost:9090/alerts
4. View alert in Slack (if configured)

---

## 🐛 Troubleshooting

### Check Service Health

```bash
# View all container statuses
docker compose ps

# Check specific service logs
docker compose logs collector
docker compose logs prometheus
docker compose logs alertmanager

# Follow logs in real-time
docker compose logs -f collector
```

### Verify Metrics Generation

```bash
# Check if collector is exposing metrics
curl http://localhost:8889/metrics | grep calls_total
```

### Verify Prometheus Scraping

1. Open http://localhost:9090/targets
2. Check if `jaeger-collector` target is `UP`
3. Last Scrape should show recent timestamp

### Verify Elasticsearch

```bash
# Check cluster health
curl http://localhost:9200/_cluster/health

# List indices
curl http://localhost:9200/_cat/indices?v

# Check span count
curl http://localhost:9200/jaeger-span-*/_count
```

### Common Issues

#### ❌ Collector won't start
```bash
# Check config syntax
docker compose config

# View detailed logs
docker compose logs collector --tail=50
```

#### ❌ No metrics in Prometheus
```bash
# Verify collector is exposing metrics
curl http://localhost:8889/metrics

# Check Prometheus config
docker compose exec prometheus cat /etc/prometheus/prometheus.yml
```

#### ❌ Alerts not firing
```bash
# Check alert rules syntax
docker compose exec prometheus promtool check rules /etc/prometheus/alert_rules.yml

# View alert evaluation
# Visit http://localhost:9090/alerts
```

---

## 📊 Monitoring & Alerts

### Key Differences from Other Setups

**Traditional Setup:**
```
OTel Collector → Jaeger (combined) → Prometheus
```

**This Setup:**
```
Jaeger Collector (IS an OTel Collector) → Elasticsearch + Prometheus
Jaeger Query (separate service) → UI/API
```

**Insight:** Jaeger v2 is built on OpenTelemetry Collector, so it can handle spanmetrics generation directly without needing a separate OTel Collector service.

### Data Flow

1. **HotROD** sends OTLP traces → Collector (ports 4317/4318)
2. **Collector** processes traces:
   - Stores in Elasticsearch
   - Generates metrics via spanmetrics
3. **Prometheus** scrapes metrics from Collector (port 8889)
4. **Alert rules** evaluate conditions
5. **AlertManager** routes to Slack when alerts fire

### Metrics Explained

#### `calls_total`
Counter of all requests, labeled by:
- `service_name` - Which microservice
- `http_method` - GET, POST, etc.
- `http_status_code` - 200, 404, 500, etc.

#### `duration_milliseconds`
Histogram of request durations:
- Tracks distribution across buckets
- Enables percentile calculations (P50, P95, P99)

---

## 🛠️ Customization

### Add More Alert Rules

Edit `prometheus/alert_rules.yml`:

```yaml
- alert: CustomAlert
  expr: your_promql_expression > threshold
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Alert description"
```

### Adjust Histogram Buckets

Edit `collector/config.yml`:

```yaml
connectors:
  spanmetrics:
    histogram:
      explicit:
        buckets: [50us, 100us, 500us, 1ms, 5ms, 10ms, 50ms, 100ms, 500ms, 1s]
```

### Add More Dimensions

Edit `collector/config.yml`:

```yaml
connectors:
  spanmetrics:
    dimensions:
      - name: http.method
      - name: http.status_code
      - name: service_name
      - name: http.route        # Add route
      - name: db.system         # Add database type
```

⚠️ **Warning:** Avoid high-cardinality dimensions like `user_id` or `trace_id` - they'll explode the metrics cardinality!

---

## 🧹 Cleanup

### Stop Services
```bash
docker compose down
```

### Remove Volumes (Deletes Data)
```bash
docker compose down -v
```

### Remove Everything
```bash
docker compose down -v --rmi all
```

---

## 📚 Resources

- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [OpenTelemetry Collector](https://opentelemetry.io/docs/collector/)
- [AlertManager Configuration](https://prometheus.io/docs/alerting/latest/configuration/)
- [PromQL Basics](https://prometheus.io/docs/prometheus/latest/querying/basics/)

---

## 🤝 Contributing

This is a capstone project by:
- Benji Walker
- Philip Knapp  
- Ryan Foley
- Zane Lee

---

## 📝 License

Open source

---

<div align="center">

**Built with** ❤️ **for observability**

[⬆ Back to Top](#-retriever---distributed-observability-stack)

</div>
