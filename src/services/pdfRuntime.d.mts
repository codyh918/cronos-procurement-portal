import type { jsPDF, jsPDFOptions } from 'jspdf'

export function resolveJsPdfConstructor(module: unknown): typeof jsPDF
export function createPdfDocument(options?: jsPDFOptions): Promise<jsPDF>
