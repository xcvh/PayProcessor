import QRCode from 'qrcode'

export interface EpcPaymentData {
  name: string
  iban: string
  amount: number
  reference?: string | null
}

function buildEpcPayload(data: EpcPaymentData): string {
  const { name, iban, amount, reference } = data

  // Format amount as EUR followed by value with 2 decimal places
  const amountStr = amount > 0 ? `EUR${amount.toFixed(2)}` : ''

  // EPC069-12 standard payload, lines separated by \n
  const lines = [
    'BCD',           // Service Tag
    '002',           // Version
    '1',             // Character set: UTF-8
    'SCT',           // Identification Code: SEPA Credit Transfer
    '',              // BIC (optional, blank)
    name.slice(0, 70), // Beneficiary name (max 70 chars)
    iban.replace(/\s/g, ''), // IBAN (strip spaces)
    amountStr,       // Amount
    '',              // Purpose (blank)
    '',              // Structured remittance reference (blank)
    reference ?? '', // Unstructured remittance information
    '',              // Beneficiary to originator info (blank)
  ]

  return lines.join('\n')
}

export async function renderQrToCanvas(
  canvas: HTMLCanvasElement,
  data: EpcPaymentData
): Promise<void> {
  const payload = buildEpcPayload(data)
  await QRCode.toCanvas(canvas, payload, {
    errorCorrectionLevel: 'M',
    width: 280,
    margin: 2,
    color: {
      dark: '#1e293b',
      light: '#ffffff',
    },
  })
}

export async function qrToDataUrl(data: EpcPaymentData): Promise<string> {
  const payload = buildEpcPayload(data)
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    width: 600,
    margin: 2,
  })
}
