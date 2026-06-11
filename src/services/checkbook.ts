import { calculateLineTotals, roundCurrency } from './calculations'
import type { Project } from '../types'

export type CheckbookLine = {
  poId: string
  poNumber: string
  quoteNumber: string
  vendor: string
  dateIssued: string
  description: string
  requestor: string
  ourCost: number
  customerCost: number
  grossProfit: number
}

export function getCheckbookSummary(project: Project) {
  const startingBalance = project.checkbookStartingBalance ?? 0
  const lines = getCheckbookLines(project)
  const ourCost = roundCurrency(lines.reduce((total, line) => total + line.ourCost, 0))
  const customerCost = roundCurrency(lines.reduce((total, line) => total + line.customerCost, 0))
  const remainingBalance = roundCurrency(startingBalance - customerCost)

  return {
    startingBalance,
    ourCost,
    customerCost,
    grossProfit: roundCurrency(customerCost - ourCost),
    remainingBalance,
    lines,
  }
}

export function getCheckbookLines(project: Project): CheckbookLine[] {
  return project.purchaseOrders.map(po => {
    const quote = project.quotes?.find(item => item.id === po.quoteId)
    const quoteLineIds = new Set(po.lines.map(line => line.id.replace(/^po-/, '')))
    const matchingQuoteLines = quote?.lines.filter(line => quoteLineIds.has(line.id)) ?? []
    const customerCost = matchingQuoteLines.length
      ? matchingQuoteLines.reduce((total, line) => total + calculateLineTotals(line).extendedSellPrice, 0)
      : po.customerTotalCost ?? po.totalCost

    return {
      poId: po.id,
      poNumber: po.poNumber,
      quoteNumber: quote?.quoteNumber ?? '-',
      vendor: po.vendor,
      dateIssued: po.dateIssued,
      description: getPurchaseOrderDescription(po),
      requestor: po.requestor ?? '',
      ourCost: roundCurrency(po.totalCost),
      customerCost: roundCurrency(customerCost),
      grossProfit: roundCurrency(customerCost - po.totalCost),
    }
  })
}

function getPurchaseOrderDescription(po: Project['purchaseOrders'][number]) {
  const poDescription = po.description?.trim()
  if (poDescription) return poDescription

  const lineDescriptions = Array.from(new Set(po.lines.map(line => line.description.trim()).filter(Boolean)))
  if (!lineDescriptions.length) return ''
  if (lineDescriptions.length === 1) return lineDescriptions[0]

  return lineDescriptions.slice(0, 3).join('; ')
}
