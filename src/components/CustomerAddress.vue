<template>
  <address class="customer-address-block">
    <strong v-if="customer.companyName">{{ customer.companyName }}</strong>
    <span v-if="customer.attention && customer.attention.toLowerCase() !== customer.companyName.toLowerCase()">{{ customer.attention }}</span>
    <span v-for="line in addressLines" :key="line">{{ line }}</span>
    <small v-if="customer.email">{{ customer.email }}</small>
    <small v-if="customer.phone">{{ customer.phone }}</small>
  </address>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatCustomerAddressLines, structuredCustomerFromProject } from '../services/customerFormatting'
import type { Project } from '../types'

const props = defineProps<{
  project?: Project
  fallbackCompany?: string
}>()

const customer = computed(() => structuredCustomerFromProject(props.project, props.fallbackCompany ?? ''))
const addressLines = computed(() => formatCustomerAddressLines(customer.value))
</script>
