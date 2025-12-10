resource "aws_security_group" "hotrod" {
  name        = "hotrod"
  description = "Allow all traffic needed for the hotrod demo app"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "hotrod"
  }
}

resource "aws_vpc_security_group_ingress_rule" "hotrod-ui" {
  security_group_id = aws_security_group.hotrod.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 8080
  ip_protocol       = "tcp"
  to_port           = 8080
}

resource "aws_vpc_security_group_egress_rule" "hotrod-get-dockerhub-image" {
  security_group_id = aws_security_group.hotrod.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  ip_protocol       = "tcp"
  to_port           = 443
}

resource "aws_vpc_security_group_egress_rule" "hotrod-send-otel-data" {
  security_group_id = aws_security_group.hotrod.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 4318
  ip_protocol       = "tcp"
  to_port           = 4318
}

resource "aws_ecs_task_definition" "hotrod" {
  family                   = "rvr_hotrod"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 1024
  memory                   = 2048
  execution_role_arn       = data.aws_iam_role.ecs_task.arn

  container_definitions = <<TASK_DEFINITION
[
  {
    "cpu": 0,
    "environment": [
      {
        "name": "OTEL_EXPORTER_OTLP_ENDPOINT",
        "value": "${var.HOTROD_ENDPOINT}"
      }
    ],
    "environmentFiles": [],
    "essential": true,
    "image": "jaegertracing/example-hotrod:latest",
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/rvr-test-hotrod",
        "awslogs-create-group": "true",
        "awslogs-region": "${local.region}",
        "awslogs-stream-prefix": "ecs"
      },
      "secretOptions": []
    },
    "mountPoints": [],
    "name": "hotrod",
    "portMappings": [
      {
        "appProtocol": "http",
        "containerPort": 8080,
        "hostPort": 8080,
        "name": "ui",
        "protocol": "tcp"
      },
      {
        "appProtocol": "http",
        "containerPort": 8083,
        "hostPort": 8083,
        "name": "other",
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

resource "aws_ecs_service" "rvr_hotrod" {
  name                          = "rvr_hotrod"
  cluster                       = aws_ecs_cluster.demo.id
  task_definition               = aws_ecs_task_definition.hotrod.arn
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
      aws_security_group.hotrod.id
    ]
    subnets = [aws_subnet.private-a.id]
  }

  load_balancer {
    container_name   = "hotrod"
    container_port   = 8080
    target_group_arn = aws_lb_target_group.demo-app.arn
  }
}
