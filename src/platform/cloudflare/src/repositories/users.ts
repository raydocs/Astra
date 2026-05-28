import type { D1Database } from "../bindings"
import { assertD1Success, fromSqlBoolean, parseJsonColumn, selectAll, serializeJsonColumn, toSqlBoolean } from "../lib/d1"
import type {
  ShadowUserCredentialRow,
  ShadowUserCredentialSnapshot,
  ShadowUserRow,
  ShadowUserSnapshot,
} from "../types/shadow-state"

interface ShadowUserDatabaseRow {
  id: string
  email: string
  billing_email: string
  created_at: string
  plan: ShadowUserRow["plan"]
  subscription_status: ShadowUserRow["subscriptionStatus"]
  identity_mode: ShadowUserRow["identityMode"]
  install_id: string | null
  provider_entitlements_json: string
  reading_history_sync_enabled: number | boolean
  study_progress_sync_enabled: number | boolean
  weekly_digest_sync_enabled?: number | boolean
  shadow_updated_at: string
}

interface ShadowUserCredentialDatabaseRow {
  user_id: string
  credential_kind: ShadowUserCredentialRow["credentialKind"]
  password_hash: string
  password_hash_alg: ShadowUserCredentialRow["passwordHashAlg"]
  updated_at: string
  shadow_updated_at: string
}

const SHADOW_USER_SELECT = `
  SELECT
    id,
    email,
    billing_email,
    created_at,
    plan,
    subscription_status,
    identity_mode,
    install_id,
    provider_entitlements_json,
    reading_history_sync_enabled,
    study_progress_sync_enabled,
    weekly_digest_sync_enabled,
    shadow_updated_at
  FROM shadow_users
`

const SHADOW_USER_CREDENTIAL_SELECT = `
  SELECT
    user_id,
    credential_kind,
    password_hash,
    password_hash_alg,
    updated_at,
    shadow_updated_at
  FROM shadow_user_credentials
`

function normalizeShadowUser(snapshot: ShadowUserSnapshot): ShadowUserRow {
  return {
    ...snapshot,
    installId: snapshot.installId ?? null,
    providerEntitlements: [...snapshot.providerEntitlements],
    syncPreferences: {
      reading_history: snapshot.syncPreferences.reading_history,
      study_progress: snapshot.syncPreferences.study_progress,
      weekly_digest: snapshot.syncPreferences.weekly_digest,
    },
    shadowUpdatedAt: snapshot.shadowUpdatedAt ?? new Date().toISOString(),
  }
}

function normalizeShadowUserCredential(
  snapshot: ShadowUserCredentialSnapshot,
): ShadowUserCredentialRow {
  return {
    ...snapshot,
    shadowUpdatedAt: snapshot.shadowUpdatedAt ?? snapshot.updatedAt,
  }
}

function mapShadowUserRow(row: ShadowUserDatabaseRow): ShadowUserRow {
  return {
    id: row.id,
    email: row.email,
    billingEmail: row.billing_email,
    createdAt: row.created_at,
    plan: row.plan,
    subscriptionStatus: row.subscription_status,
    identityMode: row.identity_mode,
    installId: row.install_id,
    providerEntitlements: parseJsonColumn(row.provider_entitlements_json, []),
    syncPreferences: {
      reading_history: fromSqlBoolean(row.reading_history_sync_enabled),
      study_progress: fromSqlBoolean(row.study_progress_sync_enabled),
      weekly_digest: row.weekly_digest_sync_enabled === undefined ? true : fromSqlBoolean(row.weekly_digest_sync_enabled),
    },
    shadowUpdatedAt: row.shadow_updated_at,
  }
}

function mapShadowUserCredentialRow(
  row: ShadowUserCredentialDatabaseRow,
): ShadowUserCredentialRow {
  return {
    userId: row.user_id,
    credentialKind: row.credential_kind,
    passwordHash: row.password_hash,
    passwordHashAlg: row.password_hash_alg,
    updatedAt: row.updated_at,
    shadowUpdatedAt: row.shadow_updated_at,
  }
}

export async function upsertShadowUser(
  db: D1Database,
  snapshot: ShadowUserSnapshot,
): Promise<ShadowUserRow> {
  const row = normalizeShadowUser(snapshot)

  const result = await db.prepare(`
    INSERT INTO shadow_users (
      id,
      email,
      billing_email,
      created_at,
      plan,
      subscription_status,
      identity_mode,
      install_id,
      provider_entitlements_json,
      reading_history_sync_enabled,
      study_progress_sync_enabled,
      weekly_digest_sync_enabled,
      shadow_updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      billing_email = excluded.billing_email,
      created_at = excluded.created_at,
      plan = excluded.plan,
      subscription_status = excluded.subscription_status,
      identity_mode = excluded.identity_mode,
      install_id = excluded.install_id,
      provider_entitlements_json = excluded.provider_entitlements_json,
      reading_history_sync_enabled = excluded.reading_history_sync_enabled,
      study_progress_sync_enabled = excluded.study_progress_sync_enabled,
      weekly_digest_sync_enabled = excluded.weekly_digest_sync_enabled,
      shadow_updated_at = excluded.shadow_updated_at
  `)
    .bind(
      row.id,
      row.email,
      row.billingEmail,
      row.createdAt,
      row.plan,
      row.subscriptionStatus,
      row.identityMode,
      row.installId,
      serializeJsonColumn(row.providerEntitlements),
      toSqlBoolean(row.syncPreferences.reading_history),
      toSqlBoolean(row.syncPreferences.study_progress),
      toSqlBoolean(row.syncPreferences.weekly_digest),
      row.shadowUpdatedAt,
    )
    .run()
  assertD1Success(result, "upsert shadow user")

  return row
}

export async function getShadowUserById(
  db: D1Database,
  userId: string,
): Promise<ShadowUserRow | null> {
  const row = await db.prepare<ShadowUserDatabaseRow>(`
    ${SHADOW_USER_SELECT}
    WHERE id = ?
  `)
    .bind(userId)
    .first<ShadowUserDatabaseRow>()

  return row ? mapShadowUserRow(row) : null
}

export async function getShadowUserByEmail(
  db: D1Database,
  email: string,
): Promise<ShadowUserRow | null> {
  const row = await db.prepare<ShadowUserDatabaseRow>(`
    ${SHADOW_USER_SELECT}
    WHERE email = ?
  `)
    .bind(email.trim())
    .first<ShadowUserDatabaseRow>()

  return row ? mapShadowUserRow(row) : null
}

export async function getShadowUserByInstallId(
  db: D1Database,
  installId: string,
): Promise<ShadowUserRow | null> {
  const row = await db.prepare<ShadowUserDatabaseRow>(`
    ${SHADOW_USER_SELECT}
    WHERE install_id = ?
  `)
    .bind(installId.trim())
    .first<ShadowUserDatabaseRow>()

  return row ? mapShadowUserRow(row) : null
}

export async function createShadowAnonymousUser(
  db: D1Database,
  snapshot: ShadowUserSnapshot,
): Promise<ShadowUserRow> {
  const row = normalizeShadowUser(snapshot)
  const result = await db.prepare(`
    INSERT INTO shadow_users (
      id,
      email,
      billing_email,
      created_at,
      plan,
      subscription_status,
      identity_mode,
      install_id,
      provider_entitlements_json,
      reading_history_sync_enabled,
      study_progress_sync_enabled,
      weekly_digest_sync_enabled,
      shadow_updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
    .bind(
      row.id,
      row.email,
      row.billingEmail,
      row.createdAt,
      row.plan,
      row.subscriptionStatus,
      row.identityMode,
      row.installId,
      serializeJsonColumn(row.providerEntitlements),
      toSqlBoolean(row.syncPreferences.reading_history),
      toSqlBoolean(row.syncPreferences.study_progress),
      toSqlBoolean(row.syncPreferences.weekly_digest),
      row.shadowUpdatedAt,
    )
    .run()
  assertD1Success(result, "create shadow anonymous user")

  return row
}

export async function upsertShadowUserCredential(
  db: D1Database,
  snapshot: ShadowUserCredentialSnapshot,
): Promise<ShadowUserCredentialRow> {
  const row = normalizeShadowUserCredential(snapshot)
  const result = await db.prepare(`
    INSERT INTO shadow_user_credentials (
      user_id,
      credential_kind,
      password_hash,
      password_hash_alg,
      updated_at,
      shadow_updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      credential_kind = excluded.credential_kind,
      password_hash = excluded.password_hash,
      password_hash_alg = excluded.password_hash_alg,
      updated_at = excluded.updated_at,
      shadow_updated_at = excluded.shadow_updated_at
  `)
    .bind(
      row.userId,
      row.credentialKind,
      row.passwordHash,
      row.passwordHashAlg,
      row.updatedAt,
      row.shadowUpdatedAt,
    )
    .run()
  assertD1Success(result, "upsert shadow user credential")

  return row
}

export async function getShadowUserCredential(
  db: D1Database,
  userId: string,
): Promise<ShadowUserCredentialRow | null> {
  const row = await db.prepare<ShadowUserCredentialDatabaseRow>(`
    ${SHADOW_USER_CREDENTIAL_SELECT}
    WHERE user_id = ?
  `)
    .bind(userId)
    .first<ShadowUserCredentialDatabaseRow>()

  return row ? mapShadowUserCredentialRow(row) : null
}

export async function listShadowUsers(
  db: D1Database,
  filters: {
    userId?: string
    email?: string
  } = {},
): Promise<ShadowUserRow[]> {
  const email = filters.email?.trim() || null
  const rows = await selectAll<ShadowUserDatabaseRow>(
    db,
    `
      ${SHADOW_USER_SELECT}
      WHERE
        (? IS NULL OR id = ?)
        AND (? IS NULL OR email = ?)
      ORDER BY created_at ASC, id ASC
    `,
    [filters.userId ?? null, filters.userId ?? null, email, email],
  )

  return rows.map(mapShadowUserRow)
}
