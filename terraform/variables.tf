variable "aws_region" {
  description = "Primary AWS region for the S3 bucket and supporting resources."
  type        = string
  default     = "us-west-1"
}

variable "aws_profile" {
  description = "Local AWS CLI profile used by Terraform (personal account)."
  type        = string
  default     = "portfolio"
}

variable "project_name" {
  description = "Short name used for resource naming."
  type        = string
  default     = "portfolio"
}

variable "github_owner" {
  description = "GitHub username or org that owns the portfolio repo."
  type        = string
  default     = "nathanfelix72"
}

variable "github_repo" {
  description = "GitHub repository name allowed to assume the deploy role."
  type        = string
  default     = "Portfolio"
}

variable "github_branch" {
  description = "Git branch allowed to deploy via OIDC."
  type        = string
  default     = "main"
}

variable "domain_name" {
  description = "Optional custom domain (leave empty for CloudFront default domain)."
  type        = string
  default     = ""
}

variable "acm_certificate_arn" {
  description = "Optional ACM certificate ARN in us-east-1 for the custom domain."
  type        = string
  default     = ""
}
