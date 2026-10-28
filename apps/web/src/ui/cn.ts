import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// v2 sınıf birleştirici. Eski lib/utils'ten içe aktarma yasak olduğu için ayrı tutulur (ADR-UI-02).
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
