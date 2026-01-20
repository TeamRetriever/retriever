resource "aws_security_group" "collector" {
  name        = "collector"
  description = "Accept OTLP, health check, and prometheus metrics traffic"
  vpc_id      = var.VPC_ID
  tags = {
    Name = "collector"
  }
}

# ingress - who can query the Collector?
resource "aws_vpc_security_group_ingress_rule" "collector_grpc" {
  security_group_id = aws_security_group.collector.id
  # referenced_security_group_id = aws_security_group.user_application
  cidr_ipv4   = "0.0.0.0/0"
  from_port   = 4317
  ip_protocol = "tcp"
  to_port     = 4317
}

resource "aws_vpc_security_group_ingress_rule" "collector_http" {
  security_group_id = aws_security_group.collector.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 4318
  ip_protocol       = "tcp"
  to_port           = 4318
}

resource "aws_vpc_security_group_ingress_rule" "collector_health_check" {
  security_group_id = aws_security_group.collector.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 13133
  ip_protocol       = "tcp"
  to_port           = 13133
}

resource "aws_vpc_security_group_ingress_rule" "collector_from_prometheus" {
  ip_protocol                  = "tcp"
  security_group_id            = aws_security_group.collector.id
  referenced_security_group_id = aws_security_group.prometheus.id
  from_port                    = 8889
  to_port                      = 8889
}

# egress - who can the collector reach?
resource "aws_vpc_security_group_egress_rule" "collector_to_opensearch" {
  security_group_id            = aws_security_group.collector.id
  referenced_security_group_id = aws_security_group.opensearch.id
  from_port                    = 9200
  ip_protocol                  = "tcp"
  to_port                      = 9200
}

resource "aws_ecs_task_definition" "collector" {
  family                   = "rvr_collector"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 1024
  memory                   = 2048
  execution_role_arn       = data.aws_iam_role.ecs_task.arn

  container_definitions = <<TASK_DEFINITION
[
 {
      "cpu": 1024,
      "environment": [],
      "environmentFiles": [],
      "essential": true,
      "healthCheck": {
        "command": [
          "CMD-SHELL",
          "curl -f http://localhost:13133/status || exit 1"
        ],
        "interval": 30,
        "retries": 3,
        "startPeriod": 30,
        "timeout": 5
      },
      "image": "runretriever/jaeger-collector:1",
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/rvr-test-collector-private",
          "awslogs-create-group": "true",
          "awslogs-region": "${local.region}",
          "awslogs-stream-prefix": "ecs"
        },
        "secretOptions": []
      },
      "mountPoints": [],
      "name": "jaeger_collector_private",
      "portMappings": [
        {
          "appProtocol": "grpc",
          "containerPort": 4317,
          "hostPort": 4317,
          "name": "collector_grpc",
          "protocol": "tcp"
        },
        {
          "appProtocol": "http",
          "containerPort": 4318,
          "hostPort": 4318,
          "name": "collector_http",
          "protocol": "tcp"
        },
        {
          "appProtocol": "http",
          "containerPort": 13133,
          "hostPort": 13133,
          "name": "collector_health_check",
          "protocol": "tcp"
        },
        {
          "appProtocol": "http",
          "containerPort": 8889,
          "hostPort": 8889,
          "name": "collector_prometheus_scrape",
          "protocol": "tcp"
        }
      ],
      "systemControls": [],
      "ulimits": [],
      "volumesFrom": []
    }
]
TASK_DEFINITION

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }
}

resource "aws_ecs_service" "rvr_collector" {
  name                          = "rvr_collector"
  cluster                       = aws_ecs_cluster.main.id
  task_definition               = aws_ecs_task_definition.collector.arn
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
    assign_public_ip = false
    security_groups = [
      aws_security_group.tls_out.id,
      aws_security_group.collector.id
    ]
    subnets = [var.PRIVATE_SUBNET_ID]
  }

  service_registries {
    container_name = "jaeger_collector_private"
    registry_arn   = aws_service_discovery_service.collector.arn
  }

  service_connect_configuration {
    enabled   = true
    namespace = aws_service_discovery_http_namespace.main.arn

    service {
      port_name = "collector_grpc"

      client_alias {
        port = 4317
      }
    }

    service {
      port_name = "collector_http"

      client_alias {
        port = 4318
      }
    }

    service {
      port_name = "collector_health_check"

      client_alias {
        port = 13133
      }
    }

    service {
      port_name = "collector_prometheus_scrape"

      client_alias {
        port = 8889
      }
    }
  }

  depends_on = [
    aws_ecs_service.rvr_opensearch
  ]
}

