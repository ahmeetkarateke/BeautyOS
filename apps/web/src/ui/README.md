# v2 bileşenleri (`src/ui`)

Kaynak: `docs/tasarim.md` §4 ve `docs/tasarim/prototip/bilesenler.css`. Bu klasör eski `components/` ile karışmaz (ADR-UI-02): eski `components`, `hooks`, `store`, `lib`, `api` içe aktarılmaz.

## Prototip sınıfı -> bileşen

| Prototip sınıfı | Bileşen | Dosya | Not |
|---|---|---|---|
| `.dugme` | `Button` | `button.tsx` | Türler: `primary`, `secondary`, `text`, `danger`, `danger-solid`, `icon` (`aria-label` zorunlu). `loading` + `loadingText` |
| `.alan` | `InputField`, `SelectField`, `TextareaField`, `PhoneField` | `field.tsx` | `label`, `optional`, `hint`, `error`. `focusFirstInvalid(form)` gönderimde ilk hatalı alana odaklar |
| `.alan__on-ek` (+90) | `PhoneField` | `field.tsx`, `phone.ts` | `value` yalnız rakamlar (`5321234567`); `toNationalDigits`, `formatNationalPhone` |
| `.secenek` | `Checkbox`, `LegalCheckbox`, `RadioGroup` + `Radio` | `choice.tsx` | Yasal kutu için `LegalCheckbox` (önceden işaretlenemez) |
| `.anahtar` | `Switch` | `choice.tsx` | `role="switch"`, görünür etiket zorunlu |
| `.parcali` | `SegmentedControl` | `segmented-control.tsx` | 2-5 seçenek, `radiogroup`, ok tuşları |
| `.secim-kart` | `SelectionCard` | `selection-card.tsx` | `aria-pressed`, fiyat sağda tabular |
| `.cip`, `.cipler` | `Chip`, `ChipRow` | `chip.tsx` | `aria-pressed`, satır kendi içinde kayar |
| `.durum` | `StatusBadge` | `status-badge.tsx` | 6 durum + `soon` ("Yakında") |
| `.avatar`, `.avatar--kucuk/buyuk`, `kisi-N` | `Avatar`, `getInitials`, `personTone` | `avatar.tsx` | `tone` verilmezse nötr (müşteri) |
| `.serit` | `Banner` | `banner.tsx` | `tone`: `info`, `warning`, `success`, `error`; en çok bir eylem |
| `.bos`, `.bos--orta` | `EmptyState` | `states.tsx` | En çok bir birincil eylem |
| `.hata-blok` | `ErrorState` | `states.tsx` | "X yüklenemedi." + Yeniden dene, son yükleme saati |
| yetkisiz ekran | `Forbidden` | `states.tsx` | Çıkış yolu `action` ile verilir |
| `.iskelet` | `Skeleton`, `SkeletonGroup` | `skeleton.tsx` | Düz gri, parıltısız |
| `.bildirim`, `.bildirimler` | `ToastProvider`, `useToast` | `toast.tsx` | 4 sn, geri al varsa 8 sn; `show({ message, tone, undo })` |

Sonraki bölüm (W4): `.katman` (Sheet/Dialog), onay penceresi, açılır menü, sekmeler, `.kart`, `.satir`, `.tablo`, `.ozet`, gün şeridi, saat ızgarası, para ve tarih.

## Kurallar

- Renk, aralık ve köşe yalnız `src/styles/tokens.css` anlamsal tokenlarından gelir (`bg-primary`, `text-text-muted`, `rounded-card`). Ham hex ve varsayılan Tailwind paleti yok; `scripts/ui-lint` yakalar.
- Durum ve kişi renkleri `app.css` içindeki `@theme inline` ile sınıfa bağlıdır (`bg-status-pending-bg`, `bg-person-1-bg`).
- Metin alanlarına `name` verilmez (JS yüklenmezse girdi URL'ye sızmasın); veri üst bileşenin durumundan gider. İstisna: `RadioGroup` radyoları gruplamak için otomatik üretilmiş bir `name` kullanır (gizli bilgi taşımaz, değer yine üst bileşende).
- Sınıf adları tam yazılır (dinamik birleştirme yok); Tailwind bulamaz.
- Etkileşim kuralı bileşenle birlikte teste bağlanır (`*.test.tsx`); test adı `W3:` önekiyle kriteri taşır.
