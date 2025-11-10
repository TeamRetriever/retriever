output "collector_endpoint" {
  value = "http://${aws_ecs_service.collector.name}.amazonaws.com:14268"
}
