import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// v2 sınıf birleştirici. Eski lib/utils'ten içe aktarma yasak olduğu için ayrı tutulur (ADR-UI-02).
// tailwind-merge projenin adlandırılmış köşe ve gölge ölçeklerini (tokens.css) bilmez; tanıtılmazsa
// `rounded-control rounded-full` gibi çiftler birlikte kalır ve hangisinin kazanacağı CSS sırasına bırakılır.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      rounded: [{ rounded: ['tag', 'control', 'card', 'sheet'] }],
      shadow: [{ shadow: ['floating', 'menu'] }],
    },
  },
})

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
