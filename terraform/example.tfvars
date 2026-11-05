aws_region   = "us-west-1"
aws_profile  = "portfolio"
project_name = "portfolio"
github_owner = "nathanfelix72"
github_repo  = "Portfolio"
github_branch = "main"
# Immutable OIDC subjects from: gh api repos/OWNER/REPO/actions/oidc/customization/sub
github_oidc_sub_prefixes = [
  "repo:nathanfelix72@131198703/Portfolio@1447445645:*",
  "repo:nathanfelix72@131198703/Legoize@1447471741:*",
]

domain_name                     = "nathanfelix72.com"
include_www                     = true
# First apply with false, add ACM CNAMEs in Cloudflare, then set true and apply again.
wait_for_certificate_validation = false
