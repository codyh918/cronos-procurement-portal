<template>
  <label class="tracking-field">
    <span>{{ label }}</span>
    <input :type="type" :value="value" @input="emitChange" />
  </label>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    value: string
    type?: string
  }>(),
  { type: 'text' },
)

const emit = defineEmits<{
  change: [value: string]
}>()

function emitChange(event: Event) {
  emit('change', (event.target as HTMLInputElement).value)
}
</script>
