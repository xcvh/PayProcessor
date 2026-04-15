import type { DatabaseManager } from '../db/manager'
import type { Payment, IBAN, Recipient } from '../models/types'
import type { createQrModal } from './qr-modal'

export interface PaymentContext {
  recipientName: string
  iban: string
}

interface AddPaymentDialog extends HTMLDialogElement {
  showContext: (ctx: PaymentContext | null) => void
}

function formatDate(ts: string): string {
  try {
    return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return ts
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function createAddPaymentDialog(
  onAdd: (amount: number, reference: string) => Promise<void>
): AddPaymentDialog {
  const dialog = document.createElement('dialog')
  dialog.innerHTML = `
    <div class="p-6 space-y-4">
      <h2 class="text-lg font-semibold text-gray-900">New Payment</h2>
      <div id="pay-context" class="bg-gray-50 rounded-xl p-3 space-y-1 text-sm"></div>
      <div class="space-y-3">
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Amount (EUR)</label>
          <input id="pay-amount" type="number" step="0.01" min="0.01" class="input-field" placeholder="0.00" />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Reference <span class="text-gray-400 font-normal">(optional)</span></label>
          <input id="pay-ref" type="text" class="input-field" placeholder="Invoice #001" maxlength="140" />
        </div>
      </div>
      <p id="pay-error" class="text-xs text-red-500 hidden"></p>
      <div class="flex gap-2">
        <button id="pay-submit" class="btn-primary flex-1 justify-center">Add Payment</button>
        <button id="pay-cancel" class="btn-secondary flex-1 justify-center">Cancel</button>
      </div>
    </div>
  `

  const contextEl = dialog.querySelector<HTMLElement>('#pay-context')!
  const amountInput = dialog.querySelector<HTMLInputElement>('#pay-amount')!
  const refInput = dialog.querySelector<HTMLInputElement>('#pay-ref')!
  const errorEl = dialog.querySelector<HTMLElement>('#pay-error')!
  const submitBtn = dialog.querySelector<HTMLButtonElement>('#pay-submit')!

  ;(dialog as AddPaymentDialog).showContext = (ctx: PaymentContext | null) => {
    if (ctx) {
      contextEl.innerHTML = `
        <div class="flex items-baseline gap-2">
          <span class="text-xs text-gray-400 w-16 shrink-0">To</span>
          <span class="font-medium text-gray-800 truncate">${escapeHtml(ctx.recipientName)}</span>
        </div>
        <div class="flex items-baseline gap-2">
          <span class="text-xs text-gray-400 w-16 shrink-0">IBAN</span>
          <span class="font-mono text-gray-700 text-xs break-all">${escapeHtml(ctx.iban)}</span>
        </div>
      `
      contextEl.classList.remove('hidden')
    } else {
      contextEl.classList.add('hidden')
    }
  }

  const showError = (msg: string) => {
    errorEl.textContent = msg
    errorEl.classList.remove('hidden')
  }

  dialog.querySelector('#pay-cancel')!.addEventListener('click', () => dialog.close())
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close() })

  submitBtn.addEventListener('click', async () => {
    errorEl.classList.add('hidden')
    const amount = parseFloat(amountInput.value)
    if (!amount || amount <= 0) { showError('Please enter a valid amount.'); return }
    submitBtn.disabled = true
    submitBtn.textContent = 'Adding...'
    try {
      await onAdd(amount, refInput.value.trim())
      dialog.close()
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Failed to add payment.')
    } finally {
      submitBtn.disabled = false
      submitBtn.textContent = 'Add Payment'
    }
  })

  amountInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitBtn.click() })
  refInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitBtn.click() })

  return dialog as AddPaymentDialog
}

export function createPaymentsPanel(
  db: DatabaseManager,
  qrModal: ReturnType<typeof createQrModal>
): {
  element: HTMLElement
  load: (iban: IBAN, recipient: Recipient) => void
  clear: () => void
  prefillAndOpen: (amount: number, reference: string) => void
} {
  const panel = document.createElement('div')
  panel.className = 'panel flex-1'
  panel.innerHTML = `
    <div class="panel-header">
      <span class="panel-title">Payments</span>
      <button id="add-payment-btn" class="btn-primary hidden" title="Add payment">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
        </svg>
        New
      </button>
    </div>
    <div id="payments-body" class="panel-body">
      <div class="empty-state">
        <div class="empty-state-icon">💳</div>
        <p class="empty-state-text">Select an IBAN to view payments</p>
      </div>
    </div>
  `

  let currentIban: IBAN | null = null
  let currentRecipient: Recipient | null = null
  let payments: Payment[] = []
  let selectedId: number | null = null

  const body = panel.querySelector<HTMLElement>('#payments-body')!
  const addBtn = panel.querySelector<HTMLButtonElement>('#add-payment-btn')!

  const render = () => {
    body.innerHTML = ''
    if (!currentIban) {
      body.innerHTML = `<div class="empty-state"><div class="empty-state-icon">💳</div><p class="empty-state-text">Select an IBAN to view payments</p></div>`
      return
    }
    if (payments.length === 0) {
      body.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🧾</div><p class="empty-state-text">No payments yet</p></div>`
      return
    }
    payments.forEach((p) => {
      const el = document.createElement('div')
      el.className = `list-item ${p.id === selectedId ? 'selected' : ''}`
      el.innerHTML = `
        <div class="flex flex-col gap-0.5 min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-semibold text-sm">€${p.amount.toFixed(2)}</span>
            ${p.reference ? `<span class="text-xs truncate opacity-70">${p.reference}</span>` : ''}
          </div>
          <span class="text-xs opacity-60">${formatDate(p.created_at)}</span>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button class="item-action qr-btn p-1.5 rounded-md" title="Generate QR">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>
            </svg>
          </button>
          <button class="item-action delete-btn" title="Delete payment">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      `
      el.querySelector('.qr-btn')!.addEventListener('click', async (e) => {
        e.stopPropagation()
        if (!currentIban || !currentRecipient) return
        selectedId = p.id
        render()
        await qrModal.show(
          { name: currentRecipient.name, iban: currentIban.iban, amount: p.amount, reference: p.reference },
          currentRecipient.name,
          currentIban.iban
        )
      })
      el.querySelector('.delete-btn')!.addEventListener('click', async (e) => {
        e.stopPropagation()
        if (!confirm(`Delete this €${p.amount.toFixed(2)} payment?`)) return
        await db.deletePayment(p.id)
        if (selectedId === p.id) selectedId = null
        if (currentIban) payments = db.getPaymentsForIban(currentIban.id)
        render()
      })
      el.addEventListener('click', async () => {
        if (!currentIban || !currentRecipient) return
        selectedId = p.id
        render()
        await qrModal.show(
          { name: currentRecipient.name, iban: currentIban.iban, amount: p.amount, reference: p.reference },
          currentRecipient.name,
          currentIban.iban
        )
      })
      body.appendChild(el)
    })
  }

  const addDialog = createAddPaymentDialog(async (amount, reference) => {
    if (!currentIban) throw new Error('No IBAN selected')
    await db.addPayment(amount, reference, currentIban.id)
    payments = db.getPaymentsForIban(currentIban.id)
    render()
  })
  panel.appendChild(addDialog)

  addBtn.addEventListener('click', () => {
    const amountInput = addDialog.querySelector<HTMLInputElement>('#pay-amount')!
    const refInput = addDialog.querySelector<HTMLInputElement>('#pay-ref')!
    amountInput.value = ''
    refInput.value = ''
    addDialog.querySelector<HTMLElement>('#pay-error')!.classList.add('hidden')
    addDialog.showModal()
    setTimeout(() => amountInput.focus(), 50)
  })

  const load = (iban: IBAN, recipient: Recipient) => {
    currentIban = iban
    currentRecipient = recipient
    selectedId = null
    payments = db.getPaymentsForIban(iban.id)
    addBtn.classList.remove('hidden')
    render()
    addDialog.showContext({ recipientName: recipient.name, iban: iban.iban })
  }

  const clear = () => {
    currentIban = null
    currentRecipient = null
    selectedId = null
    payments = []
    addBtn.classList.add('hidden')
    render()
    addDialog.showContext(null)
  }

  const prefillAndOpen = (amount: number, reference: string) => {
    if (!currentIban) return
    const amountInput = addDialog.querySelector<HTMLInputElement>('#pay-amount')!
    const refInput = addDialog.querySelector<HTMLInputElement>('#pay-ref')!
    amountInput.value = amount > 0 ? amount.toString() : ''
    refInput.value = reference
    addDialog.querySelector<HTMLElement>('#pay-error')!.classList.add('hidden')
    addDialog.showModal()
    setTimeout(() => amountInput.focus(), 50)
  }

  return { element: panel, load, clear, prefillAndOpen }
}
