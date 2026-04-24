export interface SectorData {
  categories: string[]
  suggestions: string[]
}

export const SECTOR_DATA: Record<string, SectorData> = {
  barbershop: {
    categories: ['Saç', 'Sakal', 'Bakım', 'Diğer'],
    suggestions: ['Saç Kesimi', 'Sakal Tıraşı', 'Saç Boyama', 'Keratin'],
  },
  beauty_center: {
    categories: ['Cilt', 'Makyaj', 'Güzellik', 'Vücut', 'Diğer'],
    suggestions: ['Cilt Bakımı', 'Makyaj', 'Kaş Tasarımı', 'Ağda'],
  },
  nail_studio: {
    categories: ['Tırnak', 'El Bakımı', 'Ayak Bakımı', 'Diğer'],
    suggestions: ['Manikür', 'Pedikür', 'Protez Tırnak', 'Nail Art'],
  },
  aesthetic: {
    categories: ['Yüz Estetiği', 'Vücut Estetiği', 'Lazer', 'Medikal Cilt', 'Diğer'],
    suggestions: ['Botox', 'Dolgu', 'Lazer Epilasyon', 'Cilt Bakımı', 'Mezoterapi'],
  },
  other: {
    categories: ['Hizmet', 'Bakım', 'Diğer'],
    suggestions: [],
  },
}

export const DEFAULT_SECTOR: SectorData = {
  categories: ['Saç', 'Tırnak', 'Cilt', 'Masaj', 'Diğer'],
  suggestions: [],
}
