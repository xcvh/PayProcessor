import './style.css'
import initSqlJs from 'sql.js'
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import { DatabaseManager } from './db/manager'
import { mountApp } from './ui/app'
import type { EpcPaymentData } from './services/qr-generator'

const root = document.getElementById('app')!

root.innerHTML = `
  <div class="min-h-screen flex flex-col items-center justify-center gap-4">
    <div class="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center animate-pulse">
      <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>
      </svg>
    </div>
    <p class="text-sm text-gray-500">Loading PayProcessor…</p>
  </div>
`

function parseUrlParams(): EpcPaymentData | null {
  const p = new URLSearchParams(location.search)
  const iban = p.get('iban')?.replace(/\s/g, '').toUpperCase() ?? ''
  const name = p.get('name') ?? ''
  const amount = parseFloat(p.get('amount') ?? '')
  const reference = p.get('reference') ?? ''

  if (!name) return null
  return { iban, name, amount: isNaN(amount) ? 0 : amount, reference: reference || undefined }
}

async function init() {
  try {
    const SQL = await initSqlJs({ locateFile: () => sqlWasmUrl })
    const db = await DatabaseManager.create(SQL)
    await mountApp(root, db, parseUrlParams())
  } catch (err) {
    root.innerHTML = `
      <div class="min-h-screen flex items-center justify-center">
        <div class="text-center space-y-2">
          <p class="text-red-500 font-medium">Failed to initialize database</p>
          <p class="text-sm text-gray-400">${err instanceof Error ? err.message : String(err)}</p>
          <button onclick="location.reload()" class="btn-secondary mt-4">Retry</button>
        </div>
      </div>
    `
  }
}

init()
