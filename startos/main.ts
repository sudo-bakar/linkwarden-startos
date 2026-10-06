import { i18n } from './i18n'
import { sdk } from './sdk'
import { storeJson } from './fileModels/store.json'
import { adminUserId, databaseUrl, meiliPort, uiPort } from './utils'

export const main = sdk.setupMain(async ({ effects }) => {
  console.info(i18n('Starting Linkwarden'))

  // Read field-by-field so a registration toggle or URL pin rebuilds only the
  // linkwarden daemon and leaves the sidecars running.
  const pgPassword = await storeJson.read((s) => s.pgPassword).const(effects)
  const meiliKey = await storeJson.read((s) => s.meiliMasterKey).const(effects)
  const lwStore = await storeJson
    .read((s) => ({
      nextAuthSecret: s.nextAuthSecret,
      primaryUrl: s.primaryUrl,
      disableReg: s.disableRegistration,
    }))
    .const(effects)

  if (!pgPassword || !meiliKey || !lwStore) {
    throw new Error(
      'store.json is not initialized: internal secrets missing. Reinstall the package.',
    )
  }

  // The image sets NODE_ENV=production, under which NextAuth refuses to start
  // without NEXTAUTH_URL — hence the loopback fallback.
  const uiInterface = await sdk.host
    .getOwn(effects, 'ui', (h) => h?.bindings[uiPort]?.interfaces['ui'] ?? null)
    .const()
  const addressInfo = uiInterface?.addressInfo ?? null
  const first = (list: string[] | undefined) => list?.[0] ?? null
  const derivedOrigin =
    first(addressInfo?.public.format('urlstring')) ??
    first(addressInfo?.nonLocal.format('urlstring')) ??
    `http://localhost:${uiPort}`
  const chosenOrigin = lwStore.primaryUrl || derivedOrigin
  const nextAuthUrl = `${chosenOrigin}/api/v1/auth`

  const pgSub = sdk.SubContainer.of(
    effects,
    { imageId: 'postgres' },
    sdk.Mounts.of().mountVolume({
      volumeId: 'db',
      subpath: null,
      mountpoint: '/var/lib/postgresql',
      readonly: false,
    }),
    'postgres',
  )
  const meiliSub = sdk.SubContainer.of(
    effects,
    { imageId: 'meilisearch' },
    sdk.Mounts.of().mountVolume({
      volumeId: 'search',
      subpath: null,
      mountpoint: '/meili_data',
      readonly: false,
    }),
    'meilisearch',
  )
  const lwSub = sdk.SubContainer.of(
    effects,
    { imageId: 'linkwarden' },
    sdk.Mounts.of().mountVolume({
      volumeId: 'main',
      subpath: null,
      mountpoint: '/data/data',
      readonly: false,
    }),
    'linkwarden',
  )

  return (
    sdk.Daemons.of(effects)
      // docker-entrypoint.sh prepends `postgres` when the first arg starts
      // with `-`, so this keeps the DB on the shared netns loopback.
      .addDaemon('postgres', {
        subcontainer: pgSub,
        exec: {
          command: sdk.useEntrypoint(['-c', 'listen_addresses=127.0.0.1']),
          env: {
            POSTGRES_USER: 'postgres',
            POSTGRES_PASSWORD: pgPassword,
            POSTGRES_DB: 'postgres',
          },
        },
        ready: {
          display: null,
          fn: async () => {
            const r = await pgSub.exec([
              'pg_isready',
              '-q',
              '-h',
              '127.0.0.1',
              '-U',
              'postgres',
              '-d',
              'postgres',
            ])
            return r.exitCode === 0
              ? { result: 'success', message: i18n('PostgreSQL is ready') }
              : { result: 'loading', message: i18n('Waiting for PostgreSQL') }
          },
        },
        requires: [],
      })
      .addDaemon('meilisearch', {
        subcontainer: meiliSub,
        exec: {
          command: sdk.useEntrypoint(),
          env: {
            MEILI_MASTER_KEY: meiliKey,
            // MeiliSearch database files are version-locked; on first boot
            // after an image bump this upgrades the volume's index in place.
            // A no-op on fresh installs and on every later boot.
            MEILI_EXPERIMENTAL_DUMPLESS_UPGRADE: 'true',
          },
        },
        ready: {
          display: null,
          // The upgrade runs before the HTTP server binds, so a large index
          // can delay readiness past the default grace period.
          gracePeriod: 60_000,
          fn: () =>
            sdk.healthCheck.checkPortListening(effects, meiliPort, {
              successMessage: i18n('MeiliSearch is ready'),
              errorMessage: i18n('Starting MeiliSearch'),
            }),
        },
        requires: [],
      })
      // The image's CMD runs `prisma migrate deploy` before starting web and
      // worker, so migrations need no oneshot but the sidecars must be up.
      .addDaemon('linkwarden', {
        subcontainer: lwSub,
        exec: {
          command: sdk.useEntrypoint(),
          env: {
            NEXTAUTH_URL: nextAuthUrl,
            NEXTAUTH_SECRET: lwStore.nextAuthSecret,
            DATABASE_URL: databaseUrl(pgPassword),
            MEILI_HOST: `http://127.0.0.1:${meiliPort}`,
            MEILI_MASTER_KEY: meiliKey,
            // Baked into the client bundle at build time; flipping it here
            // gates the signup API server-side only.
            NEXT_PUBLIC_DISABLE_REGISTRATION: lwStore.disableReg
              ? 'true'
              : 'false',
            NEXT_PUBLIC_CREDENTIALS_ENABLED: 'true',
            NEXT_PUBLIC_ADMIN: String(adminUserId),
          },
        },
        ready: {
          display: i18n('Web Interface'),
          gracePeriod: 60_000,
          fn: () =>
            sdk.healthCheck.checkWebUrl(
              effects,
              `http://127.0.0.1:${uiPort}/`,
              {
                successMessage: i18n('The web interface is ready'),
                errorMessage: i18n('The web interface is not ready'),
              },
            ),
        },
        requires: ['postgres', 'meilisearch'],
      })
  )
})
