// Hesabım saf mantığı (W28). Kural sunucudaki strongPassword ile aynıdır; asıl denetim sunucudadır.
export type PasswordValues = { current: string; next: string; confirm: string }
export const emptyPassword: PasswordValues = { current: '', next: '', confirm: '' }

export function validatePassword(values: PasswordValues): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!values.current) errors.current = 'Mevcut şifrenizi yazın.'
  if (values.next.length < 8) errors.next = 'Şifre en az 8 karakter olmalı.'
  else if (values.next.length > 128) errors.next = 'Şifre en çok 128 karakter olabilir.'
  else if (!/\p{L}/u.test(values.next)) errors.next = 'Şifrede en az 1 harf bulunmalı.'
  else if (!/[0-9]/.test(values.next)) errors.next = 'Şifrede en az 1 rakam bulunmalı.'
  else if (values.next === values.current) errors.next = 'Yeni şifre eskisinden farklı olmalı.'
  if (!errors.next && values.confirm !== values.next) errors.confirm = 'Şifreler aynı değil.'
  return errors
}

export function passwordBody(values: PasswordValues) {
  return { currentPassword: values.current, newPassword: values.next }
}
