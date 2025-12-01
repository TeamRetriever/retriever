#!/bin/bash
set -e

# Build and Push Frontend ARM64 Image to GHCR
# Run this on your Mac (ARM64) to build the frontend ARM64 image
# GitHub Actions handles:
#   - All AMD64 images (7 services)
#   - Backend ARM64 images (6 services)
# This script only builds: Frontend ARM64 (too heavy for QEMU)
#
# Prerequisites:
# - Logged into GHCR: echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
#
# Usage: ./build-arm64.sh [--no-cache]

REGISTRY="ghcr.io"
NAMESPACE="kcstills17/basketball-shoes-app"
TAG="latest"
PLATFORM="linux/arm64"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Parse arguments
NO_CACHE=""
if [ "$1" = "--no-cache" ]; then
  NO_CACHE="--no-cache"
fi

echo -e "${GREEN}Building Frontend ARM64 Docker image on Apple Silicon...${NC}"
echo -e "${YELLOW}Platform: $PLATFORM${NC}"
echo -e "${YELLOW}Note: Backend services ARM64 are built automatically by GitHub Actions${NC}"
echo ""

# Check if logged in
if ! docker info 2>/dev/null | grep -q "Username"; then
  echo -e "${RED}Error: Not logged in to Docker registry${NC}"
  echo "Login with: echo \$GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin"
  exit 1
fi

# Only frontend needs ARM64 build locally
SERVICES=(
  "frontend:frontend"
)

# Build and push all services
for service_info in "${SERVICES[@]}"; do
  IFS=':' read -r service context <<< "$service_info"

  echo -e "${YELLOW}Building $service (ARM64)...${NC}"

  docker buildx build $NO_CACHE \
    --platform $PLATFORM \
    -t "$REGISTRY/$NAMESPACE/$service:$TAG" \
    -f "$context/Dockerfile" \
    --push \
    "$context"

  echo -e "${GREEN}✓ Built and pushed $service (ARM64)${NC}"
  echo ""
done

echo -e "${GREEN}Frontend ARM64 image built and pushed successfully!${NC}"
echo ""
echo "Image available at:"
echo "  - $REGISTRY/$NAMESPACE/frontend:$TAG (linux/arm64)"
echo ""
echo -e "${GREEN}Complete platform support:${NC}"
echo "  - Backend services (6): AMD64 + ARM64 (via GitHub Actions)"
echo "  - Frontend: AMD64 (via GitHub Actions) + ARM64 (via this script)"
echo ""
echo -e "${YELLOW}Docker will automatically pull the right architecture for each platform${NC}"
