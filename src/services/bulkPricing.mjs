export function applyPricingToAllLines(lines, mode, percent) {
  const value = Number(percent)
  if (!Number.isFinite(value) || value < 0) throw new Error('Enter a percentage of zero or greater.')
  if (mode === 'margin' && value >= 100) throw new Error('Margin percentage must be less than 100.')
  if (mode !== 'margin' && mode !== 'markup') throw new Error('Choose margin or markup pricing.')

  return lines.map(line => mode === 'margin'
    ? { ...line, pricingMode: 'margin', marginPercent: value }
    : { ...line, pricingMode: 'markup', markupPercent: value })
}
