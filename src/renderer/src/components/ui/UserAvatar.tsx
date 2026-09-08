import type { CSSProperties, ReactElement } from 'react'
import { cn, isPhotoAvatar } from '../../lib/utils'

/**
 * Avatar do participante: mostra a foto de perfil, um emoji ou — quando nada
 * foi escolhido — a inicial do nome.
 */
interface Props {
  name: string
  avatar?: string
  color?: string
  /** Diâmetro em pixels */
  size: number
  /** Tamanho da fonte da inicial; o emoji usa ~62% do diâmetro */
  fontSize?: number
  /** Estilo invertido (fundo sólido na cor do participante) */
  filled?: boolean
  className?: string
  title?: string
}

export default function UserAvatar({
  name,
  avatar,
  color,
  size,
  fontSize,
  filled = false,
  className,
  title
}: Props): ReactElement {
  const isPhoto = isPhotoAvatar(avatar)

  const style: CSSProperties = {
    width: size,
    height: size,
    fontSize: avatar && !isPhoto ? Math.round(size * 0.62) : (fontSize ?? Math.round(size * 0.42))
  }

  // Os tokens de tema são triplas HSL, por isso precisam de hsl(...) à volta
  if (!isPhoto) {
    if (filled) {
      style.backgroundColor = color || 'hsl(var(--primary))'
      style.borderColor = color || 'hsl(var(--primary))'
      style.color = '#ffffff'
    } else {
      style.backgroundColor = color ? `${color}20` : 'hsl(var(--primary) / 0.2)'
      style.borderColor = color ? `${color}30` : 'hsl(var(--primary) / 0.1)'
      style.color = color || 'hsl(var(--primary))'
    }
  } else {
    style.borderColor = color ? `${color}60` : 'hsl(var(--primary) / 0.3)'
  }

  return (
    <div
      className={cn(
        'flex-none rounded-full border flex items-center justify-center font-bold leading-none overflow-hidden select-none',
        className
      )}
      style={style}
      title={title ?? name}
    >
      {isPhoto ? (
        <img src={avatar} alt={name} className="h-full w-full object-cover" draggable={false} />
      ) : avatar ? (
        <span>{avatar}</span>
      ) : (
        name.charAt(0).toUpperCase() || '?'
      )}
    </div>
  )
}
