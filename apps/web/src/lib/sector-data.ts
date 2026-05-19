export interface SectorData {
  categories: string[]
  suggestions: string[]
}

export const SECTOR_DATA: Record<string, SectorData> = {
  dentist: {
    categories: ['Muayene', 'Dolgu / Kanal', 'Ortodonti', 'Estetik Diş Hekimliği', 'İmplant', 'Diğer'],
    suggestions: ['Muayene', 'Dolgu', 'Kanal Tedavisi', 'Diş Beyazlatma', 'Diş Çekimi', 'İmplant', 'Ortodonti Kontrol'],
  },
  aesthetic_clinic: {
    categories: ['Yüz Estetiği', 'Vücut Estetiği', 'Lazer', 'Medikal Cilt', 'Saç Tedavileri', 'Diğer'],
    suggestions: ['Botox', 'Dolgu', 'Lazer Epilasyon', 'PRP', 'Mezoterapi', 'Cilt Bakımı'],
  },
  beauty_center: {
    categories: ['Cilt', 'Makyaj', 'Güzellik', 'Vücut', 'Diğer'],
    suggestions: ['Cilt Bakımı', 'Makyaj', 'Kaş Tasarımı', 'Ağda', 'Sıkılaştırma'],
  },
  hair_salon: {
    categories: ['Saç Kesim', 'Saç Boyama', 'Bakım', 'Şekillendirme', 'Diğer'],
    suggestions: ['Kesim', 'Boya', 'Röfle', 'Keratin', 'Fön', 'Topuz'],
  },
  barbershop: {
    categories: ['Saç', 'Sakal', 'Bakım', 'Diğer'],
    suggestions: ['Saç Kesimi', 'Sakal Tıraşı', 'Saç Boyama', 'Cilt Bakımı'],
  },
  spa: {
    categories: ['Masaj', 'Hammam', 'Sauna', 'Vücut Bakımı', 'Yüz Bakımı', 'Diğer'],
    suggestions: ['Klasik Masaj', 'Aromaterapi', 'Köpük Masajı', 'Kese Peeling'],
  },
  nail_studio: {
    categories: ['Tırnak', 'El Bakımı', 'Ayak Bakımı', 'Diğer'],
    suggestions: ['Manikür', 'Pedikür', 'Protez Tırnak', 'Nail Art', 'Kalıcı Oje'],
  },
  massage: {
    categories: ['Klasik', 'Terapi', 'Aromaterapi', 'Diğer'],
    suggestions: ['Klasik Masaj', 'Sıcak Taş', 'Hamile Masajı', 'Refleksoloji'],
  },
  tattoo_piercing: {
    categories: ['Dövme', 'Piercing', 'Kalıcı Makyaj', 'Diğer'],
    suggestions: ['Mini Dövme', 'Renkli Dövme', 'Kulak Piercing', 'Kaş Konturu'],
  },
  hair_transplant: {
    categories: ['Konsültasyon', 'Ekim', 'Kontrol', 'PRP', 'Diğer'],
    suggestions: ['Saç Ekimi Konsültasyon', 'FUE Saç Ekimi', 'PRP Tedavisi', 'Kontrol'],
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
