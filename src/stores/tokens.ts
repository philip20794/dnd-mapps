import { defineStore } from 'pinia'
import type { GridPoint } from '@/types/geometry'
import type { PlacedToken, TokenPatch } from '@/types/tokens'
import { findTokenTemplate } from '@/types/tokens'

interface TokenState {
  tokens: PlacedToken[]
  selectedTokenId: string | null
  nextTokenNumber: number
}

const createTokenId = (number: number): string => `token-${number.toString(36)}`

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

      const token: PlacedToken = {
        id: createTokenId(this.nextTokenNumber),
        mapId,
        levelId,
        name: template.name,
        position,
        size: 1,
        rotation: 0,
        visionRange: template.defaultVisionRange,
        visionAngle: null,
        visionEnabled: true,
        category: template.category,
        color: template.color,
        symbol: template.symbol,
      }
      this.nextTokenNumber += 1
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
    updateToken(tokenId: string, patch: TokenPatch): void {
      this.tokens = this.tokens.map((token) =>
        token.id === tokenId ? { ...token, ...patch } : token,
      )
    },
    deleteSelectedToken(): void {
      if (!this.selectedTokenId) {
        return
      }
      this.tokens = this.tokens.filter((token) => token.id !== this.selectedTokenId)
      this.selectedTokenId = null
    },
    resetMapTokens(mapId: string, startTokens: readonly PlacedToken[] = []): void {
      this.tokens = [...this.tokens.filter((token) => token.mapId !== mapId), ...startTokens]
      this.selectedTokenId = null
      this.nextTokenNumber = Math.max(this.nextTokenNumber, this.tokens.length + 1)
    },
    replaceTokens(tokens: readonly PlacedToken[]): void {
      this.tokens = [...tokens]
      this.selectedTokenId = null
      this.nextTokenNumber = Math.max(1, tokens.length + 1)
    },
  },
})
