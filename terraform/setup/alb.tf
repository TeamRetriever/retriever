resource "aws_security_group" "alb-demo" {
  name        = "rvr-demo-alb-sg"
  description = "Allow TLS traffic. Temporarily allow HTTP traffic for testing purposes."

  vpc_id = aws_vpc.main.id

  timeouts {
    delete = "2m" # to fail faster in the event of a sticky security group
  }

  tags = {
    Name = "rvr-demo-alb-sg"
  }
}

resource "aws_vpc_security_group_ingress_rule" "allow_demo_app_traffic" {
  security_group_id = aws_security_group.alb-demo.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 8080
  ip_protocol       = "tcp"
  to_port           = 8080
}

resource "aws_vpc_security_group_egress_rule" "allow_demo_app_traffic" {
  security_group_id = aws_security_group.alb-demo.id
  cidr_ipv4         = aws_vpc.main.cidr_block
  from_port         = 8080
  ip_protocol       = "tcp"
  to_port           = 8080
}

resource "aws_lb" "demo-endpoint" {
  name               = "rvr-demo-endpoint"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb-demo.id]
  subnets            = [aws_subnet.public-a.id, aws_subnet.public-b.id]
  ip_address_type    = "ipv4"

  tags = {
    Name = "rvr-demo-endpoint"
  }
}

resource "aws_lb_target_group" "demo-app" {
  name        = "demo-app-tg"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"
}

resource "aws_lb_listener" "demo-app" {
  load_balancer_arn = aws_lb.demo-endpoint.arn
  port              = "8080"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.demo-app.arn
  }
}
