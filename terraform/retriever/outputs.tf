output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = aws_ecs_cluster.main.name
}

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.public-endpoint.dns_name
}

output "service_discovery_namespace_arn" {
  description = "ARN of the service discovery namespace"
  value       = aws_service_discovery_http_namespace.main.arn
}