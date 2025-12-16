FROM --platform=linux/amd64 prom/alertmanager:v0.29.0

EXPOSE 9093

COPY alertmanager.yml /etc/alertmanager/alertmanager.yml.template

# need to inject the variables before alertmanager reads them. 

USER root
RUN cat > /docker-entrypoint.sh <<'EOF'
#!/bin/sh
set -e

# Validate and extract Slack webhook URL from JSON secret
if [ -z "$SLACK_WEBHOOK_URL" ]; then
  echo "Error: SLACK_WEBHOOK_URL secret is not set"
  exit 1
fi

# Extract the webhook_url from the JSON secret
# Expected format: { "webhook_url": "https://..." }
if echo "$SLACK_WEBHOOK_URL" | grep -q "webhook_url"; then
  SLACK_WEBHOOK_URL=$(echo "$SLACK_WEBHOOK_URL" | sed -n 's/.*"webhook_url"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
  echo "Extracted webhook URL from JSON secret"
fi

# Validate required environment variable
if [ -z "$SLACK_CHANNEL" ]; then
  echo "Error: SLACK_CHANNEL environment variable is not set"
  exit 1
fi

# Perform substitution using awk (no delimiter issues)
awk -v webhook="$SLACK_WEBHOOK_URL" -v channel="$SLACK_CHANNEL" \
    '{gsub(/\$\{SLACK_WEBHOOK_URL\}/, webhook); gsub(/\$\{SLACK_CHANNEL\}/, channel); print}' \
    /etc/alertmanager/alertmanager.yml.template > /etc/alertmanager/alertmanager.yml

# Verify the config was created successfully
if [ ! -s /etc/alertmanager/alertmanager.yml ]; then
  echo "Error: Failed to generate alertmanager.yml"
  exit 1
fi

echo "AlertManager configuration generated successfully"
exec /bin/alertmanager "$@"
EOF

RUN chmod +x /docker-entrypoint.sh
USER nobody

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["--config.file=/etc/alertmanager/alertmanager.yml", \
     "--storage.path=/alertmanager", \
     "--web.route-prefix=/alertmanager", \
     "--web.external-url=https://rvr.philipkn.app/alertmanager"]