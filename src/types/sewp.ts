export const sewpStages = [
  'New', 'Intake in Progress', 'Intake Review Required', 'Bid/No-Bid Review',
  'Approved to Pursue', 'Vendor RFQs in Progress', 'Waiting on Vendor Pricing',
  'Pricing Analysis', 'Technical Review', 'Compliance Review', 'Internal Approval',
  'Ready for Submission', 'Submitted', 'Clarification or Amendment', 'Awarded',
  'Lost', 'No-Bid', 'Cancelled',
] as const

export type SewpStage = typeof sewpStages[number]

export interface SewpRfq {
  id: string
  atlas_opportunity_number: string
  official_rfq_number: string
  title: string
  agency: string | null
  customer_organization: string | null
  source: string
  category: string | null
  set_aside: string | null
  priority: 'Low' | 'Normal' | 'High' | 'Critical'
  health_status: 'On Track' | 'At Risk' | 'Critical' | 'Blocked' | 'Overdue'
  current_stage: SewpStage
  ai_review_status: string
  date_received: string
  questions_due_at: string | null
  response_due_at: string | null
  response_time_zone: string
  estimated_value: number | null
  notes: string | null
  version: number
  created_at: string
  updated_at: string
}

export interface SewpCreateInput {
  officialRfqNumber: string
  title: string
  agency?: string
  customerOrganization?: string
  source: string
  category?: string
  setAside?: string
  priority: SewpRfq['priority']
  responseDueAt?: string | null
  questionsDueAt?: string | null
  responseTimeZone: string
  estimatedValue?: number | null
  notes?: string
}
