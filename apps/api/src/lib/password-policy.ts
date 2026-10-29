import { z } from 'zod'

/** Şifre kuralı tek yerde: kayıt, sıfırlama, şifre değiştirme ve personel ekleme aynı şemayı kullanır. */
export const strongPassword = z
  .string()
  .min(8, 'Şifre en az 8 karakter olmalı.')
  .max(128, 'Şifre çok uzun.')
  .refine((v) => /[a-zA-Z]/.test(v), 'Şifrede en az 1 harf bulunmalı.')
  .refine((v) => /[0-9]/.test(v), 'Şifrede en az 1 rakam bulunmalı.')
