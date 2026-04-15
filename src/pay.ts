import './style.css'
import { renderQrToCanvas, qrToDataUrl, type EpcPaymentData } from './services/qr-generator'

const root = document.getElementById('app')!

function getParams(): EpcPaymentData | null {
  const p = new URLSearchParams(location.search)
  const iban = p.get('iban')?.replace(/\s/g, '').toUpperCase() ?? ''
  const name = p.get('name') ?? ''
  const amount = parseFloat(p.get('amount') ?? '')
  const reference = p.get('reference') ?? ''

  if (!iban || !name || isNaN(amount) || amount <= 0) return null
  return { iban, name, amount, reference: reference || undefined }
}

async function render(data: EpcPaymentData) {
  root.innerHTML = `
    <div class="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
      <div class="bg-white rounded-2xl shadow-xl p-6 flex flex-col items-center gap-5 w-full max-w-sm">
        <div class="flex items-center gap-2.5">
          <div class="w-7 h-7 bg-brand-500 rounded-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>
            </svg>
          </div>
          <span class="font-semibold text-gray-900 tracking-tight">PayProcessor</span>
        </div>

        <div class="w-full bg-gray-50 rounded-xl p-4 space-y-1.5 text-sm">
          <div class="flex items-baseline gap-2">
            <span class="text-xs text-gray-400 w-20 shrink-0">Recipient</span>
            <span class="font-medium text-gray-800 truncate">${escapeHtml(data.name)}</span>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="text-xs text-gray-400 w-20 shrink-0">IBAN</span>
            <span class="font-mono text-gray-700 text-xs break-all">${escapeHtml(data.iban)}</span>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="text-xs text-gray-400 w-20 shrink-0">Amount</span>
            <span class="font-semibold text-gray-800">€${data.amount.toFixed(2)}</span>
          </div>
          ${data.reference ? `
          <div class="flex items-baseline gap-2">
            <span class="text-xs text-gray-400 w-20 shrink-0">Reference</span>
            <span class="text-gray-700 truncate">${escapeHtml(data.reference)}</span>
          </div>
          ` : ''}
        </div>

        <div class="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
          <canvas id="qr-canvas"></canvas>
        </div>

        <p class="text-xs text-gray-400 text-center">Scan with any SEPA-compatible banking app</p>

        <button id="save-btn" class="btn-primary w-full justify-center">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          Save as PNG
        </button>
      </div>
    </div>
  `

  const canvas = document.getElementById('qr-canvas') as HTMLCanvasElement
  await renderQrToCanvas(canvas, data)

  document.getElementById('save-btn')!.addEventListener('click', async () => {
    const url = await qrToDataUrl(data)
    const a = document.createElement('a')
    a.href = url
    const safeName = (data.name + '_' + data.iban.slice(-4)).replace(/\s/g, '_')
    a.download = `qr_${safeName}.png`
    a.click()
  })
}

function renderError(message: string) {
  root.innerHTML = `
    <div class="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
      <div class="bg-white rounded-2xl shadow-xl p-6 flex flex-col items-center gap-4 w-full max-w-sm">
        <div class="text-red-400">
          <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        </div>
        <h1 class="text-lg font-semibold text-gray-900">Invalid payment link</h1>
        <p class="text-sm text-gray-500 text-center">${escapeHtml(message)}</p>
        <p class="text-xs text-gray-400 text-center">Missing or invalid: iban, name, amount</p>
      </div>
    </div>
  `
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const data = getParams()
if (data) {
  render(data)
} else {
  renderError('Payment data is incomplete.')
}
