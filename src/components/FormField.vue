<template>
  <label class="form-field">
    <span>{{ label }}</span>
    <input
      :value="modelValue"
      :type="type"
      :placeholder="placeholder"
      :required="required"
      :step="step"
      :min="min"
      @input="emitValue"
    />
  </label>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: string | number
    label: string
    placeholder: string
    required?: boolean
    type?: string
    step?: string
    min?: string
  }>(),
  {
    required: false,
    type: 'text',
    step: undefined,
    min: undefined,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

function emitValue(event: Event) {
  const input = event.target as HTMLInputElement
  emit('update:modelValue', props.type === 'number' ? Number(input.value) : input.value)
}
</script>
