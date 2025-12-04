FROM --platform=linux/amd64 jaegertracing/jaeger:2.11.0

EXPOSE 4317
EXPOSE 4318
EXPOSE 13133
EXPOSE 8889 # prometheus scrape

COPY config.yml ./etc

CMD ["--config", "./etc/config.yml"]