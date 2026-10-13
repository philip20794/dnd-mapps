import { Texture } from 'pixi.js'

interface ManagedTexture {
  readonly texture: Texture
  refs: number
}

export class ResourceManager {
  private readonly textures = new Map<string, ManagedTexture>()

  public getCircleTexture(key: string, color: string, radius: number, alpha: number): Texture {
    const cached = this.textures.get(key)
    if (cached) {
      cached.refs += 1
      return cached.texture
    }

    const size = Math.ceil(radius * 2)
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Canvas-Kontext für prozedurale Textur konnte nicht erzeugt werden.')
    }

    const gradient = context.createRadialGradient(radius, radius, 0, radius, radius, radius)
    gradient.addColorStop(0, color)
    gradient.addColorStop(1, `rgba(0, 0, 0, ${alpha})`)
    context.fillStyle = gradient
    context.beginPath()
    context.arc(radius, radius, radius, 0, Math.PI * 2)
    context.fill()

    const texture = Texture.from(canvas)
    this.textures.set(key, { texture, refs: 1 })
    return texture
  }

  public retain(key: string): void {
    const cached = this.textures.get(key)
    if (cached) {
      cached.refs += 1
    }
  }

  public release(key: string): void {
    const cached = this.textures.get(key)
    if (!cached) {
      return
    }

    cached.refs -= 1
    if (cached.refs <= 0) {
      cached.texture.destroy(true)
      this.textures.delete(key)
    }
  }

  public clear(): void {
    for (const cached of this.textures.values()) {
      cached.texture.destroy(true)
    }
    this.textures.clear()
  }
}
