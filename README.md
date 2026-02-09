# 🔍 Retriever - Cloud-Native Distributed Observability Platform

## Checkout The Project Writeup for the most in-depth breakdown:
- [Project Writeup](https://runretriever.app/)

> Production-ready observability stack deployed to your AWS VPC with distributed tracing, metrics, and alerting

[![Jaeger](https://img.shields.io/badge/Jaeger-v2.11.0-60D5F0?logo=jaeger)](https://www.jaegertracing.io/)
[![Prometheus](https://img.shields.io/badge/Prometheus-latest-E6522C?logo=prometheus)](https://prometheus.io/)
[![OpenSearch](https://img.shields.io/badge/OpenSearch-2.11.1-005571?logo=opensearch)](https://opensearch.org/)
[![AWS](https://img.shields.io/badge/AWS-ECS_Fargate-FF9900?logo=amazon-aws)](https://aws.amazon.com/fargate/)
[![Terraform](https://img.shields.io/badge/Terraform-IaC-7B42BC?logo=terraform)](https://www.terraform.io/)

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Deployment](#-deployment)
- [Services](#-services)
- [Authentication](#-authentication)
- [Configuration](#-configuration)
- [Monitoring & Alerts](#-monitoring--alerts)
- [Troubleshooting](#-troubleshooting)
- [Customization](#-customization)
- [Cleanup](#-cleanup)

---

## 🎯 Overview

Retriever is a **cloud-native observability platform** that deploys directly into your AWS account. Built on battle-tested open-source tools, it provides distributed tracing, spanmetrics collection, and intelligent alerting - all running securely in your VPC. Using a built-in MCP server, it allows for a useful debugging workflow all in one environment using Cursor. 

### Key Features

- 📊 **Distributed Tracing** via Jaeger for request flow visualization
- 📈 **Metrics Collection** via Prometheus for performance monitoring
- 🚨 **Smart Alerting** via AlertManager with Slack integration
- 💾 **Persistent Storage** via OpenSearch for long-term trace retention
- 🤖 **AI Integration** via MCP Server for AI-powered observability analysis
- 🔒 **Secure by Default** with JWT authentication and TLS encryption
- ☁️ **Cloud-Native** deployed to AWS ECS Fargate (serverless containers)
- 🏗️ **Infrastructure as Code** using Terraform for reproducible deployments
- 🚀 **One-Command Deploy** via CLI - no manual AWS console configuration needed

### Why Retriever?

**Traditional observability platforms require:**
- Complex manual setup and configuration
- Expensive SaaS subscriptions with per-GB pricing
- Vendor lock-in and data residency concerns
- Limited customization options

**Retriever provides:**
- ✅ Self-hosted in your AWS account (you control your data)
- ✅ One-command deployment via CLI
- ✅ Automated infrastructure provisioning with Terraform
- ✅ Full source code access for customization
- ✅ Pay only for AWS infrastructure (no per-GB fees)
- ✅ Production-ready with TLS, authentication, and auto-scaling

---

## 🏗️ Architecture

### High-Level Overview
   ![High-Level Architecture](./Images/architecture.png)
                                                         
                                                 

### AWS Resources Created

| Resource | Purpose | Details |
|----------|---------|---------|
| **VPC** | Network isolation | Uses your existing VPC |
| **ECS Cluster** | Container orchestration | Fargate (serverless) |
| **7 ECS Services** | Observability components | Query, Collector, Prometheus, etc. |
| **Application Load Balancer** | HTTPS ingress | TLS termination with ACM |
| **ACM Certificate** | TLS/SSL | Auto-validated via DNS |
| **Service Connect** | Service mesh | Inter-service DNS and discovery |
| **Secrets Manager** | Secrets storage | JWT secret, Slack webhook |
| **S3 Bucket** | Terraform state | Account-isolated state storage |
| **Security Groups** | Network policies | Least-privilege access |

### 🔑 Key Components

| Component | Purpose | Access |
|-----------|---------|--------|
| **Auth Proxy** | JWT authentication gateway | All traffic flows through here |
| **Jaeger Query** | Trace visualization UI | https://your-domain.com/ |
| **Jaeger Collector** | OTLP trace ingestion | Port 4317 (gRPC), 4318 (HTTP) |
| **OpenSearch** | Long-term trace storage | Internal only |
| **Prometheus** | Metrics aggregation | https://your-domain.com/prometheus |
| **AlertManager** | Alert routing and deduplication | https://your-domain.com/alertmanager |
| **MCP Server** | AI integration API | https://your-domain.com/mcp |

---

## 📦 Prerequisites

### Required

1. **AWS Account**
   - Admin or sufficient IAM permissions
   - Account must support Fargate in your region

2. **AWS CLI** configured with credentials
   ```bash
   aws configure
   # or use environment variables:
   # export AWS_ACCESS_KEY_ID=...
   # export AWS_SECRET_ACCESS_KEY=...
   # export AWS_REGION=us-east-1
   ```

3. **Existing VPC Infrastructure**
   - VPC with at least 2 public subnets (for ALB)
   - 1 private subnet (for ECS tasks)
   - Internet Gateway attached
   - NAT Gateway for private subnet

4. **Domain Name** (for TLS)
   - You own a domain (e.g., example.com)
   - Ability to add DNS records
   - Domain can be hosted anywhere (AWS Route53, DigitalOcean, Cloudflare, etc.)

### Optional

- **Slack Workspace** (for alert notifications)
  - Webhook URL for posting messages

---

## 🚀 Installation

### 1️⃣ Install Retriever CLI

```bash
# Clone the repository
git clone https://github.com/TeamRetriever/retriever.git
cd retriever/cli

# Install dependencies
npm install

# Build the CLI
npm run buildF

# Link globally (makes 'retriever' command available)
npm link
```

Verify installation:
```bash
retriever --version
```

### 2️⃣ Initialize Configuration

Run the interactive setup wizard:

```bash
retriever init
```

The CLI will prompt you for:

1. **AWS Configuration**
   - Region (e.g., us-east-1)
   - VPC ID
   - Public Subnet IDs (2 required for ALB high availability)
   - Private Subnet ID (for ECS tasks)

2. **TLS Certificate Setup**
   - Domain name (e.g., observability.example.com)
   - Creates ACM certificate automatically
   - Provides DNS validation record to add

3. **DNS Validation**
   - Add the CNAME record to your DNS provider
   - CLI waits for validation to complete (~5 minutes)

4. **JWT Authentication**
   - Generates cryptographically secure JWT secret
   - Stores in AWS Secrets Manager
   - Creates initial access token (valid for 10 years)

5. **Slack Integration** (Optional)
   - Prompt to configure Slack webhook
   - Skip if you don't want Slack notifications

Configuration is saved to `.retriever-config.json`:
```json
{
  "region": "us-east-1",
  "vpcId": "vpc-xxxxx",
  "publicSubnetId1": "subnet-xxxxx",
  "publicSubnetId2": "subnet-xxxxx",
  "privateSubnetId": "subnet-xxxxx",
  "certificateArn": "arn:aws:acm:...",
  "domain": "observability.example.com",
  "jwtToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

## 🚀 Deployment

### Deploy Infrastructure

```bash
retriever deploy
```

**What happens:**
1. ✅ Validates AWS credentials and configuration
2. ✅ Checks/creates ECS task execution role
3. ✅ Sets up S3 backend for Terraform state
4. ✅ Initializes Terraform
5. ✅ Shows deployment plan (resources to be created)
6. ❓ Asks for confirmation
7. 🚀 Deploys all infrastructure (~10-15 minutes)
   - Creates ECS cluster
   - Launches 7 Fargate services
   - Configures Application Load Balancer
   - Sets up Service Connect mesh
   - Configures security groups
8. ✅ Verifies deployment health

**Output:**
```
✅ Deployment Complete!

Your Retriever observability platform is now running!

Load Balancer DNS: retriever-alb-xxxxxxxxx.us-east-1.elb.amazonaws.com

Next steps:
  1. Point your DNS A record for observability.example.com to:
     retriever-alb-xxxxxxxxx.us-east-1.elb.amazonaws.com
  2. Access Retriever at: https://observability.example.com
  3. Configure your applications to send traces to the collector

━━━ Access Information ━━━

Your JWT Access Token:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

This token is required to:
  • Log in to the web UI (paste when prompted)
  • Access the MCP server (use as Bearer token)
  • Valid for 10 years from generation

Token also saved in .retriever-config.json
```



## 🌐 Services

### 🔍 Jaeger UI

**URL:** `https://your-domain.com/`

View distributed traces, analyze service dependencies, and debug performance issues.

**Features:**
- Search traces by service, operation, tags
- Visualize trace spans and timing
- Analyze service dependencies
- Compare trace performance

### 📊 Prometheus

**URL:** `https://your-domain.com/prometheus`

Query metrics, visualize data, and view active alerts.

**Useful Queries:**

```promql
# Request rate by service
rate(calls_total[1m])

# Error rate
rate(calls_total{http_status_code=~"5.."}[1m])

# P95 Latency
histogram_quantile(0.95, rate(duration_milliseconds_bucket[5m]))

# Request rate by HTTP method
sum by(http_method) (rate(calls_total[1m]))

# Top services by request volume
topk(5, sum by(service_name) (rate(calls_total[5m])))
```

### 🚨 AlertManager

**URL:** `https://your-domain.com/alertmanager`

View active alerts, silences, and notification history.

**Features:**
- View firing alerts
- Create silences to suppress notifications
- View alert routing and grouping
- Check Slack notification status

### 🤖 MCP Server



API endpoint for AI integration with Claude Desktop.

**Integration:**
Configure Claude Desktop to connect:
```json
{
  "mcpServers": {
    "retriever": {
      "url": "https://your-domain.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_JWT_TOKEN"
      }
    }
  }
}
```

---

## 🔐 Authentication

All services are protected by **JWT authentication** via the Auth Proxy.

### Accessing the Web UI

1. Navigate to `https://your-domain.com`
2. You'll be prompted for a token
3. Paste your JWT token (from `.retriever-config.json`)
4. Token is stored in your browser session

### API Access

Use your JWT token as a Bearer token:

```bash
curl https://your-domain.com/prometheus/api/v1/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d 'query=up'
```

### Generating New Tokens

```bash
# Generate a new token using existing secret
retriever generate-token

# Regenerate secret (invalidates all existing tokens)
retriever generate-token --regenerate-secret
```

---

## ⚙️ Configuration

### Spanmetrics Connector

The Jaeger collector automatically transforms traces into metrics:

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

Configured in `terraform/infrastructure/prometheus/alert_rules.yml`:

| Alert | Condition | Threshold | Duration | Severity |
|-------|-----------|-----------|----------|----------|
| ServiceError | Any 5xx errors | > 0 req/sec | 30s | critical |
| HighErrorRate | Error percentage | > 5% | 2m | warning |
| HighLatency | P95 latency | > 100ms | 5m | warning |
| CollectorDown | Collector unreachable | N/A | 1m | critical |
| HighRequestRate | Request spike | > 1000 req/sec | 2m | info |

### Slack Integration

Update Slack webhook in AWS Secrets Manager:

```bash
aws secretsmanager update-secret \
  --secret-id retriever-slack-webhookurl \
  --secret-string "https://hooks.slack.com/services/YOUR/WEBHOOK/URL" \
  --region us-east-1
```

```bash
retriever deploy --force-recreate
```

---



### Data Flow

```
Your App → Collector → OpenSearch (traces)
                    └→ Spanmetrics → Prometheus (metrics)
```

1. **Applications send traces** to Collector via OTLP (ports 4317/4318)
2. **Collector processes traces:**
   - Stores in OpenSearch for long-term retention
   - Generates metrics via spanmetrics connector
3. **Prometheus scrapes metrics** from Collector (port 8889)


## 🐛 Troubleshooting

### Check Deployment Status

```bash
# View ECS service status
aws ecs list-services --cluster retriever --region us-east-1

# Check if services are running
aws ecs describe-services \
  --cluster retriever \
  --services rvr_query rvr_auth_proxy rvr_collector \
  --region us-east-1 \
  --query 'services[*].{Name:serviceName,Running:runningCount,Desired:desiredCount}'
```




### Common Issues


#### ❌ "Certificate validation failed"

**Cause:** DNS validation CNAME not added or not propagated

**Check validation status:**
```bash
aws acm describe-certificate \
  --certificate-arn your-cert-arn \
  --region us-east-1 \
  --query 'Certificate.Status'
```

**Fix:** Add the CNAME record shown by `retriever init` to your DNS provider.

#### ❌ "Unauthorized" when accessing UI

**Cause:** Invalid or expired JWT token

**Fix:**
```bash
# Generate new token
retriever generate-token

# Token is displayed - copy and paste into UI
```

#### ❌ No traces appearing in Jaeger

**Verify collector is reachable:**
```bash
# Test gRPC endpoint
grpcurl -d '{"message":"test"}' \
  your-domain.com:4317 \
  opentelemetry.proto.collector.trace.v1.TraceService/Export

# Check collector logs for errors
aws logs tail /ecs/rvr_collector --region us-east-1 --since 5m
```


**Check Prometheus is scraping:**
```bash
# View targets in Prometheus UI
open https://your-domain.com/prometheus/targets

# Check alert evaluation
open https://your-domain.com/prometheus/alerts
```

**Verify AlertManager config:**
```bash
# View AlertManager config
aws logs tail /ecs/rvr-test-alertmanager --region us-east-1 --since 5m | grep "config"
```

---

## 🛠️ Customization

### Modify Alert Thresholds

1. Edit `terraform/infrastructure/prometheus/alert_rules.yml`
2. Change threshold values:
   ```yaml
   - alert: HighLatency
     expr: histogram_quantile(0.95, rate(duration_milliseconds_bucket[5m])) > 200  # Changed from 100ms
     for: 10m  # Changed from 5m
   ```


### Add Custom Alert Rules

Edit `terraform/infrastructure/prometheus/alert_rules.yml`:

```yaml
- alert: LowRequestRate
  expr: sum(rate(calls_total[5m])) < 10
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "Request rate is unusually low"
    description: "Only {{ $value }} req/sec for 10 minutes"
```

### Adjust Spanmetrics Buckets

For different latency profiles, edit `terraform/infrastructure/collector/config.yml`:

```yaml
connectors:
  spanmetrics:
    histogram:
      explicit:
        # High-performance APIs (microseconds)
        buckets: [10us, 50us, 100us, 500us, 1ms, 5ms, 10ms]

        # OR typical web APIs (milliseconds)
        buckets: [10ms, 50ms, 100ms, 250ms, 500ms, 1s, 5s]
```

### Add More Metric Dimensions

Edit `terraform/infrastructure/collector/config.yml`:

```yaml
connectors:
  spanmetrics:
    dimensions:
      - name: http.method
      - name: http.status_code
      - name: service_name
      - name: http.route        # Add request path
      - name: http.host         # Add hostname
      - name: deployment.environment  # Add environment
```

> ⚠️ **Warning:** Avoid high-cardinality dimensions like `user_id`, `request_id`, or `trace_id`. They exponentially increase metric series count and Prometheus memory usage.

---

## 🧹 Cleanup

### Destroy All Infrastructure

```bash
# Navigate to infrastructure directory
cd terraform/infrastructure

# Destroy all AWS resources
terraform destroy

# Confirm with 'yes' when prompted
```

**What gets deleted:**
- ✅ All ECS services and tasks
- ✅ Load balancer and target groups
- ✅ Security groups
- ✅ Service Connect configuration
- ❌ VPC, subnets (not managed by Retriever)
- ❌ ACM certificate (manual deletion required)
- ❌ S3 state bucket (kept for safety)
- ❌ Secrets Manager secrets (kept for safety)

### Manual Cleanup (Optional)

**Delete ACM certificate:**
```bash
aws acm delete-certificate \
  --certificate-arn your-cert-arn \
  --region us-east-1
```

**Delete Secrets Manager secrets:**
```bash
# JWT secret
aws secretsmanager delete-secret \
  --secret-id retriever/jwt-secret \
  --force-delete-without-recovery \
  --region us-east-1

# Slack webhook
aws secretsmanager delete-secret \
  --secret-id retriever-slack-webhookurl \
  --force-delete-without-recovery \
  --region us-east-1
```

**Delete S3 state bucket:**
```bash
# Empty bucket first
aws s3 rm s3://retriever-tfstate-YOUR-ACCOUNT-ID --recursive

# Delete bucket
aws s3 rb s3://retriever-tfstate-YOUR-ACCOUNT-ID
```



## 📚 Additional Resources
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [OpenTelemetry Specification](https://opentelemetry.io/docs/)
- [AWS ECS Best Practices](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/)
- [Terraform AWS Provider Docs](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)

---

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](../../issues).

## 📧 Support

For questions or support:
- Open an issue on GitHub
- Check the [Troubleshooting](#-troubleshooting) section
- Review Terraform logs: `terraform/infrastructure/terraform.log`

---

**Built with ❤️ for production observability on AWS**
