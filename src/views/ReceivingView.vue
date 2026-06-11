<template>
  <div class="receiving-page">
    <header class="receiving-heading">
      <h1>Warehouse Receiving</h1>
      <p>Search by PO, project, part number, or tracking number. The workflow prevents receiving more than ordered.</p>
    </header>

    <section class="receiving-card">
      <label class="receiving-search">
        <Search :size="19" />
        <input v-model="query" placeholder="Search PO, project, part number, tracking..." />
      </label>
    </section>

    <div class="receiving-layout">
      <section class="receiving-card">
        <h2>Open PO Lines</h2>
        <div class="receiving-line-list">
          <button
            v-for="item in filteredLines"
            :key="item.line.id"
            class="receiving-line-button"
            :class="{ selected: item.line.id === selectedLineId }"
            type="button"
            @click="selectedLineId = item.line.id"
          >
            <span class="receiving-po-number">{{ item.po.poNumber }}</span>
            <span>
              <strong>{{ item.line.partNumber }}</strong>
              <small>{{ item.projectNumber }} · {{ item.line.description }}</small>
            </span>
            <span>{{ item.line.quantityReceived }}/{{ item.line.quantityOrdered }}</span>
            <StatusBadge :status="item.line.status" />
          </button>
        </div>
      </section>

      <section class="receiving-card">
        <h2>Receive Material</h2>
        <div v-if="selected" class="receive-material-form">
          <ReadOnlyDetail label="PO" :value="selected.po.poNumber" />
          <ReadOnlyDetail label="Project" :value="`${selected.projectNumber} · ${selected.projectName}`" />
          <ReadOnlyDetail label="Part" :value="`${selected.line.partNumber} · ${selected.line.description}`" />
          <label class="receiving-field">
            <span>Quantity received</span>
            <input v-model.number="quantity" min="1" type="number" />
          </label>
          <label class="receiving-field">
            <span>Warehouse</span>
            <select v-model="warehouseId">
              <option v-for="warehouse in WAREHOUSES" :key="warehouse.id" :value="warehouse.id">
                {{ warehouse.location }}
              </option>
            </select>
          </label>
          <div class="receiving-inline-fields">
            <label class="receiving-field">
              <span>Rack</span>
              <input v-model="rack" placeholder="A-04" />
            </label>
            <label class="receiving-field">
              <span>Bin</span>
              <input v-model="bin" placeholder="B-12" />
            </label>
            <label class="receiving-field">
              <span>Pallet</span>
              <input v-model="pallet" placeholder="PAL-105" />
            </label>
            <label class="receiving-field">
              <span>Serial / asset tags</span>
              <input v-model="serialTags" placeholder="Comma separated" />
            </label>
          </div>
          <p class="receiving-validation" :class="{ valid: validation.ok, invalid: !validation.ok }">
            {{ validation.message }}
          </p>
          <button class="primary-action receive-button" type="button" :disabled="!validation.ok" @click="receiveSelectedLine">
            <PackageCheck :size="18" />
            <span>Receive selected line</span>
          </button>
          <p class="receiving-message">{{ message }}</p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, onUnmounted, ref, watch } from 'vue'
import { PackageCheck, Search } from '@lucide/vue'
import StatusBadge from '../components/StatusBadge.vue'
import { loadPurchaseOrders, receivePurchaseOrderLine } from '../services/localProjects'
import { WAREHOUSES, getQuantityRemaining, validateReceiptQuantity, type WarehouseId } from '../services/receiving'
import type { ProjectPurchaseOrder, PurchaseOrderLine } from '../types'

type ReceivingLine = {
  projectId: string
  projectNumber: string
  projectName: string
  po: ProjectPurchaseOrder
  line: PurchaseOrderLine
}

const query = ref('')
const quantity = ref(1)
const selectedLineId = ref('')
const message = ref('Select a PO line, enter quantity, assign location, and receive.')
const warehouseId = ref<WarehouseId>(WAREHOUSES[0].id)
const rack = ref('')
const bin = ref('')
const pallet = ref('')
const serialTags = ref('')
const purchaseOrders = ref<ProjectPurchaseOrder[]>(loadPurchaseOrders())

onMounted(() => window.addEventListener('cronos:projects-changed', refreshPurchaseOrders))
onUnmounted(() => window.removeEventListener('cronos:projects-changed', refreshPurchaseOrders))

const lines = computed<ReceivingLine[]>(() =>
  purchaseOrders.value.flatMap(po =>
    po.lines
      .filter(line => getQuantityRemaining(line) > 0 && !['Cancelled', 'Delivered'].includes(line.status))
      .map(line => ({
        projectId: po.projectId,
        projectNumber: po.projectNumber,
        projectName: po.projectName,
        po,
        line,
      })),
  ),
)

const filteredLines = computed(() => {
  const term = query.value.trim().toLowerCase()
  if (!term) return lines.value

  return lines.value.filter(({ projectNumber, po, line }) =>
    [projectNumber, po.poNumber, po.trackingNumber, line.trackingNumber, line.partNumber, line.description]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(term),
  )
})

const selected = computed(() => lines.value.find(item => item.line.id === selectedLineId.value) ?? lines.value[0])
const validation = computed(() =>
  selected.value
    ? validateReceiptQuantity({
        ordered: selected.value.line.quantityOrdered,
        alreadyReceived: selected.value.line.quantityReceived,
        receivingNow: quantity.value,
      })
    : { ok: false, message: 'No PO line selected.' },
)

watch(
  lines,
  nextLines => {
    if (!selectedLineId.value && nextLines[0]) {
      selectedLineId.value = nextLines[0].line.id
    }
  },
  { immediate: true },
)

function refreshPurchaseOrders() {
  purchaseOrders.value = loadPurchaseOrders()
}

function receiveSelectedLine() {
  if (!selected.value) return

  try {
    const { inventoryItem } = receivePurchaseOrderLine(selected.value.projectId, selected.value.po.id, selected.value.line.id, {
      warehouseId: warehouseId.value,
      quantity: quantity.value,
      rack: rack.value,
      bin: bin.value,
      palletNumber: pallet.value,
      ...parseSerialAssetTags(serialTags.value),
    })
    refreshPurchaseOrders()
    const warehouse = WAREHOUSES.find(item => item.id === inventoryItem.warehouseId)?.location ?? 'warehouse'
    message.value = `${inventoryItem.quantityReceived} received into ${warehouse}${inventoryItem.warehouseLocation ? ` (${inventoryItem.warehouseLocation})` : ''}.`
    resetReceiptFields()
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'Receipt failed.'
  }
}

function resetReceiptFields() {
  quantity.value = 1
  rack.value = ''
  bin.value = ''
  pallet.value = ''
  serialTags.value = ''
}

function parseSerialAssetTags(value: string) {
  const [serialNumber, assetTag] = value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)

  return {
    serialNumber: serialNumber ?? '',
    assetTag: assetTag ?? '',
  }
}

const ReadOnlyDetail = defineComponent({
  name: 'ReadOnlyDetail',
  props: {
    label: { type: String, required: true },
    value: { type: String, required: true },
  },
  setup(props) {
    return () => h('div', { class: 'receiving-readonly' }, [h('p', props.label), h('strong', props.value)])
  },
})
</script>
