FROM --platform=linux/amd64 prom/prometheus:v3.7.3

EXPOSE 9090

COPY ./prometheus.yml ./alert_rules.yml /etc/prometheus/

CMD ["--config.file=/etc/prometheus/prometheus.yml", \
       "--storage.tsdb.path=/prometheus", \
       "--web.console.libraries=/usr/share/prometheus/console_libraries", \
       "--web.console.templates=/usr/share/prometheus/consoles", \
       "--web.route-prefix=/prometheus"]