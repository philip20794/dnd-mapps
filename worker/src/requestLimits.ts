import type { MapGenerationRequest } from '../../src/map-generation/types.js'

export const MAX_REQUEST_BYTES = 32 * 1024

const maximum = (
  errors: string[],
  value: number | undefined,
  limit: number,
  label: string,
): void => {
  if (value !== undefined && value > limit) errors.push(`${label} darf höchstens ${limit} sein.`)
}

export const validateWorkerRequestLimits = (
  request: MapGenerationRequest,
): readonly string[] => {
  const errors: string[] = []
  if ((request.description?.length ?? 0) > 2_000)
    errors.push('description darf höchstens 2000 Zeichen enthalten.')
  maximum(errors, request.width, 200, 'width')
  maximum(errors, request.height, 200, 'height')
  if ((request.width ?? 0) * (request.height ?? 0) > 40_000)
    errors.push('Die Karte darf höchstens 40000 Zellen enthalten.')
  maximum(errors, request.dungeon?.roomCount, 120, 'dungeon.roomCount')
  maximum(errors, request.dungeon?.levelCount, 8, 'dungeon.levelCount')
  maximum(errors, request.dungeon?.entranceCount, 16, 'dungeon.entranceCount')
  if ((request.biomes?.length ?? 0) > 4) errors.push('biomes darf höchstens 4 Einträge enthalten.')
  if ((request.waterFeatures?.length ?? 0) > 4)
    errors.push('waterFeatures darf höchstens 4 Einträge enthalten.')
  if ((request.themes?.length ?? 0) > 4) errors.push('themes darf höchstens 4 Einträge enthalten.')
  if ((request.features?.length ?? 0) > 4)
    errors.push('features darf höchstens 4 Einträge enthalten.')
  return errors
}
