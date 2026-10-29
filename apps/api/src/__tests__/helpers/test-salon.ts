import type { SalonContext } from '../../ai/intent.service'

// Yalniz testler icin kurgusal salon; uretim kodunda yer almaz (S5 K1).
export const TEST_SALON: SalonContext = {
  name: 'BeautyOS Test Salon',
  address: 'Test Mah. Demo Cad. No:1',
  workingHours: 'Hafta içi 09:00-20:00, Cumartesi 10:00-18:00',
  services: [
    { name: 'Saç Kesimi', duration: 30, price: 250 },
    { name: 'Röfle', duration: 90, price: 600 },
    { name: 'Komple Boyama', duration: 120, price: 900 },
    { name: 'Protez Tırnak', duration: 120, price: 450 },
    { name: 'Manikür', duration: 45, price: 200 },
    { name: 'Pedikür', duration: 60, price: 250 },
  ],
  staff: [
    { name: 'Ayşe Hanım', title: 'Kıdemli Kuaför' },
    { name: 'Emre Bey', title: 'Nail Artist' },
    { name: 'Zeynep Hanım', title: 'Estetisyen' },
  ],
}
