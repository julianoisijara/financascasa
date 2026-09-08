import { shell, safeStorage } from 'electron'
import * as http from 'http'
import { randomBytes } from 'crypto'
import { OAuth2Client, CodeChallengeMethod, type Credentials } from 'google-auth-library'
import { google, type drive_v3 } from 'googleapis'
import { DATA_FILE_NAME, readConfig, updateGoogleConfig } from './config'

/**
 * Integração com a API do Google Drive.
 *
 * Fluxo de autenticação: OAuth 2.0 "Desktop app" com PKCE e redirecionamento
 * para um servidor HTTP local (loopback), que é o fluxo recomendado pelo Google
 * para aplicativos instalados. O refresh token é guardado criptografado com o
 * `safeStorage` do Electron (Keychain no macOS, DPAPI no Windows).
 *
 * O finance-data.json fica na pasta escolhida pelo usuário (padrão
 * "Meu Drive/FinancasCasa"). O escopo completo do Drive é exigido para listar e
 * usar pastas que o app não criou.
 */

// Escopo completo do Drive: necessário para listar as pastas do usuário e
// guardar o arquivo em qualquer pasta (drive.file só enxerga o que o app criou).
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive'
const SCOPES = [DRIVE_SCOPE, 'https://www.googleapis.com/auth/userinfo.email']
const FOLDER_NAME = 'FinancasCasa'
const FOLDER_MIME = 'application/vnd.google-apps.folder'
const AUTH_TIMEOUT_MS = 5 * 60 * 1000

export interface GoogleCredentials {
  clientId: string
  clientSecret?: string
}

export interface DriveStatus {
  /** Há Client ID configurado (env de build ou Configurações) */
  configured: boolean
  /** Há refresh token guardado */
  connected: boolean
  email?: string
  /** Client ID veio do build (.env), não das Configurações */
  credentialsFromBuild: boolean
  clientId?: string
  /** Pasta do Drive em uso, para exibição */
  folderPath?: string
  /** Login feito com escopo antigo: precisa reconectar para escolher pasta */
  needsReconnect: boolean
  /** Nome do arquivo em uso (pode diferir ao usar um arquivo compartilhado) */
  fileName: string
}

export interface DriveEntry {
  id: string
  name: string
  kind: 'folder' | 'file'
}

/** ID virtual da raiz "Compartilhados comigo" no seletor. */
export const SHARED_ROOT = 'shared'
const SHARED_LABEL = 'Compartilhados comigo'
const DATA_FILE_QUERY = `(mimeType = 'application/json' or name contains '.json')`

// ─── Credenciais ───

function buildCredentials(): GoogleCredentials | null {
  const clientId = import.meta.env.MAIN_VITE_GOOGLE_CLIENT_ID as string | undefined
  const clientSecret = import.meta.env.MAIN_VITE_GOOGLE_CLIENT_SECRET as string | undefined
  if (clientId && clientId.trim()) return { clientId: clientId.trim(), clientSecret }
  return null
}

export function getCredentials(): GoogleCredentials | null {
  const cfg = readConfig().google
  if (cfg?.clientId && cfg.clientId.trim()) {
    return { clientId: cfg.clientId.trim(), clientSecret: cfg.clientSecret?.trim() || undefined }
  }
  return buildCredentials()
}

export function setCredentials(clientId: string, clientSecret?: string): void {
  updateGoogleConfig({
    clientId: clientId.trim() || undefined,
    clientSecret: clientSecret?.trim() || undefined,
    // Credenciais novas invalidam a sessão antiga
    tokens: undefined,
    email: undefined,
    fileId: undefined,
    folderId: undefined,
    folderPath: undefined,
    scope: undefined
  })
}

// ─── Tokens (criptografados) ───

const PLAIN_PREFIX = 'plain:'

function encryptTokens(tokens: Credentials): string {
  const json = JSON.stringify(tokens)
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(json).toString('base64')
  }
  // Linux sem keyring: guarda em texto, marcado, para não quebrar a leitura.
  console.warn('[GDrive] safeStorage indisponível; token guardado sem criptografia')
  return PLAIN_PREFIX + Buffer.from(json, 'utf-8').toString('base64')
}

function decryptTokens(stored: string): Credentials | null {
  try {
    if (stored.startsWith(PLAIN_PREFIX)) {
      return JSON.parse(Buffer.from(stored.slice(PLAIN_PREFIX.length), 'base64').toString('utf-8'))
    }
    if (!safeStorage.isEncryptionAvailable()) return null
    return JSON.parse(safeStorage.decryptString(Buffer.from(stored, 'base64')))
  } catch (err) {
    console.error('[GDrive] falha ao ler token guardado:', err)
    return null
  }
}

function loadTokens(): Credentials | null {
  const stored = readConfig().google?.tokens
  return stored ? decryptTokens(stored) : null
}

function saveTokens(tokens: Credentials): void {
  updateGoogleConfig({ tokens: encryptTokens(tokens) })
}

export function isConnected(): boolean {
  return !!loadTokens()?.refresh_token
}

export function getStatus(): DriveStatus {
  const creds = getCredentials()
  const cfg = readConfig().google
  return {
    configured: !!creds,
    connected: isConnected(),
    email: cfg?.email,
    credentialsFromBuild: !cfg?.clientId && !!buildCredentials(),
    clientId: cfg?.clientId,
    folderPath: cfg?.folderPath ?? `Meu Drive/${FOLDER_NAME}`,
    fileName: cfg?.fileName ?? DATA_FILE_NAME,
    needsReconnect: isConnected() && !(cfg?.scope ?? '').split(' ').includes(DRIVE_SCOPE)
  }
}

// ─── Erros ───

export class DriveError extends Error {
  constructor(
    message: string,
    public readonly kind: 'not-configured' | 'not-connected' | 'offline' | 'auth' | 'other'
  ) {
    super(message)
  }
}

interface GaxiosLikeError {
  code?: string | number
  message?: string
  response?: { status?: number; data?: { error?: string | { message?: string } } }
}

const OFFLINE_CODES = new Set([
  'ENOTFOUND',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'ENETDOWN'
])

/** Converte erros da API/rede em mensagens pt-BR e no tipo DriveError. */
export function toDriveError(err: unknown): DriveError {
  if (err instanceof DriveError) return err
  const e = err as GaxiosLikeError | null
  const code = typeof e?.code === 'string' ? e.code : undefined
  const status = e?.response?.status ?? (typeof e?.code === 'number' ? e.code : undefined)
  const apiError = e?.response?.data?.error
  const apiMessage = typeof apiError === 'string' ? apiError : apiError?.message

  if (code && OFFLINE_CODES.has(code)) {
    return new DriveError(
      'Sem conexão com o Google Drive. Verifique sua internet e tente novamente.',
      'offline'
    )
  }
  if (apiMessage === 'invalid_grant' || status === 401) {
    return new DriveError(
      'A sessão com o Google expirou ou foi revogada. Conecte sua conta novamente em Configurações.',
      'auth'
    )
  }
  if (status === 403 && /insufficient/i.test(apiMessage ?? '')) {
    return new DriveError(
      'A conta foi conectada com uma permissão antiga. Desconecte e conecte a conta Google novamente para poder escolher a pasta.',
      'auth'
    )
  }
  if (status === 403) {
    return new DriveError(
      `O Google negou o acesso (${apiMessage ?? '403'}). Confira se a API do Google Drive está ativada no projeto do Google Cloud e se sua conta foi adicionada como usuário de teste.`,
      'auth'
    )
  }
  if (status === 404) {
    return new DriveError('O arquivo não foi encontrado no Google Drive.', 'other')
  }
  return new DriveError(apiMessage ?? e?.message ?? String(err), 'other')
}

// ─── Cliente OAuth ───

function createClient(redirectUri?: string): OAuth2Client {
  const creds = getCredentials()
  if (!creds) {
    throw new DriveError(
      'O Google Drive ainda não foi configurado. Informe o Client ID do Google Cloud em Configurações.',
      'not-configured'
    )
  }
  return new OAuth2Client({
    clientId: creds.clientId,
    clientSecret: creds.clientSecret,
    redirectUri
  })
}

/** Cliente autenticado com o refresh token guardado. */
function getAuthedClient(): OAuth2Client {
  const tokens = loadTokens()
  if (!tokens?.refresh_token) {
    throw new DriveError(
      'Nenhuma conta Google conectada. Conecte sua conta em Configurações.',
      'not-connected'
    )
  }
  const client = createClient()
  client.setCredentials(tokens)
  // Access tokens renovados são persistidos para evitar refresh a cada abertura
  client.on('tokens', (fresh) => {
    saveTokens({ ...tokens, ...fresh, refresh_token: fresh.refresh_token ?? tokens.refresh_token })
  })
  return client
}

function getDrive(): drive_v3.Drive {
  return google.drive({ version: 'v3', auth: getAuthedClient() })
}

// ─── Login (loopback + PKCE) ───

let pendingAuth: { close: () => void } | null = null

const CALLBACK_HTML = (title: string, body: string): string => `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Finanças</title>
<style>body{font-family:-apple-system,Segoe UI,sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.box{text-align:center;max-width:420px;padding:32px;border:1px solid #334155;border-radius:16px;background:#1e293b}
h1{font-size:20px;margin:0 0 8px}p{color:#94a3b8;font-size:14px;margin:0}</style></head>
<body><div class="box"><h1>${title}</h1><p>${body}</p></div></body></html>`

/**
 * Abre o navegador para o usuário autorizar o app e guarda o refresh token.
 * Resolve com o e-mail da conta conectada.
 */
export async function connect(): Promise<{ email?: string }> {
  // Só um login por vez
  pendingAuth?.close()
  pendingAuth = null

  const state = randomBytes(16).toString('hex')

  return new Promise<{ email?: string }>((resolve, reject) => {
    let settled = false
    let exchanging = false
    let client: OAuth2Client
    let codeVerifier = ''

    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      if (url.pathname !== '/oauth2callback') {
        res.writeHead(404).end()
        return
      }

      const finish = (ok: boolean, title: string, body: string): void => {
        res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(CALLBACK_HTML(title, body))
      }

      if (url.searchParams.get('state') !== state) {
        finish(
          false,
          'Pedido inválido',
          'O código de segurança não confere. Tente novamente no aplicativo.'
        )
        return
      }
      // O navegador pode pedir a mesma URL de novo (recarregar, pré-carregar);
      // um código de autorização só vale uma vez, então não repete a troca.
      if (settled || exchanging) {
        finish(true, 'Pedido já processado', 'Volte ao aplicativo Finanças.')
        return
      }

      const oauthError = url.searchParams.get('error')
      const code = url.searchParams.get('code')
      if (oauthError || !code) {
        finish(false, 'Acesso não autorizado', 'Você pode fechar esta janela e tentar novamente.')
        cleanup()
        settle(() =>
          reject(new DriveError(`Login cancelado (${oauthError ?? 'sem código'}).`, 'auth'))
        )
        return
      }

      exchanging = true
      try {
        let tokens: Credentials
        try {
          tokens = (await client.getToken({ code, codeVerifier })).tokens
        } catch (err) {
          const e = err as GaxiosLikeError
          console.error(
            '[GDrive] troca do código falhou:',
            e?.response?.status,
            JSON.stringify(e?.response?.data ?? e?.message)
          )
          const apiError = e?.response?.data?.error
          const apiMessage = typeof apiError === 'string' ? apiError : apiError?.message
          if (apiMessage === 'invalid_grant') {
            throw new DriveError(
              'O Google recusou o código de autorização (invalid_grant). Isso costuma acontecer quando o código foi usado duas vezes ou o relógio do computador está errado. Confira a data/hora e tente conectar de novo.',
              'auth'
            )
          }
          throw err
        }
        if (!tokens.refresh_token) {
          throw new DriveError(
            'O Google não devolveu um refresh token. Remova o acesso do app em myaccount.google.com/permissions e conecte novamente.',
            'auth'
          )
        }
        saveTokens(tokens)
        client.setCredentials(tokens)

        let email: string | undefined
        try {
          const info = await google.oauth2({ version: 'v2', auth: client }).userinfo.get()
          email = info.data.email ?? undefined
        } catch (err) {
          console.warn('[GDrive] não foi possível obter o e-mail:', err)
        }
        updateGoogleConfig({ email, fileId: undefined, scope: tokens.scope })

        finish(true, 'Conta conectada!', 'Você já pode fechar esta janela e voltar ao Finanças.')
        cleanup()
        settle(() => resolve({ email }))
      } catch (err) {
        finish(false, 'Falha ao conectar', 'Volte ao aplicativo e tente novamente.')
        cleanup()
        settle(() => reject(toDriveError(err)))
      }
    })

    const timer = setTimeout(() => {
      cleanup()
      settle(() =>
        reject(new DriveError('Tempo esgotado aguardando a autorização no navegador.', 'auth'))
      )
    }, AUTH_TIMEOUT_MS)

    function cleanup(): void {
      clearTimeout(timer)
      server.close()
      pendingAuth = null
    }
    function settle(fn: () => void): void {
      if (settled) return
      settled = true
      fn()
    }

    pendingAuth = {
      close: () => {
        cleanup()
        settle(() => reject(new DriveError('Login cancelado.', 'auth')))
      }
    }

    server.on('error', (err) => {
      cleanup()
      settle(() => reject(toDriveError(err)))
    })

    server.listen(0, '127.0.0.1', async () => {
      try {
        const address = server.address()
        if (!address || typeof address === 'string') throw new Error('Porta local indisponível')
        const redirectUri = `http://127.0.0.1:${address.port}/oauth2callback`

        client = createClient(redirectUri)
        const pkce = await client.generateCodeVerifierAsync()
        codeVerifier = pkce.codeVerifier

        const authUrl = client.generateAuthUrl({
          access_type: 'offline',
          prompt: 'consent',
          scope: SCOPES,
          state,
          code_challenge_method: CodeChallengeMethod.S256,
          code_challenge: pkce.codeChallenge
        })
        await shell.openExternal(authUrl)
      } catch (err) {
        cleanup()
        settle(() => reject(toDriveError(err)))
      }
    })
  })
}

/** Cancela um login em andamento (se houver). */
export function cancelConnect(): void {
  pendingAuth?.close()
}

/** Revoga o token (melhor esforço) e apaga a sessão local. */
export async function disconnect(): Promise<void> {
  const tokens = loadTokens()
  if (tokens?.refresh_token) {
    try {
      await createClient().revokeToken(tokens.refresh_token)
    } catch (err) {
      console.warn('[GDrive] revogação falhou (ignorado):', err)
    }
  }
  updateGoogleConfig({
    tokens: undefined,
    email: undefined,
    fileId: undefined,
    folderId: undefined,
    folderPath: undefined,
    scope: undefined
  })
}

// ─── Pastas e arquivo de dados no Drive ───

function escapeQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function isNotFound(err: unknown): boolean {
  return (err as GaxiosLikeError)?.response?.status === 404
}

/**
 * Lista o conteúdo de `parentId` para o seletor: subpastas e arquivos .json.
 * "root" = Meu Drive; SHARED_ROOT = itens compartilhados com o usuário.
 */
export async function listEntries(parentId = 'root'): Promise<DriveEntry[]> {
  try {
    const drive = getDrive()
    const scope =
      parentId === SHARED_ROOT ? 'sharedWithMe = true' : `'${escapeQuery(parentId)}' in parents`
    const entries: DriveEntry[] = []
    let pageToken: string | undefined
    do {
      const res = await drive.files.list({
        q: `${scope} and (mimeType = '${FOLDER_MIME}' or ${DATA_FILE_QUERY}) and trashed = false`,
        fields: 'nextPageToken, files(id, name, mimeType)',
        orderBy: 'folder, name_natural',
        pageSize: 200,
        spaces: 'drive',
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        pageToken
      })
      for (const f of res.data.files ?? []) {
        if (f.id && f.name) {
          entries.push({
            id: f.id,
            name: f.name,
            kind: f.mimeType === FOLDER_MIME ? 'folder' : 'file'
          })
        }
      }
      pageToken = res.data.nextPageToken ?? undefined
    } while (pageToken)
    return entries
  } catch (err) {
    throw toDriveError(err)
  }
}

export async function createFolder(parentId: string, name: string): Promise<DriveEntry> {
  try {
    const drive = getDrive()
    const created = await drive.files.create({
      requestBody: { name, mimeType: FOLDER_MIME, parents: [parentId] },
      fields: 'id, name'
    })
    if (!created.data.id) throw new DriveError('Não foi possível criar a pasta no Drive.', 'other')
    return { id: created.data.id, name: created.data.name ?? name, kind: 'folder' }
  } catch (err) {
    throw toDriveError(err)
  }
}

/**
 * Caminho legível ("Meu Drive/A/B" ou "Compartilhados comigo/A/B") subindo
 * pelos pais. Em itens compartilhados a subida para onde o acesso acaba.
 */
async function resolveFolderPath(drive: drive_v3.Drive, folderId: string): Promise<string> {
  const parts: string[] = []
  let current: string | undefined = folderId
  let ownedByMe = true
  for (let depth = 0; current && depth < 30; depth++) {
    let file: drive_v3.Schema$File
    try {
      const res: { data: drive_v3.Schema$File } = await drive.files.get({
        fileId: current,
        fields: 'id, name, parents, ownedByMe',
        supportsAllDrives: true
      })
      file = res.data
    } catch (err) {
      if (isNotFound(err) || (err as GaxiosLikeError)?.response?.status === 403) break
      throw err
    }
    if (!file.parents || file.parents.length === 0) {
      // Raiz de "Meu Drive" (sem nome útil) ou topo de uma árvore compartilhada
      if (file.ownedByMe === false) parts.unshift(file.name ?? '?')
      ownedByMe = file.ownedByMe !== false
      break
    }
    parts.unshift(file.name ?? '?')
    ownedByMe = file.ownedByMe !== false
    current = file.parents[0]
  }
  return [ownedByMe ? 'Meu Drive' : SHARED_LABEL, ...parts].join('/')
}

async function findFolderByName(drive: drive_v3.Drive, parentId: string): Promise<string | null> {
  const res = await drive.files.list({
    q: `'${escapeQuery(parentId)}' in parents and name = '${escapeQuery(FOLDER_NAME)}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
    fields: 'files(id)',
    pageSize: 1,
    spaces: 'drive'
  })
  return res.data.files?.[0]?.id ?? null
}

/** Pasta em uso: a escolhida pelo usuário ou, por padrão, "Meu Drive/FinancasCasa". */
async function ensureFolder(drive: drive_v3.Drive): Promise<string> {
  const cfg = readConfig().google
  if (cfg?.folderId) {
    try {
      const res = await drive.files.get({ fileId: cfg.folderId, fields: 'id, trashed' })
      if (res.data.id && !res.data.trashed) return res.data.id
    } catch (err) {
      if (!isNotFound(err)) throw err
    }
    // A pasta escolhida sumiu: volta ao padrão e avisa pelo caminho exibido.
    updateGoogleConfig({ folderId: undefined, folderPath: undefined, fileId: undefined })
  }

  const existing = await findFolderByName(drive, 'root')
  if (existing) return existing
  const created = await drive.files.create({
    requestBody: { name: FOLDER_NAME, mimeType: FOLDER_MIME, parents: ['root'] },
    fields: 'id'
  })
  if (!created.data.id) throw new DriveError('Não foi possível criar a pasta no Drive.', 'other')
  return created.data.id
}

async function findDataFileIn(drive: drive_v3.Drive, folderId: string): Promise<string | null> {
  const res = await drive.files.list({
    q: `'${escapeQuery(folderId)}' in parents and name = '${escapeQuery(DATA_FILE_NAME)}' and trashed = false`,
    fields: 'files(id, modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: 1,
    spaces: 'drive',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true
  })
  return res.data.files?.[0]?.id ?? null
}

/** Localiza o finance-data.json (pelo ID guardado ou buscando na pasta em uso). */
async function findDataFile(drive: drive_v3.Drive): Promise<string | null> {
  const cachedId = readConfig().google?.fileId
  if (cachedId) {
    try {
      const res = await drive.files.get({
        fileId: cachedId,
        fields: 'id, trashed',
        supportsAllDrives: true
      })
      if (res.data.id && !res.data.trashed) return res.data.id
    } catch (err) {
      if (!isNotFound(err)) throw err
    }
  }

  const folderId = await ensureFolder(drive)
  const id = await findDataFileIn(drive, folderId)
  updateGoogleConfig({ fileId: id ?? undefined })
  return id
}

export type SetFolderResult = 'existing' | 'moved' | 'copied' | 'empty'

/**
 * Troca a pasta do Drive onde o arquivo fica.
 * - Se a nova pasta já tem um finance-data.json, ele passa a ser usado.
 * - Senão, o arquivo atual (se houver) é movido para lá.
 */
export async function setFolder(
  folderId: string
): Promise<{ folderPath: string; result: SetFolderResult }> {
  if (folderId === SHARED_ROOT || folderId === 'root') {
    throw new DriveError(
      'Escolha uma pasta dentro de "Meu Drive" ou "Compartilhados comigo".',
      'other'
    )
  }
  try {
    const drive = getDrive()
    const folderPath = await resolveFolderPath(drive, folderId)

    const existingInTarget = await findDataFileIn(drive, folderId)
    if (existingInTarget) {
      updateGoogleConfig({ folderId, folderPath, fileId: existingInTarget, fileName: undefined })
      return { folderPath, result: 'existing' }
    }

    const currentId = await findDataFile(drive)
    if (currentId) {
      const current = await drive.files.get({
        fileId: currentId,
        fields: 'parents, ownedByMe',
        supportsAllDrives: true
      })
      try {
        await drive.files.update({
          fileId: currentId,
          addParents: folderId,
          removeParents: (current.data.parents ?? []).join(','),
          fields: 'id',
          supportsAllDrives: true
        })
        updateGoogleConfig({ folderId, folderPath, fileId: currentId, fileName: undefined })
        return { folderPath, result: 'moved' }
      } catch (err) {
        // Arquivo de outra pessoa (ou pasta sem permissão de mover): copia.
        if ((err as GaxiosLikeError)?.response?.status !== 403) throw err
        const res = await drive.files.get(
          { fileId: currentId, alt: 'media', supportsAllDrives: true },
          { responseType: 'text' }
        )
        const body = res.data as unknown
        const created = await drive.files.create({
          requestBody: { name: DATA_FILE_NAME, mimeType: 'application/json', parents: [folderId] },
          media: {
            mimeType: 'application/json',
            body: typeof body === 'string' ? body : JSON.stringify(body)
          },
          fields: 'id',
          supportsAllDrives: true
        })
        updateGoogleConfig({
          folderId,
          folderPath,
          fileId: created.data.id ?? undefined,
          fileName: undefined
        })
        return { folderPath, result: 'copied' }
      }
    }

    updateGoogleConfig({ folderId, folderPath, fileId: undefined, fileName: undefined })
    return { folderPath, result: 'empty' }
  } catch (err) {
    throw toDriveError(err)
  }
}

/**
 * Usa um arquivo .json específico (ex.: compartilhado por outra pessoa) como
 * o finance-data.json do app.
 */
export async function setFile(
  fileId: string
): Promise<{ folderPath: string; fileName: string; canEdit: boolean }> {
  try {
    const drive = getDrive()
    const res = await drive.files.get({
      fileId,
      fields: 'id, name, parents, capabilities(canEdit), trashed',
      supportsAllDrives: true
    })
    if (!res.data.id || res.data.trashed) {
      throw new DriveError('O arquivo não está mais disponível.', 'other')
    }
    const parentId = res.data.parents?.[0]
    const folderPath = parentId ? await resolveFolderPath(drive, parentId) : SHARED_LABEL
    updateGoogleConfig({
      fileId: res.data.id,
      folderId: parentId,
      folderPath,
      fileName: res.data.name ?? undefined
    })
    return {
      folderPath,
      fileName: res.data.name ?? DATA_FILE_NAME,
      canEdit: res.data.capabilities?.canEdit !== false
    }
  } catch (err) {
    throw toDriveError(err)
  }
}

export async function hasDataFile(): Promise<boolean> {
  try {
    return (await findDataFile(getDrive())) !== null
  } catch (err) {
    throw toDriveError(err)
  }
}

/** Conteúdo bruto do arquivo, ou null se ainda não existir no Drive. */
export async function readDataFile(): Promise<string | null> {
  try {
    const drive = getDrive()
    const fileId = await findDataFile(drive)
    if (!fileId) return null
    const res = await drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'text' }
    )
    const body = res.data as unknown
    return typeof body === 'string' ? body : JSON.stringify(body)
  } catch (err) {
    throw toDriveError(err)
  }
}

export async function writeDataFile(contents: string): Promise<void> {
  try {
    const drive = getDrive()
    const fileId = await findDataFile(drive)
    const media = { mimeType: 'application/json', body: contents }

    if (fileId) {
      await drive.files.update({ fileId, media, supportsAllDrives: true })
      return
    }

    const folderId = await ensureFolder(drive)
    const created = await drive.files.create({
      requestBody: { name: DATA_FILE_NAME, mimeType: 'application/json', parents: [folderId] },
      media,
      fields: 'id'
    })
    updateGoogleConfig({ fileId: created.data.id ?? undefined })
  } catch (err) {
    throw toDriveError(err)
  }
}
