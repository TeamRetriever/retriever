terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

locals {
  region = "us-east-1"
}

provider "aws" {
  region = local.region
}

# Set up resources needed by all services

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

resource "aws_security_group" "tls_out" {
  name = "tls_out"
  description = "Allow TLS outbound traffic for retrieving docker images"
  vpc_id = var.VPC_ID

  tags = {
    Name = "tls_out"
  }
}

resource "aws_vpc_security_group_egress_rule" "tls_out" {
  security_group_id = aws_security_group.tls_out.id

  cidr_ipv4 = "0.0.0.0/0"
  from_port         = 443
  ip_protocol       = "tcp"
  to_port           = 443
}

data "aws_iam_role" "ecs_task" {
  name = "ecsTaskExecutionRole"
}

data "aws_region" "current" {
  region = "us-east-1"
}

# Set up resources for OpenSearch

resource "aws_security_group" "opensearch" {
  name = "opensearch"
  description = "Allow traffic in on OpenSearch ports"
  vpc_id = var.VPC_ID

  tags = {
    Name = "opensearch"
  }
}

resource "aws_vpc_security_group_ingress_rule" "opensearch" {
  security_group_id = aws_security_group.opensearch.id

  cidr_ipv4 = "0.0.0.0/0"
  from_port         = 9200
  ip_protocol       = "tcp"
  to_port           = 9200
}

resource "aws_ecs_task_definition" "opensearch" {
  family = "rvr_opensearch"
  requires_compatibilities = ["FARGATE"]
  network_mode = "awsvpc"
  cpu = 1024
  memory = 5120
  execution_role_arn = data.aws_iam_role.ecs_task.arn

  container_definitions = <<TASK_DEFINITION
[
  {
    "cpu": 1024,
    "environment": [
      {
        "name": "DISABLE_SECURITY_PLUGIN",
        "value": "true"
      },
      {
        "name": "discovery.type",
        "value": "single-node"
      }
    ],
    "environmentFiles": [],
    "essential": true,
    "healthCheck": {
      "command": [
        "CMD-SHELL",
        "curl -f http://localhost:9200/_cluster/health || exit 1"
      ],
      "interval": 30,
      "retries": 3,
      "timeout": 5
    },
    "image": "opensearchproject/opensearch:2.11.1",
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/rvr-opensearch",
        "awslogs-create-group": "true",
        "awslogs-region": "${local.region}",
        "awslogs-stream-prefix": "ecs"
      },
      "secretOptions": []
    },
    "memory": 5120,
    "memoryReservation": 3072,
    "mountPoints": [],
    "name": "opensearch",
    "portMappings": [
      {
        "appProtocol": "http",
        "containerPort": 9200,
        "hostPort": 9200,
        "name": "opensearch-api",
        "protocol": "tcp"
      },
      {
        "appProtocol": "http",
        "containerPort": 9600,
        "hostPort": 9600,
        "name": "opensearch-other",
        "protocol": "tcp"
      }
    ],
    "systemControls": [],
    "ulimits": [],
    "volumesFrom": []
  }
]
TASK_DEFINITION
}

resource "aws_ecs_service" "rvr_opensearch" {
  name = "rvr_opensearch"
  cluster = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.opensearch.arn
  desired_count = 1
  force_delete = true
  availability_zone_rebalancing = "DISABLED"
  launch_type = "FARGATE"
  wait_for_steady_state = true

  deployment_circuit_breaker {
    enable = true
    rollback = true  
  }

  network_configuration {
    assign_public_ip = true
    security_groups = [
      aws_security_group.tls_out.id,
      aws_security_group.opensearch.id
    ]
    subnets = [var.PUBLIC_SUBNET_ID]
  }

  service_connect_configuration {
    enabled = true
    namespace = aws_service_discovery_http_namespace.main.arn

    service {
      port_name = "opensearch-api"
      
      client_alias {
        port = 9200
      }
    }
  }
}

# Set up resources for Jaeger Collector

# security group for the collector
resource "aws_security_group" "collector" {
  name = "collector"
  description = "Accept OTLP and health check traffic"
  vpc_id = var.VPC_ID
  tags = {
    Name = "collector"
  }
}

resource "aws_vpc_security_group_ingress_rule" "collector_grpc" {
  security_group_id = aws_security_group.collector.id
  cidr_ipv4 = "0.0.0.0/0"
  from_port = 4317
  ip_protocol       = "tcp"
  to_port = 4317
}
resource "aws_vpc_security_group_ingress_rule" "collector_http" {
  security_group_id = aws_security_group.collector.id
  cidr_ipv4 = "0.0.0.0/0"
  from_port = 4318
  ip_protocol       = "tcp"
  to_port = 4318
}
resource "aws_vpc_security_group_ingress_rule" "collector_health_check" {
  security_group_id = aws_security_group.collector.id
  cidr_ipv4 = "0.0.0.0/0"
  from_port = 13133
  ip_protocol       = "tcp"
  to_port = 13133
}

resource "aws_vpc_security_group_egress_rule" "collector_to_opensearch" {
  security_group_id = aws_security_group.collector.id
  cidr_ipv4 = "0.0.0.0/0"
  from_port = 9200
  ip_protocol       = "tcp"
  to_port = 9200
}

# workflow for the docker image

# task def and service


































