/* BeautyOS prototip yardımcıları: ikonlar, biçimler, rol/durum, katman (alt sayfa/diyalog), bildirim, sekmeler.
   Üretim kodu değildir; davranış sözleşmesini gösterir (docs/tasarim.md §6–§7). */
(function () {
  const P = {};
  const qs = new URLSearchParams(location.search);
  P.param = (k, v) => qs.get(k) ?? v;
  P.yalin = qs.get('yalin') === '1';
  if (P.yalin) document.documentElement.dataset.yalin = '1';

  // ---- Rol ve durum (prototip) ----
  // İşletme türü → terim seti (docs/tasarim.md §7.1, metin-rehberi §2b). Tek kaynak; ekranlar P.T(anahtar) ile okur.
  P.TURLER = { kuafor: 'Kuaför (salon)', estetik: 'Estetik kliniği', dis: 'Diş hekimi' };
  P.tur = qs.get('tur') || localStorage.getItem('bos-tur') || 'kuafor';
  if (!P.TURLER[P.tur]) P.tur = 'kuafor';
  P.klinik = P.tur !== 'kuafor';
  if (P.klinik) document.documentElement.dataset.mod = 'klinik';
  // Her set tam cümleleri ayrı taşır (Türkçe ek uyumu değişkenle üretilmez; metin-rehberi §2b).
  const SETLER = {
    salon: { isletme: 'Salon', isletmeBilgi: 'Salon bilgileri', sahip: 'Salon sahibi', sahiptenIste: 'Gerekiyorsa salon sahibinden yetki isteyin.', kisi: 'Müşteri', kisiler: 'Müşteriler', kisiEkle: 'Müşteri ekle', kisiEklendi: 'Müşteri eklendi.', kisilerim: 'Müşterilerim', kisiKarti: 'Müşteri kartı', kisiSil: 'Müşteriyi sil', kisiSilindi: 'Müşteri silindi.', kisiyeHaber: 'Müşteriye haber ver', kisiyeHaberVerildi: 'Müşteriye haber verildi.', kisiSec: 'Önce müşteri seçin.', kisiAdYaz: 'Müşteri adını yazın.', kisiBos: 'Henüz müşteri yok.', veren: 'Uzman', hizmet: 'Hizmet', hizmetler: 'Hizmetler', form: 'Müşteri formu', formSorulari: 'Müşteri formu soruları', notu: 'Notlar' },
    danisan: { isletme: 'Klinik', isletmeBilgi: 'Klinik bilgileri', sahip: 'Klinik sahibi', sahiptenIste: 'Gerekiyorsa klinik sahibinden yetki isteyin.', kisi: 'Danışan', kisiler: 'Danışanlar', kisiEkle: 'Danışan ekle', kisiEklendi: 'Danışan eklendi.', kisilerim: 'Danışanlarım', kisiKarti: 'Danışan kartı', kisiKapat: 'Danışan kaydını kapat', kisiKapatildi: 'Danışan kaydı kapatıldı.', kisiyeHaber: 'Danışana haber ver', kisiyeHaberVerildi: 'Danışana haber verildi.', kisiSec: 'Önce danışan seçin.', kisiAdYaz: 'Danışanın adını yazın.', kisiBos: 'Henüz danışan yok.', veren: 'Uzman', hizmet: 'Uygulama', hizmetler: 'Uygulamalar', form: 'Danışan formu', formSorulari: 'Danışan formu soruları', notu: 'Klinik notu' },
    hasta: { isletme: 'Klinik', isletmeBilgi: 'Klinik bilgileri', sahip: 'Klinik sahibi', sahiptenIste: 'Gerekiyorsa klinik sahibinden yetki isteyin.', kisi: 'Hasta', kisiler: 'Hastalar', kisiEkle: 'Hasta ekle', kisiEklendi: 'Hasta eklendi.', kisilerim: 'Hastalarım', kisiKarti: 'Hasta kartı', kisiKapat: 'Hasta kaydını kapat', kisiKapatildi: 'Hasta kaydı kapatıldı.', kisiyeHaber: 'Hastaya haber ver', kisiyeHaberVerildi: 'Hastaya haber verildi.', kisiSec: 'Önce hasta seçin.', kisiAdYaz: 'Hastanın adını yazın.', kisiBos: 'Henüz hasta yok.', veren: 'Hekim', hizmet: 'İşlem', hizmetler: 'İşlemler', form: 'Hasta formu', formSorulari: 'Hasta formu soruları', notu: 'Klinik notu' },
  };
  // Klinik türlerinde varsayılan set "hasta"; sahip Ayarlar › Terimler'den "danışan"a geçebilir (?set=danisan).
  P.setAdi = P.klinik ? (qs.get('set') === 'danisan' ? 'danisan' : 'hasta') : 'salon';
  P.SET = SETLER[P.setAdi];
  P.T = (k) => P.SET[k] ?? SETLER.salon[k] ?? k;
  P.ROLLER = { sahip: P.T('sahip'), yonetici: 'Müdür', resepsiyon: 'Resepsiyon', personel: P.klinik ? 'Hekim' : 'Uzman' };
  if (P.klinik) P.ROLLER.saglik = 'Sağlık personeli';
  P.ROL_KISI = { sahip: 'p1', yonetici: 'p2', resepsiyon: 'p5', personel: 'p3', saglik: 'p4' };
  const ROL_TAKMA = { mudur: 'yonetici', uzman: 'personel', hekim: 'personel', 'saglik-personeli': 'saglik' };
  P.rol = qs.get('rol') || localStorage.getItem('bos-rol') || 'sahip';
  P.rol = ROL_TAKMA[P.rol] || P.rol;
  if (!P.ROLLER[P.rol]) P.rol = 'sahip';
  P.DURUMLAR = { normal: 'Dolu (normal)', yukleniyor: 'Yükleniyor', bos: 'Boş / ilk kullanım', hata: 'Yüklenemedi', yetkisiz: 'Yetkisiz' };
  P.durum = qs.get('durum') || 'normal';

  // Yetki tablosu: docs/tasarim-girdisi/roller-ve-akislar.md §1.4 ile birebir (S=sahip, Y=yönetici, R=resepsiyon, P=personel)
  const Y = {
    'bugun': 'SYR', 'bugun-ciro': 'SY', 'gunum': 'P', 'takvim': 'SYRP', 'randevu-olustur': 'SYRP', 'randevu-sil': 'SY',
    'randevu-tasi': 'SYRP', 'tutar-degistir': 'SYR', 'hizli-islem': 'SYRP', 'bekleme': 'SYR',
    'musteriler': 'SYRP', 'musteri-duzenle': 'SYR', 'saglik': 'SYP', 'foto': 'SYP', 'musteri-sil': 'SY', 'musteri-indir': 'SY',
    'cari-bakiye': 'SYR', 'paket-sat': 'SYR', 'paket-yonet': 'SY', 'izin-kaydet': 'SYR', 'personel-izni': 'SY',
    'hizmetler': 'SYRP', 'hizmet-duzenle': 'SY', 'personel': 'SYR', 'personel-duzenle': 'SY', 'rol-ver': 'S',
    'kasa': 'SYR', 'kasa-gecmis': 'SY', 'gun-sonu': 'SYR', 'gun-ac': 'SY', 'duzeltme': 'SY', 'gider-ekle': 'SY', 'ayar-terimler': 'S', 'ayar-guvenlik': 'SY', 'gider-sil': 'SY', 'bahsis-gir': 'SYR',
    'raporlar': 'SY', 'yonetim': 'SY', 'primim': 'P',
    'ayarlar': 'SY', 'ayar-abonelik': 'S', 'ayar-gizlilik': 'S', 'ayar-moduller': 'S', 'ayar-asistan': 'S', 'ayar-kullanicilar': 'S', 'hesabim': 'SYRP',
  };
  const HARF = { sahip: 'S', yonetici: 'Y', resepsiyon: 'R', personel: 'P', saglik: 'G' };
  // Sağlık personeli (G, yalnız klinik): takvim ve atandığı randevular; sahip yetki vermedikçe sağlık bilgisi ve klinik notu yok.
  const G_EK = ['takvim', 'gunum', 'musteriler', 'hesabim', 'hizmetler'];
  // Klinikte sağlık verisi, klinik notu, onam: yalnız hekim (kendi hastası). Sahip için "Sahip klinik notlarını görür" anahtarı varsayılan kapalı (?sahipNot=1).
  const KLINIK_SAGLIK = ['saglik', 'foto', 'musteri-indir'];
  P.yetki = (k) => {
    if (P.klinik && KLINIK_SAGLIK.includes(k) && qs.get('2fa') === 'yok') return false; // 2FA kurulmadan sağlık verisi kapalı (U1)
    if (P.klinik && KLINIK_SAGLIK.includes(k)) return P.rol === 'personel' || (P.rol === 'sahip' && qs.get('sahipNot') === '1');
    if (P.klinik && k === 'erisim') return P.rol === 'sahip' || P.rol === 'personel';
    if (P.rol === 'saglik') return G_EK.includes(k);
    return (Y[k] || '').includes(HARF[P.rol]);
  };
  P.kisi = () => VERI.PERSONEL.find((p) => p.id === P.ROL_KISI[P.rol]);

  // ---- Biçimler (tr-TR) ----
  const fmt0 = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0, minimumFractionDigits: 0 });
  const fmt2 = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 });
  P.para = (n) => fmt0.format(n);
  P.paraK = (n) => fmt2.format(n);
  P.sayi = (n) => new Intl.NumberFormat('tr-TR').format(n);
  P.sure = (dk) => (dk < 60 ? `${dk} dk` : `${Math.floor(dk / 60)} sa${dk % 60 ? ' ' + (dk % 60) + ' dk' : ''}`);
  P.dk = (s) => { const [a, b] = s.split(':').map(Number); return a * 60 + b; };
  P.kac = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---- İkonlar: tek set, 1.6 px çizgi, 24 kutu (lucide ile aynı dil; üretimde lucide-react) ----
  const I = {
    bugun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    takvim: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    musteri: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    arti: '<path d="M12 5v14M5 12h14"/>',
    ara: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    kapat: '<path d="M18 6 6 18M6 6l12 12"/>',
    geri: '<path d="m15 18-6-6 6-6"/>',
    ileri: '<path d="m9 18 6-6-6-6"/>',
    asagi: '<path d="m6 9 6 6 6-6"/>',
    saat: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    telefon: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    mesaj: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.9-.9L3 21l1.9-5.1a8.4 8.4 0 1 1 16.1-4.4z"/>',
    kasa: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
    hizmet: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>',
    personel: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    liste: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    rapor: '<path d="M3 3v18h18"/><path d="M7 15v2M11 11v6M15 7v10M19 12v5"/>',
    hesap: '<path d="M3 21h18M5 21V10M19 21V10M9 21v-6M15 21v-6M12 3 2 9h20z"/>',
    cari: '<path d="M4 4h12l4 4v12H4z"/><path d="M8 10h8M8 14h8M8 18h5"/>',
    fatura: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>',
    kamyon: '<path d="M2 6h12v10H2zM14 10h4l4 3v3h-8"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
    kutu: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    paket: '<rect x="3" y="8" width="18" height="13" rx="1"/><path d="M12 8v13M3 12h18M12 8c-2-4-6-4-6-1.5S10 8 12 8zm0 0c2-4 6-4 6-1.5S14 8 12 8z"/>',
    bahsis: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .9-3 2.2 0 3 6 1.6 6 4.6 0 1.3-1.3 2.2-3 2.2-1.4 0-2.6-.6-3-1.6M12 6v2M12 16v2"/>',
    prim: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    ayar: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    kilit: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    cikis: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    uyari: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    bilgi: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
    tamam: '<path d="M20 6 9 17l-5-5"/>',
    tamamDaire: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    hata: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>',
    yenile: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    duzenle: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    sil: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    nokta: '<circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/>',
    kopya: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    baglanti: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    goz: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    gozKapali: '<path d="M17.9 17.9A10 10 0 0 1 12 19c-6.4 0-10-7-10-7a18 18 0 0 1 5.1-5.9M9.9 4.2A9 9 0 0 1 12 4c6.4 0 10 7 10 7a18 18 0 0 1-2.2 3.2M14.1 14.1a3 3 0 1 1-4.2-4.2M2 2l20 20"/>',
    kalp: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>',
    foto: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
    indir: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    yazdir: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    konum: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    filtre: '<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>',
    oynat: '<path d="m6 4 14 8-14 8z"/>',
    kalkan: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    zil: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    tablet: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M12 18h.01"/>',
    imza: '<path d="M3 17c3-3 4-9 6-9s0 9 3 9 3-5 5-5 2 5 4 5M3 21h18"/>',
    kart: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    nakit: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
    sinyal: '<path d="M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20h.01"/>',
    araç: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
    sohbet: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  };
  P.ikon = (ad, cls = '') => `<svg class="ikon ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${I[ad] || ''}</svg>`;

  // Marka işareti (yer tutucu; kurucu logosu gelince değişir): halka = gün, pudra yay = dolu randevu dilimi
  P.isaret = (boy = 28) => `<svg class="marka__isaret" width="${boy}" height="${boy}" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="12.5" fill="none" stroke="#1F3E47" stroke-width="3.5"/><path d="M16 3.5A12.5 12.5 0 0 1 28.5 16" fill="none" stroke="#E89B96" stroke-width="3.5" stroke-linecap="round"/><circle cx="16" cy="16" r="2.4" fill="#1F3E47"/></svg>`;
  P.marka = (href = '#') => `<a class="marka" href="${href}" aria-label="BeautyOS ana sayfa">${P.isaret()}<span class="marka__ad">BeautyOS</span></a>`;

  P.avatar = (p, cls = '') => `<span class="avatar kisi-${p.ton} ${cls}" aria-hidden="true">${p.bas}</span>`;
  P.durumEtiketi = (d) => {
    const A = { bekliyor: 'Bekliyor', onayli: 'Onaylandı', suruyor: 'Devam ediyor', bitti: 'Tamamlandı', iptal: 'İptal edildi', gelmedi: 'Gelmedi' };
    return `<span class="durum durum--${d}">${A[d]}</span>`;
  };
  P.DURUM_ADI = { bekliyor: 'Bekliyor', onayli: 'Onaylandı', suruyor: 'Devam ediyor', bitti: 'Tamamlandı', iptal: 'İptal edildi', gelmedi: 'Gelmedi' };
  P.iskelet = (w = '100%', h = 14, cls = '') => `<span class="iskelet ${cls}" style="width:${w};height:${h}px" aria-hidden="true"></span>`;

  // ---- Katman: telefonda alt sayfa, 768+ diyalog. Odak tuzağı, Esc, arka plan tıklaması, odak iadesi ----
  let acikKatmanlar = [];
  P.katmanAc = function ({ baslik, govde, alt = '', tam = false, genis = false, kimlik = '', geri = false, kapatilamaz = false }) {
    const onceki = document.activeElement;
    const arka = document.createElement('div');
    arka.className = 'katman-arka';
    const bId = 'kb-' + Math.random().toString(36).slice(2, 8);
    arka.innerHTML = `<div class="katman ${tam ? 'katman--tam' : ''} ${genis ? 'katman--genis' : ''}" role="dialog" aria-modal="true" aria-labelledby="${bId}" data-testid="${kimlik}">
      ${tam ? '' : '<div class="katman__tutamac" aria-hidden="true"></div>'}
      <div class="katman__ust">
        ${geri ? `<button class="dugme dugme--ikon" data-katman-kapat aria-label="Geri">${P.ikon('geri')}</button>` : ''}
        <h2 class="katman__baslik" id="${bId}">${baslik}</h2>
        ${kapatilamaz || geri ? '' : `<button class="dugme dugme--ikon" data-katman-kapat aria-label="Kapat">${P.ikon('kapat')}</button>`}
      </div>
      <div class="katman__govde">${govde}</div>
      ${alt ? `<div class="katman__alt">${alt}</div>` : ''}
    </div>`;
    document.body.appendChild(arka);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => (arka.dataset.acik = 'true'));
    const kutu = arka.querySelector('.katman');
    const kapat = () => {
      arka.dataset.acik = 'false';
      setTimeout(() => { arka.remove(); acikKatmanlar = acikKatmanlar.filter((k) => k !== arka); if (!acikKatmanlar.length) document.body.style.overflow = ''; onceki && onceki.focus && onceki.focus(); }, 180);
    };
    arka._kapat = kapat;
    if (!kapatilamaz) arka.addEventListener('mousedown', (e) => { if (e.target === arka) kapat(); });
    arka.addEventListener('click', (e) => { if (e.target.closest('[data-katman-kapat]')) kapat(); });
    arka.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !kapatilamaz) { e.stopPropagation(); kapat(); }
      if (e.key === 'Tab') {
        const o = [...kutu.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
        if (!o.length) return;
        if (e.shiftKey && document.activeElement === o[0]) { e.preventDefault(); o[o.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === o[o.length - 1]) { e.preventDefault(); o[0].focus(); }
      }
    });
    acikKatmanlar.push(arka);
    setTimeout(() => { const ilk = kutu.querySelector('[data-ilk-odak]') || kutu.querySelector('.katman__baslik'); ilk.setAttribute('tabindex', '-1'); ilk.focus({ preventScroll: true }); }, 30);
    return { kok: kutu, kapat };
  };
  P.tumKatmanlariKapat = () => acikKatmanlar.slice().forEach((k) => k._kapat());

  // Onay penceresi (silme, iptal, geri alma): başlık eylemi, gövde sonucu, buton eylemin adı
  P.onay = function ({ baslik, metin, vazgec = 'Vazgeç', eylem, tehlike = true, ek = '', sonra }) {
    const k = P.katmanAc({
      baslik, kimlik: 'onay-penceresi',
      govde: `<p class="metin-ikincil">${metin}</p>${ek}`,
      alt: `<button class="dugme dugme--ikincil" data-katman-kapat>${vazgec}</button><button class="dugme ${tehlike ? 'dugme--tehlike-dolu' : 'dugme--birincil'}" data-onay-eylem>${eylem}</button>`,
    });
    k.kok.querySelector('[data-onay-eylem]').addEventListener('click', () => { k.kapat(); sonra && sonra(); });
    return k;
  };

  // ---- Kısa bildirim ----
  let kap = null;
  P.bildir = function (metin, { tur = 'basari', geriAl = null, sure = 4000 } = {}) {
    if (!kap) { kap = document.createElement('div'); kap.className = 'bildirimler'; kap.setAttribute('role', 'status'); kap.setAttribute('aria-live', 'polite'); document.body.appendChild(kap); }
    const b = document.createElement('div');
    b.className = 'bildirim' + (tur === 'hata' ? ' bildirim--hata' : '');
    b.innerHTML = `${P.ikon(tur === 'hata' ? 'hata' : 'tamamDaire')}<span style="flex:1">${metin}</span>${geriAl ? '<button class="dugme dugme--metin dugme--kucuk" data-geri-al>Geri al</button>' : ''}<button class="dugme dugme--ikon" style="width:32px;min-height:32px;color:inherit" aria-label="Bildirimi kapat">${P.ikon('kapat', 'ikon--16')}</button>`;
    kap.appendChild(b);
    const sil = () => b.remove();
    b.querySelector('[aria-label="Bildirimi kapat"]').onclick = sil;
    if (geriAl) b.querySelector('[data-geri-al]').onclick = () => { geriAl(); sil(); };
    setTimeout(sil, geriAl ? 8000 : sure);
  };

  // Gönderim düğmesi: "Kaydediliyor…" + dönen işaret, sonra sonuç
  P.isle = function (dugme, ilerleme, sonra, ms = 700) {
    const eski = dugme.innerHTML;
    dugme.setAttribute('aria-busy', 'true'); dugme.disabled = true;
    dugme.innerHTML = `<span class="donen" aria-hidden="true"></span>${ilerleme}`;
    setTimeout(() => { dugme.removeAttribute('aria-busy'); dugme.disabled = false; dugme.innerHTML = eski; sonra && sonra(); }, ms);
  };

  // ---- Genel olay devri: tekli seçim grupları, sekmeler, kopyalama ----
  document.addEventListener('click', (e) => {
    const s = e.target.closest('[data-tekli] > [aria-pressed], [data-tekli] [aria-pressed]');
    if (s && !s.disabled) {
      const grup = s.closest('[data-tekli]');
      grup.querySelectorAll('[aria-pressed]').forEach((x) => x.setAttribute('aria-pressed', String(x === s)));
      grup.dispatchEvent(new CustomEvent('secim', { detail: s.dataset.deger ?? s.textContent.trim(), bubbles: true }));
    }
    const t = e.target.closest('[role="tab"]');
    if (t) {
      const liste = t.closest('[role="tablist"]');
      liste.querySelectorAll('[role="tab"]').forEach((x) => {
        const sec = x === t; x.setAttribute('aria-selected', String(sec)); x.tabIndex = sec ? 0 : -1;
        const panel = document.getElementById(x.getAttribute('aria-controls')); if (panel) panel.hidden = !sec;
      });
    }
    const k = e.target.closest('[data-kopyala]');
    if (k) { navigator.clipboard && navigator.clipboard.writeText(k.dataset.kopyala).catch(() => {}); P.bildir('Bağlantı kopyalandı.'); }
  });
  document.addEventListener('keydown', (e) => {
    const t = e.target.closest && e.target.closest('[role="tab"]');
    if (!t || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const s = [...t.closest('[role="tablist"]').querySelectorAll('[role="tab"]')];
    let i = s.indexOf(t);
    i = e.key === 'ArrowRight' ? (i + 1) % s.length : e.key === 'ArrowLeft' ? (i - 1 + s.length) % s.length : e.key === 'Home' ? 0 : s.length - 1;
    s[i].click(); s[i].focus(); e.preventDefault();
  });

  // ---- Prototip çubuğu (rol + durum). Ürünün parçası değildir; ?yalin=1 ile gizlenir ----
  P.cubuk = function ({ durum = true, rol = true } = {}) {
    if (P.yalin) return;
    const c = document.createElement('div');
    c.className = 'prototip-cubuk';
    c.setAttribute('aria-label', 'Prototip denetimleri');
    c.innerHTML = `<button class="prototip-cubuk__ac" aria-expanded="true" title="Prototip denetimlerini gizle">Prototip</button>
      ${rol ? `<label>Rol <select data-p-rol>${Object.entries(P.ROLLER).map(([k, v]) => `<option value="${k}" ${k === P.rol ? 'selected' : ''}>${v}</option>`).join('')}</select></label>` : ''}
      <label>Tür <select data-p-tur>${Object.entries(P.TURLER).map(([k, v]) => `<option value="${k}" ${k === P.tur ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      ${durum ? `<label>Durum <select data-p-durum>${Object.entries(P.DURUMLAR).map(([k, v]) => `<option value="${k}" ${k === P.durum ? 'selected' : ''}>${v}</option>`).join('')}</select></label>` : ''}
      <a href="index.html">Ekran listesi</a>`;
    document.body.appendChild(c);
    const git = (k, v) => { const u = new URL(location.href); u.searchParams.set(k, v); if (k === 'rol') localStorage.setItem('bos-rol', v); if (k === 'tur') localStorage.setItem('bos-tur', v); location.href = u.toString(); };
    c.querySelector('[data-p-tur]')?.addEventListener('change', (e) => git('tur', e.target.value));
    c.querySelector('[data-p-rol]')?.addEventListener('change', (e) => git('rol', e.target.value));
    c.querySelector('[data-p-durum]')?.addEventListener('change', (e) => git('durum', e.target.value));
    c.querySelector('.prototip-cubuk__ac').addEventListener('click', (e) => { const k = c.dataset.kapali !== 'true'; c.dataset.kapali = String(k); e.target.setAttribute('aria-expanded', String(!k)); });
  };

  window.P = P;
})();
