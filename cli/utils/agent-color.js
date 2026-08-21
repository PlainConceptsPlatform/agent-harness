/**
 * Deterministic colour for an agent, derived from its name.
 *
 * opencode accepts either a hex value or one of its theme keywords. Two of
 * those keywords are reserved for the primaries so they stay recognisable
 * across every project: build is `primary`, plan is `warning`. Every other
 * agent gets a hex derived from its name, so a `butterfly-engineer` is the
 * same colour in every repository that has one, with no central registry and
 * no chance of two agents in one project colliding by accident.
 *
 * Saturation and lightness are fixed rather than hashed. That is what keeps
 * the result usable: hashing them too would eventually produce near-grey,
 * near-black or near-white agents that are invisible against one theme or the
 * other. Only the hue varies.
 */

/** opencode's theme keywords. Treated as unset so a name-derived hex wins. */
export const THEME_COLORS = new Set([
  'primary',
  'secondary',
  'accent',
  'success',
  'warning',
  'error',
  'info',
])

/** Reserved: the two primaries, which never take a derived colour. */
export const RESERVED_COLORS = { build: 'primary', plan: 'warning' }

const SATURATION = 68
const LIGHTNESS = 52

/**
 * FNV-1a, 32 bit. Chosen because it is short enough to duplicate verbatim in
 * the shipped plugin and produces the same hue everywhere: the same name must
 * resolve to the same colour on every machine and in every project.
 */
function hash(value) {
  let h = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

function hslToHex(h, s, l) {
  const sat = s / 100
  const light = l / 100
  const c = (1 - Math.abs(2 * light - 1)) * sat
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = light - c / 2

  const [r, g, b] =
    h < 60 ? [c, x, 0] :
    h < 120 ? [x, c, 0] :
    h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] :
    h < 300 ? [x, 0, c] :
    [c, 0, x]

  const toHex = v => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
}

/** The colour for an agent, honouring the two reserved primaries. */
export function agentColor(name) {
  if (name in RESERVED_COLORS) return RESERVED_COLORS[name]
  return hslToHex(hash(name) % 360, SATURATION, LIGHTNESS)
}

/**
 * Whether a frontmatter colour should be replaced by the derived one.
 *
 * A theme keyword is replaced: those came from the old template, which asked
 * whoever ran /make-engineer to pick one and avoid collisions by hand. An
 * explicit hex is left alone, because someone chose it deliberately.
 */
export function shouldDeriveColor(current) {
  if (!current) return true
  return THEME_COLORS.has(current.trim().toLowerCase())
}
