# W30 API sözleşmesi (gorev/W30-auth-api)

Taban: `/api/v1/auth`. Hepsi kimliksiz. Hata biçimi: `{ error: { code, message } }`.

## 1. Şifre sıfırlama (ADR-0046)
- `POST /password-reset/request` gövde `{ email }` -> her zaman `200 { ok: true }` (hesap varlığı sızmaz). E-posta bağlantısı: `${FRONTEND_URL}/reset-password#<64 hex> (yalniz token, "token=" oneki yok)`. Hız sınırı IP başına 15 dk / 5 -> `429 RATE_LIMIT`. Geçersiz e-posta `400 VALIDATION_ERROR`.
- `POST /password-reset/confirm` gövde `{ token, password }` -> `200 { ok: true }`; token yanlış/kullanılmış/süresi dolmuş `400 INVALID_TOKEN`; zayıf şifre `400 VALIDATION_ERROR` (mesaj kuralı söyler). Başarıda tüm oturumlar kapanır. Sınır 15 dk / 10.
- Ön yüz: `#` sonrasının tamamını okur, hemen `history.replaceState` ile adresten siler, yalnız POST gövdesinde yollar.
- Eski `POST /forgot-password` ve `/reset-password` (bağlantı `?token=`) canlıdaki eski arayüz için aynen durur.

## 2. Kayıt rızaları (ADR-0048)
`POST /register` gövdesine isteğe bağlı: `consents: { terms: true, marketingEmail?: boolean }`.
- K1 kutusu işaretliyse `terms: true`; işaretsizse alanı `false` göndermeyin, düğme zaten pasif olmalı. `terms: false` -> `400 VALIDATION_ERROR`, mesaj: "Devam etmek için Kullanım Şartları'nı ve Veri İşleme Sözleşmesi'ni kabul etmeniz gerekir."
- K3 işaretliyse `marketingEmail: true`.
- Yeni arayüz `consents`'i HER ZAMAN göndermeli (alan yoksa sunucu eski arayüz sayar ve kabul kaydı yazmaz).
- Diğer yanıtlar değişmedi (201, `409 DUPLICATE_SLUG`, `409 DUPLICATE_EMAIL`).

## 3. Salon adresi uygunluğu
`GET /slug-available?slug=<adres>` -> `200 { available: true }` | `{ available: false, reason: 'taken' }` | `{ available: false, reason: 'invalid' }` (biçim: küçük harf, rakam, tire; 3-30). IP başına dakikada 30 -> `429 RATE_LIMIT`. Yazarken 300-400 ms bekleyip (debounce) çağırın; yarış olabilir, kesin sonuç `/register`'ın 409'udur.

## Güncelleme (hukuk-uyum W30-1, müdür kararı)
- Sıfırlama bağlantısı `/reset-password#<token>`.
- `GET /legal-versions` -> `{ termsVersion, dpaVersion, labelVersion, marketingTextVersion }` (kimliksiz). Kayıtta `consents` şöyle gider: `{ terms: true, termsVersion, dpaVersion, labelVersion, marketingEmail?: boolean }`; sürümler bu uçtan alınır, eşleşmezse `400 LEGAL_VERSION_MISMATCH` (sayfayı yenile).
