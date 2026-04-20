# BeautyOS Agent Ekibi — Master Rehber
## 12 Uzman Agent ile Projenizi Baştan Sona Yönetin

---

> **Versiyon:** 1.0 | **Tarih:** Nisan 2026  
> **Kullanım:** Bu dosyayı Claude Code, Claude.ai veya Anthropic API ile kullanın.  
> Her agent dosyası; rolü, sorumlulukları, örnek komutları ve çıktı formatını içerir.

---

## Agent Ekibine Genel Bakış

```
BeautyOS Agent Ekibi
│
├── 🖥️  01_frontend.md        — Next.js, React, Tailwind, UI/UX
├── ⚙️  02_backend.md         — Node.js, Express, API, İş Mantığı
├── 🤖  03_whatsapp_ai.md     — NLP, Bot Akışı, Prompt Mühendisliği
├── 📣  04_marketing.md       — Facebook/Instagram Ads, Büyüme
├── 🎨  05_visual_design.md   — NanoBanana, Marka, Görsel Üretim
├── 🗄️  06_database.md        — PostgreSQL, Prisma, Redis, Veri
├── 🔐  07_security.md        — OWASP, KVKK, AppSec, Denetim
├── 💳  08_payment.md         — iyzico, Stripe, Kaparo Sistemi
├── 🚀  09_devops.md          — CI/CD, Deployment, Monitoring
├── 📊  10_analytics.md       — PostHog, KPI, Büyüme Zekası
├── 📝  11_seo_content.md     — SEO, Blog, Landing Page Metni
└── 📋  12_product.md         — Ürün Yönetimi, Sprint, Onboarding
```

---

## Agent'ları Nasıl Kullanırsınız?

### Yöntem 1: Claude Code CLI ile (Önerilen)

Claude Code kuruluysa (`claude` komutu), her agent'ı doğrudan çağırabilirsiniz:

```bash
# Agent dosyasını sistem prompt olarak yükle ve görev ver
claude --system-prompt agents/02_backend.md \
  "Slot müsaitlik sorgulama API endpoint'ini yaz"

# Ya da interaktif oturumda
claude
> /read agents/01_frontend.md
> Takvim sayfasını oluştur: haftalık görünüm, drag-drop randevu
```

### Yöntem 2: Claude.ai Sohbet Arayüzü

1. İlgili agent dosyasını açın (örn: `agents/04_marketing.md`)
2. İçeriği kopyalayın
3. Claude.ai'de yeni sohbet başlatın
4. "Aşağıdaki rolü üstlen ve ilk görevini tamamla:" şeklinde yapıştırın
5. Görevinizi verin

### Yöntem 3: Claude API ile Programatik Kullanım

```python
import anthropic
from pathlib import Path

def create_agent(agent_file: str, task: str) -> str:
    """Agent dosyasını sistem prompt olarak yükleyip görevi çalıştır"""
    client = anthropic.Anthropic()
    system_prompt = Path(f"agents/{agent_file}").read_text(encoding="utf-8")

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=system_prompt,
        messages=[{"role": "user", "content": task}]
    )
    return response.content[0].text

# Kullanım örnekleri
frontend_result = create_agent(
    "01_frontend.md",
    "Dashboard KPI widget'larını oluştur: bugünün geliri, bekleyen randevular"
)

marketing_result = create_agent(
    "04_marketing.md",
    "WhatsApp AI özelliği için 5 farklı Facebook reklam başlığı yaz"
)
```

### Yöntem 4: Claude Code Sub-Agent (İleri Seviye)

```python
# Birden fazla agent'ı paralel çalıştır
import anthropic

client = anthropic.Anthropic()

tasks = [
    ("01_frontend.md", "Takvim bileşenini oluştur"),
    ("02_backend.md", "Slot API endpoint'ini yaz"),
    ("07_security.md", "Bu endpoint'in güvenlik review'ını yap"),
]

# Paralel çalıştırma (Batch API veya threading ile)
for agent_file, task in tasks:
    system = Path(f"agents/{agent_file}").read_text(encoding="utf-8")
    # ... her agent için ayrı API çağrısı
```

---

## Hangi Agent'ı Ne Zaman Çağırırsınız?

### Geliştirme Süreçleri

| Görev | Birincil Agent | Destek Agent |
|---|---|---|
| Yeni sayfa oluşturma | Frontend (01) | Backend (02) |
| API endpoint yazma | Backend (02) | Database (06), Security (07) |
| WhatsApp bot akışı | WhatsApp AI (03) | Backend (02) |
| Ödeme entegrasyonu | Payment (08) | Backend (02), Security (07) |
| Veritabanı migration | Database (06) | Backend (02) |
| Deployment sorunları | DevOps (09) | Backend (02) |
| Performance sorunu | Backend (02) veya Database (06) | DevOps (09) |

### Pazarlama & Büyüme Süreçleri

| Görev | Birincil Agent | Destek Agent |
|---|---|---|
| Reklam kampanyası | Marketing (04) | Visual Design (05) |
| Sosyal medya görseli | Visual Design (05) | Marketing (04) |
| Blog yazısı | SEO/Content (11) | Visual Design (05) |
| Landing page | SEO/Content (11) | Frontend (01) |
| E-posta dizisi | Marketing (04) | Product (12) |

### Ürün & Strateji Süreçleri

| Görev | Birincil Agent | Destek Agent |
|---|---|---|
| Feature önceliklendirme | Product (12) | Analytics (10) |
| Sprint planlaması | Product (12) | — |
| KPI analizi | Analytics (10) | Product (12) |
| Kullanıcı araştırması | Product (12) | Analytics (10) |
| SEO stratejisi | SEO/Content (11) | Analytics (10) |

---

## Tipik Günlük İş Akışları

### Senaryo 1: Yeni Bir Özellik Geliştirmek

```
1. Product Agent (12) → User Story ve kabul kriterleri yaz
2. Database Agent (06) → Gerekiyorsa migration hazırla
3. Backend Agent (02) → API endpoint'leri yaz
4. Frontend Agent (01) → UI bileşenlerini oluştur
5. Security Agent (07) → Code review: güvenlik kontrolü
6. DevOps Agent (09) → Deployment ve monitoring kurulumu
7. Analytics Agent (10) → Event tracking ekle
```

### Senaryo 2: Pazarlama Kampanyası

```
1. Marketing Agent (04) → Kampanya stratejisi ve reklam metni
2. Visual Design Agent (05) → NanoBanana ile görseller üret
3. SEO/Content Agent (11) → Landing page metni optimize et
4. Frontend Agent (01) → Landing page implementasyonu
5. Analytics Agent (10) → Conversion tracking ekle
6. Marketing Agent (04) → A/B test planı
```

### Senaryo 3: Güvenlik Denetimi

```
1. Security Agent (07) → OWASP taraması, risk listesi
2. Backend Agent (02) → Bulunan açıkları kapat
3. Database Agent (06) → RLS politikalarını doğrula
4. Security Agent (07) → Düzeltme doğrulama testi
5. DevOps Agent (09) → Güvenli deployment
```

### Senaryo 4: WhatsApp Bot İyileştirmesi

```
1. Analytics Agent (10) → Hangi konuşmalarda bot başarısız?
2. WhatsApp AI Agent (03) → Problemi analiz et, prompt güncelle
3. Backend Agent (02) → Servis güncellemesi
4. DevOps Agent (09) → Staging'de test, production deploy
5. Analytics Agent (10) → Başarı oranı izle
```

---

## Agent Etkileşim Haritası

```
                    ┌─────────────┐
                    │  Product    │◄──── Müşteri Geri Bildirimi
                    │    (12)     │
                    └──────┬──────┘
                           │ User Story
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ Frontend │ │ Backend  │ │ WhatsApp │
        │   (01)   │ │   (02)   │ │ AI (03)  │
        └────┬─────┘ └────┬─────┘ └────┬─────┘
             │            │            │
             └────────────┼────────────┘
                          │ Tümü kullanır
               ┌──────────┼──────────┐
               ▼          ▼          ▼
         ┌──────────┐ ┌──────────┐ ┌──────────┐
         │ Database │ │Security  │ │ Payment  │
         │   (06)   │ │   (07)   │ │   (08)   │
         └──────────┘ └──────────┘ └──────────┘
                          │
                    ┌─────┴──────┐
                    │  DevOps    │◄──── CI/CD
                    │   (09)     │
                    └─────┬──────┘
                          │
               ┌──────────┼──────────┐
               ▼          ▼          ▼
         ┌──────────┐ ┌──────────┐ ┌──────────┐
         │Analytics │ │Marketing │ │  SEO &   │
         │   (10)   │ │   (04)   │ │Content(11)│
         └──────────┘ └──────────┘ └──────────┘
                          │
                    ┌─────┴──────┐
                    │  Visual   │
                    │Design (05) │
                    └────────────┘
```

---

## Agent'lara Bağlam Verme İpuçları

### Her Agent'a Vermeniz Gereken Minimum Bağlam

```
1. PRD referansı: "BeautyOS PRD v1.1'e göre..."
2. Mevcut durum: "Şu an X özelliği var, Y özelliği yok"
3. Kısıtlar: "Supabase kullanıyoruz, şema zaten şu şekilde"
4. Hedef: "Bu hafta Sprint 3 bitmeli, deadline Cuma"
```

### Etkili Komut Yapısı

```
[ROL/BAĞLAM] + [SPESIFIK GÖREV] + [KISITLAR] + [ÇIKTI FORMATI]

Örnek:
"BeautyOS backend API'si için (Node.js + Express + Prisma)
 POST /appointments endpoint'i yaz.
 Kısıtlar: tenant_id her zaman JWT'den alınmalı, slot çakışması 
 Redis distributed lock ile önlenmeli.
 Çıktı: TypeScript kodu + Zod şeması + Supertest testi."
```

---

## NanoBanana ile Görsel Üretim Akışı

Visual Design Agent (05) ile NanoBanana'yı birlikte kullanmak için:

```
Adım 1: Visual Design Agent'ı çağır
        → Tasarım brief'i al (prompt metni, boyut, renk, kopya)

Adım 2: NanoBanana'ya git (nanobanana.com)
        → Yeni proje oluştur: "BeautyOS [Kampanya Adı]"

Adım 3: Agent'ın ürettiği AI prompt'u NanoBanana'ya gir
        → Stil, renk ve içerik parametrelerini uygula

Adım 4: Üretilen görseli indirin
        → Instagram, Facebook, e-posta boyutlarına export et

Adım 5: Marketing Agent'a göster
        → Reklam kampanyasına entegre et
```

---

## Hızlı Başlangıç: İlk 5 Komut

Projeye yeni başlıyorsanız bu sırayla ilerleyin:

```
1. Product Agent (12):
   "BeautyOS MVP Phase 1 için ilk sprint'in user story listesini hazırla"

2. Database Agent (06):
   "PRD şemasındaki temel tabloları Prisma schema.prisma dosyasına çevir"

3. Backend Agent (02):
   "Auth sistemi kurulumu: JWT + NextAuth, multi-tenant middleware"

4. Frontend Agent (01):
   "Onboarding sihirbazını oluştur: 5 adım, progress bar, form validasyon"

5. DevOps Agent (09):
   "GitHub Actions CI/CD pipeline kur: test + build + Vercel deploy"
```

---

## Notlar & En İyi Pratikler

1. **Tek seferde tek agent** — Birden fazla agent'ı karıştırma; bağlam kirlenir.
2. **Çıktıyı doğrula** — Agent kodu ürettiyse test çalıştır, "çalışıyor" olduğunu varsayma.
3. **Agent'lar arası el değiştirme** — Backend agent çıktısını Frontend agent'a ver; "şu endpoint hazır, şimdi UI'ı oluştur."
4. **PRD'yi referans göster** — "PRD Bölüm 3.2'deki dinamik hizmet süreleri için..." demek çok daha iyi sonuç verir.
5. **Kısıtları söyle** — Teknoloji stack, mevcut kod yapısı, deadline. Agent'lar kısıtsız çalışırsa fazla karmaşık çözüm üretebilir.
6. **İteratif çalış** — Büyük görevleri parçala. "Takvim modülünü yaz" yerine "Takvim haftalık görünüm bileşenini yaz."

---

*BeautyOS Agent Ekibi — Nisan 2026*  
*PRD v1.1 ile senkronize edilmiştir.*
