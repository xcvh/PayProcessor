import type { DatabaseManager } from '../db/manager'
import { createRecipientsPanel } from './recipients'
import { createIbansPanel } from './ibans'
import { createPaymentsPanel } from './payments'
import { createQrModal } from './qr-modal'

export function mountApp(root: HTMLElement, db: DatabaseManager) {
  root.innerHTML = ''

  // -- Header --
  const header = document.createElement('header')
  header.className = 'bg-white border-b border-gray-200 sticky top-0 z-10'
  header.innerHTML = `
    <div class="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
      <div class="flex items-center gap-2.5">
        <div class="w-7 h-7 bg-brand-500 rounded-lg flex items-center justify-center">
          <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>
          </svg>
        </div>
        <span class="font-semibold text-gray-900 tracking-tight">PayProcessor</span>
        <span class="text-xs text-gray-400 font-normal">SEPA QR Payments</span>
      </div>
      <div class="flex items-center gap-2">
        <button id="export-btn" class="btn-ghost text-xs" title="Export database">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          Export DB
        </button>
        <label class="btn-ghost text-xs cursor-pointer" title="Import database">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12"/>
          </svg>
          Import DB
          <input id="import-input" type="file" accept=".db,.sqlite" class="hidden" />
        </label>
      </div>
    </div>
  `

  // -- Main content --
  const main = document.createElement('main')
  main.className = 'max-w-7xl mx-auto px-4 py-5 h-[calc(100vh-3.5rem)]'

  const workspace = document.createElement('div')
  workspace.className = 'flex gap-4 h-full'

  // -- QR Modal --
  const qrModal = createQrModal()
  document.body.appendChild(qrModal.element)

  // -- Payments panel --
  const paymentsPanel = createPaymentsPanel(db, qrModal)

  // -- IBANs panel --
  const ibansPanel = createIbansPanel(
    db,
    (iban, recipient) => paymentsPanel.load(iban, recipient),
    () => paymentsPanel.clear()
  )

  // -- Right column (IBANs + Payments stacked) --
  const rightCol = document.createElement('div')
  rightCol.className = 'flex flex-col gap-4 flex-1 min-w-0'
  rightCol.appendChild(ibansPanel.element)
  rightCol.appendChild(paymentsPanel.element)

  // -- Recipients panel --
  const recipientsPanel = createRecipientsPanel(
    db,
    (recipient) => ibansPanel.load(recipient),
    () => ibansPanel.clear()
  )

  workspace.appendChild(recipientsPanel.element)
  workspace.appendChild(rightCol)
  main.appendChild(workspace)

  root.appendChild(header)
  root.appendChild(main)

  // -- Export --
  header.querySelector('#export-btn')!.addEventListener('click', () => {
    const data = db.exportBinary()
    const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'entries.db'
    a.click()
    URL.revokeObjectURL(url)
  })

  // -- Import --
  header.querySelector<HTMLInputElement>('#import-input')!.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    if (!confirm('Importing will replace all current data. Continue?')) return
    const buffer = await file.arrayBuffer()
    await db.importBinary(new Uint8Array(buffer))
    recipientsPanel.refresh()
    ibansPanel.clear()
    paymentsPanel.clear()
    alert('Database imported successfully.')
  })
}
