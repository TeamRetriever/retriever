FROM --platform=linux/amd64 jaegertracing/jaeger:2.11.0
# gRCP
EXPOSE 4317
# HTTP
EXPOSE 4318
# Health
EXPOSE 13133
# Prometheus scrape
EXPOSE 8889

COPY config.yml ./etc

CMD ["--config", "./etc/config.yml"]