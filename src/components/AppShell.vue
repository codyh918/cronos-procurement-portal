<template>
  <div class="app-shell">
    <Sidebar />
    <main class="app-main">
      <RouterView />
    </main>
    <AiAssistant />
  </div>
</template>

<script setup lang="ts">
import AiAssistant from './AiAssistant.vue'
import Sidebar from './Sidebar.vue'
</script>
