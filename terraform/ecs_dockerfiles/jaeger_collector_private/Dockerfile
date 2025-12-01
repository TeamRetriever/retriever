FROM jaegertracing/jaeger:2.11.0

EXPOSE 4317
EXPOSE 4318
EXPOSE 13133

COPY config.yml ./etc

CMD ["--config", "./etc/config.yml"]