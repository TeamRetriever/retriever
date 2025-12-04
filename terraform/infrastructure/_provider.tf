terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
  backend "s3" {}
}

locals {
  region = "us-east-1"
}

provider "aws" {
  region = local.region
}
