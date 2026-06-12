import { calculateQuoteSummaryWithContractFee, currency, roundCurrency } from './calculations'
import type { Project, PurchaseOrder } from '../types'

export type AssistantMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type AssistantProjectSummary = {
  id: string
  projectNumber: string
  projectName: string
  customer: string
  status: string
  projectType: string
  quoteCount: number
  poCount: number
  quoteTotal: number
  poTotal: number
  openPoCount: number
  missingTrackingCount: number
  purchaseOrders: Array<{
    id: string
    poNumber: string
    vendor: string
    status: string
    carrier: string
    trackingNumber: string
    estimatedShipDate: string
    expectedDeliveryDate: string
    lineCount: number
  }>
}

export function buildAssistantProjectSummaries(projects: Project[]): AssistantProjectSummary[] {
  return projects.map(project => {
    const purchaseOrders = (project.purchaseOrders ?? []).map(summarizePurchaseOrder)

    return {
      id: project.id,
      projectNumber: project.projectNumber,
      projectName: project.projectName,
      customer: project.customer,
      status: project.status,
      projectType: project.projectType ?? 'Design & Install',
      quoteCount: project.quotes?.length ?? 0,
      poCount: project.purchaseOrders?.length ?? 0,
      quoteTotal: roundCurrency(
        (project.quotes ?? []).reduce((total, quote) => {
          const summary = calculateQuoteSummaryWithContractFee(quote.lines, quote.contractFeeEnabled, quote.shippingCost)
          return total + summary.customerTotal
        }, 0),
      ),
      poTotal: roundCurrency((project.purchaseOrders ?? []).reduce((total, po) => total + po.totalCost, 0)),
      openPoCount: (project.purchaseOrders ?? []).filter(po => !['Received', 'Delivered', 'Cancelled'].includes(po.status)).length,
      missingTrackingCount: (project.purchaseOrders ?? []).filter(po => !po.trackingNumber).length,
      purchaseOrders,
    }
  })
}

export function answerAssistantQuestion(question: string, projects: Project[]) {
  const summaries = buildAssistantProjectSummaries(projects)
  const normalized = question.toLowerCase()
  const project = findReferencedProject(normalized, summaries) ?? summaries[0]

  if (!summaries.length) {
    return 'I do not see any projects in this browser yet. Create or import a project, then I can summarize quotes, POs, vendor tracking, and customer updates.'
  }

  if (/missing.*tracking|tracking.*missing|which pos.*tracking|pos.*missing/i.test(question)) {
    const rows = summaries.flatMap(summary =>
      summary.purchaseOrders
        .filter(po => !po.trackingNumber)
        .map(po => `${summary.projectNumber} ${po.poNumber} for ${po.vendor} is ${po.status} and does not have a tracking number yet.`),
    )
    return rows.length ? `POs missing tracking:\n${rows.map(row => `- ${row}`).join('\n')}` : 'All current purchase orders have tracking numbers.'
  }

  if (/vendor.*update|updates.*needed|open work|follow.?up/i.test(question)) {
    const rows = summaries.flatMap(summary =>
      summary.purchaseOrders
        .filter(po => !po.trackingNumber || !po.estimatedShipDate)
        .map(po => `${summary.projectNumber} ${po.poNumber} for ${po.vendor} needs ${!po.estimatedShipDate ? 'an estimated ship date' : 'tracking'}.`),
    )
    return rows.length ? `Vendor updates needed:\n${rows.map(row => `- ${row}`).join('\n')}` : 'No vendor update gaps are showing in the current project data.'
  }

  if (/customer.*tracking|tracking.*update|draft/i.test(question)) {
    if (!project) return 'I need at least one project before I can draft a customer tracking update.'
    const shipped = project.purchaseOrders.filter(po => po.trackingNumber)
    const pending = project.purchaseOrders.filter(po => !po.trackingNumber)
    return [
      `Customer update for ${project.projectNumber} - ${project.projectName}:`,
      shipped.length
        ? `We have tracking on ${shipped.length} PO${shipped.length === 1 ? '' : 's'}: ${shipped.map(po => `${po.poNumber} via ${po.carrier || 'carrier pending'} ${po.trackingNumber}`).join('; ')}.`
        : 'No tracking numbers are posted yet.',
      pending.length
        ? `${pending.length} PO${pending.length === 1 ? ' is' : 's are'} still awaiting vendor tracking: ${pending.map(po => po.poNumber).join(', ')}.`
        : 'All POs currently have tracking posted.',
    ].join('\n')
  }

  if (/summary|summarize|status|project/i.test(question) && project) {
    return [
      `${project.projectNumber} - ${project.projectName}`,
      `Customer: ${project.customer}`,
      `Status: ${project.status} (${project.projectType})`,
      `Quotes: ${project.quoteCount} totaling ${currency(project.quoteTotal)}`,
      `POs: ${project.poCount} totaling ${currency(project.poTotal)}; ${project.openPoCount} open, ${project.missingTrackingCount} missing tracking.`,
    ].join('\n')
  }

  return [
    `I can help with ${summaries.length} project${summaries.length === 1 ? '' : 's'} in this browser.`,
    `Current focus: ${project.projectNumber} - ${project.projectName}.`,
    `Ask for a project summary, POs missing tracking, vendor updates needed, or a customer tracking update.`,
  ].join('\n')
}

function summarizePurchaseOrder(po: PurchaseOrder) {
  return {
    id: po.id,
    poNumber: po.poNumber,
    vendor: po.vendor,
    status: po.status,
    carrier: po.carrier ?? '',
    trackingNumber: po.trackingNumber ?? '',
    estimatedShipDate: po.estimatedShipDate ?? '',
    expectedDeliveryDate: po.expectedDeliveryDate ?? '',
    lineCount: po.lines.length,
  }
}

function findReferencedProject(question: string, projects: AssistantProjectSummary[]) {
  return projects.find(project => {
    const number = project.projectNumber.toLowerCase()
    const name = project.projectName.toLowerCase()
    return question.includes(number) || question.includes(name)
  })
}
