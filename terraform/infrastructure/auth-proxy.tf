# Auth Proxy - Authentication gateway for observability UIs
# Validates JWT tokens and proxies requests to Jaeger, Prometheus, and AlertManager

resource "aws_security_group" "auth_proxy" {
  name        = "auth-proxy"
  description = "Auth proxy: accepts requests from ALB, proxies to observability services"
  vpc_id      = var.VPC_ID
  tags = {
    Name = "auth-proxy"
  }
}

# Ingress - who can reach the auth-proxy?
# ALB forwards requests to auth-proxy via :3001
resource "aws_vpc_security_group_ingress_rule" "auth_proxy_from_alb" {
  security_group_id            = aws_security_group.auth_proxy.id
  referenced_security_group_id = aws_security_group.alb-sg.id
  from_port                    = 3001
  ip_protocol                  = "tcp"
  to_port                      = 3001
}

# Egress: What does auth-proxy need to reach?
# Auth-proxy proxies to Jaeger Query (to display traces)
resource "aws_vpc_security_group_egress_rule" "auth_proxy_to_query" {
  security_group_id            = aws_security_group.auth_proxy.id
  referenced_security_group_id = aws_security_group.query.id
  from_port                    = 16686
  ip_protocol                  = "tcp"
  to_port                      = 16686
}

# Auth-proxy proxies to Prometheus (to display metrics)
resource "aws_vpc_security_group_egress_rule" "auth_proxy_to_prometheus" {
  security_group_id            = aws_security_group.auth_proxy.id
  referenced_security_group_id = aws_security_group.prometheus.id
  from_port                    = 9090
  ip_protocol                  = "tcp"
  to_port                      = 9090
}

# Auth-proxy proxies to AlertManager (to display alerts)
resource "aws_vpc_security_group_egress_rule" "auth_proxy_to_alertmanager" {
  security_group_id            = aws_security_group.auth_proxy.id
  referenced_security_group_id = aws_security_group.alertmanager.id
  from_port                    = 9093
  ip_protocol                  = "tcp"
  to_port                      = 9093
}

# Task definition
resource "aws_ecs_task_definition" "auth_proxy" {
  family                   = "rvr_auth_proxy"
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
        "name": "JAEGER_URL",
        "value": "http://query_ui.retriever:16686"
      },
      {
        "name": "PROMETHEUS_URL",
        "value": "http://prometheus_ui.retriever:9090"
      },
      {
        "name": "ALERTMANAGER_URL",
        "value": "http://alertmanager_ui.retriever:9093"
      },
      {
        "name": "COOKIE_MAX_AGE_DAYS",
        "value": "7"
      },
      {
        "name": "PORT",
        "value": "3001"
      },
      {
        "name": "NODE_ENV",
        "value": "production"
      }
    ],
    "secrets": [
      {
        "name": "JWT_SECRET",
        "valueFrom": "${data.aws_secretsmanager_secret.jwt_secret.arn}"
      }
    ],
    "environmentFiles": [],
    "essential": true,
    "image": "runretriever/auth-proxy:latest",
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/rvr_auth_proxy",
        "awslogs-create-group": "true",
        "awslogs-region": "${local.region}",
        "awslogs-stream-prefix": "ecs"
      }
    },
    "mountPoints": [],
    "name": "auth-proxy",
    "portMappings": [
      {
        "appProtocol": "http",
        "containerPort": 3001,
        "hostPort": 3001,
        "name": "auth-proxy",
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
resource "aws_lb_target_group" "auth_proxy" {
  name        = "auth-proxy-tg"
  port        = 3001
  protocol    = "HTTP"
  vpc_id      = var.VPC_ID
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
    interval            = 30
    path                = "/health"
    port                = "3001"
    protocol            = "HTTP"
    matcher             = "200"
  }

  deregistration_delay = 30

  tags = {
    Name = "auth-proxy-tg"
  }
}

# ALB listener rule for HTTPS - /auth (login page)
resource "aws_lb_listener_rule" "auth_proxy_https_login" {
  listener_arn = aws_lb_listener.public-https.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.auth_proxy.arn
  }

  condition {
    path_pattern {
      values = ["/auth", "/auth/*"]
    }
  }

  tags = {
    Name = "auth-proxy-https-login-rule"
  }
}

# ALB listener rule for HTTP - /auth (login page)
resource "aws_lb_listener_rule" "auth_proxy_http_login" {
  listener_arn = aws_lb_listener.public-http.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.auth_proxy.arn
  }

  condition {
    path_pattern {
      values = ["/auth", "/auth/*"]
    }
  }

  tags = {
    Name = "auth-proxy-http-login-rule"
  }
}

# ALB listener rule for HTTPS - /jaeger
resource "aws_lb_listener_rule" "auth_proxy_https_jaeger" {
  listener_arn = aws_lb_listener.public-https.arn
  priority     = 20

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.auth_proxy.arn
  }

  condition {
    path_pattern {
      values = ["/jaeger", "/jaeger/*"]
    }
  }

  tags = {
    Name = "auth-proxy-https-jaeger-rule"
  }
}

# ALB listener rule for HTTP - /jaeger
resource "aws_lb_listener_rule" "auth_proxy_http_jaeger" {
  listener_arn = aws_lb_listener.public-http.arn
  priority     = 20

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.auth_proxy.arn
  }

  condition {
    path_pattern {
      values = ["/jaeger", "/jaeger/*"]
    }
  }

  tags = {
    Name = "auth-proxy-http-jaeger-rule"
  }
}

# ALB listener rule for HTTPS - /prometheus
resource "aws_lb_listener_rule" "auth_proxy_https_prometheus" {
  listener_arn = aws_lb_listener.public-https.arn
  priority     = 30

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.auth_proxy.arn
  }

  condition {
    path_pattern {
      values = ["/prometheus", "/prometheus/*"]
    }
  }

  tags = {
    Name = "auth-proxy-https-prometheus-rule"
  }
}

# ALB listener rule for HTTP - /prometheus
resource "aws_lb_listener_rule" "auth_proxy_http_prometheus" {
  listener_arn = aws_lb_listener.public-http.arn
  priority     = 30

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.auth_proxy.arn
  }

  condition {
    path_pattern {
      values = ["/prometheus", "/prometheus/*"]
    }
  }

  tags = {
    Name = "auth-proxy-http-prometheus-rule"
  }
}

# ALB listener rule for HTTPS - /alertmanager
resource "aws_lb_listener_rule" "auth_proxy_https_alertmanager" {
  listener_arn = aws_lb_listener.public-https.arn
  priority     = 40

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.auth_proxy.arn
  }

  condition {
    path_pattern {
      values = ["/alertmanager", "/alertmanager/*"]
    }
  }

  tags = {
    Name = "auth-proxy-https-alertmanager-rule"
  }
}

# ALB listener rule for HTTP - /alertmanager
resource "aws_lb_listener_rule" "auth_proxy_http_alertmanager" {
  listener_arn = aws_lb_listener.public-http.arn
  priority     = 40

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.auth_proxy.arn
  }

  condition {
    path_pattern {
      values = ["/alertmanager", "/alertmanager/*"]
    }
  }

  tags = {
    Name = "auth-proxy-http-alertmanager-rule"
  }
}

# ECS service
resource "aws_ecs_service" "auth_proxy" {
  name                          = "rvr_auth_proxy"
  cluster                       = aws_ecs_cluster.main.id
  task_definition               = aws_ecs_task_definition.auth_proxy.arn
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
      aws_security_group.auth_proxy.id
    ]
    subnets = [var.PRIVATE_SUBNET_ID]
  }

  service_connect_configuration {
    enabled   = true
    namespace = aws_service_discovery_http_namespace.main.arn
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.auth_proxy.arn
    container_name   = "auth-proxy"
    container_port   = 3001
  }
}
