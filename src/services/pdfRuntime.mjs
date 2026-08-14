export function resolveJsPdfConstructor(module) {
  const constructor = module?.jsPDF ?? module?.default?.jsPDF ?? module?.default

  if (typeof constructor !== 'function') {
    throw new Error('The PDF generator could not be loaded. Refresh the page and try again.')
  }

  return constructor
}

export async function createPdfDocument(options = {}) {
  const module = await import('jspdf')
  const JsPdf = resolveJsPdfConstructor(module)
  return new JsPdf(options)
}
