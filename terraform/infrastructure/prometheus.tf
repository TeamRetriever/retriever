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

# egress: what can Prometheus reach?
# Prometheus scrapes metrics from the Collector
resource "aws_vpc_security_group_egress_rule" "prometheus_to_collector" {
  security_group_id            = aws_security_group.prometheus.id
  referenced_security_group_id = aws_security_group.collector.id
  from_port                    = 8889
  ip_protocol                  = "tcp"
  to_port                      = 8889
}