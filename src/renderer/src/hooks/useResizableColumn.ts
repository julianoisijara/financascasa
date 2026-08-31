import { useCallback, useEffect, useRef, useState } from 'react'

interface Options {
  /** Chave usada para lembrar a largura escolhida pelo usuário */
  storageKey: string
  defaultWidth: number
  minWidth: number
  maxWidth: number
  /** Borda da tela em que a coluna está ancorada (define o sentido do arraste) */
  edge: 'left' | 'right'
}

interface Resizable {
  /** Largura efetiva a aplicar na coluna */
  width: number
  isResizing: boolean
  /** Handler para o `onPointerDown` da alça de redimensionamento */
  startResize: (e: React.PointerEvent) => void
  /** Volta à largura padrão (usado no duplo clique da alça) */
  resetWidth: () => void
}

/** Teto extra: a coluna nunca passa de 40% da janela, para o conteúdo central sobrar espaço */
function viewportMax(viewport: number, minWidth: number): number {
  return Math.max(minWidth, Math.round(viewport * 0.4))
}

export function useResizableColumn({
  storageKey,
  defaultWidth,
  minWidth,
  maxWidth,
  edge
}: Options): Resizable {
  // Largura escolhida pelo usuário. É preservada mesmo quando a janela está estreita
  // demais para exibi-la, para voltar sozinha quando a janela crescer de novo.
  const [preferredWidth, setPreferredWidth] = useState(() => {
    const saved = Number(localStorage.getItem(storageKey))
    const initial = Number.isFinite(saved) && saved > 0 ? saved : defaultWidth
    return Math.min(maxWidth, Math.max(minWidth, Math.round(initial)))
  })
  const [viewport, setViewport] = useState(() => window.innerWidth)
  const [isResizing, setIsResizing] = useState(false)

  // Largura zero acontece com a janela ainda sem layout: nesse caso não há teto a aplicar
  const width =
    viewport > 0 ? Math.min(preferredWidth, viewportMax(viewport, minWidth)) : preferredWidth

  const clamp = useCallback(
    (value: number, currentViewport: number) => {
      const bounded = Math.min(maxWidth, Math.max(minWidth, Math.round(value)))
      return currentViewport > 0
        ? Math.min(bounded, viewportMax(currentViewport, minWidth))
        : bounded
    },
    [minWidth, maxWidth]
  )

  // Espelha a largura atual para os handlers de arraste (não pode ser lida no render)
  const widthRef = useRef(width)
  useEffect(() => {
    widthRef.current = width
  }, [width])

  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)

  const startResize = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startWidth: widthRef.current }
    setIsResizing(true)
  }, [])

  const resetWidth = useCallback(() => {
    setPreferredWidth(defaultWidth)
    localStorage.setItem(storageKey, String(defaultWidth))
  }, [defaultWidth, storageKey])

  useEffect(() => {
    if (!isResizing) return

    const onMove = (e: PointerEvent): void => {
      const drag = dragRef.current
      if (!drag) return
      const delta = e.clientX - drag.startX
      setPreferredWidth(
        clamp(drag.startWidth + (edge === 'left' ? delta : -delta), window.innerWidth)
      )
    }

    const onUp = (): void => {
      dragRef.current = null
      setIsResizing(false)
    }

    // Mantém o cursor de redimensionamento e evita seleção de texto durante o arraste
    const previousCursor = document.body.style.cursor
    const previousSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)

    return () => {
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousSelect
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [isResizing, clamp, edge])

  // Grava a preferência só quando o arraste termina, para não escrever a cada pixel
  useEffect(() => {
    if (isResizing) return
    localStorage.setItem(storageKey, String(preferredWidth))
  }, [isResizing, preferredWidth, storageKey])

  useEffect(() => {
    const update = (): void => setViewport(window.innerWidth)
    update()
    // O `resize` da janela não cobre todos os casos (ex.: janela ainda sem layout no primeiro render)
    const observer = new ResizeObserver(update)
    observer.observe(document.documentElement)
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [])

  return { width, isResizing, startResize, resetWidth }
}
