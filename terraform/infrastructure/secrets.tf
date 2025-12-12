# reference secret 
data "aws_secretsmanager_secret" "jwt_secret" {
    name = "retriever/jwt-secret"
}

# Grant ECS permission to read policy
resource "aws_iam_role_policy" "ecs_secrets_access" {
    role = data.aws_iam_role.ecs_task.name 

    policy = jsonencode({
        Version = "2012-10-17" 
        Statement = [{
            Effect = "Allow" 
            Action = [
                "secretsmanager:GetSecretValue"
            ]
            Resource = [
                data.aws_secretsmanager_secret.jwt_secret.arn
            ]
        }]
    })
}