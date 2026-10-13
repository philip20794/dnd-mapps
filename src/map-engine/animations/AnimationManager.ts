export type AnimationUpdate = (
  elapsedSeconds: number,
  deltaSeconds: number,
  reducedMotion: boolean,
) => void

export interface AnimationHandle {
  readonly id: string
  readonly dispose: () => void
}

export class AnimationManager {
  private readonly animations = new Map<string, AnimationUpdate>()
  private elapsedSeconds = 0
  private nextId = 0
  private enabled = true
  private reducedMotion = false
  private documentHidden = false
  private readonly motionQuery: MediaQueryList | null = null
  private readonly handleMotionChange = (event: MediaQueryListEvent): void => {
    this.reducedMotion = event.matches
  }
  private readonly handleVisibilityChange = (): void => {
    this.documentHidden = typeof document !== 'undefined' ? document.hidden : false
  }

  public constructor() {
    if (typeof document !== 'undefined') {
      this.documentHidden = document.hidden
      document.addEventListener('visibilitychange', this.handleVisibilityChange)
    }

    if (typeof window !== 'undefined' && 'matchMedia' in window) {
      this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
      this.reducedMotion = this.motionQuery.matches
      this.motionQuery.addEventListener('change', this.handleMotionChange)
    }
  }

  public register(update: AnimationUpdate): AnimationHandle {
    const id = `animation-${this.nextId}`
    this.nextId += 1
    this.animations.set(id, update)

    return {
      id,
      dispose: () => {
        this.animations.delete(id)
      },
    }
  }

  public update(deltaSeconds: number): void {
    if (!this.enabled || this.documentHidden) {
      return
    }

    const clampedDelta = Math.min(deltaSeconds, this.reducedMotion ? 1 / 12 : 1 / 20)
    this.elapsedSeconds += clampedDelta

    for (const update of this.animations.values()) {
      update(this.elapsedSeconds, clampedDelta, this.reducedMotion)
    }
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  public setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion
  }

  public clear(): void {
    this.animations.clear()
    this.elapsedSeconds = 0
  }

  public destroy(): void {
    this.clear()
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    }
    this.motionQuery?.removeEventListener('change', this.handleMotionChange)
  }
}
