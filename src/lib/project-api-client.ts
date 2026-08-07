"use client";

import {
  deleteProject,
  generatePurchaseOrdersForApprovedQuotes,
  generatePurchaseOrdersForQuote,
  importCheckbookPurchaseOrders,
  loadProject,
  loadProjects,
  loadQuotes,
  saveProject,
  setQuoteApprovalStatus,
  updatePurchaseOrderTracking,
  type CheckbookPoImportInput,
  type ProjectFormInput
} from "./local-projects";
import type { CustomerQuote, Project, PurchaseOrder, QuoteLine } from "./types";

type QuoteOptions = { contractFeeEnabled?: boolean; expirationDays?: 30 | 60 | 90; shippingCost?: number };
type QuoteLineInput = Omit<QuoteLine, "id" | "approved"> & Partial<Pick<QuoteLine, "id" | "approved">>;

export async function loadProjectsShared() {
  return withFallback<Project[]>(() => apiGet("/api/projects"), () => loadProjects());
}

export async function loadProjectShared(id: string) {
  return withFallback<Project | undefined>(
    () => apiGet(`/api/projects/${id}`),
    () => loadProject(id)
  );
}

export async function saveProjectShared(input: ProjectFormInput) {
  return withFallback<Project>(
    () => apiPost("/api/projects", input),
    () => saveProject(input)
  );
}

export async function deleteProjectShared(projectId: string) {
  return withFallback<Project>(
    () => apiDelete(`/api/projects/${projectId}`),
    () => deleteProject(projectId)
  );
}

export async function createQuoteForProjectShared(projectId: string, lines: QuoteLineInput[], options: QuoteOptions = {}) {
  return apiAction<CustomerQuote>("createQuote", { projectId, lines, options });
}

export async function updateQuoteForProjectShared(
  projectId: string,
  quoteId: string,
  lines: QuoteLineInput[],
  options: QuoteOptions = {}
) {
  return apiAction<CustomerQuote>("updateQuote", { projectId, quoteId, lines, options });
}

export async function setQuoteApprovalStatusShared(projectId: string, quoteId: string, approved: boolean) {
  return withFallback<{ project: Project | null; quote: CustomerQuote; purchaseOrders: PurchaseOrder[] }>(
    () => apiAction("setQuoteApprovalStatus", { projectId, quoteId, approved }),
    () => setQuoteApprovalStatus(projectId, quoteId, approved)
  );
}

export async function generatePurchaseOrdersForQuoteShared(projectId: string, quoteId: string) {
  return withFallback<{ project: Project | null; quote: CustomerQuote; purchaseOrders: PurchaseOrder[] }>(
    () => apiAction("generatePurchaseOrdersForQuote", { projectId, quoteId }),
    () => generatePurchaseOrdersForQuote(projectId, quoteId)
  );
}

export async function generatePurchaseOrdersForApprovedQuotesShared(projectId?: string) {
  if (projectId) {
    return withFallback<Project[]>(
      async () => {
        const projects = await loadProjectsShared();
        const project = projects.find((item) => item.id === projectId);
        if (!project) return [];
        const approvedQuotes = (project.quotes ?? []).filter((quote) => quote.status === "Customer Approved");
        for (const quote of approvedQuotes) {
          await generatePurchaseOrdersForQuoteShared(projectId, quote.id);
        }
        return loadProjectsShared();
      },
      () => generatePurchaseOrdersForApprovedQuotes(projectId)
    );
  }

  return withFallback<Project[]>(
    async () => {
      const projects = await loadProjectsShared();
      for (const project of projects) {
        const approvedQuotes = (project.quotes ?? []).filter((quote) => quote.status === "Customer Approved");
        for (const quote of approvedQuotes) {
          await generatePurchaseOrdersForQuoteShared(project.id, quote.id);
        }
      }
      return loadProjectsShared();
    },
    () => generatePurchaseOrdersForApprovedQuotes()
  );
}

export async function updatePurchaseOrderTrackingShared(
  projectId: string,
  poId: string,
  updates: Partial<Pick<PurchaseOrder, "dateIssued" | "status" | "estimatedShipDate" | "expectedDeliveryDate" | "carrier" | "trackingNumber" | "trackingUrl" | "customerUpdateNotes">>
) {
  return withFallback<Project | null>(
    () => apiAction("updatePurchaseOrderTracking", { projectId, poId, updates }),
    () => updatePurchaseOrderTracking(projectId, poId, updates)
  );
}

export async function importCheckbookPurchaseOrdersShared(projectId: string, rows: CheckbookPoImportInput[]) {
  return withFallback<{ project: Project | null; importedCount: number; skippedCount: number }>(
    () => apiAction("importCheckbookPurchaseOrders", { projectId, rows }),
    () => importCheckbookPurchaseOrders(projectId, rows)
  );
}

export async function loadQuotesShared() {
  return withFallback<CustomerQuote[]>(
    async () => (await loadProjectsShared()).flatMap((project) => project.quotes ?? []),
    () => loadQuotes()
  );
}

async function apiGet<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  return parseApiResponse<T>(response);
}

async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return parseApiResponse<T>(response);
}

async function apiDelete<T>(url: string): Promise<T> {
  const response = await fetch(url, { method: "DELETE" });
  return parseApiResponse<T>(response);
}

function apiAction<T>(action: string, body: Record<string, unknown>) {
  return apiPost<T>("/api/projects/actions", { action, ...body });
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(payload?.error ?? "Shared data API is unavailable.", response.status);
  }
  return payload as T;
}

async function withFallback<T>(remote: () => Promise<T>, fallback: () => T): Promise<T> {
  try {
    return await remote();
  } catch (error) {
    if (error instanceof ApiError && [401, 403].includes(error.status)) {
      throw error;
    }
    return fallback();
  }
}

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
