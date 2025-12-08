resource "aws_service_discovery_http_namespace" "main" {
  name        = "retriever"
  description = "Namespace for communication between ECS services running as part of the Retriever observability tool"
}

resource "aws_ecs_cluster" "main" {
  name = "retriever"

  service_connect_defaults {
    namespace = aws_service_discovery_http_namespace.main.arn
  }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = ["FARGATE"]
}