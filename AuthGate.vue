<template>
  <button
    class="atlas-fab"
    type="button"
    aria-label="Open Cronos assistant"
    title="Atlas"
    @click="open = true"
  >
    <MessageSquare :size="24" />
  </button>

  <div v-if="open" class="atlas-overlay">
    <button class="atlas-backdrop" type="button" aria-label="Close assistant overlay" @click="open = false" />
    <aside class="atlas-drawer" aria-label="Atlas assistant">
      <header class="atlas-header">
        <div class="atlas-title-row">
          <span class="atlas-avatar"><Bot :size="22" /></span>
          <div>
            <h2>Atlas</h2>
            <p>Projects, POs, tracking, receiving</p>
          </div>
        </div>
        <button class="atlas-close" type="button" aria-label="Close assistant" @click="open = false">
          <X :size="20" />
        </button>
      </header>

      <div ref="listRef" class="atlas-messages">
        <div
          v-for="(message, index) in messages"
          :key="`${message.role}-${index}`"
          class="atlas-message-row"
          :class="{ 'is-user': message.role === 'user' }"
        >
          <div class="atlas-message" :class="{ 'is-user': message.role === 'user' }">
            {{ message.content }}
          </div>
        </div>
        <div v-if="loading" class="atlas-message-row">
          <div class="atlas-thinking">
            <Loader2 class="spin" :size="16" />
            <span>Thinking</span>
          </div>
        </div>
      </div>

      <div class="atlas-composer-panel">
        <div class="atlas-starters">
          <button v-for="starter in starters" :key="starter" type="button" @click="submitQuestion(starter)">
            <Sparkles :size="13" />
            <span>{{ starter }}</span>
          </button>
        </div>
        <form class="atlas-composer" @submit.prevent="submitQuestion()">
          <textarea
            v-model="input"
            placeholder="Ask about a project, PO, tracking, receiving..."
            @keydown.enter.exact.prevent="submitQuestion()"
          />
          <button type="submit" :disabled="loading || !input.trim()" aria-label="Send message">
            <Send :size="18" />
          </button>
        </form>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { Bot, Loader2, MessageSquare, Send, Sparkles, X } from '@lucide/vue'
import { answerAssistantQuestion, type AssistantMessage } from '../services/assistant'
import { loadProjects } from '../services/localProjects'

const starters = [
  'Summarize project 25-100.',
  'Which POs are missing tracking?',
  'What receiving work is still open?',
  'Draft a customer tracking update.',
]

const open = ref(false)
const input = ref('')
const loading = ref(false)
const listRef = ref<HTMLElement | null>(null)
const messages = ref<AssistantMessage[]>([
  {
    role: 'assistant',
    content: 'Hi, I am Atlas, the Cronos AI assistant. Ask me about projects, quotes, POs, tracking, receiving, or customer updates.',
  },
])

watch([messages, loading, open], () => {
  void nextTick(scrollToLatest)
}, { deep: true })

onMounted(() => {
  window.addEventListener('cronos:open-assistant', openAssistant)
})

onUnmounted(() => {
  window.removeEventListener('cronos:open-assistant', openAssistant)
})

function openAssistant() {
  open.value = true
}

function submitQuestion(override?: string) {
  const question = (override ?? input.value).trim()
  if (!question || loading.value) return

  messages.value = [...messages.value, { role: 'user', content: question }]
  input.value = ''
  loading.value = true

  window.setTimeout(() => {
    messages.value = [
      ...messages.value,
      {
        role: 'assistant',
        content: answerAssistantQuestion(question, loadProjects()),
      },
    ]
    loading.value = false
  }, 180)
}

function scrollToLatest() {
  if (!listRef.value) return
  listRef.value.scrollTo({ top: listRef.value.scrollHeight, behavior: 'smooth' })
}
</script>
