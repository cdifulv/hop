# hop

A self-hosted URL shortener. One deployment serves a single organization. Anyone can shorten a URL without signing in; signing in lets a person see and manage the links they created.

## Language

**Deployment**:
A single self-hosted instance of hop, serving one organization and one short domain.
_Avoid_: tenant, server, environment

**Short domain**:
The bare domain a Deployment issues short links under and resolves redirects on (e.g. `acme.com/leap-204`). Serves redirects only — no app UI. One per Deployment.

**App domain**:
The separate host serving the hop application: dashboard, sign-in, admin, and API (e.g. `app.acme.com`). Distinct from the Short domain so Slugs never collide with app routes. One per Deployment.
_Avoid_: dashboard URL, web host

**Link**:
A mapping from a Slug to a Destination, optionally with an Expiration. The product UI calls this a "hop". Immutable except for Expiration — Slug and Destination are fixed at creation; "changing" a Link means deleting it and creating a new one.
_Avoid_: URL (ambiguous — could mean Destination), redirect

**Slug**:
The path segment after the Short domain that identifies a Link (e.g. `leap-204` in `acme.com/leap-204`). Unique across the entire Deployment and permanent: once used, a Slug is never reissued, even after its Link is deleted.
When not supplied, hop auto-generates a short random base62 code. Custom Slugs allow letters, digits, and hyphens, are matched case-insensitively, and run ~3–64 chars.
_Avoid_: short code, alias, path, key

**Tombstone**:
The retained marker for a deleted Link's Slug. Keeps the Slug retired and lets a visitor to a deleted Link see a "no longer available" page rather than a bare 404.
_Avoid_: soft delete, archive

**Destination**:
The long target URL a Link redirects to. Must be http or https; URLs resolving to private, loopback, link-local, or cloud-metadata addresses are rejected.
_Avoid_: long URL, original URL, target

**Expiration**:
An optional point after which a Link no longer resolves. Mutable: the owner can extend or remove it, including re-activating an already-Expired Link.
_Avoid_: TTL, expiry date (use Expiration), timeout

**Expired**:
The state of a Link past its Expiration: it no longer redirects, and a visitor sees a distinct "expired" page (not a 404). The Link record and its stats are retained indefinitely; nothing is auto-deleted.

**Suspended**:
A reversible Admin-imposed halt in which a Link stops resolving. Suspension comes from two independent sources: an Admin Suspends a Link **directly**, or Suspends its owning **Member**, which cascades to every Link they own. The two are **layers**, not alternatives — both can apply to one Link at once, and lifting one never lifts the other. A Link resolves again only once **every** Suspension layer on it has been lifted. Unlike a Tombstone, Suspension does not retire the Slug — the mapping is intact, just halted. Distinct from deletion, which is separate and permanent.
_Avoid_: banned, blocked, disabled (use Suspended), deactivated

**Suspended Member**:
A Member an Admin has suspended: it takes effect immediately — existing sessions are invalidated (forced sign-out on next request) and they cannot sign in again (regardless of the Identity provider), and every Link they own is Suspended for the duration. Reversible by an Admin. Only a non-Admin Member can be Suspended — an Admin must be Demoted first, so a Suspended Member is never also an Admin — and an Admin can never Suspend their own account.

**Member**:
A signed-in person, identified by their stable Identity provider subject (not their email — email is display metadata and may change without affecting identity or Link ownership). Anyone the Deployment's Identity provider successfully authenticates becomes a Member on first sign-in — there is no separate eligibility step; eligibility is whatever the operator scopes the Identity provider to. hop holds no member passwords. A Member can see and manage the Links they created. Membership is personal — one account, no teams or shared management.
_Avoid_: user, workspace, owner, account

**Admin**:
A Member with elevated rights: configures the Deployment (Identity provider, Short domain), can view and delete any Link including the Anonymous pool, can view the Deployment's Members, and can disable anonymous Link creation entirely (a kill switch; redirects keep working). Anonymous creation is rate-limited per source regardless. An Admin does not gate Membership — that is delegated to the Identity provider's own scoping.
_Avoid_: operator (the operator deploys infra; an Admin administers from within the app), superuser, root

**Moderation**:
An Admin's explicit intervention on a Link or Member to stop abuse: **Suspending** (a reversible halt) or deleting a Link (permanent, leaving a **Tombstone**). Suspending a **Member** cascades as one act — their status flips to Suspended, every Link they own is Suspended, and their existing sessions are invalidated immediately. Moderation is always an explicit Admin act, never an automatic side effect (in particular, never a consequence of Identity-provider removal).
_Avoid_: ban, takedown, blocklist (use Suspend / delete), auto-moderation

**Identity provider**:
The external OIDC/SSO system a Deployment delegates Member authentication to. Configured in-app by an Admin — issuer, client ID, and client secret — one per Deployment. The issuer anchors Member identity (a Member is keyed on issuer + Identity provider subject), so it is fixed once the first SSO Member has signed in; client ID and client secret stay editable, but changing the issuer thereafter would detach every existing Member from their Links. The client secret is a deployment-to-Identity-provider **service credential**, not a human login password; hop stores it encrypted at rest in the database, decryptable only with a master key supplied to the Deployment as an environment variable.
_Avoid_: IdP (spell it out), auth server

**Bootstrap admin**:
A one-time, deploy-time local credential that lets the very first Admin sign in to configure the Identity provider and promote the first SSO Admin. Automatically and permanently disabled once the Identity provider is active *and* at least one non-bootstrap Admin exists; the only human login password hop ever holds — distinct from the Identity provider client secret, a service credential hop stores encrypted.
_Avoid_: root account, default admin

**Click event**:
One successful redirect of a Link, recorded as an event with a timestamp, coarse referrer, and user-agent family — never a raw IP or other PII. A Link's "click count" is derived by aggregating its Click events. Subject to a retention window.
_Avoid_: hit, visit, view, click (the count) vs Click event (the record) — keep them distinct

**Anonymous visitor**:
Someone using hop without signing in. Can create Links and follow them, but has no persistent view of Links they created.

**Anonymous pool**:
The set of Links created by Anonymous visitors that have not been Claimed. Distinct from Links owned by a Member, though all Links share one global Slug namespace.

**Browser session**:
The per-browser tracking that lets an Anonymous visitor see and manage the Links they created on that browser, before signing in. Not portable across devices.

**Claim**:
The one-time act, at sign-in, of attaching the Links tracked in the current Browser session to the signing-in Member. A Claimed Link leaves the Anonymous pool and is owned by that Member thereafter.

## Relationships

- A **Deployment** has exactly one **Short domain** (redirects) and one **App domain** (the app), on different hosts
- A **Link** has exactly one **Slug** and one **Destination**, and optionally one **Expiration**
- Every **Slug** is unique across the whole **Deployment** (across all **Members** and the **Anonymous pool**) and is never reissued; deleting a Link leaves a **Tombstone**
- Any person the **Identity provider** authenticates becomes a **Member** on first sign-in; there is no separate eligibility gate
- An **Admin** is a **Member** with Deployment-wide configuration and Link-moderation rights; Admin is granted in-app — the **Bootstrap admin** promotes the first Admin(s), and Admins promote/demote other **Members** thereafter
- An **Admin** can **Suspend** a single **Link** (including one in the **Anonymous pool**) or a whole **Member** (cascading to all their Links); Suspension is reversible and does not retire the **Slug**, unlike deletion (**Tombstone**). Direct-Link and Member-cascade Suspension are independent layers — a Link stays Suspended until every layer on it is lifted
- Removal from the **Identity provider** is passive: the person can no longer sign in, but their **Links** keep resolving and are not Suspended — only an Admin Suspends
- A **Link** is owned by at most one **Member**; unowned Links are in the **Anonymous pool**
- A **Link** accumulates many **Click events**; its click count is their aggregate
- An **Anonymous visitor** manages their Links only within the **Browser session** that created them
- Signing in **Claims** the current **Browser session**'s Links into the **Member**; Claiming is one-way and irreversible

## Example dialogue

> **Dev:** "Someone made a Link while logged out, then signs in next week on their laptop. Do they get it back?"
> **Domain expert:** "Only if it's the same browser — Claiming pulls in the Links tracked in that Browser session. Different device, it stays in the Anonymous pool. They can't retroactively pull in anonymous Links from elsewhere."
>
> **Dev:** "A Member deletes a Link. Can they recreate it on the same Slug if they made a typo in the Destination?"
> **Domain expert:** "No. Slug and Destination are immutable, and a deleted Slug is retired forever — there's a Tombstone. They pick a new Slug. That's the price of guaranteeing a circulated short link never changes meaning."
>
> **Dev:** "An Admin opens the Anonymous pool and sees a sketchy Link. Expired ones too?"
> **Domain expert:** "Yes — Expired Links keep their record and Click events, they just stop resolving and show an expired page. The Admin can delete it; that turns it into a Tombstone."
>
> **Dev:** "An Admin Suspends one bad Link of Dana's, then later Suspends Dana entirely. They clear Dana and un-suspend her. Does that one Link come back?"
> **Domain expert:** "No. Suspending Dana added a Member-cascade layer on top of that Link's own direct Suspension. Un-suspending Dana lifts only the cascade layer — the direct Suspension the Admin put on that one Link is still there. It stays halted until the Admin lifts that one too."

## Flagged ambiguities

- "workspace" (used throughout the demo UI: "Workspace links", "6 links in this workspace") implies a shared team space. Resolved: membership is **personal** — a Member only ever sees their own Links. "Workspace" is UI copy, not a domain concept; prefer **Member** and "their Links".
- "URL" is overloaded — it means both the **Destination** (long) and the short link. Resolved: **Link** = the short mapping, **Destination** = the long target.
- "hop" is both the product name and the demo's noun for a **Link** ("Recent hops"). Resolved: domain term is **Link**; "hop" is product/UI branding only.
- "who may become a Member" was previously described as an Admin-controlled lever. Resolved: there is **no in-app eligibility gate** — successful Identity provider authentication is sufficient to be a Member. Eligibility is whatever the operator scopes the Identity provider/OIDC client to.
