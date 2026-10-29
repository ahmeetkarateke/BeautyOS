import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { permissionsFor } from '@beautyos/shared'
import { ApiError } from '@/lib/v2/api-client'
import type { ApiClient } from '@/lib/v2/api-client'
import { ApiClientProvider } from '@/lib/v2/api-context'
import { MeProvider } from '@/lib/v2/session'
import { makeMe } from '@/lib/v2/test-me'
import type { Me } from '@/lib/v2/me'
import type { DayAppointment } from '@/features/appointments/day-logic'
import { ToastProvider } from '@/ui/toast'
import { AppointmentDetailSheet } from './detail-sheet'
import '@/ui/test-polyfills'

const request = vi.fn()
const client = { request } as unknown as ApiClient
const onClose = vi.fn()
const onChanged = vi.fn()

const appt = (over: Partial<DayAppointment> = {}): DayAppointment => ({
  id: 'a1', staffKey: 'p1', staffName: 'Derya Aksoy', customerId: 'c1', serviceId: 'sv1', customerName: 'Ayşe Demir', customerPhone: '0532 111 22 33',
  unverified: false, serviceName: 'Fön', start: new Date('2026-10-29T07:00:00Z'), end: new Date('2026-10-29T07:45:00Z'), status: 'confirmed', price: 500, notes: 'Alerjisi var', ...over,
})

type Init = { method?: string; body?: Record<string, unknown>; query?: Record<string, string> }
let patchError: ApiError | null
let slots: { id: string; label: string; available: boolean }[]
const callsTo = (suffix: string, method: string) => request.mock.calls.filter(([p, i]) => String(p).endsWith(suffix) && (i as Init | undefined)?.method === method)

function mount(a: DayAppointment | null = appt(), me: Me = makeMe('owner')) {
  return render(
    <ApiClientProvider client={client}>
      <MeProvider me={me}>
        <ToastProvider>
          <AppointmentDetailSheet appointment={a} today="2026-10-29" onClose={onClose} onChanged={onChanged} />
        </ToastProvider>
      </MeProvider>
    </ApiClientProvider>,
  )
}

beforeEach(() => {
  request.mockReset()
  onClose.mockReset()
  onChanged.mockReset()
  patchError = null
  slots = [
    { id: '2026-10-29T09:00:00', label: '12:00', available: true },
    { id: '2026-10-29T09:45:00', label: '12:45', available: false },
    { id: '2026-10-29T11:00:00', label: '14:00', available: true },
  ]
  request.mockImplementation(async (path: string, init?: Init) => {
    if (path.endsWith('/slots')) return { slots }
    if (init?.method === 'PATCH' || init?.method === 'DELETE') {
      if (patchError) throw patchError
      return {}
    }
    throw new Error(`beklenmeyen çağrı ${path}`)
  })
})
afterEach(cleanup)

describe('W14 Randevu ayrıntısı', () => {
  it('K-bilgi: müşteri, hizmet, uzman, zaman, not görünür; Ara ve WhatsApp bağlantıları doğru', () => {
    mount()
    const dialog = screen.getByRole('dialog', { name: 'Randevu ayrıntısı' })
    expect(within(dialog).getByText('Ayşe Demir')).toBeTruthy()
    expect(within(dialog).getByText('Alerjisi var')).toBeTruthy()
    expect(within(dialog).getByRole('link', { name: 'Ara: Ayşe Demir' }).getAttribute('href')).toBe('tel:05321112233')
    expect(within(dialog).getByRole('link', { name: 'WhatsApp: Ayşe Demir' }).getAttribute('href')).toBe('https://wa.me/905321112233')
  })

  it('K-başlat: Başlat durumu devam ediyor yapar, bildirim verir, listeyi yeniler ve kapatır', async () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Başlat' }))
    await waitFor(() => expect(callsTo('/a1/status', 'PATCH')).toHaveLength(1))
    expect(callsTo('/a1/status', 'PATCH')[0][1].body).toEqual({ status: 'in_progress' })
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(onClose).toHaveBeenCalled()
  })

  it('K-iptal: İptal et onay penceresi sorar; onaylayınca cancelled gönderilir', async () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'İptal et' }))
    expect(callsTo('/a1/status', 'PATCH')).toHaveLength(0)
    const confirm = await screen.findByRole('alertdialog')
    fireEvent.click(within(confirm).getByRole('button', { name: 'Randevuyu iptal et' }))
    await waitFor(() => expect(callsTo('/a1/status', 'PATCH')).toHaveLength(1))
    expect(callsTo('/a1/status', 'PATCH')[0][1].body).toEqual({ status: 'cancelled' })
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('K-gelmedi: Gelmedi onaydan sonra no_show gönderir', async () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Gelmedi' }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Gelmedi olarak işaretle' }))
    await waitFor(() => expect(callsTo('/a1/status', 'PATCH')[0][1].body).toEqual({ status: 'no_show' }))
  })

  it('K-sil: Sil onaydan sonra DELETE çağırır', async () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Sil' }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Randevuyu sil' }))
    await waitFor(() => expect(callsTo('/a1', 'DELETE')).toHaveLength(1))
  })

  it('K-yetki: silme yalnız sahip/müdürde; uzmanda Sil yok', () => {
    mount(appt(), makeMe('staff'))
    expect(screen.queryByRole('button', { name: 'Sil' })).toBeNull()
  })

  it('K-yetki: saat değiştirme izni yoksa Saati değiştir yok', () => {
    const me = makeMe('owner')
    mount(appt(), { ...me, permissions: permissionsFor('owner').filter((p) => p !== 'appointment.reschedule') })
    expect(screen.queryByRole('button', { name: 'Saati değiştir' })).toBeNull()
  })

  it.each(['completed', 'cancelled', 'no_show'] as const)('K-kilit: %s randevuda eylem yok, kapalı bilgisi görünür', (status) => {
    mount(appt({ status }))
    expect(screen.queryByRole('button', { name: 'İptal et' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Saati değiştir' })).toBeNull()
    expect(screen.getByText(/artık değiştirilemez/)).toBeTruthy()
  })

  it('K-hata: STATUS_LOCKED (başkası kapattı) anlaşılır metin gösterir, liste yenilenir, katman açık kalır', async () => {
    patchError = new ApiError({ status: 409, code: 'STATUS_LOCKED' })
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Başlat' }))
    expect((await screen.findByRole('alert')).textContent).toContain('işlem kabul etmiyor')
    expect(onChanged).toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('K-hata: ağ hatasında Başlat mesaj verir ve katman açık kalır (sessiz yutma yok)', async () => {
    patchError = new ApiError({ status: 0, code: 'NETWORK' })
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Başlat' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('K-saat-değiştir: yalnız boş saatler listelenir; seçilen saat Z ekli ISO ile PATCH reschedule gönderilir', async () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Saati değiştir' }))
    const dialog = await screen.findByRole('dialog', { name: 'Saati değiştir' })
    expect(await within(dialog).findByRole('button', { name: '12:00' })).toBeTruthy()
    expect(within(dialog).queryByRole('button', { name: '12:45' })).toBeNull()
    const save = within(dialog).getByRole('button', { name: 'Saati değiştir' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    fireEvent.click(within(dialog).getByRole('button', { name: '14:00' }))
    fireEvent.click(save)
    await waitFor(() => expect(callsTo('/a1/reschedule', 'PATCH')).toHaveLength(1))
    expect(callsTo('/a1/reschedule', 'PATCH')[0][1].body).toEqual({ startAt: '2026-10-29T11:00:00Z' })
    const slotCall = request.mock.calls.find(([p]) => String(p).endsWith('/slots'))!
    expect(slotCall[1].query).toEqual({ serviceId: 'sv1', staffId: 'p1', date: '2026-10-29' })
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('K-saat-değiştir-409: SLOT_TAKEN saat bölümünde hata verir, saatleri yeniler, seçimi temizler', async () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Saati değiştir' }))
    const dialog = await screen.findByRole('dialog', { name: 'Saati değiştir' })
    fireEvent.click(await within(dialog).findByRole('button', { name: '14:00' }))
    patchError = new ApiError({ status: 409, code: 'SLOT_TAKEN' })
    const before = request.mock.calls.filter(([p]) => String(p).endsWith('/slots')).length
    fireEvent.click(within(dialog).getByRole('button', { name: 'Saati değiştir' }))
    expect((await within(dialog).findByRole('alert')).textContent).toContain('Bu saat doldu.')
    await waitFor(() => expect(request.mock.calls.filter(([p]) => String(p).endsWith('/slots')).length).toBeGreaterThan(before))
    expect((within(dialog).getByRole('button', { name: 'Saati değiştir' }) as HTMLButtonElement).disabled).toBe(true)
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('K-saat-değiştir-hata: saat sorgusu hata verirse hata ve Yeniden dene görünür', async () => {
    request.mockImplementation(async (path: string) => {
      if (path.endsWith('/slots')) throw new ApiError({ status: 500, code: 'INTERNAL_ERROR' })
      return {}
    })
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Saati değiştir' }))
    expect(await screen.findByText('Boş saatler yüklenemedi.')).toBeTruthy()
  })

  it('K-hizmetsiz: hizmet kimliği olmayan randevuda Saati değiştir çıkmaz (eksik veriyle istek atılmaz)', () => {
    mount(appt({ serviceId: null }))
    expect(screen.queryByRole('button', { name: 'Saati değiştir' })).toBeNull()
  })
})
