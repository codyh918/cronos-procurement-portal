<template>
  <label class="vendor-field">
    <span>{{ label }}{{ required ? ' *' : '' }}</span>
    <input :type="type" :value="modelValue" :placeholder="placeholder" @input="emitValue" />
  </label>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: string
    label: string
    placeholder: string
    required?: boolean
    type?: string
  }>(),
  {
    required: false,
    type: 'text',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function emitValue(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}
</script>
