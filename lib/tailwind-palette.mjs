// Subset da paleta default do Tailwind CSS (v3+) usada como fonte canônica
// dos tokens visuais do Meet Criteria. Inline para evitar dep de `tailwindcss`
// (não compilamos CSS — apenas consumimos os valores hex).
//
// Referência: https://tailwindcss.com/docs/customizing-colors
//
// Adicione novas cores apenas conforme um token semântico passar a referenciá-las.

export const TAILWIND = Object.freeze({
  white: '#ffffff',
  'neutral-200': '#e5e5e5',
  'neutral-800': '#262626',
  'neutral-900': '#171717',
  'pink-500': '#ec4899',
  'rose-600': '#e11d48',
  'firefly-50':  '#f5f8f8',
  'firefly-100': '#dee9e8',
  'firefly-200': '#bcd3d1',
  'firefly-300': '#93b5b3',
  'firefly-400': '#6c9594',
  'firefly-500': '#527a79',
  'firefly-600': '#406161',
  'firefly-700': '#364f4f',
  'firefly-800': '#2e4141',
  'firefly-900': '#293838',
  'firefly-950': '#1d2b2c',
})

// Família tipográfica default do Tailwind (font-sans).
// Tailwind define `Inter var, ui-sans-serif, system-ui, ...`. Figma exige um
// nome de família registrado, então usamos o primeiro membro concreto do stack.
export const TAILWIND_FONT_SANS_DEFAULT = 'Inter'
