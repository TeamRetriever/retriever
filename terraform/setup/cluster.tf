resource "aws_ecs_cluster" "demo" {
  name = "rvr-demo"
}

resource "aws_ecs_cluster_capacity_providers" "demo" {
  cluster_name = aws_ecs_cluster.demo.name

  capacity_providers = ["FARGATE"]
}