<template>
  <div v-if="!lines.length" class="quote-lines-empty">
    <p>{{ emptyMessage }}</p>
  </div>

  <div v-else class="quote-lines-scroll">
    <table class="quote-lines-table">
      <thead>
        <tr>
          <th v-for="heading in headings" :key="heading">{{ heading }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="line in lines" :key="line.id">
          <td>
            <input
              class="cell-input w-36"
              :value="line.partNumber"
              :list="`quote-line-part-suggestions-${line.id}`"
              @input="updatePartNumber(line.id, inputValue($event))"
            />
            <p class="quote-line-catalog-help">
              {{ catalogHint(line.partNumber) }}
            </p>
            <datalist :id="`quote-line-part-suggestions-${line.id}`">
              <option v-for="record in findPartPriceSuggestions(line.partNumber)" :key="record.id" :value="record.partNumber">
                {{ record.description }} - {{ record.vendor }}
              </option>
            </datalist>
          </td>
          <td><input class="cell-input w-36" :value="line.manufacturer" @input="updateLine(line.id, { manufacturer: inputValue($event) })" /></td>
          <td>
            <textarea class="cell-textarea" :value="line.description" @input="updateLine(line.id, { description: inputValue($event) })" />
          </td>
          <td><input class="cell-input w-20" type="number" min="0" :value="line.quantity" @input="updateLine(line.id, { quantity: numberValue($event) })" /></td>
          <td>
            <input
              class="cell-input w-28"
              type="number"
              min="0"
              step="0.01"
              :value="line.unitCost"
              @input="updateLine(line.id, { unitCost: numberValue($event) })"
            />
          </td>
          <template v-if="showPricingControls">
            <td>
              <input
                class="cell-input w-24"
                type="number"
                min="0"
                step="0.01"
                :value="line.markupPercent"
                @input="updateLine(line.id, { pricingMode: 'markup', markupPercent: numberValue($event) })"
              />
            </td>
          </template>
          <td>
            <select class="cell-input w-44" :value="line.vendor" @change="updateLine(line.id, { vendor: inputValue($event) })">
              <option value="">Select vendor</option>
              <option v-for="vendor in getVendorOptions(line.vendor)" :key="vendor" :value="vendor">{{ vendor }}</option>
            </select>
          </td>
          <td><input class="cell-input w-36" :value="line.quoteNumber" @input="updateLine(line.id, { quoteNumber: inputValue($event) })" /></td>
          <td>
            <input
              class="cell-input w-40"
              :value="line.leadTime"
              placeholder="8-10 weeks"
              aria-label="Lead time"
              @input="updateLine(line.id, { leadTime: inputValue($event) })"
            />
          </td>
          <td>{{ currency(calculateLineTotals(line).sellPrice) }}</td>
          <td>{{ currency(calculateLineTotals(line).extendedSellPrice) }}</td>
          <td class="profit-cell">{{ currency(calculateLineTotals(line).grossProfit) }}</td>
          <td class="action-cell">
            <button class="delete-line-button" type="button" :aria-label="`Remove ${line.partNumber || 'line'}`" @click="removeLine(line.id)">
              <Trash2 :size="16" />
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Trash2 } from '@lucide/vue'
import { calculateLineTotals, currency } from '../services/calculations'
import { findLatestPartPrice, findPartPriceSuggestions } from '../services/partCatalog'
import { recommendVendorForPart } from '../services/vendorIntelligence'
import { getVendorOptions } from '../services/vendors'
import type { QuoteLine } from '../types'

const props = withDefaults(
  defineProps<{
    lines: QuoteLine[]
    emptyMessage: string
    showPricingControls?: boolean
  }>(),
  { showPricingControls: true },
)

const emit = defineEmits<{
  change: [lines: QuoteLine[]]
}>()

const headings = computed(() => [
  'Part Number',
  'Manufacturer',
  'Description',
  'Qty',
  'Unit Cost',
  ...(props.showPricingControls ? ['Markup %'] : []),
  'Vendor',
  'Vendor Quote #',
  'Lead Time',
  'Sell',
  'Ext Sell',
  'GP',
  '',
])

function updateLine(id: string, updates: Partial<QuoteLine>) {
  emit(
    'change',
    applySequentialClins(props.lines.map(line => (line.id === id ? { ...line, ...updates } : line))),
  )
}

function updatePartNumber(id: string, partNumber: string) {
  const currentLine = props.lines.find(line => line.id === id)
  const match = findLatestPartPrice(partNumber)
  updateLine(
    id,
    match
      ? {
          partNumber,
          manufacturer: match.manufacturer || currentLine?.manufacturer || '',
          description: match.description || currentLine?.description || '',
          vendor: match.vendor || currentLine?.vendor || '',
          unitCost: match.unitCost,
        }
      : {
          partNumber,
          vendor: currentLine?.vendor || recommendVendorForPart(partNumber, currentLine?.manufacturer, currentLine?.description),
        },
  )
}

function removeLine(id: string) {
  emit('change', applySequentialClins(props.lines.filter(line => line.id !== id)))
}

function applySequentialClins(lines: QuoteLine[]) {
  return lines.map((line, index) => ({
    ...line,
    clin: String(index + 1),
  }))
}

function inputValue(event: Event) {
  return (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value
}

function numberValue(event: Event) {
  return Number(inputValue(event))
}

function catalogHint(partNumber: string) {
  const match = findLatestPartPrice(partNumber)
  return match ? `Catalog: ${currency(match.unitCost)}` : ''
}
</script>
