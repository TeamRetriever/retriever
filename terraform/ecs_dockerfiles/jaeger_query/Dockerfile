FROM --platform=linux/amd64 jaegertracing/jaeger:2.11.0

# add curl for health checks
USER root
RUN apk add --no-cache curl
USER 10001

# UI and API
EXPOSE 16686
# Health
EXPOSE 16687

COPY config.yml config-ui.json /etc/jaeger/

CMD ["--config", "/etc/jaeger/config.yml"]