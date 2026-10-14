import { defineStore } from 'pinia'
import type { GridPoint } from '@/types/geometry'
import type { PlacedToken, QuickTokenCreation, TokenPatch } from '@/types/tokens'
import { findTokenTemplate } from '@/types/tokens'

interface TokenState {
  tokens: PlacedToken[]
  selectedTokenId: string | null
  nextTokenNumber: number
}

const createTokenId = (number: number): string => `token-${number.toString(36)}`

const tokenNumber = (tokenId: string): number | null => {
  if (!tokenId.startsWith('token-')) return null
  const parsed = Number.parseInt(tokenId.slice('token-'.length), 36)
  return Number.isFinite(parsed) ? parsed : null
}

const nextTokenNumberFor = (tokens: readonly PlacedToken[]): number =>
  Math.max(1, ...tokens.map((token) => (tokenNumber(token.id) ?? 0) + 1))

const nextUniqueToken = (
  tokens: readonly PlacedToken[],
  requestedNumber: number,
): { readonly id: string; readonly nextNumber: number } => {
  const knownIds = new Set(tokens.map((token) => token.id))
  let number = Math.max(requestedNumber, nextTokenNumberFor(tokens))
  while (knownIds.has(createTokenId(number))) number += 1
  return { id: createTokenId(number), nextNumber: number + 1 }
}

const hasSightlessOpponentDefault = (category: PlacedToken['category']): boolean =>
  category === 'monster' || category === 'undead'

export const useTokenStore = defineStore('tokens', {
  state: (): TokenState => ({
    tokens: [],
    selectedTokenId: null,
    nextTokenNumber: 1,
  }),
  getters: {
    selectedToken: (state): PlacedToken | null =>
      state.tokens.find((token) => token.id === state.selectedTokenId) ?? null,
    tokensForMap:
      (state) =>
      (mapId: string): readonly PlacedToken[] =>
        state.tokens.filter((token) => token.mapId === mapId),
  },
  actions: {
    addTokenFromTemplate(
      kind: string,
      mapId: string,
      position: GridPoint,
      levelId?: string,
    ): PlacedToken {
      const template = findTokenTemplate(kind)
      if (!template) {
        throw new Error(`Unbekanntes Token "${kind}".`)
      }

      const identity = nextUniqueToken(this.tokens, this.nextTokenNumber)
      const hasSightlessDefault = hasSightlessOpponentDefault(template.category)
      const token: PlacedToken = {
        id: identity.id,
        mapId,
        levelId,
        name: template.name,
        position,
        size: 1,
        rotation: 0,
        visionRange: hasSightlessDefault ? 0 : template.defaultVisionRange,
        visionAngle: null,
        visionEnabled: !hasSightlessDefault && template.defaultVisionRange > 0,
        category: template.category,
        color: template.color,
        symbol: template.symbol,
      }
      this.nextTokenNumber = identity.nextNumber
      this.tokens.push(token)
      this.selectedTokenId = token.id
      return token
    },
    addQuickToken(
      creation: QuickTokenCreation,
      mapId: string,
      position: GridPoint,
      levelId?: string,
    ): PlacedToken {
      const identity = nextUniqueToken(this.tokens, this.nextTokenNumber)
      const player = creation.category === 'player'
      const token: PlacedToken = {
        id: identity.id,
        mapId,
        levelId,
        name: player ? 'Spieler' : 'Gegner',
        position,
        size: creation.size,
        rotation: 0,
        visionRange: player ? 8 : 0,
        visionAngle: null,
        visionEnabled: player,
        category: creation.category,
        color: creation.color,
        symbol: player ? 'P' : 'G',
      }
      this.nextTokenNumber = identity.nextNumber
      this.tokens.push(token)
      this.selectedTokenId = token.id
      return token
    },
    setSelectedToken(tokenId: string | null): void {
      this.selectedTokenId = tokenId
    },
    moveToken(tokenId: string, position: GridPoint): void {
      this.updateToken(tokenId, { position })
    },
    updateTokenColor(tokenId: string, color: string): void {
      this.updateToken(tokenId, { color })
    },
    setTokenVisionRange(tokenId: string, visionRange: number): void {
      const normalizedRange = Number.isFinite(visionRange) ? Math.max(0, visionRange) : 0
      this.updateToken(tokenId, {
        visionRange: normalizedRange,
        visionEnabled: normalizedRange > 0,
      })
    },
    setTokenVisionEnabled(tokenId: string, enabled: boolean): void {
      const token = this.tokens.find((entry) => entry.id === tokenId)
      if (!token) return
      this.updateToken(tokenId, { visionEnabled: enabled && token.visionRange > 0 })
    },
    updateToken(tokenId: string, patch: TokenPatch): void {
      this.tokens = this.tokens.map((token) =>
        token.id === tokenId ? { ...token, ...patch } : token,
      )
    },
    deleteToken(tokenId: string): void {
      this.tokens = this.tokens.filter((token) => token.id !== tokenId)
      if (this.selectedTokenId === tokenId) this.selectedTokenId = null
    },
    deleteSelectedToken(): void {
      if (this.selectedTokenId) this.deleteToken(this.selectedTokenId)
    },
    resetMapTokens(mapId: string, startTokens: readonly PlacedToken[] = []): void {
      this.tokens = [...this.tokens.filter((token) => token.mapId !== mapId), ...startTokens]
      this.selectedTokenId = null
      this.nextTokenNumber = Math.max(this.nextTokenNumber, nextTokenNumberFor(this.tokens))
    },
    replaceTokens(tokens: readonly PlacedToken[]): void {
      this.tokens = [...tokens]
      this.selectedTokenId = null
      this.nextTokenNumber = nextTokenNumberFor(tokens)
    },
  },
})
