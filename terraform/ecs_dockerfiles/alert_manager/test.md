Install AM:

docker run -d --name alertmanager-test -p 9093:9093 alertmanager-test:latest

Hit the AM API:

curl http://localhost:9093/api/v2/status
curl http://localhost:9093/api/v2/alerts
curl http://localhost:9093/api/v2/silences

Manually post an alert:

curl -XPOST -H "Content-Type: application/json" \
http://localhost:9093/api/v2/alerts \
-d '[
  {
    "status": "firing",
    "labels": {
      "alertname": "TestAlert",
      "severity": "critical"
    },
    "annotations": {
      "description": "This is only a test alert"
    },
    "generatorURL": "http://localhost:9090/graph"
  }
]'

Then check:

curl http://localhost:9093/api/v2/alerts
You should see the alert registered.

Open the UI in your browser:

http://localhost:9093
