/**
 * Convert between absorbance (A) and transmittance (T).
 * A = -log10(T),  T = 10^(-A)
 * Transmittance is 0–1 (0–100%). Absorbance is 0 to ∞.
 *
 * JCAMP-DX uses ##YUNITS= to specify the Y-axis units.
 * We match against the standard values explicitly.
 */

const ABSORBANCE_VALUES = ['ABSORBANCE']
const TRANSMITTANCE_VALUES = ['TRANSMITTANCE', 'TRANSMISSION', '% TRANSMITTANCE', '% TRANSMISSION']

function normalizeUnits(s) {
  if (!s || typeof s !== 'string') return ''
  return s.toUpperCase().trim()
}

function matchesOneOf(normalized, values) {
  if (!normalized) return false
  return values.some((v) => normalized === v || normalized.startsWith(v + ' '))
}

export function isAbsorbance(yUnits) {
  const u = normalizeUnits(yUnits)
  return matchesOneOf(u, ABSORBANCE_VALUES)
}

export function isTransmittance(yUnits) {
  const u = normalizeUnits(yUnits)
  if (!u) return true
  return matchesOneOf(u, TRANSMITTANCE_VALUES)
}

/** Convert absorbance to transmittance (0–1). */
export function absorbanceToTransmittance(a) {
  if (a <= 0) return 1
  return Math.pow(10, -a)
}

/** Convert transmittance (0–1 or 0–100) to absorbance. */
export function transmittanceToAbsorbance(t) {
  const T = t > 1 ? t / 100 : Math.max(1e-10, t)
  return -Math.log10(T)
}

/**
 * Get Y values in the requested display units.
 * @param {number[]} y - raw Y values
 * @param {string} dataYUnits - units of y (e.g. 'ABSORBANCE', 'TRANSMITTANCE')
 * @param {'transmittance'|'absorbance'} displayUnits - desired display units
 * @returns {number[]} y values in display units
 */
export function getDisplayY(y, dataYUnits, displayUnits) {
  if (!y?.length) return []
  const dataIsA = isAbsorbance(dataYUnits)
  const wantA = displayUnits === 'absorbance'

  if (dataIsA && wantA) return [...y]
  if (!dataIsA && !wantA) return [...y]
  if (dataIsA && !wantA) return y.map(absorbanceToTransmittance)
  return y.map((v) => transmittanceToAbsorbance(v > 1 ? v / 100 : v))
}
