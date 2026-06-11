<template>
  <div class="data-table-frame">
    <div class="table-scroll">
      <table class="data-table">
        <thead>
          <tr>
            <th v-for="column in columns" :key="column" :class="{ nowrap: isIdentifierColumn(column) }">
              {{ column }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="rows.length === 0">
            <td v-for="column in columns" :key="column" :class="{ nowrap: isIdentifierColumn(column) }">&nbsp;</td>
          </tr>
          <tr v-for="(row, rowIndex) in rows" :key="rowIndex">
            <td
              v-for="(cell, cellIndex) in row"
              :key="`${rowIndex}-${cellIndex}`"
              :class="{ nowrap: isIdentifierColumn(columns[cellIndex] ?? '') }"
            >
              <RouterLink v-if="isLinkCell(cell)" :to="cell.to" :class="cell.className">
                {{ cell.label }}
              </RouterLink>
              <span v-else-if="isBadgeCell(cell)" class="status-badge" :class="statusClass(cell.status)">
                {{ cell.status }}
              </span>
              <span v-else>{{ cell }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Status } from '../types'

type LinkCell = { type: 'link'; label: string; to: string; className?: string }
type BadgeCell = { type: 'badge'; status: Status }
type TableCell = string | number | LinkCell | BadgeCell

defineProps<{
  columns: string[]
  rows: Array<Array<TableCell>>
}>()

function isLinkCell(cell: TableCell): cell is LinkCell {
  return typeof cell === 'object' && cell !== null && 'type' in cell && cell.type === 'link'
}

function isBadgeCell(cell: TableCell): cell is BadgeCell {
  return typeof cell === 'object' && cell !== null && 'type' in cell && cell.type === 'badge'
}

function isIdentifierColumn(column: string) {
  return /(^|\s)(#|id|po|project|quote|date|eta|cost|value|total)(\s|$)/i.test(column)
}

function statusClass(status: Status) {
  return {
    'Customer Approved': 'status-success',
    Received: 'status-success',
    'Received at Cronos': 'status-success',
    Stored: 'status-success',
    Shipped: 'status-blue',
    'Shipped to Customer': 'status-blue',
    Delivered: 'status-blue',
    'Pending Procurement': 'status-muted',
    'Awaiting Vendor Shipment': 'status-warning',
    'In Transit to Cronos': 'status-purple',
    'Partially Shipped': 'status-purple',
    'Ready to Ship': 'status-teal',
    Staged: 'status-teal',
    'Partially Received': 'status-purple',
    'Allocated to Kit': 'status-teal',
    Kitted: 'status-teal',
    Backordered: 'status-danger',
    RMA: 'status-danger',
    'RMA / Issue': 'status-danger',
    Cancelled: 'status-muted',
    'PO Generated': 'status-warning',
    'PO Issued': 'status-blue',
    Ordered: 'status-indigo',
    Quoted: 'status-muted',
  }[status] ?? 'status-blue'
}
</script>
