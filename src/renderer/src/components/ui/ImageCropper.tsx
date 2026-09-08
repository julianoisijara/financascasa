import { useRef, useState, type PointerEvent, type ReactElement, type WheelEvent } from 'react'
import type { CropRect, CropSource } from '../../lib/image'

/** Lado da área de pré-visualização, em pixels de tela */
const VIEWPORT = 224
const MIN_ZOOM = 1
const MAX_ZOOM = 4

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

interface Props {
  source: CropSource
  disabled?: boolean
  onCancel: () => void
  onConfirm: (rect: CropRect) => void
}

/**
 * Escolha do enquadramento da foto: arraste para mover e use o zoom para
 * aproximar. O quadrado visível (círculo, como o avatar) é o que fica guardado.
 */
export default function ImageCropper({
  source,
  disabled = false,
  onCancel,
  onConfirm
}: Props): ReactElement {
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null)

  // Escala que faz a imagem cobrir a área de pré-visualização no zoom mínimo
  const scale = (VIEWPORT / Math.min(source.width, source.height)) * zoom
  const displayWidth = source.width * scale
  const displayHeight = source.height * scale

  // A imagem nunca pode deixar buracos: o deslocamento fica preso às bordas
  const maxOffsetX = Math.max(0, (displayWidth - VIEWPORT) / 2)
  const maxOffsetY = Math.max(0, (displayHeight - VIEWPORT) / 2)
  const offsetX = clamp(offset.x, -maxOffsetX, maxOffsetX)
  const offsetY = clamp(offset.y, -maxOffsetY, maxOffsetY)

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>): void => {
    if (disabled) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { pointerX: e.clientX, pointerY: e.clientY, x: offsetX, y: offsetY }
  }

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current
    if (!drag) return
    setOffset({
      x: drag.x + (e.clientX - drag.pointerX),
      y: drag.y + (e.clientY - drag.pointerY)
    })
  }

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>): void => {
    dragRef.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  const handleWheel = (e: WheelEvent<HTMLDivElement>): void => {
    if (disabled) return
    setZoom((z) => clamp(z - e.deltaY * 0.002, MIN_ZOOM, MAX_ZOOM))
  }

  const reset = (): void => {
    setZoom(MIN_ZOOM)
    setOffset({ x: 0, y: 0 })
  }

  const handleConfirm = (): void => {
    // Converte a área visível de volta para pixels da imagem original
    const size = VIEWPORT / scale
    const x = displayWidth / 2 - VIEWPORT / 2 - offsetX
    const y = displayHeight / 2 - VIEWPORT / 2 - offsetY
    onConfirm({
      x: clamp(x / scale, 0, Math.max(0, source.width - size)),
      y: clamp(y / scale, 0, Math.max(0, source.height - size)),
      size
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Enquadramento</label>
        <p className="text-[11px] text-muted-foreground">
          Arraste a foto para escolher o ângulo e use o zoom para aproximar.
        </p>
      </div>

      <div className="flex justify-center">
        <div
          className="relative overflow-hidden rounded-full border border-white/10 bg-black/40 touch-none cursor-grab active:cursor-grabbing"
          style={{ width: VIEWPORT, height: VIEWPORT }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
        >
          <img
            src={source.src}
            alt="Pré-visualização da foto"
            draggable={false}
            className="absolute max-w-none select-none pointer-events-none"
            style={{
              width: displayWidth,
              height: displayHeight,
              left: VIEWPORT / 2 - displayWidth / 2 + offsetX,
              top: VIEWPORT / 2 - displayHeight / 2 + offsetY
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">Zoom</span>
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          disabled={disabled}
          className="flex-1 accent-[color:var(--primary)] cursor-pointer"
        />
        <button
          type="button"
          className="btn-ghost text-xs px-2 py-1 text-muted-foreground"
          onClick={reset}
          disabled={disabled}
        >
          Redefinir
        </button>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          className="btn-secondary flex-1"
          onClick={onCancel}
          disabled={disabled}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="btn-primary flex-1"
          onClick={handleConfirm}
          disabled={disabled}
        >
          Usar esta foto
        </button>
      </div>
    </div>
  )
}
