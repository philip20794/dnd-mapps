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
  readonly intersectionSegments?: readonly Segment[]
}

export interface PreparedVisibilityGeometry {
  readonly segments: readonly Segment[]
  readonly blockers: readonly VisibilityBlocker[]
}

export type VisibilityBlockerKind = 'map-boundary' | 'wall' | 'door'

export interface VisibilityBlocker {
  readonly id: string
  readonly kind: VisibilityBlockerKind
  readonly segment: Segment
}

export interface VisibleVisibilityBlocker {
  readonly blockerId: string
  readonly kind: Exclude<VisibilityBlockerKind, 'map-boundary'>
  readonly blockerSegment: Segment
  readonly visibleSegment: Segment
}

export interface VisibilityRangeBoundary {
  readonly origin: GridPoint
  readonly range: number
}

export interface VisibilityField {
  readonly polygon: Polygon
  readonly rangeBoundary?: VisibilityRangeBoundary
  readonly visibleBlockers?: readonly VisibleVisibilityBlocker[]
}

export const visibilityTokenStateKey = (tokens: readonly PlacedToken[]): string =>
  tokens
    .map(
      (token) =>
        `${token.id}:${token.position.x}:${token.position.y}:${token.rotation}:${token.visionRange}:${token.visionAngle ?? 'all'}:${token.visionEnabled ? 1 : 0}`,
    )
    .join('|')

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

const ANGLE_DEDUPLICATION_EPSILON = EPSILON / 100

const sortedUniqueAngles = (
  angles: readonly number[],
  rotation: number,
  visionAngle: number | null,
): number[] => {
  const sorted = angles
    .filter((angle) => isInsideVisionAngle(angle, rotation, visionAngle))
    .sort((left, right) =>
      visionAngle === null
        ? normalizeAngle(left) - normalizeAngle(right)
        : relativeAngle(left, rotation) - relativeAngle(right, rotation),
    )
  const unique: number[] = []
  for (const angle of sorted) {
    const previous = unique.at(-1)
    const difference =
      previous === undefined
        ? Number.POSITIVE_INFINITY
        : visionAngle === null
          ? Math.abs(normalizeAngle(angle) - normalizeAngle(previous))
          : Math.abs(relativeAngle(angle, rotation) - relativeAngle(previous, rotation))
    if (difference > ANGLE_DEDUPLICATION_EPSILON) unique.push(angle)
  }
  return unique
}

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

const closestVisibilityBlockerHit = (
  origin: GridPoint,
  angle: number,
  blockers: readonly VisibilityBlocker[],
  maxDistance: number,
): (RayHit & { readonly blocker: VisibilityBlocker }) | null => {
  let closest: (RayHit & { readonly blocker: VisibilityBlocker }) | null = null
  for (const blocker of blockers) {
    const hit = raySegmentIntersection(origin, angle, blocker.segment, maxDistance)
    if (hit && (!closest || hit.distance < closest.distance)) {
      closest = { ...hit, blocker }
    }
  }
  return closest
}

const pointOnRay = (origin: GridPoint, angle: number, distanceOnRay: number): GridPoint => ({
  x: origin.x + Math.cos(angle) * distanceOnRay,
  y: origin.y + Math.sin(angle) * distanceOnRay,
})

interface VisibilityRaySample {
  readonly point: GridPoint
  readonly blocker: VisibilityBlocker | null
}

interface VisibilityComputation {
  readonly polygon: Polygon
  readonly visibleBlockers: readonly VisibleVisibilityBlocker[]
}

interface BlockerInterval {
  readonly blocker: VisibilityBlocker
  readonly start: number
  readonly end: number
}

const segmentParameter = (segment: Segment, point: GridPoint): number => {
  const x = segment.b.x - segment.a.x
  const y = segment.b.y - segment.a.y
  const lengthSquared = x * x + y * y
  if (lengthSquared <= EPSILON * EPSILON) return 0
  return Math.max(
    0,
    Math.min(1, ((point.x - segment.a.x) * x + (point.y - segment.a.y) * y) / lengthSquared),
  )
}

const pointOnSegment = (segment: Segment, parameter: number): GridPoint => ({
  x: segment.a.x + (segment.b.x - segment.a.x) * parameter,
  y: segment.a.y + (segment.b.y - segment.a.y) * parameter,
})

const mergeBlockerIntervals = (
  intervals: readonly BlockerInterval[],
): readonly VisibleVisibilityBlocker[] => {
  const grouped = new Map<string, BlockerInterval[]>()
  for (const interval of intervals) {
    if (interval.blocker.kind === 'map-boundary' || interval.end - interval.start <= EPSILON) {
      continue
    }
    const entries = grouped.get(interval.blocker.id)
    if (entries) entries.push(interval)
    else grouped.set(interval.blocker.id, [interval])
  }

  const result: VisibleVisibilityBlocker[] = []
  for (const entries of grouped.values()) {
    entries.sort((left, right) => left.start - right.start)
    const blocker = entries[0]!.blocker
    let start = entries[0]!.start
    let end = entries[0]!.end
    const append = (): void => {
      result.push({
        blockerId: blocker.id,
        kind: blocker.kind as Exclude<VisibilityBlockerKind, 'map-boundary'>,
        blockerSegment: blocker.segment,
        visibleSegment: {
          a: pointOnSegment(blocker.segment, start),
          b: pointOnSegment(blocker.segment, end),
        },
      })
    }

    for (const interval of entries.slice(1)) {
      if (interval.start <= end + EPSILON * 4) {
        end = Math.max(end, interval.end)
      } else {
        append()
        start = interval.start
        end = interval.end
      }
    }
    append()
  }
  return result
}

const visibleBlockersFromSamples = (
  samples: readonly VisibilityRaySample[],
  wrap: boolean,
): readonly VisibleVisibilityBlocker[] => {
  const intervals: BlockerInterval[] = []
  const pairCount = wrap ? samples.length : Math.max(0, samples.length - 1)
  for (let index = 0; index < pairCount; index += 1) {
    const left = samples[index]
    const right = samples[(index + 1) % samples.length]
    if (!left?.blocker || left.blocker !== right?.blocker) continue
    const leftParameter = segmentParameter(left.blocker.segment, left.point)
    const rightParameter = segmentParameter(left.blocker.segment, right.point)
    intervals.push({
      blocker: left.blocker,
      start: Math.min(leftParameter, rightParameter),
      end: Math.max(leftParameter, rightParameter),
    })
  }
  return mergeBlockerIntervals(intervals)
}

export const combineVisibleBlockers = (
  fields: readonly VisibilityField[],
): readonly VisibleVisibilityBlocker[] =>
  mergeBlockerIntervals(
    fields.flatMap((field) =>
      (field.visibleBlockers ?? []).map(
        (visible): BlockerInterval => ({
          blocker: {
            id: visible.blockerId,
            kind: visible.kind,
            segment: visible.blockerSegment,
          },
          start: Math.min(
            segmentParameter(visible.blockerSegment, visible.visibleSegment.a),
            segmentParameter(visible.blockerSegment, visible.visibleSegment.b),
          ),
          end: Math.max(
            segmentParameter(visible.blockerSegment, visible.visibleSegment.a),
            segmentParameter(visible.blockerSegment, visible.visibleSegment.b),
          ),
        }),
      ),
    ),
  )

const computeVisibility = (
  input: VisibilityInput,
  intersectionBlockers?: readonly VisibilityBlocker[],
): VisibilityComputation => {
  const rotation = (input.rotationDegrees * Math.PI) / 180
  const visionAngle =
    input.visionAngleDegrees === null ? null : (input.visionAngleDegrees * Math.PI) / 180
  const intersectionSegments = input.intersectionSegments ?? input.segments
  const angles = sortedUniqueAngles(
    [...endpointAngles(input.origin, intersectionSegments), ...sampleAngles(rotation, visionAngle)],
    rotation,
    visionAngle,
  )

  const samples: VisibilityRaySample[] = []
  for (const angle of angles) {
    let closest: RayHit | null = null
    let closestBlocker: VisibilityBlocker | null = null
    const candidates = intersectionBlockers ?? intersectionSegments
    for (const candidate of candidates) {
      const segment = 'segment' in candidate ? candidate.segment : candidate
      const hit = raySegmentIntersection(input.origin, angle, segment, input.range)
      if (hit && (!closest || hit.distance < closest.distance)) {
        closest = hit
        closestBlocker = 'segment' in candidate ? candidate : null
      }
    }

    samples.push({
      point: closest?.point ?? {
        x: input.origin.x + Math.cos(angle) * input.range,
        y: input.origin.y + Math.sin(angle) * input.range,
      },
      blocker: closestBlocker,
    })
  }

  return {
    polygon: samples.map((sample) => sample.point),
    visibleBlockers: intersectionBlockers
      ? visibleBlockersFromSamples(samples, visionAngle === null)
      : [],
  }
}

export const computeVisibilityPolygon = (input: VisibilityInput): Polygon =>
  computeVisibility(input).polygon

export const visibilitySegmentsForMap = (
  map: MapDefinition,
  doorStates: Readonly<Record<string, DoorState>>,
  levelId = getDefaultLevelId(map),
): readonly Segment[] =>
  visibilityBlockersForMap(map, doorStates, levelId).map((blocker) => blocker.segment)

export const visibilityBlockersForMap = (
  map: MapDefinition,
  doorStates: Readonly<Record<string, DoorState>>,
  levelId = getDefaultLevelId(map),
): readonly VisibilityBlocker[] => [
  ...mapBoundarySegments(map).map(
    (segment, index): VisibilityBlocker => ({
      id: `map-boundary:${index}`,
      kind: 'map-boundary',
      segment,
    }),
  ),
  ...map.walls.flatMap((wall, index): readonly VisibilityBlocker[] =>
    wall.blocksSight && entryLevelId(wall, map) === levelId
      ? [
          {
            id: `wall:${wall.id ?? index}`,
            kind: 'wall',
            segment: { a: wall.a, b: wall.b },
          },
        ]
      : [],
  ),
  ...map.doors.flatMap((door): readonly VisibilityBlocker[] =>
    entryLevelId(door, map) === levelId &&
    (doorStates[door.id] ?? door.defaultState) === 'closed' &&
    door.blocksSightWhenClosed
      ? [{ id: `door:${door.id}`, kind: 'door', segment: door.segment }]
      : [],
  ),
]

export const prepareVisibilityGeometry = (
  map: MapDefinition,
  doorStates: Readonly<Record<string, DoorState>>,
  levelId = getDefaultLevelId(map),
): PreparedVisibilityGeometry => {
  const blockers = visibilityBlockersForMap(map, doorStates, levelId)
  return { blockers, segments: blockers.map((blocker) => blocker.segment) }
}

export const visibilitySegmentsNear = (
  segments: readonly Segment[],
  origin: GridPoint,
  range: number,
): readonly Segment[] => {
  const minX = origin.x - range
  const maxX = origin.x + range
  const minY = origin.y - range
  const maxY = origin.y + range
  return segments.filter(
    (segment) =>
      Math.max(segment.a.x, segment.b.x) >= minX &&
      Math.min(segment.a.x, segment.b.x) <= maxX &&
      Math.max(segment.a.y, segment.b.y) >= minY &&
      Math.min(segment.a.y, segment.b.y) <= maxY,
  )
}

export const visibilityBlockersNear = (
  blockers: readonly VisibilityBlocker[],
  origin: GridPoint,
  range: number,
): readonly VisibilityBlocker[] => {
  const minX = origin.x - range
  const maxX = origin.x + range
  const minY = origin.y - range
  const maxY = origin.y + range
  return blockers.filter(
    ({ segment }) =>
      Math.max(segment.a.x, segment.b.x) >= minX &&
      Math.min(segment.a.x, segment.b.x) <= maxX &&
      Math.max(segment.a.y, segment.b.y) >= minY &&
      Math.min(segment.a.y, segment.b.y) <= maxY,
  )
}

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
): readonly Polygon[] =>
  combineVisibilityPolygonsWithPreparedGeometry(
    tokens,
    map,
    prepareVisibilityGeometry(map, doorStates, levelId),
    lightSources,
    levelId,
  )

export const combineVisibilityPolygonsWithPreparedGeometry = (
  tokens: readonly PlacedToken[],
  map: MapDefinition,
  geometry: PreparedVisibilityGeometry,
  lightSources: readonly FogLightSource[],
  levelId = getDefaultLevelId(map),
): readonly Polygon[] =>
  combineVisibilityFieldsWithPreparedGeometry(tokens, map, geometry, lightSources, levelId).map(
    (field) => field.polygon,
  )

export const combineVisibilityFieldsWithPreparedGeometry = (
  tokens: readonly PlacedToken[],
  map: MapDefinition,
  geometry: PreparedVisibilityGeometry,
  lightSources: readonly FogLightSource[],
  levelId = getDefaultLevelId(map),
): readonly VisibilityField[] => {
  const segments = geometry.segments
  const blockers = geometry.blockers
  const tokenPolygons = tokens
    .filter((token) => (token.levelId ?? getDefaultLevelId(map)) === levelId)
    .map((token) =>
      token.visionEnabled && token.visionRange > 0
        ? (() => {
            const nearbyBlockers = visibilityBlockersNear(
              blockers,
              token.position,
              token.visionRange,
            )
            const visibility = computeVisibility(
              {
                origin: token.position,
                range: token.visionRange,
                rotationDegrees: token.rotation,
                visionAngleDegrees: token.visionAngle,
                segments,
                intersectionSegments: nearbyBlockers.map((blocker) => blocker.segment),
              },
              nearbyBlockers,
            )
            return {
              token,
              polygon: visibility.polygon,
              visibleBlockers: visibility.visibleBlockers,
            }
          })()
        : null,
    )
    .filter(
      (
        entry,
      ): entry is {
        readonly token: PlacedToken
        readonly polygon: Polygon
        readonly visibleBlockers: readonly VisibleVisibilityBlocker[]
      } => entry !== null && entry.polygon.length > 2,
    )

  const radialLights = lightSources.filter(isRadialLightSource)
  const daylightAreas = lightSources.filter(isDaylightAreaSource)

  const lightFields = tokenPolygons
    .flatMap(({ token, polygon }) =>
      radialLights.map<VisibilityField | null>((light) =>
        tokenCanActivateLight(token, polygon, light, segments)
          ? computeTokenLimitedLightField(token, light, blockers)
          : null,
      ),
    )
    .filter((field): field is VisibilityField => field !== null && field.polygon.length > 2)

  const daylightFields = tokenPolygons
    .flatMap(({ token }) =>
      daylightAreas.map<VisibilityField | null>((area) =>
        pointInBounds(token.position, area.bounds) ? { polygon: daylightPolygon(area) } : null,
      ),
    )
    .filter((field): field is VisibilityField => field !== null && field.polygon.length > 2)

  return [
    ...tokenPolygons.map(
      ({ token: visibleToken, polygon, visibleBlockers }): VisibilityField => ({
        polygon,
        rangeBoundary: { origin: visibleToken.position, range: visibleToken.visionRange },
        visibleBlockers,
      }),
    ),
    ...lightFields,
    ...daylightFields,
  ]
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

const computeTokenLimitedLightField = (
  token: PlacedToken,
  light: FogRadialLightSource,
  blockers: readonly VisibilityBlocker[],
): VisibilityField => {
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
  const nearbyBlockers = visibilityBlockersNear(blockers, token.position, maxDistance)
  const outerPoints: GridPoint[] = []
  const innerPoints: GridPoint[] = []
  const outerSamples: VisibilityRaySample[] = []

  for (let index = 0; index <= LIGHT_RAY_COUNT; index += 1) {
    const angle = centerAngle - halfAngle + (halfAngle * 2 * index) / LIGHT_RAY_COUNT
    if (!isInsideVisionAngle(angle, rotation, visionAngle)) {
      continue
    }

    const circleHit = rayCircleIntersection(token.position, angle, light.position, light.range)
    if (!circleHit || circleHit.near > token.visionRange + EPSILON) {
      continue
    }

    const blockerHit = closestVisibilityBlockerHit(
      token.position,
      angle,
      nearbyBlockers,
      maxDistance,
    )
    const far = Math.min(circleHit.far, blockerHit?.distance ?? maxDistance)
    if (far + EPSILON < circleHit.near) {
      continue
    }

    innerPoints.push(pointOnRay(token.position, angle, circleHit.near))
    const outerPoint = pointOnRay(token.position, angle, far)
    outerPoints.push(outerPoint)
    outerSamples.push({
      point: outerPoint,
      blocker:
        blockerHit && blockerHit.distance <= circleHit.far + EPSILON ? blockerHit.blocker : null,
    })
  }

  if (outerPoints.length < 2) {
    return { polygon: [], rangeBoundary: { origin: light.position, range: light.range } }
  }

  return {
    polygon: [...outerPoints, ...innerPoints.reverse()],
    rangeBoundary: { origin: light.position, range: light.range },
    visibleBlockers: visibleBlockersFromSamples(outerSamples, false),
  }
}
