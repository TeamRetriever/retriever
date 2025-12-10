resource "aws_acm_certificate" "user-cert" {
  private_key      = file(var.USER_CERTIFICATE_PRIVATE_KEY_FILE)
  certificate_body = file(var.USER_CERTIFICATE_BODY_FILE)
}

resource "aws_security_group" "alb-sg" {
  name        = "rvr-public-endpoint-sg"
  description = "Allow TLS traffic. Temporarily allow HTTP traffic for testing purposes."

  vpc_id = var.VPC_ID

  timeouts {
    delete = "2m" # to fail faster in the event of a sticky security group
  }

  tags = {
    Name = "rvr-public-endpoint-sg"
  }
}

# TODO add ingress/egress rules for:
# Port 3000 for the MCP

# ingress - what can query the ALB?
resource "aws_vpc_security_group_ingress_rule" "allow_tls_ipv4" {
  security_group_id = aws_security_group.alb-sg.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  ip_protocol       = "tcp"
  to_port           = 443
}

resource "aws_vpc_security_group_ingress_rule" "allow_http_ipv4" {
  security_group_id = aws_security_group.alb-sg.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 80
  ip_protocol       = "tcp"
  to_port           = 80
}

# egress - who can the ALB query?
resource "aws_vpc_security_group_egress_rule" "allow_tls_ipv4" {
  security_group_id = aws_security_group.alb-sg.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  ip_protocol       = "tcp"
  to_port           = 443
}

resource "aws_vpc_security_group_egress_rule" "allow_http_ipv4" {
  security_group_id = aws_security_group.alb-sg.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 80
  ip_protocol       = "tcp"
  to_port           = 80
}

# access Query UI
resource "aws_vpc_security_group_egress_rule" "alb_to_query" {
  security_group_id            = aws_security_group.alb-sg.id
  referenced_security_group_id = aws_security_group.query.id
  from_port                    = 16686
  ip_protocol                  = "tcp"
  to_port                      = 16686
}

# access Query health check
resource "aws_vpc_security_group_egress_rule" "alb_to_query_health" {
  security_group_id            = aws_security_group.alb-sg.id
  referenced_security_group_id = aws_security_group.query.id
  from_port                    = 16687
  ip_protocol                  = "tcp"
  to_port                      = 16687
}

# query Prometheus UI
resource "aws_vpc_security_group_egress_rule" "alb_to_prometheus" {
  security_group_id            = aws_security_group.alb-sg.id
  referenced_security_group_id = aws_security_group.prometheus.id
  from_port                    = 9090
  ip_protocol                  = "tcp"
  to_port                      = 9090
}

# access MCP
resource "aws_vpc_security_group_egress_rule" "alb_to_mcp" {
  security_group_id            = aws_security_group.alb-sg.id
  referenced_security_group_id = aws_security_group.mcp.id
  from_port                    = 3000
  ip_protocol                  = "tcp"
  to_port                      = 3000
}

resource "aws_lb" "public-endpoint" {
  name               = "rvr-public-endpoint"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb-sg.id]
  subnets            = [var.PUBLIC_SUBNET_ID_1, var.PUBLIC_SUBNET_ID_2]
  ip_address_type    = "ipv4"

  tags = {
    Name = "rvr-public-endpoint"
  }
}

resource "aws_lb_listener" "dummy-http" {
  load_balancer_arn = aws_lb.public-endpoint.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "fixed-response"

    fixed_response {
      content_type = "text/plain"
      message_body = "successfully connected to alb over http"
      status_code  = "200"
    }
  }
}

resource "aws_lb_listener" "dummy-https" {
  load_balancer_arn = aws_lb.public-endpoint.arn
  port              = "443"
  protocol          = "HTTPS"
  certificate_arn   = aws_acm_certificate.user-cert.arn

  default_action {
    type = "fixed-response"

    fixed_response {
      content_type = "text/plain"
      message_body = "successfully connected to alb over https"
      status_code  = "200"
    }
  }
}
