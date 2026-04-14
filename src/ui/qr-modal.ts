import { renderQrToCanvas, qrToDataUrl, type EpcPaymentData } from '../services/qr-generator'

export function createQrModal(): {
  element: HTMLDialogElement
  show: (data: EpcPaymentData, recipientName: string, ibanStr: string) => Promise<void>
  hide: () => void
} {
  const dialog = document.createElement('dialog')
  dialog.className = 'bg-white'
  dialog.innerHTML = `
    <div class="p-6 flex flex-col items-center gap-4">
      <div class="flex items-center justify-between w-full">
        <h2 class="text-lg font-semibold text-gray-900">Payment QR Code</h2>
        <button id="qr-close" class="btn-ghost text-gray-400 hover:text-gray-600">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div id="qr-meta" class="w-full bg-gray-50 rounded-xl p-4 space-y-1.5 text-sm">
        <div class="flex items-baseline gap-2">
          <span class="text-xs text-gray-400 w-20 shrink-0">Recipient</span>
          <span id="qr-recipient" class="font-medium text-gray-800 truncate"></span>
        </div>
        <div class="flex items-baseline gap-2">
          <span class="text-xs text-gray-400 w-20 shrink-0">IBAN</span>
          <span id="qr-iban" class="font-mono text-gray-700 text-xs break-all"></span>
        </div>
        <div class="flex items-baseline gap-2">
          <span class="text-xs text-gray-400 w-20 shrink-0">Amount</span>
          <span id="qr-amount" class="font-semibold text-gray-800"></span>
        </div>
        <div id="qr-ref-row" class="flex items-baseline gap-2">
          <span class="text-xs text-gray-400 w-20 shrink-0">Reference</span>
          <span id="qr-ref" class="text-gray-700 truncate"></span>
        </div>
      </div>

      <div class="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
        <canvas id="qr-canvas"></canvas>
      </div>

      <p class="text-xs text-gray-400 text-center">Scan with any SEPA-compatible banking app</p>

      <div class="flex gap-2 w-full">
        <button id="qr-save" class="btn-primary flex-1 justify-center">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          Save as PNG
        </button>
        <button id="qr-close2" class="btn-secondary flex-1 justify-center">Close</button>
      </div>
    </div>
  `

  let currentData: EpcPaymentData | null = null

  const canvas = dialog.querySelector<HTMLCanvasElement>('#qr-canvas')!
  const recipientEl = dialog.querySelector<HTMLElement>('#qr-recipient')!
  const ibanEl = dialog.querySelector<HTMLElement>('#qr-iban')!
  const amountEl = dialog.querySelector<HTMLElement>('#qr-amount')!
  const refEl = dialog.querySelector<HTMLElement>('#qr-ref')!
  const refRow = dialog.querySelector<HTMLElement>('#qr-ref-row')!

  const close = () => dialog.close()

  dialog.querySelector('#qr-close')!.addEventListener('click', close)
  dialog.querySelector('#qr-close2')!.addEventListener('click', close)
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close()
  })

  dialog.querySelector('#qr-save')!.addEventListener('click', async () => {
    if (!currentData) return
    const url = await qrToDataUrl(currentData)
    const a = document.createElement('a')
    a.href = url
    const safeName = (currentData.name + '_' + currentData.iban.slice(-4)).replace(/\s/g, '_')
    a.download = `qr_${safeName}.png`
    a.click()
  })

  const show = async (data: EpcPaymentData, recipientName: string, ibanStr: string) => {
    currentData = data
    recipientEl.textContent = recipientName
    ibanEl.textContent = ibanStr
    amountEl.textContent = `€${data.amount.toFixed(2)}`
    if (data.reference) {
      refEl.textContent = data.reference
      refRow.classList.remove('hidden')
    } else {
      refRow.classList.add('hidden')
    }
    dialog.showModal()
    await renderQrToCanvas(canvas, data)
  }

  return { element: dialog, show, hide: close }
}
