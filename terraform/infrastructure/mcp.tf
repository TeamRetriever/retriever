resource "aws_security_group" "mcp" {
  name        = "mcp"
  description = "MCP server: accepts requests from LLM clients via ALB, queries Jaeger and Prometheus"
  vpc_id      = var.VPC_ID
  tags = {
    Name = "mcp"
  }
}

# ingress - who can reach the MCP?
# ALB forwards LLM client requests to MCP via :3000/mcp
resource "aws_vpc_security_group_ingress_rule" "mcp_from_alb" {
  security_group_id            = aws_security_group.mcp.id
  referenced_security_group_id = aws_security_group.alb-sg.id
  from_port                    = 3000
  ip_protocol                  = "tcp"
  to_port                      = 3000
}

# egress: What does MCP need to reach?
# MCP queries Jaeger Query (to fetch traces via Jaeger API)
resource "aws_vpc_security_group_egress_rule" "mcp_to_query" {
  security_group_id            = aws_security_group.mcp.id
  referenced_security_group_id = aws_security_group.query.id
  from_port                    = 16686
  ip_protocol                  = "tcp"
  to_port                      = 16686
}

# MCP queries Prometheus (to fetch metrics for getServiceHealth tool)
resource "aws_vpc_security_group_egress_rule" "mcp_to_prometheus" {
  security_group_id            = aws_security_group.mcp.id
  referenced_security_group_id = aws_security_group.prometheus.id
  from_port                    = 9090
  ip_protocol                  = "tcp"
  to_port                      = 9090
}

# task definition
resource "aws_ecs_task_definition" "mcp" {
  family                   = "rvr_mcp"
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
        "name": "URL",
        "value": "http://query_ui.retriever:16686"
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
    "image": "runretriever/mcp-server:latest",
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/rvr_mcp",
        "awslogs-create-group": "true",
        "awslogs-region": "${local.region}",
        "awslogs-stream-prefix": "ecs"
      }
    },
    "mountPoints": [],
    "name": "mcp",
    "portMappings": [
      {
        "appProtocol": "http",
        "containerPort": 3000,
        "hostPort": 3000,
        "name": "mcp",
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
resource "aws_lb_target_group" "mcp" {
  name        = "mcp-tg"
  port        = 3000
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
    port                = "3000"
    protocol            = "HTTP"
    matcher             = "200"
  }

  deregistration_delay = 30

  tags = {
    Name = "mcp-tg"
  }
}

# ALB listener rule for HTTPS
resource "aws_lb_listener_rule" "mcp" {
  listener_arn = aws_lb_listener.public-https.arn
  priority     = 101

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.mcp.arn
  }

  condition {
    path_pattern {
      values = ["/mcp"]
    }
  }

  tags = {
    Name = "mcp-https-rule"
  }
}


resource "aws_ecs_service" "mcp" {
  name                          = "rvr_mcp"
  cluster                       = aws_ecs_cluster.main.id
  task_definition               = aws_ecs_task_definition.mcp.arn
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
      aws_security_group.mcp.id
    ]
    subnets = [var.PRIVATE_SUBNET_ID]
  }

  service_connect_configuration {
    enabled   = true
    namespace = aws_service_discovery_http_namespace.main.arn
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.mcp.arn
    container_name   = "mcp"
    container_port   = 3000
  }
}
