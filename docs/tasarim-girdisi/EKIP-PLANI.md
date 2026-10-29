# BeautyOS Yeniden Tasarım — Ekip Planı

Brif: `projeler/beautyos/docs/tasarim-brief.md` (herkes önce bunu okur). Tüm yollar `C:\Users\pc\Desktop\Şirket\projeler\beautyos\` altına göredir.

## Ekip ve dosya sahipliği

Aynı dosyayı iki kişi düzenlemez. Başkasının dosyasında eksik görürsen **dosyayı değil, sahibini** uyar.

| Üye | Girdi dosyası (Aşama 1) | İnceleme dosyası (Aşama 3) |
|---|---|---|
| `urun-analisti` | `docs/tasarim-girdisi/roller-ve-akislar.md` | `docs/tasarim-girdisi/inceleme-urun-analisti.md` |
| `frontend-gelistirici` | `docs/tasarim-girdisi/ekran-envanteri.md` | `docs/tasarim-girdisi/inceleme-frontend-gelistirici.md` (+ ekran görüntüleri `docs/tasarim-girdisi/ekran-goruntuleri/`) |
| `teknik-yazar` | `docs/tasarim-girdisi/metin-rehberi.md` | `docs/tasarim-girdisi/inceleme-teknik-yazar.md` |
| `hukuk-uyum` | `docs/tasarim-girdisi/yasal-ekran-gereksinimleri.md` | `docs/tasarim-girdisi/inceleme-hukuk-uyum.md` |
| `pazarlama` | `docs/tasarim-girdisi/tanitim-sitesi-icerik.md` | `docs/tasarim-girdisi/inceleme-pazarlama.md` |
| `ui-ux-tasarimci` | `docs/tasarim.md` ve `docs/tasarim/` klasörünün tamamı (prototip) | — |

Proje kodu (`apps/`), diğer `docs/` dosyaları ve git işlemleri bu işin dışında. **Commit atılmaz**; müdür sonunda toplu commit atar.

## Aşamalar

1. **Girdi (paralel):** Her üye kendi girdi dosyasını yazar. Bitince `ui-ux-tasarimci`'ya `[GİRDİ HAZIR] <dosya>` gönderir. Erken ve önemli bulguyu (ör. rol matrisi taslağı) bitmeden de gönder. `ui-ux-tasarimci` bu sırada beklemez; tasarım dilini (renk, yazı, aralık, bileşen) kurmaya başlar.
2. **Tasarım:** `ui-ux-tasarimci` `docs/tasarim.md`'yi ve prototipi üretir. Tasarım dili + ilk anahtar ekranlar hazır olunca herkese `[İNCELEME İSTEĞİ] docs/tasarim.md + docs/tasarim/prototip/index.html` gönderir.
3. **Çapraz inceleme:** Her üye kendi bakış açısıyla inceler, inceleme dosyasına yazar, `ui-ux-tasarimci`'ya `[TASARIM BULGUSU] <dosya> · <özet>` gönderir. Başka bir üyenin alanına giren şeyi doğrudan o üyeye söyler (ör. metin → `teknik-yazar`, yetki → `urun-analisti`, yasal → `hukuk-uyum`). Tasarımcı her bulguya "uygulandı / gerekçeyle reddedildi" diye yanıt verir.
4. **Tamam:** Bütün yüzeyler bitip bulgular kapanınca `ui-ux-tasarimci` müdüre `[TASARIM HAZIR]` gönderir; herkes son raporunda kendi kontrol listesinin durumunu yazar.

## Mesajlaşma

- Biçim: `[KONU] kısa açıklama · dosya yolu · senden beklenen`. Uzun içerik dosyaya, mesaja yalnız yol.
- `SendMessage` aracı görünmüyorsa önce `ToolSearch` ile `select:SendMessage` yükle. Yine gönderemezsen notu dosyana yaz ve son raporunda müdüre bildir.
- Ekip: `urun-analisti`, `frontend-gelistirici`, `teknik-yazar`, `hukuk-uyum`, `pazarlama`, `ui-ux-tasarimci`. Kurucuya giden her soru müdür üzerinden gider.

## Kurallar

- `.env` ve gizli dosyalar okunmaz. Canlı siteye yalnız bakılır (form gönderme yok). Sunucuya bağlanılmaz.
- Kurucu kararları (brif) tartışmaya açılmaz; çelişki görürsen müdüre yaz.
- Kurucuya karar gerektiren konu (ör. fiyat rakamı) yer tutucu olarak bırakılır ve son raporda listelenir.
