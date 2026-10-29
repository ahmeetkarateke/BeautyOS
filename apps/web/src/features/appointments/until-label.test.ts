import { describe, expect, it } from 'vitest'
import { untilLabel } from './until-label'

describe('W10-1 Ö4: saat + "kadar" eki okunuşa göre', () => {
  it.each([
    ['09:30', '09:30’a kadar'], // otuz
    ['10:00', '10:00’a kadar'], // on
    ['12:00', '12:00’ye kadar'], // iki
    ['16:00', '16:00’ya kadar'], // altı
    ['20:00', '20:00’ye kadar'], // yirmi
    ['14:00', '14:00’e kadar'], // dört
    ['15:00', '15:00’e kadar'], // on beş
    ['11:45', '11:45’e kadar'], // kırk beş
    ['11:07', '11:07’ye kadar'], // yedi
    ['13:50', '13:50’ye kadar'], // elli
    ['08:00', '08:00’e kadar'], // sekiz
    ['09:20', '09:20’ye kadar'], // yirmi (dakika)
    ['07:40', '07:40’a kadar'], // kırk
    ['00:00', '00:00’a kadar'], // sıfır
    ['19:00', '19:00’a kadar'], // on dokuz
    ['21:00', '21:00’e kadar'], // yirmi bir
  ])('%s -> %s', (input, expected) => {
    expect(untilLabel(input)).toBe(expected)
  })
})
