resource "aws_security_group" "query" {
  name        = "query"
  description = "Exposed publicly via the ALB, Accepts traffic from an LLM client via the MCP, provides the UI, and facilitates prometheus."
  vpc_id      = var.VPC_ID
  tags = {
    Name = "query"
  }
}

# ingress who can query Jaeger Query
# receives traffic from the ALB to reach the UI
resource "aws_vpc_security_group_ingress_rule" "query_from_alb" {
  security_group_id            = aws_security_group.query.id
  referenced_security_group_id = aws_security_group.alb-sg.id
  from_port                    = 16686
  ip_protocol                  = "tcp"
  to_port                      = 16686
}

# receives traffic from MCP
resource "aws_vpc_security_group_ingress_rule" "query_from_mcp" {
  security_group_id            = aws_security_group.query.id
  referenced_security_group_id = aws_security_group.mcp.id
  from_port                    = 16686
  ip_protocol                  = "tcp"
  to_port                      = 16686
}

# health check endpoint
resource "aws_vpc_security_group_ingress_rule" "query_health_check" {
  security_group_id            = aws_security_group.query.id
  referenced_security_group_id = aws_security_group.alb-sg.id
  from_port                    = 16687
  ip_protocol                  = "tcp"
  to_port                      = 16687
}

# egress - who can Query reach?
# requests trace data from Opensearch (to get traces)
resource "aws_vpc_security_group_egress_rule" "query_to_opensearch" {
  ip_protocol                  = "tcp"
  security_group_id            = aws_security_group.query.id
  referenced_security_group_id = aws_security_group.opensearch.id
  from_port                    = 9200
  to_port                      = 9200
}
# requests spanmetrics from Prometheus (to get metrics in the monitor tab)
resource "aws_vpc_security_group_egress_rule" "query_to_prometheus" {
  ip_protocol                  = "tcp"
  security_group_id            = aws_security_group.query.id
  referenced_security_group_id = aws_security_group.prometheus.id
  from_port                    = 9090
  to_port                      = 9090
}

# task definition
resource "aws_ecs_task_definition" "query" {
  family                   = "rvr_query"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 1024
  memory                   = 2048
  execution_role_arn       = data.aws_iam_role.ecs_task.arn
  container_definitions    = <<TASK_DEFINITION
[
    {
      "cpu": 1024,
      "environment": [],
      "environmentFiles": [],
      "essential": true,
      "healthCheck": {
        "command": [
          "CMD-SHELL",
          "curl -f http://localhost:16687/status || exit 1"
        ],
        "interval": 30,
        "retries": 3,
        "startPeriod": 30,
        "timeout": 5
      },
      "image": "runretriever/jaeger-query:latest",
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/rvr-test-query",
          "awslogs-create-group": "true",
          "awslogs-region": "${local.region}",
          "awslogs-stream-prefix": "ecs"
        },
        "secretOptions": []
      },
      "mountPoints": [],
      "name": "query",
      "portMappings": [
        {
          "appProtocol": "http",
          "containerPort": 16686,
          "hostPort": 16686,
          "name": "query_ui",
          "protocol": "tcp"
        },
        {
          "appProtocol": "http",
          "containerPort": 16687,
          "hostPort": 16687,
          "name": "query_health",
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
resource "aws_lb_target_group" "query" {
  name        = "query-tg"
  port        = 16686
  protocol    = "HTTP"
  vpc_id      = var.VPC_ID
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
    interval            = 30
    path                = "/status"
    port                = "16687"
    protocol            = "HTTP"
    matcher             = "200"
  }

  deregistration_delay = 30

  tags = {
    Name = "query-tg"
  }
}



# ecs service
resource "aws_ecs_service" "query" {
  name                          = "rvr_query"
  cluster                       = aws_ecs_cluster.main.id
  task_definition               = aws_ecs_task_definition.query.arn
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
      aws_security_group.query.id
    ]
    subnets = [var.PRIVATE_SUBNET_ID]
  }

  service_connect_configuration {
    enabled   = true
    namespace = aws_service_discovery_http_namespace.main.arn

    service {
      port_name = "query_ui"

      client_alias {
        port = 16686
      }
    }

    service {
      port_name = "query_health"

      client_alias {
        port = 16687
      }
    }
  }

  # Query (Jaeger UI) is accessed through auth-proxy at / and /jaeger
  # No direct ALB access needed

  depends_on = [
    aws_lb_listener.public-https,
    aws_ecs_service.rvr_opensearch
  ]
}
