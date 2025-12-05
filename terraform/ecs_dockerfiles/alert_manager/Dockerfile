FROM --platform=linux/amd64 prom/alertmanager:v0.29.0

EXPOSE 9093

COPY alertmanager.yml /etc/alertmanager/alertmanager.yml

CMD ["--config.file=/etc/alertmanager/alertmanager.yml", \
     "--storage.path=/alertmanager"]
