output "vpc_id" {
  description = "The id of the VPC created in Setup"
  value = aws_vpc.main.id
}

output "public_subnet_id_a" {
  description = "The id of public subnet A"
  value = aws_subnet.public-a.id
}

output "public_subnet_id_b" {
  description = "The id of public subnet B"
  value = aws_subnet.public-b.id
}

output "private_subnet_id" {
  value = aws_subnet.private-a.id
}