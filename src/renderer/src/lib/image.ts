/** Lado (px) da foto de perfil guardada no data.json */
export const AVATAR_OUTPUT_SIZE = 256

/** Qualidade do JPEG gerado — equilíbrio entre nitidez e tamanho do arquivo */
const AVATAR_QUALITY = 0.85

export interface CropSource {
  src: string
  width: number
  height: number
}

/** Área quadrada, em pixels da imagem original, que será exibida no avatar */
export interface CropRect {
  x: number
  y: number
  size: number
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'))
    reader.onload = () => resolve(reader.result as string)
    reader.readAsDataURL(file)
  })
}

/** Carrega a imagem só para conhecer as dimensões originais */
export function loadImageSource(src: string): Promise<CropSource> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onerror = () => reject(new Error('Arquivo de imagem inválido.'))
    img.onload = () => resolve({ src, width: img.naturalWidth, height: img.naturalHeight })
    img.src = src
  })
}

/** Recorta o quadrado escolhido e devolve uma data URL leve para guardar */
export function cropImageToDataUrl(src: string, rect: CropRect): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onerror = () => reject(new Error('Arquivo de imagem inválido.'))
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = AVATAR_OUTPUT_SIZE
      canvas.height = AVATAR_OUTPUT_SIZE
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Não foi possível processar a imagem.'))

      ctx.drawImage(
        img,
        rect.x,
        rect.y,
        rect.size,
        rect.size,
        0,
        0,
        AVATAR_OUTPUT_SIZE,
        AVATAR_OUTPUT_SIZE
      )
      resolve(canvas.toDataURL('image/jpeg', AVATAR_QUALITY))
    }
    img.src = src
  })
}
