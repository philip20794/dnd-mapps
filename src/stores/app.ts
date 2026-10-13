import { defineStore } from 'pinia'

interface AppState {
  sidebarCollapsed: boolean
  toolbarCollapsed: boolean
  selectedTool: 'auswahl' | 'verschieben'
  error: string | null
  status: string
}

export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    sidebarCollapsed: true,
    toolbarCollapsed: false,
    selectedTool: 'auswahl',
    error: null,
    status: 'Bereit',
  }),
  actions: {
    toggleSidebar(): void {
      this.sidebarCollapsed = !this.sidebarCollapsed
    },
    toggleToolbar(): void {
      const collapsed = !this.toolbarCollapsed
      this.toolbarCollapsed = collapsed
      if (collapsed) {
        this.sidebarCollapsed = true
      }
    },
    setError(message: string | null): void {
      this.error = message
    },
    setStatus(message: string): void {
      this.status = message
    },
  },
})
