FROM jaegertracing/jaeger:2.11.0

EXPOSE 4317
EXPOSE 4318

COPY config.yml ./etc

CMD ["--config", "./etc/config.yml"]