data "aws_iam_role" "ecs_task" {
  name = "ecsTaskExecutionRole"
}

data "aws_caller_identity" "current" {}
