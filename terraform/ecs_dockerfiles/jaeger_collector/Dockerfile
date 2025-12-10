FROM --platform=linux/amd64 jaegertracing/jaeger:2.11.0

# add curl for health checks
USER root
RUN apk add --no-cache curl
USER 10001

# gRCP
EXPOSE 4317
# HTTP
EXPOSE 4318
# Health
EXPOSE 13133
# Prometheus scrape
EXPOSE 8889

COPY config.yml /etc/jaeger/config.yml

CMD ["--config", "/etc/jaeger/config.yml"]
