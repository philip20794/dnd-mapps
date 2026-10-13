import { entryLevelId, getDefaultLevelId } from '@/maps/api'
import type { DoorDefinition, DoorState, MapDefinition } from '@/maps/api'
import type { GridPoint, Polygon, Segment } from '@/types/geometry'
import type { PlacedToken } from '@/types/tokens'
import type {
  FogDaylightAreaSource,
  FogLightSource,
  FogRadialLightSource,
} from '@/map-engine/lighting/lightSources'

const EPSILON = 0.0001
const FULL_CIRCLE_RAY_COUNT = 96
const CONE_RAY_COUNT = 40
const LIGHT_RAY_COUNT = 96

export interface RayHit {
  readonly point: GridPoint
  readonly distance: number
}

export interface VisibilityInput {
  readonly origin: GridPoint
  readonly range: number
  readonly rotationDegrees: number
  readonly visionAngleDegrees: number | null
  readonly segments: readonly Segment[]
}

const cross = (a: GridPoint, b: GridPoint): number => a.x * b.y - a.y * b.x

const subtract = (a: GridPoint, b: GridPoint): GridPoint => ({ x: a.x - b.x, y: a.y - b.y })

const normalizeAngle = (angle: number): number => {
  const twoPi = Math.PI * 2
  return ((angle % twoPi) + twoPi) % twoPi
}

const relativeAngle = (angle: number, center: number): number => {
  const normalized = normalizeAngle(angle - center)
  return normalized > Math.PI ? normalized - Math.PI * 2 : normalized
}

const distance = (a: GridPoint, b: GridPoint): number => Math.hypot(a.x - b.x, a.y - b.y)

const pointInBounds = (point: GridPoint, bounds: FogDaylightAreaSource['bounds']): boolean =>
  point.x >= bounds.x &&
  point.y >= bounds.y &&
  point.x <= bounds.x + bounds.width &&
  point.y <= bounds.y + bounds.height

const daylightPolygon = (source: FogDaylightAreaSource): Polygon => [
  { x: source.bounds.x, y: source.bounds.y },
  { x: source.bounds.x + source.bounds.width, y: source.bounds.y },
  { x: source.bounds.x + source.bounds.width, y: source.bounds.y + source.bounds.height },
  { x: source.bounds.x, y: source.bounds.y + source.bounds.height },
]

const isRadialLightSource = (source: FogLightSource): source is FogRadialLightSource =>
  source.kind !== 'daylight-area'

const isDaylightAreaSource = (source: FogLightSource): source is FogDaylightAreaSource =>
  source.kind === 'daylight-area'

export const polygonContainsPoint = (polygon: Polygon, point: GridPoint): boolean => {
  let inside = false
  for (
    let index = 0, previousIndex = polygon.length - 1;
    index < polygon.length;
    previousIndex = index, index += 1
  ) {
    const current = polygon[index]
    const previous = polygon[previousIndex]
    if (!current || !previous) {
      continue
    }

    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) + current.x
    if (intersects) {
      inside = !inside
    }
  }
  return inside
}

export const raySegmentIntersection = (
  origin: GridPoint,
  angle: number,
  segment: Segment,
  maxDistance: number,
): RayHit | null => {
  const ray = { x: Math.cos(angle), y: Math.sin(angle) }
  const segmentVector = subtract(segment.b, segment.a)
  const denominator = cross(ray, segmentVector)

  if (Math.abs(denominator) < EPSILON) {
    return null
  }

  const originToSegment = subtract(segment.a, origin)
  const distance = cross(originToSegment, segmentVector) / denominator
  const segmentPosition = cross(originToSegment, ray) / denominator

  if (
    distance < 0 ||
    distance > maxDistance ||
    segmentPosition < -EPSILON ||
    segmentPosition > 1 + EPSILON
  ) {
    return null
  }

  return {
    distance,
    point: {
      x: origin.x + ray.x * distance,
      y: origin.y + ray.y * distance,
    },
  }
}

export const mapBoundarySegments = (
  map: Pick<MapDefinition, 'width' | 'height'>,
): readonly Segment[] => [
  { a: { x: 0, y: 0 }, b: { x: map.width, y: 0 } },
  { a: { x: map.width, y: 0 }, b: { x: map.width, y: map.height } },
  { a: { x: map.width, y: map.height }, b: { x: 0, y: map.height } },
  { a: { x: 0, y: map.height }, b: { x: 0, y: 0 } },
]

export const doorVisibilitySegments = (
  doors: readonly DoorDefinition[],
  doorStates: Readonly<Record<string, DoorState>>,
  map?: MapDefinition,
  levelId?: string,
): readonly Segment[] =>
  doors
    .filter(
      (door) =>
        (!map || !levelId || entryLevelId(door, map) === levelId) &&
        (doorStates[door.id] ?? door.defaultState) === 'closed' &&
        door.blocksSightWhenClosed,
    )
    .map((door) => door.segment)

const endpointAngles = (origin: GridPoint, segments: readonly Segment[]): number[] =>
  segments.flatMap((segment) =>
    [segment.a, segment.b].flatMap((point) => {
      const angle = Math.atan2(point.y - origin.y, point.x - origin.x)
      return [angle - EPSILON, angle, angle + EPSILON]
    }),
  )

const sampleAngles = (rotation: number, visionAngle: number | null): number[] => {
  if (visionAngle === null) {
    return Array.from(
      { length: FULL_CIRCLE_RAY_COUNT },
      (_value, index) => (Math.PI * 2 * index) / FULL_CIRCLE_RAY_COUNT,
    )
  }

  const half = visionAngle / 2
  return Array.from(
    { length: CONE_RAY_COUNT + 1 },
    (_value, index) => rotation - half + (visionAngle * index) / CONE_RAY_COUNT,
  )
}

const isInsideVisionAngle = (
  angle: number,
  rotation: number,
  visionAngle: number | null,
): boolean => {
  if (visionAngle === null) {
    return true
  }
  return Math.abs(relativeAngle(angle, rotation)) <= visionAngle / 2 + EPSILON
}

const rayCircleIntersection = (
  origin: GridPoint,
  angle: number,
  circleCenter: GridPoint,
  radius: number,
): { readonly near: number; readonly far: number } | null => {
  const direction = { x: Math.cos(angle), y: Math.sin(angle) }
  const toCenter = {
    x: circleCenter.x - origin.x,
    y: circleCenter.y - origin.y,
  }
  const projection = toCenter.x * direction.x + toCenter.y * direction.y
  const centerDistanceSquared = toCenter.x * toCenter.x + toCenter.y * toCenter.y
  const perpendicularSquared = centerDistanceSquared - projection * projection
  const radiusSquared = radius * radius

  if (perpendicularSquared > radiusSquared) {
    return null
  }

  const halfChord = Math.sqrt(Math.max(0, radiusSquared - perpendicularSquared))
  const near = projection - halfChord
  const far = projection + halfChord

  if (far < 0) {
    return null
  }

  return {
    near: Math.max(0, near),
    far,
  }
}

const closestWallDistance = (
  origin: GridPoint,
  angle: number,
  segments: readonly Segment[],
  maxDistance: number,
): number => {
  let closest = maxDistance
  for (const segment of segments) {
    const hit = raySegmentIntersection(origin, angle, segment, maxDistance)
    if (hit && hit.distance < closest) {
      closest = hit.distance
    }
  }
  return closest
}

const pointOnRay = (origin: GridPoint, angle: number, distanceOnRay: number): GridPoint => ({
  x: origin.x + Math.cos(angle) * distanceOnRay,
  y: origin.y + Math.sin(angle) * distanceOnRay,
})

export const computeVisibilityPolygon = (input: VisibilityInput): Polygon => {
  const rotation = (input.rotationDegrees * Math.PI) / 180
  const visionAngle =
    input.visionAngleDegrees === null ? null : (input.visionAngleDegrees * Math.PI) / 180
  const angles = [
    ...endpointAngles(input.origin, input.segments),
    ...sampleAngles(rotation, visionAngle),
  ]
    .filter((angle) => isInsideVisionAngle(angle, rotation, visionAngle))
    .sort((left, right) => {
      if (visionAngle === null) {
        return normalizeAngle(left) - normalizeAngle(right)
      }
      return relativeAngle(left, rotation) - relativeAngle(right, rotation)
    })

  const points: GridPoint[] = []
  for (const angle of angles) {
    let closest: RayHit | null = null
    for (const segment of input.segments) {
      const hit = raySegmentIntersection(input.origin, angle, segment, input.range)
      if (hit && (!closest || hit.distance < closest.distance)) {
        closest = hit
      }
    }

    points.push(
      closest?.point ?? {
        x: input.origin.x + Math.cos(angle) * input.range,
        y: input.origin.y + Math.sin(angle) * input.range,
      },
    )
  }

  return points
}

export const visibilitySegmentsForMap = (
  map: MapDefinition,
  doorStates: Readonly<Record<string, DoorState>>,
  levelId = getDefaultLevelId(map),
): readonly Segment[] => [
  ...mapBoundarySegments(map),
  ...map.walls
    .filter((wall) => wall.blocksSight && entryLevelId(wall, map) === levelId)
    .map((wall) => ({ a: wall.a, b: wall.b })),
  ...doorVisibilitySegments(map.doors, doorStates, map, levelId),
]

export const computeTokenVisibility = (
  token: PlacedToken,
  map: MapDefinition,
  doorStates: Readonly<Record<string, DoorState>>,
  levelId = token.levelId ?? getDefaultLevelId(map),
): Polygon | null => {
  if (!token.visionEnabled || token.visionRange <= 0) {
    return null
  }

  return computeVisibilityPolygon({
    origin: token.position,
    range: token.visionRange,
    rotationDegrees: token.rotation,
    visionAngleDegrees: token.visionAngle,
    segments: visibilitySegmentsForMap(map, doorStates, levelId),
  })
}

export const combineVisibilityPolygons = (
  tokens: readonly PlacedToken[],
  map: MapDefinition,
  doorStates: Readonly<Record<string, DoorState>>,
  levelId = getDefaultLevelId(map),
): readonly Polygon[] =>
  tokens
    .filter((token) => (token.levelId ?? getDefaultLevelId(map)) === levelId)
    .map((token) => computeTokenVisibility(token, map, doorStates, levelId))
    .filter((polygon): polygon is Polygon => polygon !== null && polygon.length > 2)

export const combineVisibilityPolygonsWithLights = (
  tokens: readonly PlacedToken[],
  map: MapDefinition,
  doorStates: Readonly<Record<string, DoorState>>,
  lightSources: readonly FogLightSource[],
  levelId = getDefaultLevelId(map),
): readonly Polygon[] => {
  const segments = visibilitySegmentsForMap(map, doorStates, levelId)
  const tokenPolygons = tokens
    .filter((token) => (token.levelId ?? getDefaultLevelId(map)) === levelId)
    .map((token) =>
      token.visionEnabled && token.visionRange > 0
        ? {
            token,
            polygon: computeVisibilityPolygon({
              origin: token.position,
              range: token.visionRange,
              rotationDegrees: token.rotation,
              visionAngleDegrees: token.visionAngle,
              segments,
            }),
          }
        : null,
    )
    .filter(
      (entry): entry is { readonly token: PlacedToken; readonly polygon: Polygon } =>
        entry !== null && entry.polygon.length > 2,
    )

  const radialLights = lightSources.filter(isRadialLightSource)
  const daylightAreas = lightSources.filter(isDaylightAreaSource)

  const lightPolygons = tokenPolygons
    .flatMap(({ token, polygon }) =>
      radialLights.map((light) =>
        tokenCanActivateLight(token, polygon, light, segments)
          ? computeTokenLimitedLightPolygon(token, light, segments)
          : [],
      ),
    )
    .filter((polygon): polygon is Polygon => polygon.length > 2)

  const daylightPolygons = tokenPolygons
    .flatMap(({ token }) =>
      daylightAreas.map((area) =>
        pointInBounds(token.position, area.bounds) ? daylightPolygon(area) : [],
      ),
    )
    .filter((polygon): polygon is Polygon => polygon.length > 2)

  return [...tokenPolygons.map((entry) => entry.polygon), ...lightPolygons, ...daylightPolygons]
}

const tokenCanActivateLight = (
  token: PlacedToken,
  tokenPolygon: Polygon,
  light: FogRadialLightSource,
  segments: readonly Segment[],
): boolean => {
  if (polygonContainsPoint(tokenPolygon, light.position)) {
    return true
  }

  const distanceToLight = distance(token.position, light.position)
  if (distanceToLight > token.visionRange + light.range + EPSILON) {
    return false
  }

  const angle = Math.atan2(light.position.y - token.position.y, light.position.x - token.position.x)
  if (
    closestWallDistance(token.position, angle, segments, distanceToLight) <
    distanceToLight - EPSILON
  ) {
    return false
  }

  const rotation = (token.rotation * Math.PI) / 180
  const visionAngle = token.visionAngle === null ? null : (token.visionAngle * Math.PI) / 180
  const lightAngularRadius =
    distanceToLight <= light.range ? Math.PI : Math.asin(Math.min(1, light.range / distanceToLight))
  return (
    isInsideVisionAngle(angle - lightAngularRadius, rotation, visionAngle) ||
    isInsideVisionAngle(angle, rotation, visionAngle) ||
    isInsideVisionAngle(angle + lightAngularRadius, rotation, visionAngle)
  )
}

const computeTokenLimitedLightPolygon = (
  token: PlacedToken,
  light: FogRadialLightSource,
  segments: readonly Segment[],
): Polygon => {
  const distanceToLight = distance(token.position, light.position)
  const centerAngle = Math.atan2(
    light.position.y - token.position.y,
    light.position.x - token.position.x,
  )
  const halfAngle =
    distanceToLight <= light.range ? Math.PI : Math.asin(Math.min(1, light.range / distanceToLight))
  const rotation = (token.rotation * Math.PI) / 180
  const visionAngle = token.visionAngle === null ? null : (token.visionAngle * Math.PI) / 180
  const maxDistance = distanceToLight + light.range
  const outerPoints: GridPoint[] = []
  const innerPoints: GridPoint[] = []

  for (let index = 0; index <= LIGHT_RAY_COUNT; index += 1) {
    const angle = centerAngle - halfAngle + (halfAngle * 2 * index) / LIGHT_RAY_COUNT
    if (!isInsideVisionAngle(angle, rotation, visionAngle)) {
      continue
    }

    const circleHit = rayCircleIntersection(token.position, angle, light.position, light.range)
    if (!circleHit || circleHit.near > token.visionRange + EPSILON) {
      continue
    }

    const wallDistance = closestWallDistance(token.position, angle, segments, maxDistance)
    const far = Math.min(circleHit.far, wallDistance)
    if (far + EPSILON < circleHit.near) {
      continue
    }

    innerPoints.push(pointOnRay(token.position, angle, circleHit.near))
    outerPoints.push(pointOnRay(token.position, angle, far))
  }

  if (outerPoints.length < 2) {
    return []
  }

  return [...outerPoints, ...innerPoints.reverse()]
}
