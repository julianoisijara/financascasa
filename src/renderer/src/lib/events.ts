/** Evento global disparado quando uma gravação (local ou Drive) falha. */
export const SAVE_ERROR_EVENT = 'app:save-error'

export function emitSaveError(message: string): void {
  window.dispatchEvent(new CustomEvent<string>(SAVE_ERROR_EVENT, { detail: message }))
}
