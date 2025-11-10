terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

# Call your Jaeger collector module
module "jaeger_collector" {
  source   = "./modules/jaeger_collector"
  user_id  = "test-user"
  region   = "us-east-1"
  subnet_id = "subnet-03d72864ca293a058"

  # Optional if your module needs these:
  # vpc_id   = "vpc-xxxxxx"
  # subnet_id = "subnet-xxxxxx"
}

output "collector_endpoint" {
  value = module.jaeger_collector.collector_endpoint
}
