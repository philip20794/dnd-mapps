import { createRouter, createWebHistory } from 'vue-router'
import TabletopView from '@/views/TabletopView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'tabletop',
      component: TabletopView,
    },
  ],
})

export default router
