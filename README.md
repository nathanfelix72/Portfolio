# Portfolio

Static Next.js portfolio hosted on **S3 + CloudFront**, provisioned with **Terraform**, and deployed from **GitHub Actions** via IAM OIDC.

Live URL (CloudFront): https://d209qbrh7b6fyk.cloudfront.net

## Stack

- Next.js App Router with `output: "export"`
- Private S3 bucket + CloudFront Origin Access Control
- GitHub Actions → assume `portfolio-github-deploy` role (no long-lived AWS keys in GitHub)
- Local AWS CLI profile: `portfolio` (personal account `248189945218`)

## Local development

Screen changes locally before pushing to `main` (that deploys to CloudFront).

```powershell
npm install
npm run dev
```

Open http://localhost:3000 — hot reload while you edit.

### Production-like preview

This matches what S3/CloudFront serves (static export in `./out`):

```powershell
npm run preview
```

Open http://localhost:4173. Use this before merging visual or routing changes.

Build only (no server):

```powershell
npm run build
# output lands in ./out
```

## AWS CLI

Use the personal account profile only:

```powershell
aws sts get-caller-identity --profile portfolio
```

Do **not** use the `clearsky` profile for this project.

## Terraform

```powershell
$env:AWS_PROFILE = "portfolio"
cd terraform
terraform init
terraform plan
terraform apply
terraform output
```

Useful outputs:

| Output | Purpose |
|--------|---------|
| `cloudfront_url` | Public site URL |
| `bucket_name` | Deploy target for `aws s3 sync` |
| `cloudfront_distribution_id` | Cache invalidations |
| `github_actions_role_arn` | OIDC role for GitHub Actions |

Destroy everything:

```powershell
$env:AWS_PROFILE = "portfolio"
cd terraform
terraform destroy
```

## CI/CD

Push to `main` runs `.github/workflows/deploy.yml`:

1. `npm ci` + `npm run build`
2. Assume the GitHub OIDC IAM role
3. Sync `out/` to S3
4. Invalidate CloudFront

Repository variables (already set for this repo):

- `AWS_ROLE_ARN`
- `S3_BUCKET`
- `CLOUDFRONT_DISTRIBUTION_ID`

GitHub uses **immutable OIDC subjects** for this repo. The IAM trust policy matches:

`repo:nathanfelix72@131198703/Portfolio@1447445645:*`

Inspect with:

```powershell
gh api repos/nathanfelix72/Portfolio/actions/oidc/customization/sub
```

## Add a project

Edit `lib/projects.ts` and push to `main`.

## Add a custom domain later

1. Request an ACM certificate in **us-east-1**
2. Set Terraform variables:

```hcl
domain_name         = "yourdomain.com"
acm_certificate_arn = "arn:aws:acm:us-east-1:ACCOUNT:certificate/ID"
```

3. `terraform apply`, then point DNS (Route 53 or elsewhere) at the CloudFront distribution

No domain is purchased by this project.
