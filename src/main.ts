import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/tokens.css'
import './styles/ui.css'
import './style.css'
import './styles/equity-scout.css'
import './styles/cims.css'

const savedTheme = localStorage.getItem('equity-scout.theme')
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
document.documentElement.dataset.theme = savedTheme ?? (prefersDark ? 'dark' : 'light')

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
