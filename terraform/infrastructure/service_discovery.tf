resource "aws_service_discovery_private_dns_namespace" "collector" {
  name        = "retriever-collector"
  description = "namespace to connect to the Retriever trace data collector"
  vpc         = var.VPC_ID
}

resource "aws_service_discovery_service" "collector" {
  name = "collector"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.collector.id

    dns_records {
      ttl  = 15
      type = "A"
    }
  }
}
