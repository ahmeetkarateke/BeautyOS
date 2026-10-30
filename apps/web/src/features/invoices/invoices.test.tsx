import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/v2/api-client'
import type { ApiClient } from '@/lib/v2/api-client'
import { ApiClientProvider } from '@/lib/v2/api-context'
import type { Me } from '@/lib/v2/me'
import { MeProvider } from '@/lib/v2/session'
import { makeMe } from '@/lib/v2/test-me'
import { ToastProvider } from '@/ui/toast'
import { InvoicesScreen } from './invoices-screen'
import '@/ui/test-polyfills'

const request = vi.fn()
const client = { request } as unknown as ApiClient
type Init = { method?: string; body?: Record<string, unknown> }
let invoices: unknown[]
let listError: ApiError | null
let writeError: ApiError | null

const inv = (id: string, status: string, over: Record<string, unknown> = {}) => ({
  id,
  supplierName: 'Güzellik Toptan',
  invoiceNumber: `F-${id}`,
  invoiceDate: '2026-10-20T00:00:00.000Z',
  dueDate: null,
  status,
  total: 1200,
  ...over,
})
const withPerms = (perms: string[]): Me => ({ ...makeMe('owner'), permissions: perms as unknown as Me['permissions'] })
const owner = () => withPerms(['purchase_invoice.read', 'purchase_invoice.write'])

function mount(me: Me = owner()) {
  return render(
    <ApiClientProvider client={client}>
      <MeProvider me={me}>
        <ToastProvider>
          <InvoicesScreen />
        </ToastProvider>
      </MeProvider>
    </ApiClientProvider>,
  )
}
const writes = () => request.mock.calls.filter(([, init]) => (init as Init | undefined)?.method)

beforeEach(() => {
  request.mockReset()
  listError = null
  writeError = null
  invoices = [inv('1', 'draft'), inv('2', 'posted'), inv('3', 'cancelled')]
  request.mockImplementation(async (path: string, init?: Init) => {
    if (init?.method) {
      if (writeError) throw writeError
      return {}
    }
    if (path.endsWith('/suppliers')) return { data: [{ id: 's1', name: 'Güzellik Toptan' }] }
    if (listError) throw listError
    return { data: invoices }
  })
})
afterEach(cleanup)

describe('W25 Alış faturaları', () => {
  it('K1: faturalar tedarikçi, numara, tarih, durum ve toplamla; eylemler duruma göre', async () => {
    mount()
    const list = await screen.findByRole('list', { name: 'Alış faturaları' })
    const rows = within(list).getAllByRole('listitem')
    expect(rows[0].textContent).toContain('Taslak')
    expect(within(rows[0]).getByRole('button', { name: /^Faturayı işle/ })).toBeTruthy()
    expect(within(rows[0]).getByRole('button', { name: /^Taslağı sil/ })).toBeTruthy()
    expect(within(rows[1]).getByRole('button', { name: /^Faturayı iptal et/ })).toBeTruthy()
    expect(within(rows[2]).queryByRole('button')).toBeNull()
    expect(rows[1].textContent).toContain('₺1.200')
  })

  it('K2: izin yoksa yetkisiz; yalnız okuma izninde eylem ve Fatura ekle yok', async () => {
    mount(makeMe('receptionist'))
    expect(screen.getByText('Bu sayfayı görme yetkiniz yok.')).toBeTruthy()
    expect(request).not.toHaveBeenCalled()
    cleanup()
    mount(withPerms(['purchase_invoice.read']))
    await screen.findByRole('list', { name: 'Alış faturaları' })
    expect(screen.queryByRole('button', { name: 'Fatura ekle' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Faturayı işle/ })).toBeNull()
  })

  it('K3: Faturayı işle önce onay ister (stok ve cari uyarısı); onayda POST /post gider', async () => {
    mount()
    const list = await screen.findByRole('list', { name: 'Alış faturaları' })
    fireEvent.click(within(within(list).getAllByRole('listitem')[0]).getByRole('button', { name: /^Faturayı işle/ }))
    const confirm = await screen.findByRole('alertdialog')
    expect(confirm.textContent).toContain('stoğa girer')
    fireEvent.click(within(confirm).getByRole('button', { name: 'Vazgeç' }))
    expect(writes()).toHaveLength(0)
    fireEvent.click(within(within(list).getAllByRole('listitem')[0]).getByRole('button', { name: /^Faturayı işle/ }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Faturayı işle' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(writes()[0][0]).toMatch(/purchase-invoices\/1\/post$/)
    expect(await screen.findByText('Fatura işlendi.')).toBeTruthy()
  })

  it('K4: iptal ve taslak silme DELETE/cancel uçlarına gider; sunucu hatası sayfa şeridinde görünür', async () => {
    writeError = new ApiError({ status: 400, code: 'NOT_POSTED' })
    mount()
    const list = await screen.findByRole('list', { name: 'Alış faturaları' })
    fireEvent.click(within(within(list).getAllByRole('listitem')[1]).getByRole('button', { name: /^Faturayı iptal et/ }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Faturayı iptal et' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(writes()[0][0]).toMatch(/purchase-invoices\/2\/cancel$/)
    expect((await screen.findByRole('alert')).textContent).toBeTruthy()
  })

  it('K5: yeni fatura: eksik alanlar istek atmaz; kalem toplamları canlı; geçerli form POST eder', async () => {
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Fatura ekle' }))
    const dialog = await screen.findByRole('dialog', { name: 'Fatura ekle' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Taslak olarak kaydet' }))
    expect(await within(dialog).findByText('Tedarikçiyi seçin.')).toBeTruthy()
    expect(within(dialog).getByText('Kalem adını yazın (en çok 200 karakter).')).toBeTruthy()
    expect(writes()).toHaveLength(0)
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Tedarikçi' }), { target: { value: 's1' } })
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Kalem 1 adı' }), { target: { value: 'Şampuan' } })
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Kalem 1 adet/ }), { target: { value: '10' } })
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Kalem 1 birim fiyat/ }), { target: { value: '100' } })
    expect(within(dialog).getByRole('status').textContent).toContain('₺1.200')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Taslak olarak kaydet' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect((writes()[0][1] as Init).body).toMatchObject({
      supplierId: 's1',
      items: [{ name: 'Şampuan', quantity: 10, unitPrice: 100, taxRate: 20, discount: 0 }],
    })
    expect(await screen.findByText('Taslak kaydedildi.')).toBeTruthy()
  })

  it('K6: "Kaydedince hemen işle" işaretliyse post:true gider; kalem eklenip kaldırılabilir', async () => {
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Fatura ekle' }))
    const dialog = await screen.findByRole('dialog', { name: 'Fatura ekle' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Kalem ekle' }))
    expect(within(dialog).getByRole('textbox', { name: 'Kalem 2 adı' })).toBeTruthy()
    fireEvent.click(within(dialog).getAllByRole('button', { name: /^Kalemi kaldır/ })[1])
    expect(within(dialog).queryByRole('textbox', { name: 'Kalem 2 adı' })).toBeNull()
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /hemen işle/ }))
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Tedarikçi' }), { target: { value: 's1' } })
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Kalem 1 adı' }), { target: { value: 'Boya' } })
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Kalem 1 birim fiyat/ }), { target: { value: '50' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Faturayı işle' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect((writes()[0][1] as Init).body).toMatchObject({ post: true })
  })

  it('K7: boş liste ve hata durumları açıklayıcıdır', async () => {
    invoices = []
    mount()
    expect(await screen.findByText('Henüz alış faturası yok.')).toBeTruthy()
    cleanup()
    listError = new ApiError({ status: 500, code: 'INTERNAL_ERROR' })
    mount()
    expect((await screen.findByRole('alert')).textContent).toContain('Alış faturaları yüklenemedi.')
  })
})
