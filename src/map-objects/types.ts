import type { Container, Graphics, Texture } from 'pixi.js'
import type { DoorState } from '@/maps/api'
import type { GridPoint, Segment } from '@/types/geometry'
import type { AnimationManager } from '@/map-engine/animations/AnimationManager'
import type { ResourceManager } from '@/map-engine/resources/ResourceManager'

export type MapLayerName =
  | 'background'
  | 'materialBase'
  | 'floor'
  | 'materialEdges'
  | 'grid'
  | 'terrainStatic'
  | 'materialDecals'
  | 'terrainAnimated'
  | 'objectsStatic'
  | 'interactiveObjects'
  | 'wallsDoors'
  | 'tokens'
  | 'effects'
  | 'spellEffects'
  | 'light'
  | 'fog'
  | 'selection'

export type InteractionState = DoorState | 'idle' | 'triggered' | 'disabled'

export interface LightConfig {
  readonly color: number
  readonly range: number
  readonly intensity: number
  readonly flickerStrength?: number
}

export interface AnimationConfig {
  readonly enabled: boolean
  readonly speed: number
}

export interface WaterConfig {
  readonly direction: number
  readonly speed: number
  readonly intensity: number
  readonly alpha: number
}

export interface VerticalTransitionConfig {
  readonly targetLevelId: string
  readonly targetPosition: GridPoint
  readonly direction: 'up' | 'down'
  readonly label?: string
}

export interface MapObjectDefinition {
  readonly id?: string
  readonly type: string
  readonly preset?: string
  readonly levelId?: string
  readonly position: GridPoint
  readonly width?: number
  readonly height?: number
  readonly rotation?: number
  readonly scale?: number
  readonly variant?: string
  readonly texture?: string
  readonly visible?: boolean
  readonly layer?: MapLayerName
  readonly tags?: readonly string[]
  readonly blocksSight?: boolean
  readonly blocksMovement?: boolean
  readonly interactionState?: InteractionState
  readonly color?: number
  readonly secondaryColor?: number
  readonly alpha?: number
  readonly light?: LightConfig | null
  readonly animation?: AnimationConfig | null
  readonly water?: WaterConfig | null
  readonly sparks?: boolean
  readonly label?: string
  readonly transition?: VerticalTransitionConfig
}

export interface ResolvedMapObject extends Required<
  Omit<
    MapObjectDefinition,
    | 'preset'
    | 'texture'
    | 'variant'
    | 'light'
    | 'animation'
    | 'water'
    | 'label'
    | 'levelId'
    | 'transition'
  >
> {
  readonly preset?: string
  readonly texture?: string
  readonly variant?: string
  readonly levelId?: string
  readonly light: LightConfig | null
  readonly animation: AnimationConfig | null
  readonly water: WaterConfig | null
  readonly label?: string
  readonly transition?: VerticalTransitionConfig
}

export interface ObjectPreset<TDefinition extends MapObjectDefinition = MapObjectDefinition> {
  readonly name: string
  readonly type: string
  readonly label: string
  readonly defaults: Partial<TDefinition>
}

export interface RenderContext {
  readonly gridSize: number
  readonly resources: ResourceManager
  readonly animations: AnimationManager
  readonly emitInteraction: (objectId: string) => void
}

export interface RuntimeMapObject {
  readonly id: string
  readonly type: string
  readonly container: Container
  readonly light?: Graphics
  readonly textures?: readonly Texture[]
  readonly cleanup: () => void
}

export interface MapObjectRegistration<
  TDefinition extends MapObjectDefinition = MapObjectDefinition,
> {
  readonly type: string
  readonly defaults: Partial<TDefinition>
  readonly presets: readonly ObjectPreset<TDefinition>[]
  readonly validate: (definition: TDefinition) => readonly string[]
  readonly render: (definition: ResolvedMapObject, context: RenderContext) => RuntimeMapObject
  readonly update?: (
    runtime: RuntimeMapObject,
    definition: ResolvedMapObject,
    elapsedSeconds: number,
  ) => void
  readonly getSightGeometry?: (definition: ResolvedMapObject) => readonly Segment[]
  readonly getCollisionGeometry?: (definition: ResolvedMapObject) => readonly Segment[]
  readonly serialize?: (definition: ResolvedMapObject) => MapObjectDefinition
  readonly cleanup?: (runtime: RuntimeMapObject) => void
}

export interface SerializableObjectState {
  readonly id: string
  readonly type: string
  readonly interactionState?: InteractionState
  readonly visible?: boolean
}
