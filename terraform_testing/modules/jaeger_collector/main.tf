resource "aws_ecs_cluster" "jaeger" {
  name = "retriever-jaeger-${var.user_id}"
}

resource "aws_ecs_task_definition" "jaeger_collector" {
  family                   = "retriever-jaeger-${var.user_id}"
  network_mode              = "awsvpc"
  requires_compatibilities  = ["FARGATE"]
  cpu                       = "256"
  memory                    = "512"
  container_definitions = jsonencode([{
    name  = "jaeger-collector"
    image = "jaegertracing/jaeger-collector:latest"
    portMappings = [{ containerPort = 14268 }]
  }])
}

resource "aws_ecs_service" "collector" {
  name            = "jaeger-collector-${var.user_id}"
  cluster         = aws_ecs_cluster.jaeger.id
  task_definition = aws_ecs_task_definition.jaeger_collector.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = var.subnet_id != null ? [var.subnet_id] : []
    assign_public_ip = true
  }
}
