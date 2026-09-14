import type { Project, CustomerQuote } from '../types'
export type FundsActor = { id: string; name?: string; email?: string; role: string; permissions?: Set<string> | string[] }
export type FundsActionType = 'Purchase Material' | 'Direct Expense / Pass-Through' | 'Create Customer Invoice' | 'Credit / Adjustment' | 'Funding Modification'
export type FundsAction = { id: string; number: string; projectId: string; type: FundsActionType; description: string; requestDate: string; requestor: string; ownerId: string; ownerName: string; status: string; authorizedAmount: number; estimatedCost: number; readyToBill: boolean; vendors: string[]; quoteIds: string[]; poIds: string[]; notes: string; createdAt: string }
export type FundsSummary = { authorized: number; committed: number; actualCost: number; billAmount: number; invoiced: number; paid: number; available: number; unbilled: number }
export type FundsTransaction = Omit<FundsSummary, 'available' | 'unbilled'> & { id: string; projectId: string; actionId?: string; adjustmentActionId?: string; invoiceId?: string; kind: string; occurredAt: string; userId: string; userName: string; reason?: string; reference?: string; vendor?: string; expenseDate?: string; description?: string; documentId?: string; customerBillAmount?: number }
export type FundsInvoice = { customerSnapshot?: Partial<Project> | null; id: string; projectId: string; number: string; status: 'Draft' | 'Issued' | 'Void'; invoiceDate: string; dueDate: string; allocations: { id: string; actionId: string; actionNumber: string; description: string; amount: number }[]; total: number; createdAt: string; issuedAt?: string }
export type FundsDocument = { id: string; projectId: string; actionId: string; name: string; kind: string; storagePath: string; size: number; uploadedAt: string; uploadedBy: string }
export type FundsAudit = { id: string; occurredAt: string; userId: string; userName: string; operation: string; targetId: string; previous: unknown; next: unknown; reason: string }
export type FundsReview = { id: string; recordType: string; recordId: string; reason: string; resolved: boolean; resolution?: string; resolvedAt?: string; resolvedBy?: string }
export type FundsState = { schemaVersion: number; projectId: string; revision: number; nextAction: number; nextInvoice: number; originalFunding: number; actions: FundsAction[]; transactions: FundsTransaction[]; invoices: FundsInvoice[]; documents: FundsDocument[]; audit: FundsAudit[]; review: FundsReview[]; commands: { id: string; userId: string; payload: string }[] }
export type FundsCommand = { id: string; type: string; actionId?: string; input: Record<string, any> }
export const ACTION_TYPES: FundsActionType[]
export const ACTION_STATUSES: string[]
export const BILLING_STATUSES: string[]
export const MF_PERMISSIONS: Record<string, string[]>
export function canManageFunds(actor: FundsActor | null | undefined, permission: string): boolean
export function cents(value: unknown): number
export function isManagedFunds(project: unknown): boolean
export function financialSummary(state?: FundsState | null, actionId?: string): FundsSummary
export function actionFinancials(state: FundsState, actionId: string): FundsSummary & { draftReserved: number; billable: number; variance: number }
export function billingStatus(state: FundsState, action: FundsAction): string
export function procurementStatus(project: Project, action: FundsAction): string
export function quoteCustomerTotal(quote: CustomerQuote): number
export function initializeManagedFunds(project: Project, actor: FundsActor, options?: object): { state: FundsState; project: Project }
export function applyManagedFundsCommand(state: FundsState, command: FundsCommand, actor: FundsActor, options?: object): FundsState
export function reconcileManagedProject(state: FundsState, previous: Project, proposed: Project, actor: FundsActor, options?: object): { state: FundsState; project: Project }
