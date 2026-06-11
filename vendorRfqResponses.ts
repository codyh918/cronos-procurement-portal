import type { InventoryItem, Project, PurchaseOrder, PurchaseOrderLine, Status } from '../types'

export const WAREHOUSES = [
  { id: 'evans-ga', name: 'Evans', location: 'Evans, GA' },
  { id: 'virginia-beach-va', name: 'Virginia Beach', location: 'Virginia Beach, VA' },
  { id: 'lexington-park-md', name: 'Lexington Park', location: 'Lexington Park, MD' },
] as const

export type WarehouseId = (typeof WAREHOUSES)[number]['id']

export type ReceiveWarehouseInput = {
  warehouseId: WarehouseId
  quantity: number
  rack?: string
  bin?: string
  palletNumber?: string
  serialNumber?: string
  assetTag?: string
  receivedBy?: string
  notes?: string
}

export type ReceiveInput = {
  ordered: number
  alreadyReceived: number
  receivingNow: number
}

export function validateReceiptQuantity({ ordered, alreadyReceived, receivingNow }: ReceiveInput) {
  if (!Number.isInteger(receivingNow) || receivingNow <= 0) {
    return { ok: false, message: 'Received quantity must be a positive whole number.' }
  }

  if (alreadyReceived + receivingNow > ordered) {
    return {
      ok: false,
      message: `Cannot receive ${receivingNow}; only ${ordered - alreadyReceived} remain on the PO line.`,
    }
  }

  return { ok: true, message: 'Receipt quantity is valid.' }
}

export function getReceivingStatus(ordered: number, received: number): Status {
  if (received <= 0) return 'Ordered'
  if (received < ordered) return 'Partially Received'
  return 'Received'
}

export function getQuantityRemaining(line: Pick<PurchaseOrderLine, 'quantityOrdered' | 'quantityReceived'>) {
  return Math.max(0, line.quantityOrdered - line.quantityReceived)
}

export function getPurchaseOrderStatus(lines: PurchaseOrderLine[], previousStatus: Status): Status {
  if (!lines.length) return previousStatus
  if (lines.every(line => line.quantityReceived >= line.quantityOrdered)) return 'Received'
  if (lines.some(line => line.quantityReceived > 0)) return 'Partially Received'
  return previousStatus === 'Backordered' ? 'Backordered' : 'Ordered'
}

export function receiveLine(line: PurchaseOrderLine, quantity: number) {
  const validation = validateReceiptQuantity({
    ordered: line.quantityOrdered,
    alreadyReceived: line.quantityReceived,
    receivingNow: quantity,
  })

  if (!validation.ok) {
    throw new Error(validation.message)
  }

  const quantityReceived = line.quantityReceived + quantity
  return {
    ...line,
    quantityReceived,
    status: getReceivingStatus(line.quantityOrdered, quantityReceived),
  }
}

export function buildInventoryItem(
  project: Project,
  po: PurchaseOrder,
  line: PurchaseOrderLine,
  input: ReceiveWarehouseInput,
): InventoryItem {
  const location = [input.rack?.trim(), input.bin?.trim()].filter(Boolean).join(' / ')

  return {
    id: crypto.randomUUID(),
    projectId: project.id,
    projectNumber: project.projectNumber,
    projectName: project.projectName,
    poNumber: po.poNumber,
    clin: line.clin,
    partNumber: line.partNumber,
    manufacturer: line.manufacturer ?? '',
    description: line.description,
    quantityOrdered: line.quantityOrdered,
    quantityReceived: input.quantity,
    quantityRemaining: getQuantityRemaining(line),
    serialNumber: input.serialNumber?.trim(),
    assetTag: input.assetTag?.trim(),
    warehouseId: input.warehouseId,
    warehouseLocation: location || undefined,
    rack: input.rack?.trim(),
    bin: input.bin?.trim(),
    palletNumber: input.palletNumber?.trim(),
    status: 'Stored',
    receivedDate: new Date().toISOString(),
    receivedBy: input.receivedBy?.trim(),
    notes: input.notes?.trim(),
  }
}
