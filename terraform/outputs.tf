output "bucket_name" {
  description = "S3 bucket that stores the static site."
  value       = aws_s3_bucket.site.bucket
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID for cache invalidations."
  value       = aws_cloudfront_distribution.site.id
}

output "cloudfront_domain_name" {
  description = "CloudFront domain name."
  value       = aws_cloudfront_distribution.site.domain_name
}

output "cloudfront_url" {
  description = "HTTPS URL for the site."
  value       = "https://${aws_cloudfront_distribution.site.domain_name}"
}

output "github_actions_role_arn" {
  description = "IAM role ARN assumed by GitHub Actions via OIDC."
  value       = aws_iam_role.github_deploy.arn
}

output "aws_account_id" {
  description = "AWS account hosting this portfolio."
  value       = data.aws_caller_identity.current.account_id
}

output "acm_certificate_arn" {
  description = "ACM certificate ARN in us-east-1 (empty until a domain is configured)."
  value       = try(aws_acm_certificate.site[0].arn, null)
}

output "acm_validation_records" {
  description = "Add these CNAME records in Cloudflare to validate the ACM certificate."
  value = local.enable_custom_domain ? [
    for option in aws_acm_certificate.site[0].domain_validation_options : {
      name  = option.resource_record_name
      type  = option.resource_record_type
      value = option.resource_record_value
    }
  ] : []
}

output "cloudflare_site_records" {
  description = "After the cert is issued, point these Cloudflare records at CloudFront (DNS only / grey cloud)."
  value = local.enable_custom_domain ? {
    apex = {
      type  = "CNAME"
      name  = "@"
      value = aws_cloudfront_distribution.site.domain_name
    }
    www = var.include_www ? {
      type  = "CNAME"
      name  = "www"
      value = aws_cloudfront_distribution.site.domain_name
    } : null
  } : null
}
