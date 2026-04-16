import type { DatabaseManager } from '../db/manager'
import type { IBAN, Recipient } from '../models/types'

function createAddIbanDialog(onAdd: (iban: string) => Promise<void>): HTMLDialogElement {
  const dialog = document.createElement('dialog')
  dialog.innerHTML = `
    <div class="p-6 space-y-4">
      <h2 class="text-lg font-semibold text-gray-900">Add IBAN</h2>
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">IBAN</label>
        <input id="iban-input" type="text" class="input-field font-mono" placeholder="DE89 3704 0044 0532 0130 00" maxlength="34" />
        <p class="text-xs text-gray-400 mt-1">Spaces are ignored automatically</p>
      </div>
      <p id="iban-error" class="text-xs text-red-500 hidden"></p>
      <div class="flex gap-2">
        <button id="iban-submit" class="btn-primary flex-1 justify-center">Add IBAN</button>
        <button id="iban-cancel" class="btn-secondary flex-1 justify-center">Cancel</button>
      </div>
    </div>
  `

  const input = dialog.querySelector<HTMLInputElement>('#iban-input')!
  const errorEl = dialog.querySelector<HTMLElement>('#iban-error')!
  const submitBtn = dialog.querySelector<HTMLButtonElement>('#iban-submit')!

  const showError = (msg: string) => {
    errorEl.textContent = msg
    errorEl.classList.remove('hidden')
  }

  dialog.querySelector('#iban-cancel')!.addEventListener('click', () => dialog.close())
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close() })

  submitBtn.addEventListener('click', async () => {
    errorEl.classList.add('hidden')
    const iban = input.value.replace(/\s/g, '').toUpperCase()
    if (iban.length < 15) { showError('Please enter a valid IBAN.'); return }
    submitBtn.disabled = true
    submitBtn.textContent = 'Adding...'
    try {
      await onAdd(iban)
      dialog.close()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      showError(msg.includes('UNIQUE') ? 'This IBAN already exists for this recipient.' : 'Failed to add IBAN.')
    } finally {
      submitBtn.disabled = false
      submitBtn.textContent = 'Add IBAN'
    }
  })

  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitBtn.click() })

  return dialog
}

function formatIban(iban: string): string {
  return iban.replace(/(.{4})/g, '$1 ').trim()
}

export function createIbansPanel(
  db: DatabaseManager,
  onIbanSelected: (iban: IBAN, recipient: Recipient) => void,
  onIbanDeselected: () => void
): {
  element: HTMLElement
  load: (recipient: Recipient) => void
  clear: () => void
  selectIbanById: (id: number) => void
} {
  const panel = document.createElement('div')
  panel.className = 'panel flex-1'
  panel.innerHTML = `
    <div class="panel-header">
      <span class="panel-title">IBANs</span>
      <button id="add-iban-btn" class="btn-primary hidden" title="Add IBAN">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
        </svg>
        Add
      </button>
    </div>
    <div id="ibans-body" class="panel-body">
      <div class="empty-state">
        <div class="empty-state-icon">🏦</div>
        <p class="empty-state-text">Select a recipient to view IBANs</p>
      </div>
    </div>
  `

  let currentRecipient: Recipient | null = null
  let ibans: IBAN[] = []
  let selectedId: number | null = null

  const body = panel.querySelector<HTMLElement>('#ibans-body')!
  const addBtn = panel.querySelector<HTMLButtonElement>('#add-iban-btn')!

  const render = () => {
    body.innerHTML = ''
    if (!currentRecipient) {
      body.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🏦</div><p class="empty-state-text">Select a recipient to view IBANs</p></div>`
      return
    }
    if (ibans.length === 0) {
      body.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🏦</div><p class="empty-state-text">No IBANs yet</p></div>`
      return
    }
    ibans.forEach((ib) => {
      const el = document.createElement('div')
      el.className = `list-item ${ib.id === selectedId ? 'selected' : ''}`
      el.innerHTML = `
        <span class="font-mono text-xs truncate">${formatIban(ib.iban)}</span>
        <button class="item-action delete-btn" title="Delete IBAN">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
      `
      el.querySelector('.delete-btn')!.addEventListener('click', async (e) => {
        e.stopPropagation()
        if (!confirm(`Delete IBAN ${formatIban(ib.iban)} and all its payments?`)) return
        await db.deleteIban(ib.id)
        if (selectedId === ib.id) {
          selectedId = null
          onIbanDeselected()
        }
        if (currentRecipient) ibans = db.getIbansForRecipient(currentRecipient.id)
        render()
      })
      el.addEventListener('click', () => {
        if (!currentRecipient) return
        selectedId = ib.id
        render()
        onIbanSelected(ib, currentRecipient)
      })
      body.appendChild(el)
    })
  }

  const addDialog = createAddIbanDialog(async (iban) => {
    if (!currentRecipient) throw new Error('No recipient selected')
    await db.addIban(iban, currentRecipient.id)
    if (currentRecipient) ibans = db.getIbansForRecipient(currentRecipient.id)
    render()
  })
  panel.appendChild(addDialog)

  addBtn.addEventListener('click', () => {
    const input = addDialog.querySelector<HTMLInputElement>('#iban-input')!
    input.value = ''
    addDialog.querySelector<HTMLElement>('#iban-error')!.classList.add('hidden')
    addDialog.showModal()
    setTimeout(() => input.focus(), 50)
  })

  const load = (recipient: Recipient) => {
    currentRecipient = recipient
    selectedId = null
    ibans = db.getIbansForRecipient(recipient.id)
    addBtn.classList.remove('hidden')
    render()
    if (ibans.length > 0) {
      selectedId = ibans[0].id
      render()
      onIbanSelected(ibans[0], currentRecipient)
    } else {
      onIbanDeselected()
    }
  }

  const clear = () => {
    currentRecipient = null
    selectedId = null
    ibans = []
    addBtn.classList.add('hidden')
    onIbanDeselected()
    render()
  }

  const selectIbanById = (id: number) => {
    const ib = ibans.find(i => i.id === id)
    if (!ib || !currentRecipient) return
    selectedId = ib.id
    render()
    onIbanSelected(ib, currentRecipient)
  }

  return { element: panel, load, clear, selectIbanById }
}
