/* BeautyOS prototip örnek verisi — KURGUSAL. Salon, kişi ve telefonlar gerçek değildir (0500 000 00 xx).
   Tüm toplamlar satırlardan hesaplanır; tutarlılık console.assert ile denetlenir. */
(function () {
  const SALON = {
    ad: 'Defne Güzellik Salonu',
    adres: 'Moda Cad. No: 00, Kadıköy / İstanbul',
    telefon: '0500 000 00 10',
    salonAdresi: 'defne-guzellik',
    tur: 'Güzellik merkezi',
    plan: 'Deneme süresi', denemeBitis: '17.11.2026', denemeKalanGun: 20,
    calismaSaatleri: [
      ['Pazartesi', '09:00', '20:00'], ['Salı', '09:00', '20:00'], ['Çarşamba', '09:00', '20:00'],
      ['Perşembe', '09:00', '20:00'], ['Cuma', '09:00', '20:00'], ['Cumartesi', '09:00', '19:00'], ['Pazar', null, null],
    ],
  };

  // Bugün: 28 Ekim 2026 Çarşamba, şimdi 14:20
  const BUGUN = { tarih: '2026-10-28', okunur: '28 Ekim, Çarşamba', kisa: 'Çar 28 Eki', simdi: '14:20' };

  const PERSONEL = [
    { id: 'p1', ad: 'Derya Aksoy', kisa: 'Derya', bas: 'DA', unvan: 'Saç tasarım', rol: 'sahip', ton: 1, prim: '%30', email: 'derya@ornek.test' },
    { id: 'p2', ad: 'Elif Şahin', kisa: 'Elif', bas: 'EŞ', unvan: 'Kuaför', rol: 'yonetici', ton: 2, prim: '%25', email: 'elif@ornek.test' },
    { id: 'p3', ad: 'Zeynep Arslan', kisa: 'Zeynep', bas: 'ZA', unvan: 'Manikür ve pedikür', rol: 'personel', ton: 3, prim: '%25', email: 'zeynep@ornek.test' },
    { id: 'p4', ad: 'Merve Çelik', kisa: 'Merve', bas: 'MÇ', unvan: 'Cilt bakım uzmanı', rol: 'personel', ton: 4, prim: '%20', email: 'merve@ornek.test' },
    { id: 'p5', ad: 'Selin Öztürk', kisa: 'Selin', bas: 'SÖ', unvan: 'Resepsiyon', rol: 'resepsiyon', ton: 5, prim: '—', email: 'selin@ornek.test', hizmetVermez: true },
  ];

  const HIZMETLER = [
    { id: 'h1', ad: 'Kadın saç kesimi', kat: 'Saç', sure: 45, fiyat: 850, personel: ['p1', 'p2'], online: true },
    { id: 'h2', ad: 'Fön', kat: 'Saç', sure: 30, fiyat: 450, personel: ['p1', 'p2'], online: true },
    { id: 'h3', ad: 'Dip boya', kat: 'Saç', sure: 90, fiyat: 1600, personel: ['p1'], online: true },
    { id: 'h4', ad: 'Ombre ve balyaj', kat: 'Saç', sure: 180, fiyat: 4500, personel: ['p1'], online: false },
    { id: 'h5', ad: 'Keratin bakım', kat: 'Saç', sure: 120, fiyat: 3200, personel: ['p1', 'p2'], online: true },
    { id: 'h6', ad: 'Manikür', kat: 'Tırnak', sure: 45, fiyat: 600, personel: ['p3'], online: true },
    { id: 'h7', ad: 'Kalıcı oje', kat: 'Tırnak', sure: 60, fiyat: 750, personel: ['p3'], online: true },
    { id: 'h8', ad: 'Protez tırnak', kat: 'Tırnak', sure: 120, fiyat: 1400, personel: ['p3'], online: true },
    { id: 'h9', ad: 'Pedikür', kat: 'Tırnak', sure: 60, fiyat: 800, personel: ['p3'], online: true },
    { id: 'h10', ad: 'Klasik cilt bakımı', kat: 'Cilt', sure: 60, fiyat: 1500, personel: ['p4'], online: true },
    { id: 'h11', ad: 'Cilt bakımı (derin temizlik)', kat: 'Cilt', sure: 75, fiyat: 2400, personel: ['p4'], online: true },
    { id: 'h12', ad: 'Kaş alımı', kat: 'Kaş ve kirpik', sure: 15, fiyat: 250, personel: ['p4'], online: true },
    { id: 'h13', ad: 'Kirpik lifting', kat: 'Kaş ve kirpik', sure: 60, fiyat: 1200, personel: ['p4'], online: true },
  ];

  // ---- Klinik modu örneği (?tur=estetik | dis): aynı gün ve tutarlar, klinik adları. Kurgusal. ----
  const TUR = new URLSearchParams(location.search).get('tur') || localStorage.getItem('bos-tur') || 'kuafor';
  if (TUR === 'estetik' || TUR === 'dis') {
    const est = TUR === 'estetik';
    Object.assign(SALON, est
      ? { ad: 'Lavin Estetik Kliniği', tur: 'Estetik kliniği', salonAdresi: 'lavin-estetik', ruhsat: '[RUHSAT NO]', sorumlu: 'Dr. Derya Aksoy' }
      : { ad: 'Ada Ağız ve Diş Sağlığı', tur: 'Diş hekimi', salonAdresi: 'ada-dis', ruhsat: '[RUHSAT NO]', sorumlu: 'Dt. Derya Aksoy' });
    const on = est ? 'Dr.' : 'Dt.';
    [['p1', `${on} Derya Aksoy`, 'Hekim'], ['p2', `${on} Elif Şahin`, 'Hekim'], ['p3', `${on} Zeynep Arslan`, 'Hekim'], ['p4', 'Merve Çelik', 'Sağlık personeli'], ['p5', 'Selin Öztürk', 'Resepsiyon']]
      .forEach(([id, ad, u]) => Object.assign(PERSONEL.find((p) => p.id === id), { ad, unvan: u, kisa: ad.replace(/^(Dr\.|Dt\.) /, '').split(' ')[0] }, u === 'Sağlık personeli' ? { rol: 'saglik' } : {}));
    const ADLAR = est
      ? [['Ön görüşme', 'Görüşme'], ['Kontrol', 'Görüşme'], ['Cilt analizi', 'Cilt'], ['Lazer epilasyon, tüm bacak', 'Lazer'], ['Leke tedavisi seansı', 'Cilt'], ['Lazer epilasyon, koltuk altı', 'Lazer'], ['Lazer epilasyon, yüz', 'Lazer'], ['Kimyasal peeling', 'Cilt'], ['Lazer epilasyon, kol', 'Lazer'], ['Cilt yenileme', 'Cilt'], ['Cilt bakımı (derin temizlik)', 'Cilt'], ['Kontrol (kısa)', 'Görüşme'], ['Mezoterapi seansı', 'Cilt']]
      : [['Muayene', 'Muayene'], ['Kontrol', 'Muayene'], ['Kanal işlemi', 'İşlem'], ['İmplant görüşmesi', 'Muayene'], ['Beyazlatma', 'Estetik'], ['Diş taşı temizliği', 'Ağız bakımı'], ['Dolgu', 'İşlem'], ['Zirkonyum ölçü', 'Estetik'], ['Dolgu (iki yüz)', 'İşlem'], ['Diş taşı ve parlatma', 'Ağız bakımı'], ['Gülüş tasarımı görüşmesi', 'Estetik'], ['Kısa kontrol', 'Muayene'], ['Çocuk muayenesi', 'Muayene']];
    HIZMETLER.forEach((h, i) => { h.ad = ADLAR[i][0].replace('Leke tedavisi', 'Leke giderme'); h.kat = ADLAR[i][1]; h.online = true; });
  }

  // durum: bekliyor | onayli | suruyor | bitti | iptal | gelmedi ; kanal: elle | online
  const r = (id, p, h, bas, bit, musteri, tel, durum, extra) => Object.assign({ id, p, h, bas, bit, musteri, tel, durum, kanal: 'elle', odeme: null }, extra || {});
  const RANDEVULAR = [
    r('r1', 'p1', 'h3', '09:30', '11:00', 'Aylin Yıldız', '0500 000 00 21', 'bitti', { odeme: 'Kart' }),
    r('r2', 'p1', 'h1', '11:30', '12:15', 'Burcu Demir', '0500 000 00 22', 'bitti', { odeme: 'Nakit' }),
    r('r3', 'p1', 'h4', '13:30', '16:30', 'Gizem Koç', '0500 000 00 23', 'suruyor', { not: 'Uçlar açık ton, kökler doğal kalsın.' }),
    r('r4', 'p1', 'h1', '17:00', '17:45', 'Ece Aydın', '0500 000 00 24', 'onayli'),
    r('r5', 'p2', 'h2', '10:00', '10:30', 'Nur Tekin', '0500 000 00 25', 'bitti', { odeme: 'Nakit' }),
    r('r6', 'p2', 'h5', '12:00', '14:00', 'Sibel Kurt', '0500 000 00 26', 'bitti', { odeme: 'Kart' }),
    r('r7', 'p2', 'h1', '14:30', '15:15', 'Hande Polat', '0500 000 00 27', 'onayli', { not: 'Kısa kesim istiyor, fotoğraf getirecek.' }),
    r('r8', 'p2', 'h2', '15:30', '16:00', 'Melis Er', '0500 000 00 28', 'bekliyor', { kanal: 'online' }),
    r('r9', 'p2', 'h2', '18:00', '18:30', 'Pınar Uçar', '0500 000 00 29', 'onayli'),
    r('r10', 'p3', 'h7', '10:00', '11:00', 'Tuğba Şen', '0500 000 00 30', 'bitti', { odeme: 'Kart' }),
    r('r11', 'p3', 'h6', '11:30', '12:15', 'Aslı Güneş', '0500 000 00 31', 'gelmedi'),
    r('r12', 'p3', 'h9', '13:00', '14:00', 'Fatma Aksu', '0500 000 00 32', 'bitti', { odeme: 'Nakit' }),
    r('r13', 'p3', 'h8', '14:30', '16:30', 'İrem Bulut', '0500 000 00 33', 'onayli', { saglikNotu: true }),
    r('r14', 'p3', 'h7', '17:00', '18:00', 'Ceren Oral', '0500 000 00 34', 'bekliyor', { kanal: 'online' }),
    r('r15', 'p4', 'h10', '11:00', '12:00', 'Gül Erdem', '0500 000 00 35', 'bitti', { odeme: 'Kart' }),
    r('r16', 'p4', 'h13', '12:30', '13:30', 'Duygu Kara', '0500 000 00 36', 'iptal'),
    r('r17', 'p4', 'h11', '15:00', '16:15', 'Seda Kılıç', '0500 000 00 37', 'onayli', { saglikNotu: true }),
    r('r18', 'p4', 'h12', '16:30', '16:45', 'Ayşe Yalın', '0500 000 00 38', 'onayli'),
  ];
  RANDEVULAR.forEach((x) => { const h = HIZMETLER.find((s) => s.id === x.h); x.hizmet = h.ad; x.tutar = h.fiyat; x.sure = h.sure; });
  // Online randevu onayı işletme ayarıdır: salonda varsayılan otomatik onay, klinikte varsayılan "Bekliyor" (?onay=elle|otomatik)
  const ONAY = new URLSearchParams(location.search).get('onay');
  const elleOnay = (TUR === 'estetik' || TUR === 'dis') ? ONAY !== 'otomatik' : ONAY === 'elle';
  if (!elleOnay) RANDEVULAR.forEach((x) => { if (x.kanal === 'online' && x.durum === 'bekliyor') x.durum = 'onayli'; });

  const GIDERLER = [
    { saat: '09:10', kat: 'Malzeme', aciklama: 'Oksidan ve folyo', tutar: 640, yontem: 'Nakit' },
    { saat: '13:05', kat: 'Yemek', aciklama: 'Öğle yemeği', tutar: 420, yontem: 'Nakit' },
  ];
  const BAHSISLER_BUGUN = [
    { p: 'p2', musteri: 'Sibel Kurt', tutar: 200, kaynak: 'Nakit' },
    { p: 'p3', musteri: 'Tuğba Şen', tutar: 100, kaynak: 'Kart' },
  ];

  const MUSTERILER = [
    { id: 'm1', ad: 'Hande Polat', tel: '0500 000 00 27', email: 'hande.polat@ornek.test', dogum: '14.03.1991', ziyaret: 9, harcama: 8650, son: '12.09.2026', ilk: '02.11.2025', not: 'Kahve sevmez, su ikram edin. Randevu öncesi gün WhatsApp’tan hatırlatma istiyor.', izinSms: { var: true, tarih: '02.11.2025', kaynak: 'Kâğıt üzerinde imzalı form' }, izinEposta: { var: false }, saglikRiza: 'var', fotoRiza: 'yok', cari: 0 },
    { id: 'm2', ad: 'Gizem Koç', tel: '0500 000 00 23', ziyaret: 6, harcama: 11200, son: 'Bugün', ilk: '15.01.2026', saglikRiza: 'var', fotoRiza: 'var', cari: 0 },
    { id: 'm3', ad: 'İrem Bulut', tel: '0500 000 00 33', ziyaret: 4, harcama: 5600, son: '30.09.2026', ilk: '10.04.2026', saglikRiza: 'var', fotoRiza: 'var', cari: 0 },
    { id: 'm4', ad: 'Seda Kılıç', tel: '0500 000 00 37', ziyaret: 3, harcama: 7200, son: '07.10.2026', ilk: '20.06.2026', saglikRiza: 'yok', fotoRiza: 'yok', paket: { ad: 'Cilt bakımı (derin temizlik) 6 seans', kalan: 3, toplam: 6, bitis: '20.12.2026' }, cari: 0 },
    { id: 'm5', ad: 'Sibel Kurt', tel: '0500 000 00 26', ziyaret: 12, harcama: 19450, son: 'Bugün', ilk: '05.08.2025', saglikRiza: 'var', fotoRiza: 'yok', cari: 0 },
    { id: 'm6', ad: 'Ece Aydın', tel: '0500 000 00 24', ziyaret: 2, harcama: 1700, son: '21.08.2026', ilk: '19.07.2026', saglikRiza: 'yok', fotoRiza: 'yok', cari: 1200 },
    { id: 'm7', ad: 'Aylin Yıldız', tel: '0500 000 00 21', ziyaret: 7, harcama: 9800, son: 'Bugün', ilk: '11.12.2025', saglikRiza: 'reddetti', fotoRiza: 'yok', cari: 0 },
    { id: 'm8', ad: 'Melis Er', tel: '0500 000 00 28', ziyaret: 0, harcama: 0, son: '—', ilk: 'Bugün (online)', saglikRiza: 'yok', fotoRiza: 'yok', cari: 0 },
    { id: 'm9', ad: 'Aslı Güneş', tel: '0500 000 00 31', ziyaret: 1, harcama: 600, son: '28.07.2026', ilk: '28.07.2026', saglikRiza: 'yok', fotoRiza: 'yok', cari: 0 },
    { id: 'm10', ad: 'Burcu Demir', tel: '0500 000 00 22', ziyaret: 5, harcama: 4250, son: 'Bugün', ilk: '03.03.2026', saglikRiza: 'yok', fotoRiza: 'yok', cari: 0 },
  ];
  const HANDE_GECMIS = [
    { tarih: '12.09.2026', hizmet: 'Kadın saç kesimi', p: 'p2', tutar: 850, durum: 'bitti' },
    { tarih: '01.08.2026', hizmet: 'Keratin bakım', p: 'p2', tutar: 3200, durum: 'bitti' },
    { tarih: '20.06.2026', hizmet: 'Kadın saç kesimi', p: 'p1', tutar: 850, durum: 'bitti' },
    { tarih: '05.05.2026', hizmet: 'Fön', p: 'p2', tutar: 450, durum: 'iptal' },
  ];

  const BEKLEME = [
    { musteri: 'Nazlı Ateş', tel: '0500 000 00 41', hizmet: 'Cilt bakımı (derin temizlik)', tercih: 'Merve · 29–31 Ekim, öğleden sonra', eklendi: '26.10.2026', durum: 'bekliyor' },
    { musteri: 'Oya Sezer', tel: '0500 000 00 42', hizmet: 'Ombre ve balyaj', tercih: 'Derya · Cumartesi', eklendi: '24.10.2026', durum: 'haber' },
    { musteri: 'Damla Tuna', tel: '0500 000 00 43', hizmet: 'Protez tırnak', tercih: 'Fark etmez · bu hafta', eklendi: '27.10.2026', durum: 'bekliyor' },
  ];

  const STOK = [
    { ad: 'Oksidan %6', birim: 'şişe', miktar: 3, kritik: 5, tedarikci: 'Kuaför Market Toptan' },
    { ad: 'Saç boyası 7.0', birim: 'tüp', miktar: 18, kritik: 6, tedarikci: 'Kuaför Market Toptan' },
    { ad: 'Keratin seti', birim: 'set', miktar: 2, kritik: 2, tedarikci: 'Pro Bakım Ltd.' },
    { ad: 'Kalıcı oje baz', birim: 'şişe', miktar: 9, kritik: 3, tedarikci: 'Nail Depo' },
    { ad: 'Cilt bakımı (derin temizlik) uç seti', birim: 'adet', miktar: 14, kritik: 10, tedarikci: 'Pro Bakım Ltd.' },
    { ad: 'Folyo rulo', birim: 'rulo', miktar: 6, kritik: 2, tedarikci: 'Kuaför Market Toptan' },
  ];
  const PAKETLER = [
    { ad: 'Cilt bakımı (derin temizlik) 6 seans', hizmet: 'Cilt bakımı (derin temizlik)', seans: 6, fiyat: 12000, gecerlilik: '6 ay', satilan: 3 },
    { ad: 'Kalıcı oje 5 seans', hizmet: 'Kalıcı oje', seans: 5, fiyat: 3200, gecerlilik: '4 ay', satilan: 5 },
    { ad: 'Fön 10 seans', hizmet: 'Fön', seans: 10, fiyat: 3800, gecerlilik: '3 ay', satilan: 2 },
  ];
  const HESAPLAR = [
    { ad: 'Salon kasası', tur: 'Nakit', bakiye: 12480 },
    { ad: 'İş bankası hesabı', tur: 'Banka', bakiye: 86350 },
    { ad: 'POS cihazı', tur: 'POS', bakiye: 7050 },
  ];
  const CARI = [
    { ad: 'Kuaför Market Toptan', tur: 'Tedarikçi', bakiye: -8420, son: '21.10.2026' },
    { ad: 'Pro Bakım Ltd.', tur: 'Tedarikçi', bakiye: -3150, son: '15.10.2026' },
    { ad: 'Ece Aydın', tur: 'Müşteri', bakiye: 1200, son: '21.08.2026' },
  ];
  const FATURALAR = [
    { no: 'KMT2026-1184', tedarikci: 'Kuaför Market Toptan', tarih: '21.10.2026', tutar: 8420, durum: 'İşlendi' },
    { no: 'PB-00932', tedarikci: 'Pro Bakım Ltd.', tarih: '15.10.2026', tutar: 3150, durum: 'İşlendi' },
    { no: 'ND-2211', tedarikci: 'Nail Depo', tarih: '27.10.2026', tutar: 1860, durum: 'Taslak' },
  ];
  const TEDARIKCILER = [
    { ad: 'Kuaför Market Toptan', yetkili: 'Murat Er', tel: '0500 000 00 51', urun: 3 },
    { ad: 'Pro Bakım Ltd.', yetkili: 'Gamze Uz', tel: '0500 000 00 52', urun: 2 },
    { ad: 'Nail Depo', yetkili: 'Can Aras', tel: '0500 000 00 53', urun: 1 },
  ];
  // Ekim ayı personel ödemeleri (1–28 Ekim)
  const PRIMLER = [
    { p: 'p1', hizmetSayisi: 64, ciro: 98400, prim: 29520, bahsis: 1850, durum: 'Bekliyor' },
    { p: 'p2', hizmetSayisi: 71, ciro: 61250, prim: 15312.5, bahsis: 2100, durum: 'Bekliyor' },
    { p: 'p3', hizmetSayisi: 58, ciro: 47900, prim: 11975, bahsis: 1300, durum: 'Bekliyor' },
    { p: 'p4', hizmetSayisi: 39, ciro: 52300, prim: 10460, bahsis: 950, durum: 'Bekliyor' },
  ];

  // Süper yönetici: salonlar (kurgusal)
  const SALONLAR = [
    { ad: 'Defne Güzellik Salonu', sahip: 'Derya Aksoy', eposta: 'derya@ornek.test', plan: 'Deneme', durum: 'Aktif', kayit: '18.10.2026', bitis: '17.11.2026', kullanici: 5, musteri: 214, randevu30: 486, ciro30: 182400, sonGiris: 'Bugün 14:02', kabul: 'v1' },
    { ad: 'Kuzey Berber', sahip: 'Kerem Taş', eposta: 'kerem@ornek.test', plan: 'Deneme', durum: 'Aktif', kayit: '22.10.2026', bitis: '21.11.2026', kullanici: 2, musteri: 31, randevu30: 58, ciro30: 14650, sonGiris: 'Dün 19:40', kabul: 'v1' },
    { ad: 'Lale Tırnak Stüdyosu', sahip: 'Lale Er', eposta: 'lale@ornek.test', plan: 'Deneme', durum: 'Aktif', kayit: '03.10.2026', bitis: '02.11.2026', kullanici: 1, musteri: 0, randevu30: 0, ciro30: 0, sonGiris: '04.10.2026', kabul: 'v1' },
    { ad: 'Mavi Saç Tasarım', sahip: 'Okan Mavi', eposta: 'okan@ornek.test', plan: 'Başlangıç', durum: 'Pasif', kayit: '12.08.2026', bitis: '—', kullanici: 3, musteri: 122, randevu30: 0, ciro30: 0, sonGiris: '28.09.2026', kabul: 'v0' },
  ];

  // ---- Hesaplanan değerler ----
  const say = (f) => RANDEVULAR.filter(f).length;
  const topla = (arr, k) => arr.reduce((a, x) => a + (typeof k === 'function' ? k(x) : x[k]), 0);
  const tamamlanan = RANDEVULAR.filter((x) => x.durum === 'bitti');
  const KASA = {
    nakit: topla(tamamlanan.filter((x) => x.odeme === 'Nakit'), 'tutar'),
    kart: topla(tamamlanan.filter((x) => x.odeme === 'Kart'), 'tutar'),
    gider: topla(GIDERLER, 'tutar'),
    acilisNakit: 1500,
  };
  KASA.ciro = KASA.nakit + KASA.kart;
  KASA.net = KASA.ciro - KASA.gider;
  KASA.beklenenNakit = KASA.acilisNakit + KASA.nakit - topla(GIDERLER.filter((g) => g.yontem === 'Nakit'), 'tutar');
  const OZET = {
    toplam: say((x) => x.durum !== 'iptal'),
    tamamlanan: tamamlanan.length,
    suruyor: say((x) => x.durum === 'suruyor'),
    bekliyor: say((x) => x.durum === 'bekliyor'),
    gelecek: say((x) => x.durum === 'onayli'),
    gelmedi: say((x) => x.durum === 'gelmedi'),
    iptal: say((x) => x.durum === 'iptal'),
    beklenenCiro: topla(RANDEVULAR.filter((x) => ['onayli', 'bekliyor', 'suruyor'].includes(x.durum)), 'tutar'),
  };

  console.assert(KASA.ciro === 9150, 'Kasa cirosu 9150 olmalı', KASA.ciro);
  console.assert(KASA.nakit === 2100 && KASA.kart === 7050, 'Nakit/kart kırılımı');
  console.assert(OZET.toplam === 17 && OZET.tamamlanan === 7, 'Randevu sayıları');
  console.assert(OZET.tamamlanan + OZET.suruyor + OZET.bekliyor + OZET.gelecek + OZET.gelmedi === OZET.toplam, 'Durumlar toplamı');
  console.assert(KASA.kart === HESAPLAR.find((h) => h.tur === 'POS').bakiye, 'POS bakiyesi bugünkü kart tahsilatına eşit');
  console.assert(KASA.beklenenNakit === 2540, 'Beklenen nakit', KASA.beklenenNakit);

  window.VERI = { SALON, BUGUN, PERSONEL, HIZMETLER, RANDEVULAR, GIDERLER, BAHSISLER_BUGUN, MUSTERILER, HANDE_GECMIS, BEKLEME, STOK, PAKETLER, HESAPLAR, CARI, FATURALAR, TEDARIKCILER, PRIMLER, SALONLAR, KASA, OZET };
})();
