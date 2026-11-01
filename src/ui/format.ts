const UNITS = ['', 'K', 'M', 'B', 'T']

// 1234 -> "1.23K" ; 12 -> "12"
export function formatNumber(n: number): string {
  if (n < 1000) return Math.floor(n).toString()
  const tier = Math.min(Math.floor(Math.log10(n) / 3), UNITS.length - 1)
  const scaled = n / 1000 ** tier
  return `${scaled.toFixed(scaled < 10 ? 2 : scaled < 100 ? 1 : 0)}${UNITS[tier]}`
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`
  return `${(seconds / 3600).toFixed(1)} h`
}

// Débit par seconde : une décimale tant que c'est petit (1.5 -> "1.5", 12 -> "12")
export const formatRate = (n: number) => (n < 100 ? n.toFixed(n % 1 === 0 ? 0 : 1) : formatNumber(n))

export const formatPercent = (n: number) => `${n >= 0 ? '+' : ''}${Math.round(n * 100)} %`
