output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer for the demo. Connect here on port 8080 to interact with the demo app."
  value       = aws_lb.demo-endpoint.dns_name
}
