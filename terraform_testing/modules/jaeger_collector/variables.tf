variable "user_id" { type = string }
variable "region"  { type = string }
variable "vpc_id" {
  type        = string
  default     = null
  description = "Optional VPC ID for Fargate networking"
}
variable "subnet_id" {
  type        = string
  default     = null
  description = "Optional subnet for Fargate service"
}
