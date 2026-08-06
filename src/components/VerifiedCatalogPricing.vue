<template>
  <div v-if="partNumber.trim()" class="verified-price-panel">
    <p v-if="loading" class="verified-price-message">Checking verified catalog pricing…</p>
    <p v-else-if="error" class="verified-price-message price-error">{{ error }}</p>
    <p v-else-if="!prices.length" class="verified-price-message">No catalog pricing records found for this exact part number.</p>
    <template v-else>
      <div class="verified-price-heading">
        <strong>{{ applicablePrices.length ? 'Catalog price available' : 'Catalog pricing found — none currently applicable' }}</strong>
        <span>{{ prices.length }} pricing record{{ prices.length === 1 ? '' : 's' }}</span>
      </div>
      <div class="verified-price-records">
        <article v-for="price in prices" :key="price.id" class="verified-price-card" :class="{ disabled: !price.applicable }">
          <div class="verified-price-summary">
            <strong>{{ currency(price.new_cost) }}</strong>
            <span class="catalog-price-status" :class="price.applicable ? 'is-verified' : 'is-blocked'">{{ price.display_status }}</span>
          </div>
          <dl>
            <div><dt>Vendor</dt><dd>{{ price.vendor || '—' }}</dd></div>
            <div><dt>Effective</dt><dd>{{ formatDate(price.effective_date) }}</dd></div>
            <div><dt>Expires</dt><dd>{{ price.expiration_date ? formatDateOnly(price.expiration_date) : 'No expiration' }}</dd></div>
            <div><dt>Days remaining</dt><dd>{{ price.days_remaining ?? 'No expiration' }}</dd></div>
            <div><dt>Quantity basis</dt><dd>{{ price.quantity_basis ?? 'Any quantity' }}</dd></div>
            <div><dt>Verified</dt><dd>{{ price.verified_at ? formatDate(price.verified_at) : 'Not verified' }}</dd></div>
            <div><dt>Verified by</dt><dd>{{ price.verified_by_name || '—' }}</dd></div>
          </dl>
          <button class="primary-action apply-catalog-price" type="button" :disabled="!price.applicable" :title="price.disabled_reason" @click="$emit('apply', price)">
            Apply Verified Catalog Price
          </button>
          <small v-if="!price.applicable">{{ price.disabled_reason }}</small>
        </article>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { currency } from '../services/calculations'
import { findVerifiedCatalogPrices, type VerifiedCatalogPrice } from '../services/productCatalogApi'

const props = withDefaults(defineProps<{ partNumber: string; manufacturer?: string; quantity?: number }>(), { manufacturer: '', quantity: 0 })
defineEmits<{ apply: [price: VerifiedCatalogPrice] }>()
const prices = ref<VerifiedCatalogPrice[]>([]); const loading = ref(false); const error = ref('')
const applicablePrices = computed(() => prices.value.filter(price => price.applicable))
let timer: ReturnType<typeof setTimeout> | undefined; let requestId = 0

watch(() => [props.partNumber, props.manufacturer, props.quantity], () => {
  if (timer) clearTimeout(timer)
  const part = props.partNumber.trim(); prices.value = []; error.value = ''
  if (!part) return
  timer = setTimeout(() => void load(part), 250)
}, { immediate: true })

onBeforeUnmount(() => { if (timer) clearTimeout(timer) })

async function load(part: string) {
  const current = ++requestId; loading.value = true
  try {
    const result = await findVerifiedCatalogPrices(part, props.manufacturer, props.quantity)
    if (current === requestId) prices.value = result.prices
  } catch (cause) {
    if (current === requestId) error.value = cause instanceof Error ? cause.message : 'Unable to check catalog pricing.'
  } finally { if (current === requestId) loading.value = false }
}

function formatDate(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) }
function formatDateOnly(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value)) }
</script>
