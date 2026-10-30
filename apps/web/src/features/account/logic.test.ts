import { describe, expect, it } from 'vitest'
import { emptyPassword, passwordBody, validatePassword } from './logic'

const ok = { current: 'Eski1234', next: 'Yeni12345', confirm: 'Yeni12345' }

describe('W28 şifre değiştirme', () => {
  it('K1: geçerli değerler hatasızdır; gövde yalnız iki alanı taşır', () => {
    expect(validatePassword(ok)).toEqual({})
    expect(passwordBody(ok)).toEqual({ currentPassword: 'Eski1234', newPassword: 'Yeni12345' })
    expect(emptyPassword).toEqual({ current: '', next: '', confirm: '' })
  })
  it('K2: mevcut şifre zorunlu', () => {
    expect(Object.keys(validatePassword({ ...ok, current: '' }))).toEqual(['current'])
  })
  it('K3: yeni şifre 8 karakterden kısa olamaz (harf ve rakam var)', () => {
    expect(validatePassword({ ...ok, next: 'Ab1234', confirm: 'Ab1234' }).next).toBe('Şifre en az 8 karakter olmalı.')
  })
  it('K4: yeni şifrede harf zorunlu (uzunluk ve rakam tamam)', () => {
    expect(validatePassword({ ...ok, next: '123456789', confirm: '123456789' }).next).toBe('Şifrede en az 1 harf bulunmalı.')
  })
  it('K5: yeni şifrede rakam zorunlu (uzunluk ve harf tamam)', () => {
    expect(validatePassword({ ...ok, next: 'Sadeceharf', confirm: 'Sadeceharf' }).next).toBe('Şifrede en az 1 rakam bulunmalı.')
  })
  it('K6: tekrar uyuşmazsa yalnız confirm alanı hatalıdır', () => {
    expect(validatePassword({ ...ok, confirm: 'Yeni12346' })).toEqual({ confirm: 'Şifreler aynı değil.' })
  })
  it('K7: yeni şifre eskisiyle aynı olamaz', () => {
    expect(validatePassword({ current: 'Eski1234', next: 'Eski1234', confirm: 'Eski1234' }).next).toBe('Yeni şifre eskisinden farklı olmalı.')
  })
  it('K8: 128 karakterden uzun şifre reddedilir; Türk I harfi harf sayılır', () => {
    const long = 'a1'.repeat(65)
    expect(validatePassword({ ...ok, next: long, confirm: long }).next).toBe('Şifre en çok 128 karakter olabilir.')
    expect(validatePassword({ ...ok, next: 'IİıI12345', confirm: 'IİıI12345' })).toEqual({})
  })
})
