import type { PurchaseOrder, PurchaseOrderLine, QuoteLine } from '../types'

export type PricingMode = 'markup' | 'margin'

export function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function calculateMarkupSellPrice(unitCost: number, markupPercent: number) {
  return roundCurrency(unitCost * (1 + markupPercent / 100))
}

export function calculateMarginSellPrice(unitCost: number, marginPercent: number) {
  if (marginPercent >= 100) {
    throw new Error('Margin percentage must be less than 100.')
  }

  return roundCurrency(unitCost / (1 - marginPercent / 100))
}

export function calculateSellPrice(unitCost: number, percentage: number, mode: PricingMode = 'markup') {
  if (mode === 'margin') {
    return calculateMarkupSellPrice(unitCost, marginPercentToMarkupPercent(percentage))
  }

  return calculateMarkupSellPrice(unitCost, percentage)
}

export function calculateLineTotals(line: QuoteLine) {
  const pricingMode = line.pricingMode ?? 'markup'
  const appliedPercent = normalizeMarkupPercent(line)
  const sellPrice = calculateSellPrice(line.unitCost, appliedPercent, 'markup')
  return calculateTotalsFromSellPrice(line.quantity, line.unitCost, sellPrice)
}

export function normalizeMarkupPercent(line: Pick<QuoteLine, 'pricingMode' | 'marginPercent' | 'markupPercent'>) {
  if (line.pricingMode === 'margin' && line.marginPercent !== undefined) {
    return marginPercentToMarkupPercent(line.marginPercent)
  }

  return line.markupPercent || 0
}

export function marginPercentToMarkupPercent(marginPercent: number) {
  if (marginPercent <= 0) return 0
  if (marginPercent >= 100) return 0
  return roundCurrency((marginPercent / (100 - marginPercent)) * 100)
}

export function calculateTotalsFromSellPrice(quantity: number, unitCost: number, sellPrice: number) {
  const extendedCost = roundCurrency(unitCost * quantity)
  const extendedSellPrice = roundCurrency(sellPrice * quantity)
  const grossProfit = roundCurrency(extendedSellPrice - extendedCost)
  const grossMarginPercent = extendedSellPrice === 0 ? 0 : roundCurrency((grossProfit / extendedSellPrice) * 100)

  return {
    sellPrice,
    extendedCost,
    extendedSellPrice,
    grossProfit,
    grossMarginPercent,
    costTotal: extendedCost,
    sellTotal: extendedSellPrice,
    margin: grossProfit,
    marginPercent: grossMarginPercent,
  }
}

export function calculateQuoteSummary(lines: QuoteLine[], contractFeeEnabled = false, shippingCost = 0) {
  const summary = lines.reduce(
    (totals, line) => {
      const lineTotals = calculateLineTotals(line)
      return {
        totalCost: totals.totalCost + lineTotals.extendedCost,
        totalSellPrice: totals.totalSellPrice + lineTotals.extendedSellPrice,
        totalGrossProfit: totals.totalGrossProfit + lineTotals.grossProfit,
      }
    },
    { totalCost: 0, totalSellPrice: 0, totalGrossProfit: 0 },
  )

  const totalCost = roundCurrency(summary.totalCost)
  const totalSellPrice = roundCurrency(summary.totalSellPrice)
  const totalGrossProfit = roundCurrency(summary.totalGrossProfit)
  const totalGrossMarginPercent = totalSellPrice === 0 ? 0 : roundCurrency((totalGrossProfit / totalSellPrice) * 100)
  const contractFee = contractFeeEnabled ? calculateContractFee(totalSellPrice) : 0
  const shipping = roundCurrency(Math.max(0, shippingCost || 0))
  const customerTotal = roundCurrency(totalSellPrice + contractFee + shipping)

  return {
    totalCost,
    totalSellPrice,
    contractFee,
    shippingCost: shipping,
    customerTotal,
    totalGrossProfit,
    totalGrossMarginPercent,
  }
}

export function calculateContractFee(totalQuoteSellPrice: number) {
  if (totalQuoteSellPrice <= 0) return 0

  return roundCurrency(totalQuoteSellPrice / 0.889 - totalQuoteSellPrice)
}

export function calculateQuoteSummaryWithContractFee(lines: QuoteLine[], contractFeeEnabled = false, shippingCost = 0) {
  return calculateQuoteSummary(lines, contractFeeEnabled, shippingCost)
}

export function groupQuoteLinesByVendor(lines: QuoteLine[]) {
  return lines.reduce<Record<string, QuoteLine[]>>((groups, line) => {
    const vendor = line.vendor || 'Unassigned'
    groups[vendor] = groups[vendor] ?? []
    groups[vendor].push(line)
    return groups
  }, {})
}

export function generateVendorPurchaseOrders(lines: QuoteLine[], projectNumber: string, startingSequence = 0): PurchaseOrder[] {
  return Object.entries(groupQuoteLinesByVendor(lines.filter(line => line.approved))).map(([vendor, vendorLines], index) => {
    const sequence = String(startingSequence + index + 1).padStart(4, '0')
    const poNumber = `${projectNumber}-${sequence}-${sanitizePoSegment(vendor)}`
    const poLines: PurchaseOrderLine[] = vendorLines.map(line => ({
      id: `po-${line.id}`,
      clin: line.clin,
      partNumber: line.partNumber,
      manufacturer: line.manufacturer,
      description: line.description,
      quantityOrdered: line.quantity,
      quantityReceived: 0,
      unitCost: line.unitCost,
      status: 'Ordered',
      vendorOrderNumber: '',
      estimatedShipDate: '',
      receivedDate: '',
      carrier: '',
      trackingNumber: '',
      trackingUrl: '',
      notes: '',
    }))

    return {
      id: crypto.randomUUID(),
      poNumber,
      vendor,
      dateIssued: todayLocalDateString(),
      status: 'PO Generated',
      totalCost: roundCurrency(poLines.reduce((total, line) => total + line.unitCost * line.quantityOrdered, 0)),
      terms: 'NET30',
      expectedDeliveryDate: '',
      lines: poLines,
    }
  })
}

export function currency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

function todayLocalDateString() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function sanitizePoSegment(value: string) {
  return (value || 'Vendor')
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'Vendor'
}
