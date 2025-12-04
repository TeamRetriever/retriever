resource "aws_security_group" "collector" {
  name        = "collector"
  description = "Accept OTLP and health check traffic"
  vpc_id      = var.VPC_ID
  tags = {
    Name = "collector"
  }
}

resource "aws_vpc_security_group_ingress_rule" "collector_grpc" {
  security_group_id = aws_security_group.collector.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 4317
  ip_protocol       = "tcp"
  to_port           = 4317
}

resource "aws_vpc_security_group_ingress_rule" "collector_http" {
  security_group_id = aws_security_group.collector.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 4318
  ip_protocol       = "tcp"
  to_port           = 4318
}

resource "aws_vpc_security_group_ingress_rule" "collector_health_check" {
  security_group_id = aws_security_group.collector.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 13133
  ip_protocol       = "tcp"
  to_port           = 13133
}

resource "aws_vpc_security_group_egress_rule" "collector_to_opensearch" {
  security_group_id = aws_security_group.collector.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 9200
  ip_protocol       = "tcp"
  to_port           = 9200
}
