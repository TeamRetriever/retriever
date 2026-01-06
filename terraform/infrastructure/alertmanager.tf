resource "aws_security_group" "alertmanager" {
  name        = "alertmanager"
  description = "Alertmanager: receives alerts from Prometheus, sends notifications to Slack"
  vpc_id      = var.VPC_ID
  tags = {
    Name = "alertmanager"
  }
}

# ingress: who can query Alertmanager?
# receives alerts from Prometheus
resource "aws_vpc_security_group_ingress_rule" "alertmanager_from_prometheus" {
  security_group_id            = aws_security_group.alertmanager.id
  referenced_security_group_id = aws_security_group.prometheus.id
  from_port                    = 9093
  ip_protocol                  = "tcp"
  to_port                      = 9093
}

# receives requests from the ALB for the Alertmanager UI
resource "aws_vpc_security_group_ingress_rule" "alertmanager_from_alb" {
  security_group_id            = aws_security_group.alertmanager.id
  referenced_security_group_id = aws_security_group.alb-sg.id
  from_port                    = 9093
  ip_protocol                  = "tcp"
  to_port                      = 9093
}

# receives requests from the auth-proxy
resource "aws_vpc_security_group_ingress_rule" "alertmanager_from_auth_proxy" {
  security_group_id            = aws_security_group.alertmanager.id
  referenced_security_group_id = aws_security_group.auth_proxy.id
  from_port                    = 9093
  ip_protocol                  = "tcp"
  to_port                      = 9093
}

# egress: what can Alertmanager reach?
# Alertmanager needs to reach external services (Slack) via HTTPS
# This is handled by the tls_out security group attached to the service

# task definition
resource "aws_ecs_task_definition" "alertmanager" {
  family                   = "rvr_alertmanager"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = data.aws_iam_role.ecs_task.arn
  container_definitions    = <<TASK_DEFINITION
[
    {
      "cpu": 256,
      "environment": [
        {
          "name": "SLACK_CHANNEL",
          "value": "#alerts"
        },
        {
          "name": "BASE_URL",
          "value": "${var.BASE_URL}"
        }
      ],
      "environmentFiles": [],
      "secrets": [
        {
          "name": "SLACK_WEBHOOK_URL",
          "valueFrom": "${data.aws_secretsmanager_secret.slack_webhook.arn}"
        }
      ],
      "essential": true,
      "healthCheck": {
        "command": [
          "CMD-SHELL",
          "wget --spider http://localhost:9093/alertmanager/-/healthy || exit 1"
        ],
        "interval": 30,
        "retries": 3,
        "startPeriod": 30,
        "timeout": 5
      },
      "image": "runretriever/alertmanager:latest",
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/rvr-test-alertmanager",
          "awslogs-create-group": "true",
          "awslogs-region": "${local.region}",
          "awslogs-stream-prefix": "ecs"
        },
        "secretOptions": []
      },
      "mountPoints": [],
      "name": "alertmanager",
      "portMappings": [
        {
          "appProtocol": "http",
          "containerPort": 9093,
          "hostPort": 9093,
          "name": "alertmanager_ui",
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
resource "aws_lb_target_group" "alertmanager" {
  name        = "alertmanager-tg"
  port        = 9093
  protocol    = "HTTP"
  vpc_id      = var.VPC_ID
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
    interval            = 30
    path                = "/alertmanager/-/healthy"
    port                = "9093"
    protocol            = "HTTP"
    matcher             = "200"
  }

  deregistration_delay = 30

  tags = {
    Name = "alertmanager-tg"
  }
}

# ECS service
resource "aws_ecs_service" "alertmanager" {
  name                          = "rvr_alertmanager"
  cluster                       = aws_ecs_cluster.main.id
  task_definition               = aws_ecs_task_definition.alertmanager.arn
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
      aws_security_group.alertmanager.id
    ]
    subnets = [var.PRIVATE_SUBNET_ID]
  }

  service_connect_configuration {
    enabled   = true
    namespace = aws_service_discovery_http_namespace.main.arn

    service {
      port_name = "alertmanager_ui"

      client_alias {
        port = 9093
      }
    }
  }

  # AlertManager is accessed through auth-proxy, not directly via ALB
  # No load_balancer block needed

  depends_on = [
    aws_lb_listener.public-https,
    aws_ecs_service.prometheus
  ]
}
