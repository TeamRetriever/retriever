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
