resource "aws_security_group" "tls_out" {
  name        = "tls_out"
  description = "Allow TLS outbound traffic for retrieving docker images"
  vpc_id      = var.VPC_ID

  tags = {
    Name = "tls_out"
  }
}

resource "aws_vpc_security_group_egress_rule" "tls_out" {
  security_group_id = aws_security_group.tls_out.id

  cidr_ipv4   = "0.0.0.0/0"
  from_port   = 443
  ip_protocol = "tcp"
  to_port     = 443
}
