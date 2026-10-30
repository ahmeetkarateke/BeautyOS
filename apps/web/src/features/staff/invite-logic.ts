// Personel daveti saf mantığı (W21, A3 sözleşmesi). Sunucu e-postayı küçük harfe çevirir; rol yalnız üç değerden biridir.
export type InviteRole = 'manager' | 'receptionist' | 'staff'
export const INVITE_ROLES: readonly InviteRole[] = ['staff', 'receptionist', 'manager']
export type InviteValues = { fullName: string; email: string; role: InviteRole; title: string }
export const emptyInvite: InviteValues = { fullName: '', email: '', role: 'staff', title: '' }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateInvite(values: InviteValues): Record<string, string> {
  const errors: Record<string, string> = {}
  const name = values.fullName.trim()
  if (name.length < 2) errors.fullName = 'Ad soyadı yazın (en az 2 karakter).'
  else if (name.length > 100) errors.fullName = 'Ad soyad en çok 100 karakter olabilir.'
  if (!EMAIL.test(values.email.trim())) errors.email = 'Geçerli bir e-posta adresi yazın.'
  if (values.title.trim().length > 100) errors.title = 'Unvan en çok 100 karakter olabilir.'
  return errors
}

export function inviteBody(values: InviteValues): Record<string, string> {
  const title = values.title.trim()
  return { fullName: values.fullName.trim(), email: values.email.trim(), role: values.role, ...(title ? { title } : {}) }
}

/** Davet gönderirken DUPLICATE_EMAIL farklı anlama gelir: giriş yapmaya yönlendirmek burada yanlış olur. */
export function inviteErrorText(code: string, fallback: string): string {
  if (code === 'DUPLICATE_EMAIL') return 'Bu e-posta için kullanıcı ya da bekleyen davet zaten var.'
  return fallback
}
