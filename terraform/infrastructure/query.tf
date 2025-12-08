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
# the LLM via MCP (is this the same endpoint?)

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
# ecs service