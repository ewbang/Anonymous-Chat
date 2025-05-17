import { createApp } from 'vue'
import App from '../App.vue'
import { createRouter, createWebHistory } from 'vue-router'
import Chat from '../components/Chat.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: Chat
    }
  ]
})

const app = createApp(App)
app.use(router)
app.mount('#app') 