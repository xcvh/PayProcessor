import type { DatabaseManager } from '../db/manager'
import type { Recipient } from '../models/types'
import { isValidIban } from '../services/iban'

function createNewRecipientDialog(
  onAdd: (name: string, iban: string) => Promise<void>
): HTMLDialogElement {
  const dialog = document.createElement('dialog')
  dialog.innerHTML = `
    <div class="p-6 space-y-4">
      <h2 class="text-lg font-semibold text-gray-900">New Recipient</h2>
      <div class="space-y-3">
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Name</label>
          <input id="rec-name" type="text" class="input-field" placeholder="John Smith" maxlength="70" />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">IBAN</label>
          <input id="rec-iban" type="text" class="input-field font-mono" placeholder="DE89 3704 0044 0532 0130 00" maxlength="34" />
          <p class="text-xs text-gray-400 mt-1">Spaces are ignored automatically</p>
        </div>
      </div>
      <p id="rec-error" class="text-xs text-red-500 hidden"></p>
      <div class="flex gap-2">
        <button id="rec-submit" class="btn-primary flex-1 justify-center">Add Recipient</button>
        <button id="rec-cancel" class="btn-secondary flex-1 justify-center">Cancel</button>
      </div>
    </div>
  `

  const nameInput = dialog.querySelector<HTMLInputElement>('#rec-name')!
  const ibanInput = dialog.querySelector<HTMLInputElement>('#rec-iban')!
  const errorEl = dialog.querySelector<HTMLElement>('#rec-error')!
  const submitBtn = dialog.querySelector<HTMLButtonElement>('#rec-submit')!

  const showError = (msg: string) => {
    errorEl.textContent = msg
    errorEl.classList.remove('hidden')
  }

  dialog.querySelector('#rec-cancel')!.addEventListener('click', () => dialog.close())
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close() })

  submitBtn.addEventListener('click', async () => {
    errorEl.classList.add('hidden')
    const name = nameInput.value.trim()
    const iban = ibanInput.value.replace(/\s/g, '').toUpperCase()
    if (!name) { showError('Please enter a recipient name.'); return }
    if (!isValidIban(iban)) { showError('Please enter a valid IBAN.'); return }
    submitBtn.disabled = true
    submitBtn.textContent = 'Adding...'
    try {
      await onAdd(name, iban)
      dialog.close()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      showError(msg.includes('UNIQUE') ? 'A recipient with this name already exists.' : 'Failed to add recipient.')
    } finally {
      submitBtn.disabled = false
      submitBtn.textContent = 'Add Recipient'
    }
  })

  ibanInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitBtn.click() })
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') ibanInput.focus() })

  return dialog
}

export function createRecipientsPanel(
  db: DatabaseManager,
  onRecipientSelected: (recipient: Recipient) => void,
  onRecipientDeselected: () => void
): { element: HTMLElement; refresh: () => void; selectById: (id: number) => void; openAddDialog: (prefillName?: string, onAdded?: (id: number) => void) => void } {
  const panel = document.createElement('div')
  panel.className = 'panel w-[480px] shrink-0'
  panel.innerHTML = `
    <div class="panel-header">
      <span class="panel-title">Recipients</span>
      <button id="add-recipient-btn" class="btn-primary" title="Add recipient">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
        </svg>
        Add Recipient
      </button>
    </div>
    <div class="px-2 pt-2 pb-1">
      <input id="search-input" type="text" class="input-field" placeholder="Search recipients…" />
    </div>
    <div id="recipients-body" class="panel-body"></div>
  `

  let recipients: Recipient[] = []
  let selectedId: number | null = null

  const body = panel.querySelector<HTMLElement>('#recipients-body')!
  const searchInput = panel.querySelector<HTMLInputElement>('#search-input')!

  const render = () => {
    body.innerHTML = ''
    if (recipients.length === 0) {
      body.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👤</div><p class="empty-state-text">No recipients yet</p></div>`
      return
    }
    recipients.forEach((r) => {
      const el = document.createElement('div')
      el.className = `list-item ${r.id === selectedId ? 'selected' : ''}`
      el.innerHTML = `
        <span class="truncate">${r.name}</span>
        <button class="item-action delete-btn" title="Delete recipient">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
      `
      el.querySelector('.delete-btn')!.addEventListener('click', async (e) => {
        e.stopPropagation()
        if (!confirm(`Delete "${r.name}" and all their IBANs and payments?`)) return
        await db.deleteRecipient(r.id)
        if (selectedId === r.id) {
          selectedId = null
          onRecipientDeselected()
        }
        recipients = db.getRecipients(searchInput.value)
        render()
      })
      el.addEventListener('click', () => {
        selectedId = r.id
        render()
        onRecipientSelected(r)
      })
      body.appendChild(el)
    })
    // Scroll selected item into view (no-op if already visible)
    body.querySelector<HTMLElement>('.list-item.selected')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }

  const refresh = () => {
    recipients = db.getRecipients(searchInput.value)
    render()
  }

  searchInput.addEventListener('input', () => {
    recipients = db.getRecipients(searchInput.value)
    render()
  })

  let afterAddHook: ((id: number) => void) | null = null

  const addDialog = createNewRecipientDialog(async (name, iban) => {
    const recipientId = await db.addRecipient(name)
    await db.addIban(iban, recipientId)
    refresh()
    selectById(recipientId)
    afterAddHook?.(recipientId)
    afterAddHook = null
  })
  panel.appendChild(addDialog)

  const openAddDialog = (prefillName?: string, onAdded?: (id: number) => void) => {
    const nameInput = addDialog.querySelector<HTMLInputElement>('#rec-name')!
    const ibanInput = addDialog.querySelector<HTMLInputElement>('#rec-iban')!
    nameInput.value = prefillName ?? ''
    ibanInput.value = ''
    addDialog.querySelector<HTMLElement>('#rec-error')!.classList.add('hidden')
    afterAddHook = onAdded ?? null
    addDialog.showModal()
    setTimeout(() => (prefillName ? ibanInput : nameInput).focus(), 50)
  }

  panel.querySelector('#add-recipient-btn')!.addEventListener('click', () => openAddDialog())

  refresh()
  const selectById = (id: number) => {
    const r = recipients.find(rec => rec.id === id)
    if (!r) return
    selectedId = r.id
    render()
    onRecipientSelected(r)
  }
  return { element: panel, refresh, selectById, openAddDialog }
}
