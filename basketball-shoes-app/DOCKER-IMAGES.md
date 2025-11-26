# Docker Images Setup

Pre-built Docker images are automatically built and published to GitHub Container Registry (GHCR) via GitHub Actions.

## Directory Structure

```
~/Capstone/retriever/
├── basketball-shoes-app/          ← This repo
│   ├── services/
│   ├── frontend/
│   ├── docker_testing_compose.yml ← Copy this to docker_testing/compose.yml
│   └── .github/workflows/build-images.yml
├── docker_testing/                ← Jaeger infrastructure (sibling directory)
│   ├── collector/
│   ├── query/
│   ├── prometheus/
│   └── compose.yml               ← Copied from docker_testing_compose.yml
└── retriever_mcp/
```

## Quick Setup

**1. Copy required files to docker_testing:**

```bash
# From basketball-shoes-app directory
cp docker_testing_compose.yml ../docker_testing/compose.yml
cp flagd-config.json ../docker_testing/flagd-config.json
```

**2. Start everything:**

```bash
cd ../docker_testing
docker compose up -d
```

That's it! Docker will automatically pull pre-built images from GHCR.

## How It Works

1. **GitHub Actions**: Every commit to `main` automatically builds and pushes all 7 service images to GHCR
2. **Pre-built Images**: Images are available at `ghcr.io/kcstills17/basketball-shoes-app/`
3. **Auto-Pull**: `docker compose up` automatically pulls the latest images
4. **Fallback**: If images aren't available, Docker builds from source

## Available Images

All images at `ghcr.io/kcstills17/basketball-shoes-app/`:

- `api-gateway:latest`
- `product-service:latest`
- `cart-service:latest`
- `order-service:latest`
- `payment-service:latest`
- `recommendation-service:latest`
- `frontend:latest`

## Making Images Public (Recommended)

By default, GHCR images are private. To make them public (so anyone can pull without auth):

1. Go to: https://github.com/users/Kcstills17/packages
2. Click on each package (e.g., `basketball-shoes-app/api-gateway`)
3. Click "Package settings"
4. Scroll to "Danger Zone" → "Change visibility" → "Public"
5. Repeat for all 7 services

**Once public, anyone can pull without authentication.**

## Performance Comparison

| Method | Time |
|--------|------|
| Build from source | 7-13 min |
| Pull pre-built images | 2-3 min |
| **Time Saved** | **5-10 min** |

## Multi-Platform Support (AMD64 + ARM64)

Docker images support both Intel/AMD (linux/amd64) and Apple Silicon (linux/arm64) platforms.

### Automatic Builds (GitHub Actions)

**What's built automatically when you push to `main`:**

| Service | AMD64 | ARM64 |
|---------|-------|-------|
| Backend Services (6) | ✅ Auto | ✅ Auto |
| Frontend | ✅ Auto | ❌ Manual |

**Why?** Backend services build fine with QEMU emulation (~5-10 min each). Frontend crashes QEMU due to heavy npm/Vite build.

**Manual trigger:**
1. Go to: https://github.com/Kcstills17/basketball-shoes-feature-flag-app/actions
2. Select "Build and Push Docker Images"
3. Click "Run workflow"

### Frontend ARM64 (Optional - Apple Silicon Only)

If you're on Apple Silicon and want the **frontend** as a pre-built ARM64 image (instead of building locally):

```bash
# Login to GHCR (one-time)
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin

# Build and push frontend ARM64
./build-arm64.sh
```

**Note:** This is optional. If you skip this, Apple Silicon users will:
- Pull 6 backend services as ARM64 (pre-built)
- Build frontend from source locally (2-3 min, automatic fallback)

**How it works:**
- Docker automatically pulls the right architecture
- Intel/AMD users: Always pull AMD64 images
- Apple Silicon users: Pull ARM64 where available, AMD64 otherwise

## Troubleshooting

### "unauthorized: unauthenticated" when pulling

Images are private. Either:
- Make images public (see above)
- Login: `echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin`
- Let Docker build from source (automatic fallback)

### Force rebuild from source

```bash
docker compose build --no-cache
docker compose up -d
```

### Check image versions

```bash
docker images | grep basketball-shoes-app
```

## Development Workflow

1. Make changes to services/frontend
2. Commit and push to `main`
3. GitHub Actions automatically builds new images (~5-10 min)
4. Pull latest changes in `docker_testing`:
   ```bash
   docker compose pull
   docker compose up -d
   ```

That's it! No manual builds needed.
