import * as fsp from 'fs/promises'
import * as path from 'path'

/**
 * Filesystem helpers hardened for cloud-sync folders (Google Drive, OneDrive,
 * iCloud). Those folders are macOS File Provider / Windows Cloud Files mounts:
 * a file can exist as a "placeholder" with no local content, and the first read
 * triggers an on-demand download. With the sync fs.* API that download blocks
 * the whole Electron main process and eventually fails with ETIMEDOUT (-60).
 *
 * Everything here is async (so the UI stays responsive while the provider
 * materialises the file) and retries the errors those providers throw
 * transiently.
 */

/** Errors that mean "try again", not "this will never work". */
const TRANSIENT_CODES = new Set([
  'ETIMEDOUT',
  'EAGAIN',
  'EBUSY',
  'EIO',
  'EINTR',
  'ENOTCONN',
  'ENETDOWN',
  'ENETUNREACH',
  'EHOSTDOWN',
  'EHOSTUNREACH',
  'EDEADLK',
  'EMFILE',
  'ENFILE'
])

export interface FsErrnoLike {
  code?: string
  errno?: number
  syscall?: string
  message?: string
}

export function errorCode(err: unknown): string | undefined {
  return (err as FsErrnoLike | null)?.code
}

export function isTransientFsError(err: unknown): boolean {
  const code = errorCode(err)
  return code !== undefined && TRANSIENT_CODES.has(code)
}

/** Human-readable (pt-BR) explanation for the errors this app can hit. */
export function describeFsError(err: unknown): string {
  const code = errorCode(err)
  switch (code) {
    case 'ETIMEDOUT':
    case 'ENOTCONN':
    case 'ENETDOWN':
    case 'ENETUNREACH':
    case 'EHOSTDOWN':
    case 'EHOSTUNREACH':
      return 'A pasta da nuvem não respondeu a tempo. Verifique se o Google Drive/OneDrive está aberto e conectado, e marque a pasta como "Disponível off-line" antes de tentar novamente.'
    case 'EACCES':
    case 'EPERM':
    case 'EROFS':
      return 'Sem permissão de escrita nessa pasta. Escolha uma subpasta (ex.: "Meu Drive/Financeiro") em vez da pasta raiz da nuvem.'
    case 'ENOSPC':
      return 'Não há espaço disponível no disco para salvar os dados.'
    case 'ENOENT':
      return 'A pasta escolhida não existe mais.'
    case 'EBUSY':
    case 'EAGAIN':
      return 'O arquivo está sendo sincronizado no momento. Aguarde a sincronização terminar e tente novamente.'
    default:
      return (err as FsErrnoLike | null)?.message ?? String(err)
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

class OperationTimeoutError extends Error {
  code = 'ETIMEDOUT'
  constructor(label: string, ms: number) {
    super(`A operação "${label}" excedeu ${Math.round(ms / 1000)}s`)
  }
}

/**
 * Runs `op` with a wall-clock deadline. The underlying fs promise keeps running
 * on the libuv threadpool if it loses the race — that is intentional, it often
 * finishes the cloud download in the background and makes the next attempt fast.
 */
async function withTimeout<T>(op: () => Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      op(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new OperationTimeoutError(label, ms)), ms)
      })
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export interface RetryOptions {
  /** Total number of attempts, including the first one. */
  attempts?: number
  /** Deadline for each individual attempt. */
  timeoutMs?: number
  /** Delay before the 2nd attempt; doubles on each subsequent retry. */
  baseDelayMs?: number
  label?: string
}

/** Retries `op` while it fails with a transient cloud-filesystem error. */
export async function withRetry<T>(op: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    attempts = 3,
    timeoutMs = 15_000,
    baseDelayMs = 800,
    label = 'operação de arquivo'
  } = options

  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await withTimeout(op, timeoutMs, label)
    } catch (err) {
      lastError = err
      if (!isTransientFsError(err) || attempt === attempts) break
      console.warn(
        `[fsSafe] ${label}: tentativa ${attempt}/${attempts} falhou (${errorCode(err)}), repetindo...`
      )
      await delay(baseDelayMs * 2 ** (attempt - 1))
    }
  }
  throw lastError
}

/** Non-throwing existence check — a cloud mount can throw instead of answering. */
export async function pathExists(target: string): Promise<boolean> {
  try {
    await withRetry(() => fsp.stat(target), { label: `verificar ${path.basename(target)}` })
    return true
  } catch (err) {
    if (errorCode(err) === 'ENOENT') return false
    // Anything else (timeout, permissions): treat as "cannot confirm".
    // Callers must not destroy data based on this answer.
    throw err
  }
}

export async function readFileSafe(filePath: string): Promise<string> {
  return withRetry(() => fsp.readFile(filePath, 'utf-8'), {
    label: `ler ${path.basename(filePath)}`,
    // The first read of a cloud placeholder has to download the file.
    timeoutMs: 30_000
  })
}

/**
 * Writes atomically: a temp file in the same directory, then rename. Prevents a
 * half-written finance-data.json if the sync client interrupts the write.
 * Falls back to a direct write when the provider rejects rename.
 */
export async function writeFileSafe(filePath: string, contents: string): Promise<void> {
  const tmpPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.tmp`
  )

  try {
    await withRetry(() => fsp.writeFile(tmpPath, contents, 'utf-8'), {
      label: `gravar ${path.basename(filePath)}`
    })
    await withRetry(() => fsp.rename(tmpPath, filePath), {
      label: `finalizar ${path.basename(filePath)}`
    })
  } catch (err) {
    await fsp.rm(tmpPath, { force: true }).catch(() => undefined)
    if (errorCode(err) === 'ENOENT' || errorCode(err) === 'EXDEV' || errorCode(err) === 'EPERM') {
      // Some cloud providers refuse rename into a synced path; write in place.
      await withRetry(() => fsp.writeFile(filePath, contents, 'utf-8'), {
        label: `gravar ${path.basename(filePath)}`
      })
      return
    }
    throw err
  }
}

export async function copyFileSafe(from: string, to: string): Promise<void> {
  // Read + atomic write instead of fsp.copyFile: copying between two cloud
  // mounts is the case that hangs hardest, and this way a failed copy never
  // leaves a truncated file at the destination.
  const contents = await readFileSafe(from)
  await writeFileSafe(to, contents)
}

/** Throws a descriptive error when the directory can't hold the data file. */
export async function assertWritableDir(dir: string): Promise<void> {
  const probe = path.join(dir, `.financas-write-test-${process.pid}`)
  try {
    await withRetry(() => fsp.writeFile(probe, 'ok', 'utf-8'), {
      label: 'testar permissão de escrita',
      attempts: 2
    })
  } finally {
    await fsp.rm(probe, { force: true }).catch(() => undefined)
  }
}
