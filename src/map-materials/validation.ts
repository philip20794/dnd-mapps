import { materialDecalKinds, materialIds, type MaterialLayerDefinition } from './types'

const materialSet = new Set<string>(materialIds)
const decalSet = new Set<string>(materialDecalKinds)

export const validateMaterialLayer = (
  layer: MaterialLayerDefinition,
  mapWidth: number,
  mapHeight: number,
): readonly string[] => {
  const errors: string[] = []
  if (!layer.id.trim()) errors.push('Material-Layer ohne ID.')
  if (layer.chunkSize !== undefined && (layer.chunkSize < 8 || layer.chunkSize > 32))
    errors.push(`Material-Layer "${layer.id}" hat eine Chunk-Groesse ausserhalb 8..32.`)
  layer.areas.forEach((area, index) => {
    const label = area.id ?? `${layer.id}-area-${index + 1}`
    if (!materialSet.has(area.material))
      errors.push(`Materialflaeche "${label}" verwendet ein unbekanntes Material.`)
    if (area.width <= 0 || area.height <= 0)
      errors.push(`Materialflaeche "${label}" hat ungueltige Masse.`)
    if (
      area.position.x < 0 ||
      area.position.y < 0 ||
      area.position.x + area.width > mapWidth ||
      area.position.y + area.height > mapHeight
    )
      errors.push(`Materialflaeche "${label}" liegt ausserhalb der Karte.`)
    if (area.scale !== undefined && (area.scale < 0.75 || area.scale > 1.25))
      errors.push(`Materialflaeche "${label}" hat eine zu starke Skalierungsvariation.`)
    if (area.alpha !== undefined && (area.alpha < 0 || area.alpha > 1))
      errors.push(`Materialflaeche "${label}" hat eine Deckkraft ausserhalb 0..1.`)
    if (area.variant !== undefined && (!Number.isInteger(area.variant) || area.variant < 0))
      errors.push(`Materialflaeche "${label}" hat eine ungueltige Variante.`)
  })
  layer.decals?.forEach((decal, index) => {
    const label = decal.id ?? `${layer.id}-decal-${index + 1}`
    if (!decalSet.has(decal.kind)) errors.push(`Decal "${label}" verwendet einen unbekannten Typ.`)
    if (
      decal.position.x < 0 ||
      decal.position.y < 0 ||
      decal.position.x + (decal.width ?? 1) * (decal.scale ?? 1) > mapWidth ||
      decal.position.y + (decal.height ?? 1) * (decal.scale ?? 1) > mapHeight
    )
      errors.push(`Decal "${label}" liegt ausserhalb der Karte.`)
    if (decal.density !== undefined && (decal.density < 0 || decal.density > 1))
      errors.push(`Decal "${label}" hat eine Dichte ausserhalb 0..1.`)
    if ((decal.width ?? 1) <= 0 || (decal.height ?? 1) <= 0 || (decal.scale ?? 1) <= 0)
      errors.push(`Decal "${label}" hat ungueltige Masse.`)
    if (decal.alpha !== undefined && (decal.alpha < 0 || decal.alpha > 1))
      errors.push(`Decal "${label}" hat eine Deckkraft ausserhalb 0..1.`)
    if (decal.rotation !== undefined && !Number.isFinite(decal.rotation))
      errors.push(`Decal "${label}" hat eine ungueltige Rotation.`)
  })
  return errors
}
