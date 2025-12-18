resource "aws_security_group" "prometheus" {
  name        = "prometheus"
  description = "Prometheus: scrapes collector metrics, serves query API to Query service and MCP"
  vpc_id      = var.VPC_ID
  tags = {
    Name = "prometheus"
  }
}

# ingress: who can query Prometheus?
# receives requests from Query for spanmetrics (for the monitor tab)
resource "aws_vpc_security_group_ingress_rule" "prometheus_from_query" {
  security_group_id            = aws_security_group.prometheus.id
  referenced_security_group_id = aws_security_group.query.id
  from_port                    = 9090
  ip_protocol                  = "tcp"
  to_port                      = 9090
}

# receives requests from the ALB for the Prometheus UI
resource "aws_vpc_security_group_ingress_rule" "prometheus_from_alb" {
  security_group_id            = aws_security_group.prometheus.id
  referenced_security_group_id = aws_security_group.alb-sg.id
  from_port                    = 9090
  ip_protocol                  = "tcp"
  to_port                      = 9090
}

# receives requests from the MCP
resource "aws_vpc_security_group_ingress_rule" "prometheus_from_mcp" {
  security_group_id            = aws_security_group.prometheus.id
  referenced_security_group_id = aws_security_group.mcp.id
  from_port                    = 9090
  ip_protocol                  = "tcp"
  to_port                      = 9090
}

# receives requests from the auth-proxy
resource "aws_vpc_security_group_ingress_rule" "prometheus_from_auth_proxy" {
  security_group_id            = aws_security_group.prometheus.id
  referenced_security_group_id = aws_security_group.auth_proxy.id
  from_port                    = 9090
  ip_protocol                  = "tcp"
  to_port                      = 9090
}

# egress: what can Prometheus reach?
# Prometheus scrapes metrics from the Collector
resource "aws_vpc_security_group_egress_rule" "prometheus_to_collector" {
  security_group_id            = aws_security_group.prometheus.id
  referenced_security_group_id = aws_security_group.collector.id
  from_port                    = 8889
  ip_protocol                  = "tcp"
  to_port                      = 8889
}

# Prometheus sends alerts to Alertmanager
resource "aws_vpc_security_group_egress_rule" "prometheus_to_alertmanager" {
  security_group_id            = aws_security_group.prometheus.id
  referenced_security_group_id = aws_security_group.alertmanager.id
  from_port                    = 9093
  ip_protocol                  = "tcp"
  to_port                      = 9093
}

# task definition
resource "aws_ecs_task_definition" "prometheus" {
  family                   = "rvr_prometheus"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = data.aws_iam_role.ecs_task.arn
  container_definitions    = <<TASK_DEFINITION
[
    {
      "cpu": 512,
      "environment": [],
      "environmentFiles": [],
      "essential": true,
      "healthCheck": {
        "command": [
          "CMD-SHELL",
          "wget --spider http://localhost:9090/prometheus/-/healthy || exit 1"
        ],
        "interval": 30,
        "retries": 3,
        "startPeriod": 30,
        "timeout": 5
      },
      "image": "runretriever/prometheus:latest",
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/rvr-test-prometheus",
          "awslogs-create-group": "true",
          "awslogs-region": "${local.region}",
          "awslogs-stream-prefix": "ecs"
        },
        "secretOptions": []
      },
      "mountPoints": [],
      "name": "prometheus",
      "portMappings": [
        {
          "appProtocol": "http",
          "containerPort": 9090,
          "hostPort": 9090,
          "name": "prometheus_ui",
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

# ALB target group
resource "aws_lb_target_group" "prometheus" {
  name        = "prometheus-tg"
  port        = 9090
  protocol    = "HTTP"
  vpc_id      = var.VPC_ID
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
    interval            = 30
    path                = "/prometheus/-/healthy"
    port                = "9090"
    protocol            = "HTTP"
    matcher             = "200"
  }

  deregistration_delay = 30

  tags = {
    Name = "prometheus-tg"
  }
}

# ECS service
resource "aws_ecs_service" "prometheus" {
  name                          = "rvr_prometheus"
  cluster                       = aws_ecs_cluster.main.id
  task_definition               = aws_ecs_task_definition.prometheus.arn
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
      aws_security_group.prometheus.id
    ]
    subnets = [var.PRIVATE_SUBNET_ID]
  }

  service_connect_configuration {
    enabled   = true
    namespace = aws_service_discovery_http_namespace.main.arn

    service {
      port_name = "prometheus_ui"

      client_alias {
        port = 9090
      }
    }
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.prometheus.arn
    container_name   = "prometheus"
    container_port   = 9090
  }

  depends_on = [
    aws_lb_listener.public-https,
    aws_ecs_service.rvr_collector
  ]
}
