export type PhoneResolution = { kind: 'none' } | { kind: 'single'; id: string } | { kind: 'multiple'; ids: string[] }

export async function resolveCustomerByPhone(
  _tx: unknown,
  _tenantId: string,
  _phone: string,
): Promise<PhoneResolution> {
  throw new Error('not implemented')
}
