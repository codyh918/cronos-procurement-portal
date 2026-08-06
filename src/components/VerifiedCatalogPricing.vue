<template>
  <div v-if="partNumber.trim()" class="verified-price-panel compact">
    <span v-if="loading" class="verified-price-message">Checking catalog…</span>
    <span v-else-if="error" class="verified-price-message price-error">{{ error }}</span>
    <template v-else-if="applicablePrices.length">
      <div class="compact-price-row">
        <span class="catalog-price-status is-verified">Verified</span>
        <select v-model="selectedId" class="compact-price-select" aria-label="Verified catalog price">
          <option v-for="price in applicablePrices" :key="price.id" :value="price.id">{{ optionLabel(price) }}</option>
        </select>
        <button class="primary-action compact-apply-price" type="button" @click="applySelected">Apply</button>
      </div>
      <p v-if="selectedPrice" class="compact-price-meta">
        {{ selectedPrice.vendor }} · effective {{ formatDateOnly(selectedPrice.effective_date) }} ·
        expires {{ selectedPrice.expiration_date ? formatDateOnly(selectedPrice.expiration_date) : 'never' }} ·
        {{ selectedPrice.days_remaining ?? 'no expiration' }}{{ selectedPrice.days_remaining === null ? '' : ' days left' }} ·
        qty {{ selectedPrice.quantity_basis ?? 'any' }} · verified {{ selectedPrice.verified_at ? formatDateOnly(selectedPrice.verified_at) : '—' }} by {{ selectedPrice.verified_by_name || '—' }}
      </p>
      <details v-if="unavailablePrices.length" class="unavailable-prices">
        <summary>{{ unavailablePrices.length }} unavailable pricing record{{ unavailablePrices.length === 1 ? '' : 's' }}</summary>
        <div v-for="price in unavailablePrices" :key="price.id" class="unavailable-price-row">
          <span>{{ currency(price.new_cost) }} · {{ price.vendor || price.manufacturer }}</span>
          <span class="catalog-price-status is-blocked">{{ price.display_status }}</span>
          <small>{{ price.disabled_reason }}</small>
        </div>
      </details>
    </template>
    <details v-else-if="prices.length" class="unavailable-prices blocked-only">
      <summary>No applicable verified price · view {{ prices.length }} record{{ prices.length === 1 ? '' : 's' }}</summary>
      <div v-for="price in prices" :key="price.id" class="unavailable-price-row">
        <span>{{ currency(price.new_cost) }} · {{ price.vendor || price.manufacturer }}</span>
        <span class="catalog-price-status is-blocked">{{ price.display_status }}</span>
        <small>{{ price.disabled_reason }}</small>
      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { currency } from '../services/calculations'
import { findVerifiedCatalogPrices, type VerifiedCatalogPrice } from '../services/productCatalogApi'

const props = withDefaults(defineProps<{ partNumber: string; manufacturer?: string; quantity?: number }>(), { manufacturer: '', quantity: 0 })
const emit = defineEmits<{ apply: [price: VerifiedCatalogPrice] }>()
const prices = ref<VerifiedCatalogPrice[]>([]); const loading = ref(false); const error = ref(''); const selectedId = ref('')
const applicablePrices = computed(() => prices.value.filter(price => price.applicable))
const unavailablePrices = computed(() => prices.value.filter(price => !price.applicable))
const selectedPrice = computed(() => applicablePrices.value.find(price => price.id === selectedId.value) || applicablePrices.value[0])
let timer: ReturnType<typeof setTimeout> | undefined; let requestId = 0

watch(() => [props.partNumber, props.manufacturer, props.quantity], () => {
  if (timer) clearTimeout(timer)
  const part = props.partNumber.trim(); prices.value = []; selectedId.value = ''; error.value = ''
  if (!part) return
  timer = setTimeout(() => void load(part), 250)
}, { immediate: true })
onBeforeUnmount(() => { if (timer) clearTimeout(timer) })

async function load(part: string) {
  const current = ++requestId; loading.value = true
  try {
    const result = await findVerifiedCatalogPrices(part, props.manufacturer, props.quantity)
    if (current === requestId) { prices.value = result.prices; selectedId.value = result.prices.find(price => price.applicable)?.id || '' }
  } catch (cause) { if (current === requestId) error.value = cause instanceof Error ? cause.message : 'Unable to check catalog pricing.' }
  finally { if (current === requestId) loading.value = false }
}

function applySelected() { if (selectedPrice.value?.applicable) emit('apply', selectedPrice.value) }
function optionLabel(price: VerifiedCatalogPrice) { return `${currency(price.new_cost)} · ${price.vendor || price.manufacturer} · exp ${price.expiration_date ? formatDateOnly(price.expiration_date) : 'none'} · qty ${price.quantity_basis ?? 'any'}` }
function formatDateOnly(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value)) }
</script>
