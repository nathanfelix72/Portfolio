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

variable "github_oidc_sub_prefixes" {
  description = "GitHub Actions OIDC subject prefixes allowed to assume the deploy role (immutable form repo:OWNER@ID/REPO@ID:*)."
  type        = list(string)
  default = [
    "repo:nathanfelix72@131198703/Portfolio@1447445645:*",
  ]
}

variable "domain_name" {
  description = "Custom domain hosted in Cloudflare (e.g. nathanfelix72.com). Leave empty to use the CloudFront domain only."
  type        = string
  default     = ""
}

variable "include_www" {
  description = "Also request/serve www.<domain_name>."
  type        = bool
  default     = true
}

variable "wait_for_certificate_validation" {
  description = "Set true after ACM DNS validation records exist in Cloudflare so Terraform can wait and attach the cert."
  type        = bool
  default     = false
}
