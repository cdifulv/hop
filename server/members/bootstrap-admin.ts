/**
 * The Bootstrap admin (ADR-0001) is a deploy-time email/password credential,
 * not a person authenticated by the Deployment's Identity provider. The
 * `members` table still keys every Member on (issuer, subject), so the
 * Bootstrap admin's row uses this sentinel issuer with the Better Auth user id
 * as its subject. Real Identity provider issuers are URLs, so the sentinel
 * never collides with a genuine one.
 */
export const bootstrapIdentityProviderIssuer = "bootstrap"
