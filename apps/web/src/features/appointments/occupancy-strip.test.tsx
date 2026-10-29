import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppointmentCard } from './appointment-card'
import type { DayAppointment } from './day-logic'
import { OccupancyStrip } from './occupancy-strip'
import type { StaffMember } from './staff'

afterEach(cleanup)

const at = (hhmm: string) => new Date(`2026-10-28T${hhmm}:00+03:00`)
const appt = (id: string, staffKey: string, from: string, to: string, status: DayAppointment['status'], over: Partial<DayAppointment> = {}): DayAppointment => ({
  id, staffKey, staffName: staffKey === 'p1' ? 'Derya Aksoy' : 'Elif Tan', customerId: 'c', serviceId: 's', customerName: `Müşteri ${id}`, customerPhone: '',
  unverified: false, serviceName: 'Fön', start: at(from), end: at(to), status, price: 0, notes: '', ...over,
})
const staff: StaffMember[] = [
  { id: 'p1', name: 'Derya Aksoy', short: 'Derya', title: '', initials: 'DA', tone: 1, givesService: true },
  { id: 'p2', name: 'Elif Tan', short: 'Elif', title: '', initials: 'ET', tone: 2, givesService: true },
]
const range = { startMin: 540, endMin: 1200 }
const NOW = 11 * 60 + 30

function mount(appointments: DayAppointment[], handlers: { open?: (id: string) => void; pick?: (s: string, t: string) => void } = {}, nowMin = NOW) {
  return render(<OccupancyStrip staff={staff} appointments={appointments} range={range} nowMin={nowMin} onOpenAppointment={handlers.open ?? vi.fn()} onPickFree={handlers.pick ?? vi.fn()} />)
}

describe('W10 doluluk şeridi', () => {
  it('K-şerit: her kişi için durum cümlesi erişilebilir adda (meşgul / boş / mesai dışı)', () => {
    mount([appt('a', 'p1', '11:00', '12:00', 'in_progress'), appt('b', 'p2', '13:00', '14:00', 'confirmed')])
    expect(screen.getByRole('group', { name: 'Derya Aksoy: şu an meşgul, 12:00’ye kadar' })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Elif Tan: şu an boş, 13:00’e kadar' })).toBeTruthy()
    cleanup()
    mount([], {}, 21 * 60)
    expect(screen.getAllByRole('group', { name: /çalışma saati dışında/ })).toHaveLength(2)
  })

  it('K-şerit: iptal edilen randevu şeritte çizilmez, diğerleri saat aralığı ve müşteriyle adlandırılır', () => {
    mount([appt('a', 'p1', '10:00', '11:00', 'confirmed'), appt('x', 'p1', '12:00', '13:00', 'cancelled')])
    expect(screen.getByRole('button', { name: '10:00 – 11:00, Müşteri a, Fön', hidden: true })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Müşteri x/, hidden: true })).toBeNull()
  })

  it('K-şerit: dilim konumu aralığa göre yüzdedir (10:00-11:00 / 09:00-20:00)', () => {
    mount([appt('a', 'p1', '10:00', '11:00', 'confirmed')])
    const slice = screen.getByRole('button', { name: /Müşteri a/, hidden: true })
    expect(parseFloat(slice.style.left)).toBeCloseTo((60 / 660) * 100, 2)
    expect(parseFloat(slice.style.width)).toBeCloseTo((60 / 660) * 100, 2)
  })

  it('K-şerit: onay bekleyen dilim kesikli kenarlıdır, devam eden dolu işaret rengindedir', () => {
    mount([appt('p', 'p1', '10:00', '11:00', 'pending'), appt('r', 'p2', '11:00', '12:00', 'in_progress')])
    expect(screen.getByRole('button', { name: /Müşteri p/, hidden: true }).className).toContain('border-dashed')
    expect(screen.getByRole('button', { name: /Müşteri r/, hidden: true }).className).toContain('bg-person-2-mark')
  })

  it('K-şerit: boşluğa dokunmak o kişiyi ve 15 dakikaya yaslanmış saati verir', () => {
    const pick = vi.fn()
    mount([], { pick })
    const track = screen.getByRole('group', { name: /Derya Aksoy/ })
    track.getBoundingClientRect = () => ({ left: 0, width: 1100, top: 0, height: 28, right: 1100, bottom: 28, x: 0, y: 0, toJSON: () => ({}) })
    // 575 px -> 540 + 345 dk = 14:45 (tam isabet), 580 px -> 888 dk -> 14:45'e yaslanır
    fireEvent.click(track, { clientX: 580 })
    expect(pick).toHaveBeenCalledWith('p1', '14:45')
  })

  it('K-şerit: dolu dilime dokunmak boş saat açmaz, randevuyu açar', () => {
    const pick = vi.fn()
    const open = vi.fn()
    mount([appt('a', 'p1', '10:00', '11:00', 'confirmed')], { pick, open })
    fireEvent.click(screen.getByRole('button', { name: /Müşteri a/, hidden: true }))
    expect(open).toHaveBeenCalledWith('a')
    expect(pick).not.toHaveBeenCalled()
  })

  it('K-şerit: "şimdi" çizgisi yalnız aralık içindeyken çizilir', () => {
    const { container } = mount([])
    expect(container.querySelectorAll('.bg-accent-mark')).toHaveLength(2)
    cleanup()
    const outside = mount([], {}, 22 * 60)
    expect(outside.container.querySelectorAll('.bg-accent-mark')).toHaveLength(0)
  })

  it('K-şerit: eksen saatleri 09, 12, 15, 18, 20', () => {
    mount([])
    expect(screen.getByText('20')).toBeTruthy()
    expect(screen.getByText('09')).toBeTruthy()
  })
})

describe('W10 randevu kartı', () => {
  it('K-kart: saat aralığı, müşteri, hizmet · kişi · Online ve durum görünür; tıklanınca kimlik döner', () => {
    const onOpen = vi.fn()
    render(<AppointmentCard appointment={appt('a', 'p1', '12:00', '12:45', 'pending', { unverified: true })} tone={1} staffShort="Derya" onOpen={onOpen} />)
    const card = screen.getByTestId('randevu-a')
    expect(card.textContent).toContain('12:00 – 12:45')
    expect(card.textContent).toContain('Müşteri a')
    expect(card.textContent).toContain('Fön · Derya · Online')
    expect(card.textContent).toContain('Bekliyor')
    fireEvent.click(card)
    expect(onOpen).toHaveBeenCalledWith('a')
  })

  it('K-kart: personel gizlenebilir; iptal edilen ad çizgilidir; tamamlanan geçmiş tonundadır', () => {
    const { rerender } = render(<AppointmentCard appointment={appt('c', 'p1', '12:00', '13:00', 'cancelled')} tone={1} staffShort="Derya" showStaff={false} onOpen={vi.fn()} />)
    expect(screen.getByTestId('randevu-c').textContent).not.toContain('Derya')
    expect(screen.getByText('Müşteri c').className).toContain('line-through')
    rerender(<AppointmentCard appointment={appt('d', 'p1', '12:00', '13:00', 'completed')} tone={1} staffShort="Derya" onOpen={vi.fn()} />)
    expect(screen.getByTestId('randevu-d').className).toContain('bg-past-bg')
  })
})
