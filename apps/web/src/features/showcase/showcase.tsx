'use client'

import { useState } from 'react'
import { Avatar, personTone } from '@/ui/avatar'
import { Banner } from '@/ui/banner'
import { Button } from '@/ui/button'
import { Card, CardHeader } from '@/ui/card'
import { Checkbox, LegalCheckbox, Radio, RadioGroup, Switch } from '@/ui/choice'
import { Chip, ChipRow } from '@/ui/chip'
import { ConfirmDialog } from '@/ui/confirm-dialog'
import { buildDayRange, DayStrip } from '@/ui/day-strip'
import { DataTable } from '@/ui/data-table'
import { DropdownMenu } from '@/ui/dropdown-menu'
import { InputField, PhoneField, SelectField, TextareaField } from '@/ui/field'
import { DateTime, Money } from '@/ui/format'
import { ListRow } from '@/ui/list-row'
import { SegmentedControl } from '@/ui/segmented-control'
import { SelectionCard } from '@/ui/selection-card'
import { Sheet } from '@/ui/sheet'
import { Skeleton, SkeletonGroup } from '@/ui/skeleton'
import { EmptyState, ErrorState, Forbidden } from '@/ui/states'
import { StatusBadge } from '@/ui/status-badge'
import { SummaryStrip } from '@/ui/summary-strip'
import { Tab, TabList, TabPanel, Tabs } from '@/ui/tabs'
import { TimeSlots } from '@/ui/time-slots'
import { ToastProvider, useToast } from '@/ui/toast'

// Tasarım sistemi vitrini (yalnız staging). Her bileşenin tasarim.md §4 kuralıyla gerçek görünümü; kurucu ve tasarımcı buradan inceler.
const rows = [
  { id: 'a', name: 'Ayşe Yılmaz', service: 'Saç boyama', total: 450 },
  { id: 'b', name: 'Elif Kaya', service: 'Manikür', total: 300 },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-semibold text-text">{title}</h2>
      {children}
    </section>
  )
}

function Demo() {
  const toast = useToast()
  const [phone, setPhone] = useState('')
  const [period, setPeriod] = useState('hafta')
  const [chip, setChip] = useState(true)
  const [card, setCard] = useState(false)
  const [sw, setSw] = useState(true)
  const [radio, setRadio] = useState('nakit')
  const [tab, setTab] = useState('bilgi')
  const [sheet, setSheet] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [day, setDay] = useState<string | null>('2026-10-30')
  const [slot, setSlot] = useState<string | null>('10:30')
  const days = buildDayRange('2026-10-29', 14).map((date, i) => ({ date, closed: i === 3 }))

  return (
    <main className="mx-auto grid max-w-(--size-content-max) gap-8 px-4 py-8 md:px-8">
      <h1 className="text-xl font-semibold text-text">Tasarım sistemi</h1>

      <Section title="Düğme">
        <div className="flex flex-wrap gap-2">
          <Button>Müşteri ekle</Button>
          <Button variant="secondary">Vazgeç</Button>
          <Button variant="text">Tümünü gör</Button>
          <Button variant="danger">Randevuyu iptal et</Button>
          <Button loading loadingText="Kaydediliyor…">Kaydet</Button>
          <Button disabled>Randevu oluştur</Button>
        </div>
      </Section>

      <Section title="Form alanları">
        <div className="grid max-w-md gap-4">
          <InputField label="Ad soyad" />
          <InputField label="E-posta" optional type="email" spellCheck={false} />
          <PhoneField label="Telefon" value={phone} onValueChange={setPhone} />
          <InputField label="Soyad" error="Soyadı yazın." />
          <SelectField label="Hizmet">
            <option>Saç kesimi</option>
          </SelectField>
          <TextareaField label="Not" optional />
          <Checkbox label="SMS hatırlatması gönder" description="Randevudan 24 saat önce." />
          <LegalCheckbox label="Kullanım koşullarını okudum ve kabul ediyorum" />
          <RadioGroup legend="Ödeme yöntemi" value={radio} onValueChange={setRadio}>
            <Radio value="nakit" label="Nakit" />
            <Radio value="kart" label="Kart" />
          </RadioGroup>
          <Switch label="Online randevu açık" checked={sw} onCheckedChange={setSw} />
        </div>
      </Section>

      <Section title="Seçim">
        <SegmentedControl
          aria-label="Dönem"
          value={period}
          onValueChange={setPeriod}
          options={[{ value: 'gun', label: 'Gün' }, { value: 'hafta', label: 'Hafta' }, { value: 'ay', label: 'Ay' }]}
        />
        <ChipRow aria-label="Süzgeç">
          <Chip pressed={chip} onToggle={() => setChip((v) => !v)} count={12}>Tümü</Chip>
          <Chip pressed={false} onToggle={() => {}} count={3}>Bekleyen</Chip>
        </ChipRow>
        <div className="grid max-w-md gap-2">
          <SelectionCard title="Saç kesimi" description="45 dk" price="₺450" selected={card} onSelect={() => setCard((v) => !v)} />
        </div>
      </Section>

      <Section title="Durum ve kimlik">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status="pending" />
          <StatusBadge status="confirmed" />
          <StatusBadge status="completed" />
          <StatusBadge status="no_show" />
          <StatusBadge status="soon" />
          <Avatar name="Ayşe Yılmaz" tone={personTone('ayse')} />
          <Avatar name="Elif Kaya" />
        </div>
      </Section>

      <Section title="Geri bildirim">
        <Banner tone="info">Bugün 12 randevunuz var.</Banner>
        <Banner tone="warning" action={{ label: 'Planı seçin', onClick: () => {} }}>Deneme süreniz 3 gün sonra bitiyor.</Banner>
        <Banner tone="success">Değişiklikler kaydedildi.</Banner>
        <Banner tone="error">Randevu kaydedilemedi. Bağlantınızı kontrol edip tekrar deneyin.</Banner>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => toast.show({ message: 'Müşteri eklendi.' })}>Bildirim göster</Button>
          <Button variant="secondary" onClick={() => toast.show({ message: 'Müşteri silindi.', undo: () => {} })}>Geri alınabilir bildirim</Button>
          <Button variant="secondary" onClick={() => toast.show({ message: 'Kaydedilemedi.', tone: 'error' })}>Hata bildirimi</Button>
        </div>
        <Card><EmptyState title="Henüz müşteri yok." description="Müşteri ekleyince randevuları buradan takip edersiniz." action={{ label: 'Müşteri ekle', onClick: () => {} }} /></Card>
        <Card><ErrorState subject="Müşteri listesi" onRetry={() => {}} lastLoadedAt={new Date()} /></Card>
        <Card><Forbidden action={<Button variant="secondary">Bugün’e dön</Button>} /></Card>
        <SkeletonGroup className="grid max-w-xs gap-2"><Skeleton /><Skeleton variant="value" /></SkeletonGroup>
      </Section>

      <Section title="Veri">
        <SummaryStrip
          items={[
            { label: 'Randevu', value: '12', comparison: 'geçen çarşamba 15' },
            { label: 'Ciro', value: <Money value={4200} />, comparison: 'geçen çarşamba ₺3.900' },
            { label: 'Yeni müşteri', value: '3' },
            { label: 'Gelmedi', value: '1' },
          ]}
        />
        <Card>
          <CardHeader title="Bugünün randevuları" action={{ label: 'Tümünü gör', onClick: () => {} }} />
          <ListRow leading={<Avatar name="Ayşe Yılmaz" tone={1} />} title="Ayşe Yılmaz" subtitle="Saç boyama" trailing={<DateTime value="2026-10-29T11:30:00Z" variant="time" />} onPress={() => {}} />
          <ListRow leading={<Avatar name="Elif Kaya" />} title="Elif Kaya" subtitle="Manikür" trailing={<StatusBadge status="confirmed" />} />
        </Card>
        <DataTable
          aria-label="Randevu listesi"
          columns={[
            { key: 'name', header: 'Müşteri', cell: (r) => r.name, primary: true },
            { key: 'service', header: 'Hizmet', cell: (r) => r.service },
            { key: 'total', header: 'Tutar', cell: (r) => <Money value={r.total} />, align: 'right' },
          ]}
          rows={rows}
          rowKey={(r) => r.id}
          footer={{ name: 'Toplam', total: <Money value={750} /> }}
        />
        <Tabs value={tab} onValueChange={setTab}>
          <TabList aria-label="Müşteri bölümleri">
            <Tab value="bilgi">Bilgiler</Tab>
            <Tab value="randevu">Randevular</Tab>
          </TabList>
          <TabPanel value="bilgi">Bilgiler burada.</TabPanel>
          <TabPanel value="randevu">Randevular burada.</TabPanel>
        </Tabs>
        <DayStrip days={days} selected={day} onSelect={setDay} />
        <TimeSlots slots={['09:00', '09:30', '10:30', '11:00']} selected={slot} onSelect={setSlot} />
        <p className="text-sm text-text-muted">
          Tarih: <DateTime value="2026-10-29T11:32:00Z" /> · Tutar: <Money value={1250.5} />
        </p>
      </Section>

      <Section title="Katmanlar">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setSheet(true)}>Alt sayfa / diyalog aç</Button>
          <Button variant="danger" onClick={() => setConfirm(true)}>Onay penceresi aç</Button>
          <DropdownMenu items={[{ label: 'Bilgileri düzenle', onSelect: () => {} }, { label: 'Müşteriyi sil', onSelect: () => {}, danger: true }]} />
        </div>
        <Sheet
          open={sheet}
          onOpenChange={setSheet}
          title="Yeni randevu"
          description="Müşteri ve saat seçin."
          footer={<><Button variant="secondary" onClick={() => setSheet(false)}>Vazgeç</Button><Button onClick={() => setSheet(false)}>Randevuyu kaydet</Button></>}
        >
          <InputField label="Müşteri adı" />
        </Sheet>
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          title="Müşteriyi silmek istiyor musunuz?"
          description="Ayşe Yılmaz ve geçmiş randevuları kalıcı olarak silinir. Bu işlem geri alınamaz."
          actionLabel="Müşteriyi sil"
          onConfirm={() => setConfirm(false)}
        />
      </Section>
    </main>
  )
}

export function Showcase() {
  return (
    <ToastProvider>
      <Demo />
    </ToastProvider>
  )
}
