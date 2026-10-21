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
    toolbarCollapsed: true,
    selectedTool: 'auswahl',
    error: null,
    status: 'Bereit',
  }),
  actions: {
    toggleSidebar(): void {
      this.sidebarCollapsed = !this.sidebarCollapsed
    },
    toggleToolbar(): void {
      this.toolbarCollapsed = !this.toolbarCollapsed
    },
    setError(message: string | null): void {
      this.error = message
    },
    setStatus(message: string): void {
      this.status = message
    },
  },
})
