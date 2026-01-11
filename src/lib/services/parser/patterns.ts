export const PATTERNS = {
  // Match #tag or #tag(value) for scale fields
  TAG: /#([a-z0-9-]+)(?:\(([^)]+)\))?/gi,

  // Match modifiers like /done, /skip, /rpe
  MODIFIER: /\/(done|skip|rpe\s+\d+)/gi,

  // Match values with optional units: 500ml, 80kg, 3x10, 15min
  NUMBER_WITH_UNIT: /^(\d+(?:\.\d+)?)\s*([a-z]+)?$/i,

  // Match set notation: 3x10, 5x5
  SETS_REPS: /^(\d+)\s*x\s*(\d+)$/i,

  // Match duration: 15min, 1h30m, 45s
  DURATION: /^(?:(\d+)h)?(?:(\d+)m(?:in)?)?(?:(\d+)s(?:ec)?)?$/i,
};

// Unit normalization
export const UNIT_ALIASES: Record<string, string> = {
  ml: 'ml',
  l: 'l',
  liter: 'l',
  liters: 'l',
  kg: 'kg',
  kgs: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  lb: 'lb',
  lbs: 'lb',
  pound: 'lb',
  pounds: 'lb',
  g: 'g',
  gram: 'g',
  grams: 'g',
  min: 'min',
  mins: 'min',
  minute: 'min',
  minutes: 'min',
  h: 'h',
  hr: 'h',
  hour: 'h',
  hours: 'h',
  s: 's',
  sec: 's',
  second: 's',
  seconds: 's',
  km: 'km',
  m: 'm',
  mile: 'mile',
  miles: 'mile',
  cal: 'cal',
  kcal: 'kcal',
  calories: 'kcal',
};

export function normalizeUnit(unit: string): string {
  const lower = unit.toLowerCase();
  return UNIT_ALIASES[lower] || lower;
}
