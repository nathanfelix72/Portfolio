locals {
  enable_custom_domain = var.domain_name != ""
  site_aliases = local.enable_custom_domain ? distinct(compact([
    var.domain_name,
    var.include_www ? "www.${var.domain_name}" : "",
  ])) : []
}

resource "aws_acm_certificate" "site" {
  count = local.enable_custom_domain ? 1 : 0

  provider          = aws.us_east_1
  domain_name       = var.domain_name
  validation_method = "DNS"
  subject_alternative_names = var.include_www ? ["www.${var.domain_name}"] : []

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name    = var.project_name
    Project = var.project_name
  }
}

resource "aws_acm_certificate_validation" "site" {
  count = local.enable_custom_domain && var.wait_for_certificate_validation ? 1 : 0

  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.site[0].arn
  validation_record_fqdns = [for record in aws_acm_certificate.site[0].domain_validation_options : record.resource_record_name]
}
