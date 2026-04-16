import { isValidIBAN } from 'ibantools'

/**
 * Validates an IBAN using ibantools (mod-97 checksum + country-specific length rules).
 * Input should be pre-cleaned (spaces removed, uppercased).
 */
export function isValidIban(iban: string): boolean {
  return isValidIBAN(iban)
}
