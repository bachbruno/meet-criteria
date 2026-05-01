// Subset da paleta default do Tailwind CSS (v3+) usada como fonte canônica
// dos tokens visuais do Meet Criteria. Inline para evitar dep de `tailwindcss`
// (não compilamos CSS — apenas consumimos os valores hex).
//
// Referência: https://tailwindcss.com/docs/customizing-colors
//
// Adicione novas cores apenas conforme um token semântico passar a referenciá-las.

export const TAILWIND = Object.freeze({
  white: '#ffffff',
  black: '#000000',
  'neutral-200': '#e5e5e5',
  'neutral-800': '#262626',
  'neutral-900': '#171717',
  'pink-500': '#ec4899',
  'rose-600': '#e11d48',
})

// Família tipográfica default do Tailwind (font-sans).
// Tailwind define `Inter var, ui-sans-serif, system-ui, ...`. Figma exige um
// nome de família registrado, então usamos o primeiro membro concreto do stack.
export const TAILWIND_FONT_SANS_DEFAULT = 'Inter'
