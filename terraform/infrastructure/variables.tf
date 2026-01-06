variable "VPC_ID" {
  type = string
}

variable "PUBLIC_SUBNET_ID_1" {
  type = string
}

variable "PUBLIC_SUBNET_ID_2" {
  type = string
}

variable "PRIVATE_SUBNET_ID" {
  type = string
}

variable "USER_CERTIFICATE_PRIVATE_KEY_FILE" {
  type = string
}

variable "USER_CERTIFICATE_BODY_FILE" {
  type = string
}

variable "USER_CERTIFICATE_CHAIN_FILE" {
  type = string
}

variable "BASE_URL" {
  description = "Base URL for the Retriever UI (used in AlertManager Slack notification links)"
  type        = string
  default     = "https://rvr.philipkn.app"
}
