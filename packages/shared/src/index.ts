/**
 * @beautyos/shared dis API'si. Buraya eklenen her ad,
 * `src/__tests__/public-api.test.ts` icindeki tam listeye de eklenmelidir.
 */
export { ROLES, isRole } from './roles'
export type { Role } from './roles'
export { PERMISSIONS, can, permissionsFor } from './permissions'
export type { PermissionKey } from './permissions'
export { TERM_KEYS, TERM_FORMS, termOverrideKeyAllowed, validateTermOverrides } from './terms'
