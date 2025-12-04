resource "aws_security_group" "opensearch" {
  name        = "opensearch"
  description = "Allow traffic in on OpenSearch ports"
  vpc_id      = var.VPC_ID

  tags = {
    Name = "opensearch"
  }
}

resource "aws_vpc_security_group_ingress_rule" "opensearch" {
  security_group_id = aws_security_group.opensearch.id

  cidr_ipv4   = "0.0.0.0/0"
  from_port   = 9200
  ip_protocol = "tcp"
  to_port     = 9200
}

resource "aws_ecs_task_definition" "opensearch" {
  family                   = "rvr_opensearch"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 1024
  memory                   = 5120
  execution_role_arn       = data.aws_iam_role.ecs_task.arn

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
  name                          = "rvr_opensearch"
  cluster                       = aws_ecs_cluster.main.id
  task_definition               = aws_ecs_task_definition.opensearch.arn
  desired_count                 = 1
  force_delete                  = true
  availability_zone_rebalancing = "DISABLED"
  launch_type                   = "FARGATE"
  wait_for_steady_state         = true

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    assign_public_ip = true
    security_groups = [
      aws_security_group.tls_out.id,
      aws_security_group.opensearch.id
    ]
    subnets = [var.PRIVATE_SUBNET_ID]
  }

  service_connect_configuration {
    enabled   = true
    namespace = aws_service_discovery_http_namespace.main.arn

    service {
      port_name = "opensearch-api"

      client_alias {
        port = 9200
      }
    }
  }
}
