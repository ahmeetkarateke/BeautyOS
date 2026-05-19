// Default anamnez (müşteri hakkında) soruları - tenant kategorisine göre.
// Tenant ilk oluşturulduğunda veya businessType değiştiğinde seed edilebilir.

import { BusinessType, AnamnesisQuestionType } from '@prisma/client'

export interface DefaultQuestion {
  label: string
  type: AnamnesisQuestionType
  options?: string[]
  helperText?: string
  isRequired?: boolean
}

const dentist: DefaultQuestion[] = [
  { label: 'Kalp rahatsızlığınız var mı?', type: AnamnesisQuestionType.yes_no },
  { label: 'Yüksek tansiyonunuz var mı?', type: AnamnesisQuestionType.yes_no },
  { label: 'Diyabet (şeker hastalığı) var mı?', type: AnamnesisQuestionType.yes_no },
  { label: 'Kanama bozukluğunuz veya kan sulandırıcı kullanımı var mı?', type: AnamnesisQuestionType.yes_no },
  { label: 'Daha önce lokal anesteziye reaksiyon yaşadınız mı?', type: AnamnesisQuestionType.yes_no },
  { label: 'Diş tedavisinden sonra uzun süreli kanama oldu mu?', type: AnamnesisQuestionType.yes_no },
  { label: 'Bilinen ilaç alerjileriniz', type: AnamnesisQuestionType.long_text, helperText: 'Penisilin, ağrı kesici vb.' },
  { label: 'Sürekli kullandığınız ilaçlar', type: AnamnesisQuestionType.long_text },
  { label: 'Geçirdiğiniz ameliyatlar', type: AnamnesisQuestionType.long_text },
  { label: 'Diş gıcırdatma / sıkma alışkanlığınız var mı?', type: AnamnesisQuestionType.yes_no },
  { label: 'Sigara kullanımı', type: AnamnesisQuestionType.single_choice, options: ['Hayır', 'Sosyal', 'Günde 1 paketten az', 'Günde 1 paket veya üzeri'] },
  { label: 'Hamilelik veya emzirme durumu var mı?', type: AnamnesisQuestionType.yes_no, helperText: 'Sadece kadın hastalar için.' },
  { label: 'Son diş hekimi ziyaretiniz', type: AnamnesisQuestionType.single_choice, options: ['Son 6 ay', '6-12 ay', '1-3 yıl', '3 yıldan fazla'] },
]

const aesthetic_clinic: DefaultQuestion[] = [
  { label: 'Mevcut kronik hastalıklarınız', type: AnamnesisQuestionType.long_text, helperText: 'Tansiyon, diyabet, tiroid vb.' },
  { label: 'Sürekli kullandığınız ilaçlar', type: AnamnesisQuestionType.long_text },
  { label: 'Bilinen alerjileriniz', type: AnamnesisQuestionType.long_text, helperText: 'İlaç, gıda, lateks, kozmetik vb.' },
  { label: 'Anestezi veya sedasyon reaksiyonunuz oldu mu?', type: AnamnesisQuestionType.yes_no },
  { label: 'Kanama veya yara iyileşme sorunu yaşadınız mı?', type: AnamnesisQuestionType.yes_no },
  { label: 'Otoimmün hastalık (lupus, romatoid artrit vb.) var mı?', type: AnamnesisQuestionType.yes_no },
  { label: 'Şu anda hamilelik veya emzirme durumu var mı?', type: AnamnesisQuestionType.yes_no },
  { label: 'Daha önce estetik işlem yaptırdınız mı?', type: AnamnesisQuestionType.long_text, helperText: 'Yapıldı ise türü ve tarihi.' },
  { label: 'Geçirdiğiniz ameliyatlar', type: AnamnesisQuestionType.long_text },
  { label: 'Sigara kullanımı', type: AnamnesisQuestionType.single_choice, options: ['Hayır', 'Sosyal', 'Günde 1 paketten az', 'Günde 1 paket veya üzeri'] },
  { label: 'Alkol tüketimi', type: AnamnesisQuestionType.single_choice, options: ['Hayır', 'Nadiren', 'Haftada birkaç kez', 'Günlük'] },
  { label: 'Güneş hassasiyetiniz veya kolay leke yapma eğiliminiz var mı?', type: AnamnesisQuestionType.yes_no },
]

const beauty_center: DefaultQuestion[] = [
  { label: 'Cilt tipiniz', type: AnamnesisQuestionType.single_choice, options: ['Kuru', 'Normal', 'Karma', 'Yağlı', 'Hassas'] },
  { label: 'Cildinizde bilinen hassasiyet/alerji var mı?', type: AnamnesisQuestionType.yes_no },
  { label: 'Kullandığınız cilt bakım ürünleri', type: AnamnesisQuestionType.long_text },
  { label: 'Daha önce yaptırdığınız bakımlar', type: AnamnesisQuestionType.long_text, helperText: 'Peeling, lazer, mezoterapi vb.' },
  { label: 'Şu anda hamile veya emziriyor musunuz?', type: AnamnesisQuestionType.yes_no },
  { label: 'Düzenli kullandığınız ilaçlar', type: AnamnesisQuestionType.long_text },
  { label: 'Güneş hassasiyeti veya leke eğilimi var mı?', type: AnamnesisQuestionType.yes_no },
  { label: 'Sigara kullanımı', type: AnamnesisQuestionType.yes_no },
]

const hair_salon: DefaultQuestion[] = [
  { label: 'Saç tipiniz', type: AnamnesisQuestionType.single_choice, options: ['Düz', 'Dalgalı', 'Kıvırcık', 'Çok kıvırcık'] },
  { label: 'Saç boyası veya kimyasallara alerjiniz var mı?', type: AnamnesisQuestionType.yes_no },
  { label: 'Saç derinizde hassasiyet/kepek/egzama var mı?', type: AnamnesisQuestionType.yes_no },
  { label: 'Son 6 ayda yaptırdığınız işlemler', type: AnamnesisQuestionType.long_text, helperText: 'Boya, röfle, keratin, perma vb.' },
  { label: 'Saç dökülmesi yaşıyor musunuz?', type: AnamnesisQuestionType.yes_no },
  { label: 'Kullandığınız saç bakım ürünleri', type: AnamnesisQuestionType.long_text },
  { label: 'Hamilelik veya emzirme durumu', type: AnamnesisQuestionType.yes_no },
  { label: 'Tercih ettiğiniz saç stili / uzunluğu', type: AnamnesisQuestionType.long_text },
]

const barbershop: DefaultQuestion[] = [
  { label: 'Saç tipi', type: AnamnesisQuestionType.single_choice, options: ['Düz', 'Dalgalı', 'Kıvırcık'] },
  { label: 'Cildinizde tıraş sonrası tahriş/batma oluyor mu?', type: AnamnesisQuestionType.yes_no },
  { label: 'Bilinen cilt hassasiyeti/alerji', type: AnamnesisQuestionType.long_text },
  { label: 'Tercih ettiğiniz saç stili ve uzunluğu', type: AnamnesisQuestionType.long_text },
  { label: 'Sakal tercihi', type: AnamnesisQuestionType.long_text },
]

const spa: DefaultQuestion[] = [
  { label: 'Mevcut sağlık sorunlarınız', type: AnamnesisQuestionType.long_text },
  { label: 'Kalp rahatsızlığı veya tansiyon sorunu var mı?', type: AnamnesisQuestionType.yes_no },
  { label: 'Şu anda hamile misiniz?', type: AnamnesisQuestionType.yes_no },
  { label: 'Cilt hastalığı, açık yara veya iltihap var mı?', type: AnamnesisQuestionType.yes_no },
  { label: 'Düzenli kullandığınız ilaçlar', type: AnamnesisQuestionType.long_text },
  { label: 'Tercih ettiğiniz masaj basıncı', type: AnamnesisQuestionType.single_choice, options: ['Hafif', 'Orta', 'Kuvvetli'] },
  { label: 'Ağrılı veya hassas bölgeleriniz', type: AnamnesisQuestionType.long_text },
  { label: 'Bilinen alerjileriniz', type: AnamnesisQuestionType.long_text, helperText: 'Esans, yağ vb.' },
]

const nail_studio: DefaultQuestion[] = [
  { label: 'Tırnak veya cilt mantarınız var mı?', type: AnamnesisQuestionType.yes_no },
  { label: 'Diyabet var mı?', type: AnamnesisQuestionType.yes_no },
  { label: 'Aseton, akrilik veya jel alerjiniz var mı?', type: AnamnesisQuestionType.yes_no },
  { label: 'Tırnak tipi', type: AnamnesisQuestionType.single_choice, options: ['Normal', 'Kırılgan', 'İnce', 'Kalın'] },
  { label: 'Son 6 ayda yaptırdığınız tırnak işlemleri', type: AnamnesisQuestionType.long_text },
  { label: 'Tırnaklarınızla ilgili sorun yaşıyor musunuz?', type: AnamnesisQuestionType.long_text, helperText: 'Kırılma, soyulma, ayrılma vb.' },
]

const massage: DefaultQuestion[] = [
  { label: 'Mevcut sağlık sorunlarınız', type: AnamnesisQuestionType.long_text },
  { label: 'Sırt, bel veya boyun ağrınız var mı?', type: AnamnesisQuestionType.yes_no },
  { label: 'Şu anda hamile misiniz?', type: AnamnesisQuestionType.yes_no },
  { label: 'Cilt hastalığı, yara veya iltihap var mı?', type: AnamnesisQuestionType.yes_no },
  { label: 'Yüksek tansiyon veya kalp rahatsızlığı', type: AnamnesisQuestionType.yes_no },
  { label: 'Ağrılı / dokunulmaması gereken bölgeler', type: AnamnesisQuestionType.long_text },
  { label: 'Tercih edilen basınç', type: AnamnesisQuestionType.single_choice, options: ['Hafif', 'Orta', 'Kuvvetli'] },
  { label: 'Düzenli kullandığınız ilaçlar', type: AnamnesisQuestionType.long_text },
]

const tattoo_piercing: DefaultQuestion[] = [
  { label: 'Diyabet var mı?', type: AnamnesisQuestionType.yes_no },
  { label: 'Kanama bozukluğunuz veya kan sulandırıcı kullanımı var mı?', type: AnamnesisQuestionType.yes_no },
  { label: 'Bağışıklık sistemi rahatsızlığınız var mı?', type: AnamnesisQuestionType.yes_no },
  { label: 'Metal (nikel) veya boya alerjiniz var mı?', type: AnamnesisQuestionType.yes_no },
  { label: 'Cilt hastalığı (egzama, sedef vb.) var mı?', type: AnamnesisQuestionType.yes_no },
  { label: 'Hamilelik veya emzirme durumu', type: AnamnesisQuestionType.yes_no },
  { label: 'Son 24 saatte alkol aldınız mı?', type: AnamnesisQuestionType.yes_no, helperText: 'Kanamayı artırabilir.' },
  { label: 'Yara iyileşmeniz nasıl?', type: AnamnesisQuestionType.single_choice, options: ['Normal', 'Yavaş', 'Keloid eğilimi var'] },
  { label: 'Sürekli kullandığınız ilaçlar', type: AnamnesisQuestionType.long_text },
]

const hair_transplant: DefaultQuestion[] = [
  { label: 'Kronik hastalıklarınız (diyabet, tansiyon, kalp vb.)', type: AnamnesisQuestionType.long_text },
  { label: 'Sürekli kullandığınız ilaçlar', type: AnamnesisQuestionType.long_text },
  { label: 'Kanama bozukluğu veya kan sulandırıcı kullanımı', type: AnamnesisQuestionType.yes_no },
  { label: 'Daha önce saç ekimi yaptırdınız mı?', type: AnamnesisQuestionType.yes_no, helperText: 'Evet ise tarih ve teknik.' },
  { label: 'Saç dökülmesi başlangıç yaşı ve hızı', type: AnamnesisQuestionType.long_text },
  { label: 'Ailenizde saç dökülmesi geçmişi var mı?', type: AnamnesisQuestionType.yes_no },
  { label: 'Sigara kullanımı', type: AnamnesisQuestionType.single_choice, options: ['Hayır', 'Sosyal', 'Günde 1 paketten az', 'Günde 1 paket veya üzeri'] },
  { label: 'Alkol kullanımı', type: AnamnesisQuestionType.yes_no },
  { label: 'Anestezi reaksiyonu yaşadınız mı?', type: AnamnesisQuestionType.yes_no },
  { label: 'Bilinen alerjileriniz', type: AnamnesisQuestionType.long_text },
]

const other: DefaultQuestion[] = [
  { label: 'Mevcut hastalıklarınız', type: AnamnesisQuestionType.long_text },
  { label: 'Kullandığınız ilaçlar', type: AnamnesisQuestionType.long_text },
  { label: 'Bilinen alerjileriniz', type: AnamnesisQuestionType.long_text },
  { label: 'Hamilelik veya emzirme durumu', type: AnamnesisQuestionType.yes_no },
  { label: 'Notlar', type: AnamnesisQuestionType.long_text },
]

export const DEFAULT_ANAMNESIS_QUESTIONS: Record<BusinessType, DefaultQuestion[]> = {
  dentist,
  aesthetic_clinic,
  beauty_center,
  hair_salon,
  barbershop,
  spa,
  nail_studio,
  massage,
  tattoo_piercing,
  hair_transplant,
  other,
}

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  dentist: 'Diş Hekimi',
  aesthetic_clinic: 'Estetik Klinik',
  beauty_center: 'Güzellik Merkezi',
  hair_salon: 'Kuaför',
  barbershop: 'Berber',
  spa: 'SPA',
  nail_studio: 'Nail Studio',
  massage: 'Masaj Salonu',
  tattoo_piercing: 'Dövme / Piercing',
  hair_transplant: 'Saç Ekim Merkezi',
  other: 'Diğer',
}
