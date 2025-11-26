# Basketball Shoes App with Distributed Jaeger Architecture

This setup integrates the basketball shoes e-commerce application with a production-grade distributed Jaeger deployment using OpenSearch as the backend storage.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Basketball Shoes App                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Frontend │  │ API GW   │  │ Product  │  │ Cart     │  ...   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
│       │             │              │              │               │
│       └─────────────┴──────────────┴──────────────┘               │
│                          │ OTLP Traces                            │
│                          ▼                                        │
├──────────────────────────────────────────────────────────────────┤
│                  Distributed Jaeger Stack                         │
│                                                                   │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │   Collector  │────▶│  OpenSearch  │◀────│    Query     │    │
│  │ (Receives    │     │  (Storage)   │     │  (Jaeger UI) │    │
│  │  Traces)     │     │              │     │              │    │
│  └──────┬───────┘     └──────────────┘     └──────────────┘    │
│         │                                                        │
│         │ Span Metrics                                          │
│         ▼                                                        │
│  ┌──────────────┐     ┌──────────────┐                         │
│  │  Prometheus  │◀────│ AlertManager │                         │
│  │  (Metrics)   │     │  (Alerts)    │                         │
│  └──────────────┘     └──────────────┘                         │
└──────────────────────────────────────────────────────────────────┘
```

## Key Differences from Standard Setup

| Component | Standard Setup | Distributed Setup |
|-----------|---------------|-------------------|
| **Jaeger** | All-in-one container | Separate collector + query services |
| **Storage** | In-memory (ephemeral) | OpenSearch (persistent) |
| **Metrics** | Basic | Prometheus with spanmetrics connector |
| **Alerting** | None | AlertManager with Slack integration |
| **Scalability** | Single container | Horizontally scalable components |

## Prerequisites

1. Docker and Docker Compose installed
2. At least 4GB RAM available for containers
3. Ports available: 80, 3000-3005, 4317-4318, 8013, 8889, 9090, 9200, 16686
4. (Optional) Slack webhook for alerts - create `slack_webhook.txt` and `slack_channel.txt`

## Setup Instructions

### 1. Prepare Configuration Files

Make sure you have these configuration files (they should be in your jaeger distributed setup):

```
./collector/config.yml          # Collector configuration
./query/config.yml              # Query service configuration
./query/config-ui.json          # Jaeger UI customization
./prometheus/prometheus.yml     # Prometheus scrape configs
./prometheus/alert_rules.yml    # Alerting rules
./alertmanager/alertmanager.yml # AlertManager config
```

### 2. (Optional) Set Up Slack Alerts

If you want Slack notifications for alerts:

```bash
# Create webhook file
echo "https://hooks.slack.com/services/YOUR/WEBHOOK/URL" > slack_webhook.txt

# Create channel file
echo "#your-channel-name" > slack_channel.txt
```

### 3. Build the Basketball Shoes App Images

```bash
cd /path/to/basketball-shoes-feature-flag-app

# Build all service images
docker-compose -f docker-compose.distributed-jaeger.yml build
```

### 4. Start the Distributed Stack

**Without AlertManager:**
```bash
docker-compose -f docker-compose.distributed-jaeger.yml up -d
```

**With AlertManager (requires Slack configuration):**
```bash
docker-compose -f docker-compose.distributed-jaeger.yml --profile alerts up -d
```

### 5. Verify Services are Running

```bash
# Check all containers are healthy
docker-compose -f docker-compose.distributed-jaeger.yml ps

# Check OpenSearch health
curl http://localhost:9200/_cluster/health

# Check collector metrics
curl http://localhost:8889/metrics
```

## Accessing the Services

| Service | URL | Description |
|---------|-----|-------------|
| **Basketball Shoes App** | http://localhost | Main e-commerce application |
| **Jaeger UI** | http://localhost:16686 | View distributed traces |
| **Prometheus** | http://localhost:9090 | Metrics and alerting rules |
| **AlertManager** | http://localhost:9093 | Alert management (if enabled) |
| **OpenSearch** | http://localhost:9200 | Storage backend (API) |
| **Collector Metrics** | http://localhost:8889/metrics | Collector Prometheus metrics |
| **Feature Flags UI** | http://localhost/flags | Toggle feature flags |

## How to Use

### Generate Traces

1. **Browse Products**: Navigate to http://localhost/products
2. **Add to Cart**: Select a product and add it to cart
3. **Checkout**: Complete a purchase flow
4. **Toggle Feature Flags**: Enable error flags to see failures in traces

### View Traces in Jaeger

1. Go to http://localhost:16686
2. Select a service from the dropdown (e.g., `api-gateway`, `order-service`)
3. Click "Find Traces"
4. Click on any trace to see the full distributed trace

### Enable Chaos with Feature Flags

Visit http://localhost/flags and toggle:
- **slow-product-api**: See 3-5 second delays in traces
- **cart-service-failure**: See 503 errors propagate through order flow
- **intermittent-cart-failure**: Random 50% failures (test retry logic)
- **invalid-product-data**: See how services handle bad data

After toggling flags, run: `docker-compose -f docker-compose.distributed-jaeger.yml restart flagd`

### View Span Metrics in Prometheus

1. Go to http://localhost:9090
2. Try these queries:
   ```promql
   # Request rate by service
   rate(calls_total[5m])

   # P95 latency by service
   histogram_quantile(0.95, rate(duration_bucket[5m]))

   # Error rate
   rate(calls_total{status_code=~"5.."}[5m])
   ```

## Monitoring and Alerting

### Built-in Span Metrics

The collector automatically generates metrics from spans:

- **calls_total**: Counter of spans (requests)
- **duration**: Histogram of span durations
- Labels: `http.method`, `http.status_code`, `service_name`

### Alert Rules (if AlertManager enabled)

Configured alerts (see `prometheus/alert_rules.yml`):
- High error rate (>5%)
- High latency (P95 >500ms)
- Service down
- Collector issues

Alerts are sent to Slack channel specified in `slack_channel.txt`.

## Data Persistence

### OpenSearch Data

Traces are stored in OpenSearch and persist across restarts. To view indices:

```bash
curl http://localhost:9200/_cat/indices
```

To clear old traces:

```bash
# Delete traces older than 7 days
curl -X DELETE "http://localhost:9200/jaeger-span-*/_delete_by_query" -H 'Content-Type: application/json' -d'
{
  "query": {
    "range": {
      "startTime": {
        "lte": "now-7d"
      }
    }
  }
}
'
```

## Troubleshooting

### OpenSearch Won't Start

```bash
# Check logs
docker-compose -f docker-compose.distributed-jaeger.yml logs opensearch

# Common fix: increase vm.max_map_count
sudo sysctl -w vm.max_map_count=262144
```

### No Traces Appearing

```bash
# Check collector logs
docker-compose -f docker-compose.distributed-jaeger.yml logs collector

# Verify services are sending traces
docker-compose -f docker-compose.distributed-jaeger.yml logs api-gateway | grep "trace"

# Check collector is receiving data
curl http://localhost:8889/metrics | grep traces
```

### Collector Can't Connect to OpenSearch

```bash
# Verify OpenSearch is healthy
curl http://localhost:9200/_cluster/health

# Check network connectivity
docker-compose -f docker-compose.distributed-jaeger.yml exec collector ping opensearch
```

## Stopping the Stack

```bash
# Stop all services
docker-compose -f docker-compose.distributed-jaeger.yml down

# Stop and remove volumes (clears all data)
docker-compose -f docker-compose.distributed-jaeger.yml down -v
```

## Architecture Benefits

### Why Distributed Jaeger?

1. **Scalability**: Collector and query can scale independently
2. **Persistence**: OpenSearch stores traces long-term
3. **High Availability**: Multiple collectors can run in parallel
4. **Advanced Queries**: OpenSearch enables complex trace queries
5. **Span Metrics**: Automatic RED metrics from traces
6. **Alerting**: Prometheus alerts on trace-derived metrics

### Span Metrics Connector

The collector generates metrics from every span:
- **Latency histograms**: Calculate P50, P95, P99
- **Request counts**: Track request rates
- **Error rates**: Monitor failure rates
- **Automatic labels**: Service, method, status code

These metrics power the Prometheus dashboards and alerts.

## Production Considerations

For production use, consider:

1. **Resource Limits**: Add CPU/memory limits to each service
2. **Replication**: Run multiple collector and query instances
3. **OpenSearch Cluster**: Use multi-node OpenSearch for HA
4. **Data Retention**: Configure index lifecycle management
5. **Security**: Enable OpenSearch security plugin
6. **TLS**: Add TLS termination for external access
7. **Sampling**: Enable trace sampling in high-traffic scenarios

## Next Steps

- Add Grafana dashboards for span metrics
- Configure trace sampling strategies
- Set up OpenSearch index templates
- Add custom span attributes for business metrics
- Integrate with your CI/CD pipeline

## Support

For issues with:
- **Basketball Shoes App**: See main README.md
- **Jaeger**: https://www.jaegertracing.io/docs/
- **OpenSearch**: https://opensearch.org/docs/
- **Prometheus**: https://prometheus.io/docs/
