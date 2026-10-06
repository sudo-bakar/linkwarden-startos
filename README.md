<p align="center">
  <img src="icon.png" alt="Linkwarden Logo" width="21%">
</p>

# Linkwarden on StartOS

> Everything not listed in this document should behave the same as upstream
> Linkwarden. If a feature, setting, or behavior is not mentioned here, the
> upstream documentation is accurate and fully applicable — see the
> Documentation section of `instructions.md` for links.

Linkwarden is a collaborative bookmark manager that archives every link it
collects — screenshot, PDF, and a readability extract — and indexes the lot for
full-text search. This package bundles the three services upstream's Compose
file runs, generates their credentials, and derives the one origin the
application needs to know about itself.

- **Upstream repo:** <https://github.com/linkwarden/linkwarden>
- **Wrapper repo:** <https://github.com/Start9-Community/linkwarden-startos>

---

## Table of Contents

- [Image and Container Runtime](#image-and-container-runtime)
- [Volume and Data Layout](#volume-and-data-layout)
- [File Models](#file-models)
- [Dependencies](#dependencies)
- [Network Access and Interfaces](#network-access-and-interfaces)
- [Installation and First-Run Flow](#installation-and-first-run-flow)
- [Actions](#actions)
- [Tasks](#tasks)
- [Health Checks](#health-checks)
- [Backups and Restore](#backups-and-restore)
- [Limitations and Differences](#limitations-and-differences)
- [Quick Reference for AI Consumers](#quick-reference-for-ai-consumers)

---

## Image and Container Runtime

Three unmodified images, run as three daemons that share one network namespace.

| Property      | Value                                                                            |
| ------------- | -------------------------------------------------------------------------------- |
| Images        | `ghcr.io/linkwarden/linkwarden`, `postgres:16-alpine`, `getmeili/meilisearch`     |
| Architectures | x86_64, aarch64                                                                   |
| Commands      | each image's own entrypoint; Postgres gets one argument                           |

| Subcontainer  | Purpose                                                          |
| ------------- | ---------------------------------------------------------------- |
| `linkwarden`  | The application — web, archive worker, and migrations            |
| `postgres`    | The database                                                     |
| `meilisearch` | The search index                                                 |

The application image's own command applies the Prisma migrations and then
supervises the web server and the archive worker together, so migrations are
part of every startup rather than a separate oneshot, and the two sidecars have
to be ready before it runs. Its health check therefore allows a full minute:
first boot pays for the migrations and for Next.js warming up.

Postgres is started with `listen_addresses=127.0.0.1`, which keeps it inside
the shared namespace; the application reaches both sidecars on loopback. Neither
sidecar binds an interface, so neither is reachable from outside the service.

MeiliSearch's database files are version-locked to the binary that wrote them,
so the meilisearch daemon is started with
`MEILI_EXPERIMENTAL_DUMPLESS_UPGRADE=true`: after an image bump it upgrades the
`search` volume's index in place on first boot. The flag is a no-op on fresh
installs and on every later boot.

## Volume and Data Layout

Three volumes, one per service, because a backup strategy is chosen per volume
and the database needs a different one from the rest.

| Volume   | Mount Point           | Purpose                                        |
| -------- | --------------------- | ---------------------------------------------- |
| `main`   | `/data/data`          | Archived pages and uploads, plus `store.json`  |
| `db`     | `/var/lib/postgresql` | The PostgreSQL cluster                         |
| `search` | `/meili_data`         | The MeiliSearch index                          |

`main` is where the archive worker writes screenshots, PDFs, and readability
extracts, so it is the volume that grows with use.

## File Models

One model, holding what the application cannot generate for itself.

| Model        | File                          | Format |
| ------------ | ----------------------------- | ------ |
| `store.json` | `store.json` on `main`'s root | JSON   |

| Key                   | Seeded             | Rewritten by                       |
| --------------------- | ------------------ | ---------------------------------- |
| `pgPassword`          | generated at install | never                            |
| `nextAuthSecret`      | generated at install | never                            |
| `meiliMasterKey`      | generated at install | never                            |
| `primaryUrl`          | `""` at install    | **Set Primary URL**                |
| `disableRegistration` | `false` at install | **Disable / Enable Registration**  |

Seeding runs on install only. The three secrets must not be regenerated on any
other path: the `db` volume holds a cluster initialized with `pgPassword`, and
`nextAuthSecret` signs every live session — a restore that minted new ones would
lock the service out of its own data.

Everything the application reads is delivered as an environment variable
assembled from those keys — `DATABASE_URL`, `MEILI_HOST`, `MEILI_MASTER_KEY`,
`NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and the `NEXT_PUBLIC_*` flags. Linkwarden
keeps its own settings in its database, and the package never writes there. The
one variable worth understanding is `NEXT_PUBLIC_DISABLE_REGISTRATION`: the
name is a Next.js build-time convention, but the signup API reads it from the
process environment on each request, so toggling it takes effect on the server
as soon as the container restarts.

## Dependencies

None. PostgreSQL and MeiliSearch are bundled as private sidecars rather than
declared as StartOS dependencies, so nothing else needs installing and neither
is shared with another service.

## Network Access and Interfaces

One interface. The sidecars are not exposed.

| Interface     | Id   | Type | Port | Description                             |
| ------------- | ---- | ---- | ---- | --------------------------------------- |
| Web Interface | `ui` | ui   | 3000 | The Linkwarden UI, and its REST API     |

`NEXTAUTH_URL` is derived from this interface's enabled addresses — a publicly
reachable one first, then any non-local one, then loopback so the application
can start at all. The value is resolved when the daemon starts, so a service
that has just gained or lost an address may need a restart before the derived
origin follows. An origin pinned through the **Set Primary URL** action is
applied immediately.

## Installation and First-Run Flow

Credentials are generated at install and never shown, because they are internal
to the service — the user needs none of them.

What the user does need to do is claim the administrator account. Linkwarden has
no way to provision one from outside the application, so registration is open on
a fresh install and **the first account created becomes the administrator**. An
`important` task says so and points at the action that closes registration
afterwards.

Database migrations run as part of every startup, so there is no first-run step
to wait on beyond the health check going green.

## Actions

Three actions, none of which an ordinary day needs.

**Disable / Enable Registration** (`toggle-registration`)

- **When to run it** — immediately after claiming the administrator account, to
  close public signup. Later, only if you want to reopen it.
- **What it changes** — `disableRegistration` in `store.json`, and through it
  the signup API's behavior. No application data is touched.
- **Cost** — a container restart, a few seconds.
- **Repeat safety** — safe to repeat; each run flips the state. The action
  renames itself to whichever direction is currently available, so there is no
  way to run it twice in the same direction.
- **Outputs** — a confirmation of the new state.

Closing registration does not prevent the administrator from adding people: the
signup endpoint still accepts a request authenticated as the admin, which is how
Linkwarden's own user management adds accounts.

**Set Primary URL** (`set-primary-url`)

- **When to run it** — only when using SSO or OAuth. The identity provider
  validates the callback URL against the domain registered with it, so the
  origin has to be pinned rather than derived. Password login never needs this.
- **What it changes** — `primaryUrl` in `store.json`, and through it
  `NEXTAUTH_URL`.
- **Cost** — a container restart, a few seconds.
- **Repeat safety** — idempotent; choosing **Auto** clears the pin and returns
  to derivation.
- **Outputs** — the origin now in effect.

The input is a dropdown of the `ui` interface's currently reachable non-local
addresses, built when the form opens.

**Reset Admin Password** (`reset-password`)

- **When to run it** — the administrator has lost their password. With no SMTP
  configured there is no reset email, and Linkwarden has no CLI, so without this
  the account is unreachable.
- **What it changes** — the `password` column of the administrator's row, via
  the application's own Prisma client and bcrypt. No other account and nothing
  else in the database is touched.
- **Cost** — seconds, with no interruption. The service must be **running**,
  because the database is a sidecar rather than a file on a volume.
- **Repeat safety** — safe to repeat; each run mints a new password and
  invalidates the previous one.
- **What happens next** — sign in with the credentials returned. Sessions are
  JWTs signed by a separate secret, so anyone already signed in stays signed
  in, exactly as on an ordinary password change.
- **Outputs** — the account's username, and the new password, masked and
  copyable. It is shown once per run.

## Tasks

Two tasks, neither of which blocks the service.

| Task                 | Severity    | Raised by      | Cleared by             |
| -------------------- | ----------- | -------------- | ---------------------- |
| Disable Registration | `important` | Install only   | Running the action     |
| Set Primary URL      | `optional`  | Every init     | Running the action     |

The registration prompt is raised once, at install, because it is about claiming
the administrator account — a thing that happens exactly once in an install's
life. The Primary URL prompt is a standing reminder for SSO users; it is raised
on every init, and because the replay key is stable, satisfying it once keeps it
satisfied.

## Health Checks

Three checks, one per daemon, ordered so the application waits for its
dependencies.

| Check         | Displayed       | Method                            | Grace |
| ------------- | --------------- | --------------------------------- | ----- |
| `postgres`    | hidden          | `pg_isready` inside the container | —     |
| `meilisearch` | hidden          | the index port is listening       | 60 s  |
| `linkwarden`  | "Web Interface" | HTTP GET on the internal port     | 60 s  |

Only the application's check is shown, because the sidecars are an
implementation detail the user cannot act on. An HTTP probe rather than a port
check catches "listening but still compiling".

The meilisearch check allows a full minute because an in-place index upgrade —
which runs before the HTTP server binds — can outlast the default grace period
on a large index.

A `linkwarden` failure that outlasts the grace period is usually a failed
migration — the service logs carry the Prisma error. If it never goes green at
all and the logs show connection refusals, one of the two hidden checks is the
one to look at, since the application starts only once both report ready.

## Backups and Restore

Mixed, because one of the three volumes is a live database.

- **`db` is dumped, not copied.** `sdk.Backups.withPgDump` runs `pg_dump`
  against the cluster and captures the dump; the cluster's files are never in
  the backup. A restore reconstructs the database by starting Postgres and
  replaying it.
- **`main` and `search` are copied wholesale.** Archives, uploads,
  `store.json`, and the search index.

The database password needed for the dump is read lazily, so on restore it comes
from the `store.json` that has just been restored rather than from a default.

A restored instance is complete: accounts, collections, links, archives, and the
search index all come back, and the startup migrations are idempotent so the
first boot after a restore behaves like any other.

## Limitations and Differences

1. **No administrator is provisioned.** Upstream offers no way to create one
   from outside the application, so the first account to register takes the
   role.
2. **SSO provider credentials cannot be configured.** `GITHUB_ID`,
   `GOOGLE_CLIENT_SECRET`, and the rest are environment variables this package
   does not expose, so SSO cannot be completed from StartOS alone.
3. **SMTP is not configured.** Email-based features — invitations, password
   reset by email — are unavailable. The **Reset Admin Password** action covers
   the administrator; there is no self-service reset for anyone else.
4. **Archive storage is local only.** Upstream can offload archives to S3-compatible
   storage; this package always writes them to the `main` volume.
5. **Sessions are bound to a secure origin.** NextAuth issues
   `__Secure-`-prefixed cookies against the derived HTTPS origin, so a sign-in
   attempted over plain HTTP against the container's own port succeeds with no
   session cookie set. Use the real interface address.
6. **Archives are backed up in full.** The `main` volume is copied rather than
   synced incrementally, so backup size tracks total archive size.

---

## Quick Reference for AI Consumers

```yaml
package_id: linkwarden
image: ghcr.io/linkwarden/linkwarden # plus postgres and getmeili/meilisearch sidecars
architectures:
  - x86_64
  - aarch64
subcontainers:
  - linkwarden # the application
  - postgres # database sidecar
  - meilisearch # search sidecar
volumes:
  main: /data/data
  db: /var/lib/postgresql
  search: /meili_data
file_models:
  - store.json
startos_managed_env_vars:
  - NEXTAUTH_URL
  - NEXTAUTH_SECRET
  - DATABASE_URL
  - MEILI_HOST
  - MEILI_MASTER_KEY
  - MEILI_EXPERIMENTAL_DUMPLESS_UPGRADE
  - NEXT_PUBLIC_DISABLE_REGISTRATION
  - NEXT_PUBLIC_CREDENTIALS_ENABLED
  - NEXT_PUBLIC_ADMIN
  - POSTGRES_USER
  - POSTGRES_PASSWORD
  - POSTGRES_DB
dependencies: []
interfaces:
  ui: { type: ui, port: 3000 }
actions:
  - toggle-registration
  - set-primary-url
  - reset-password
tasks:
  - { action: toggle-registration, severity: important }
  - { action: set-primary-url, severity: optional }
health_checks:
  - postgres # hidden
  - meilisearch # hidden
  - linkwarden # displayed "Web Interface"
```
