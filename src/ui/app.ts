import type { DatabaseManager } from '../db/manager'
import { createRecipientsPanel } from './recipients'
import { createIbansPanel } from './ibans'
import { createPaymentsPanel } from './payments'
import { createQrModal } from './qr-modal'
import type { EpcPaymentData } from '../services/qr-generator'

export async function mountApp(root: HTMLElement, db: DatabaseManager, urlParams?: EpcPaymentData | null) {
  root.innerHTML = ''

  // -- Header --
  const header = document.createElement('header')
  header.className = 'bg-white border-b border-gray-200 sticky top-0 z-10'
  header.innerHTML = `
    <div class="px-6 h-14 flex items-center justify-between w-full">
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
  main.className = 'px-6 py-5 h-[calc(100vh-3.5rem)]'

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

  if (urlParams) {
    let recipients = db.getRecipients()
    let recipient = recipients.find(r => r.name.toLowerCase() === urlParams.name.toLowerCase())
    if (!recipient) {
      const id = await db.addRecipient(urlParams.name)
      recipient = { id, name: urlParams.name }
      recipientsPanel.refresh()
    }

    let ibans = db.getIbansForRecipient(recipient.id)
    let iban = ibans.find(i => i.iban.replace(/\s/g, '') === urlParams.iban.replace(/\s/g, ''))
    if (!iban) {
      const id = await db.addIban(urlParams.iban, recipient.id)
      iban = { id, iban: urlParams.iban, recipient_id: recipient.id }
    }

    ibansPanel.load({ id: recipient.id, name: recipient.name })

    if (urlParams.amount > 0 || urlParams.reference) {
      paymentsPanel.prefillAndOpen(urlParams.amount, urlParams.reference ?? '')
    }
  }

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

  // -- Import dialog --
  const importDialog = document.createElement('dialog')
  importDialog.innerHTML = `
    <div class="p-6 space-y-4">
      <h2 class="text-lg font-semibold text-gray-900">Import Database</h2>
      <p class="text-sm text-gray-500">How should the imported data be handled?</p>
      <div class="space-y-2">
        <button id="import-merge" class="w-full text-left px-4 py-3 rounded-xl border-2 border-brand-500 bg-brand-50 hover:bg-brand-100 transition-colors">
          <div class="font-medium text-brand-700 text-sm">Merge</div>
          <div class="text-xs text-gray-500 mt-0.5">Add new entries from the file, keep existing data</div>
        </button>
        <button id="import-replace" class="w-full text-left px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
          <div class="font-medium text-gray-700 text-sm">Replace</div>
          <div class="text-xs text-gray-500 mt-0.5">Discard current data and load the file</div>
        </button>
      </div>
      <button id="import-cancel" class="btn-ghost w-full justify-center text-gray-400">Cancel</button>
    </div>
  `
  document.body.appendChild(importDialog)

  let pendingImportData: Uint8Array | null = null
  const importInput = header.querySelector<HTMLInputElement>('#import-input')!

  importDialog.querySelector('#import-cancel')!.addEventListener('click', () => {
    importDialog.close()
    importInput.value = ''
  })
  importDialog.addEventListener('click', (e) => {
    if (e.target === importDialog) { importDialog.close(); importInput.value = '' }
  })

  importDialog.querySelector('#import-merge')!.addEventListener('click', async () => {
    if (!pendingImportData) return
    importDialog.close()
    const stats = await db.mergeFrom(pendingImportData)
    pendingImportData = null
    importInput.value = ''
    recipientsPanel.refresh()
    ibansPanel.clear()
    paymentsPanel.clear()
    showToast(`Merged: +${stats.recipients} recipients, +${stats.ibans} IBANs, +${stats.payments} payments`)
  })

  importDialog.querySelector('#import-replace')!.addEventListener('click', async () => {
    if (!pendingImportData) return
    importDialog.close()
    await db.importBinary(pendingImportData)
    pendingImportData = null
    importInput.value = ''
    recipientsPanel.refresh()
    ibansPanel.clear()
    paymentsPanel.clear()
    showToast('Database replaced successfully')
  })

  // -- Import --
  importInput.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const buffer = await file.arrayBuffer()
    pendingImportData = new Uint8Array(buffer)
    importDialog.showModal()
  })
}

function showToast(message: string) {
  const toast = document.createElement('div')
  toast.className = 'fixed bottom-4 right-4 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg z-50 transition-opacity duration-300'
  toast.textContent = message
  document.body.appendChild(toast)
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300) }, 3000)
}
