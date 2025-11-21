FROM jaegertracing/jaeger:2.11.0

EXPOSE 16686

COPY config.yml config-ui.json ./etc/

CMD ["--config", "./etc/config.yml"]