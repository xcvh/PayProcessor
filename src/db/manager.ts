import type { SqlJsStatic, Database } from 'sql.js'
import { SCHEMA_SQL } from './schema'
import { loadDb, saveDb } from './persistence'
import type { Recipient, IBAN, Payment } from '../models/types'

export class DatabaseManager {
  private db: Database
  private SQL: SqlJsStatic

  private constructor(db: Database, SQL: SqlJsStatic) {
    this.db = db
    this.SQL = SQL
  }

  static async create(SQL: SqlJsStatic): Promise<DatabaseManager> {
    const stored = await loadDb()
    const db = stored ? new SQL.Database(stored) : new SQL.Database()
    const manager = new DatabaseManager(db, SQL)
    if (!stored) {
      manager.db.run(SCHEMA_SQL)
    } else {
      manager.db.run('PRAGMA foreign_keys = ON')
      manager._migrateIfNeeded()
    }
    await manager.persist()
    return manager
  }

  /** Migrate the legacy flat `entries` table to the normalized 3-table schema. */
  private _migrateIfNeeded(): void {
    const tables = this.db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='entries'"
    )
    if (!tables.length) return

    // Ensure target tables exist
    this.db.run(SCHEMA_SQL)

    const rows = this.db.exec('SELECT name, iban, amount, reference FROM entries')
    if (!rows.length) { this.db.run('DROP TABLE entries'); return }

    for (const [name, iban, amount, reference] of rows[0].values) {
      // Upsert recipient
      this.db.run('INSERT OR IGNORE INTO recipients (name) VALUES (?)', [name])
      const recResult = this.db.exec('SELECT id FROM recipients WHERE name = ?', [name])
      const recipientId = recResult[0].values[0][0] as number

      // Upsert IBAN
      this.db.run(
        'INSERT OR IGNORE INTO ibans (iban, recipient_id) VALUES (?, ?)',
        [iban, recipientId]
      )
      const ibanResult = this.db.exec(
        'SELECT id FROM ibans WHERE iban = ? AND recipient_id = ?',
        [iban, recipientId]
      )
      const ibanId = ibanResult[0].values[0][0] as number

      // Insert payment
      this.db.run(
        'INSERT INTO payments (amount, reference, iban_id) VALUES (?, ?, ?)',
        [amount, reference ?? null, ibanId]
      )
    }

    this.db.run('DROP TABLE entries')
  }

  private async persist(): Promise<void> {
    await saveDb(this.db.export())
  }

  // -- Recipients --

  getRecipients(query = ''): Recipient[] {
    const sql = query
      ? 'SELECT id, name FROM recipients WHERE name LIKE ? ORDER BY name'
      : 'SELECT id, name FROM recipients ORDER BY name'
    const result = query
      ? this.db.exec(sql, [`%${query}%`])
      : this.db.exec(sql)
    if (!result.length) return []
    return result[0].values.map(([id, name]) => ({
      id: id as number,
      name: name as string,
    }))
  }

  async addRecipient(name: string): Promise<number> {
    this.db.run('INSERT INTO recipients (name) VALUES (?)', [name])
    const result = this.db.exec('SELECT last_insert_rowid()')
    const id = result[0].values[0][0] as number
    await this.persist()
    return id
  }

  async deleteRecipient(id: number): Promise<void> {
    this.db.run('PRAGMA foreign_keys = ON')
    this.db.run('DELETE FROM recipients WHERE id = ?', [id])
    await this.persist()
  }

  // -- IBANs --

  getIbansForRecipient(recipientId: number): IBAN[] {
    const result = this.db.exec(
      'SELECT id, iban, recipient_id FROM ibans WHERE recipient_id = ? ORDER BY id',
      [recipientId]
    )
    if (!result.length) return []
    return result[0].values.map(([id, iban, recipient_id]) => ({
      id: id as number,
      iban: iban as string,
      recipient_id: recipient_id as number,
    }))
  }

  async addIban(iban: string, recipientId: number): Promise<number> {
    this.db.run('INSERT INTO ibans (iban, recipient_id) VALUES (?, ?)', [iban, recipientId])
    const result = this.db.exec('SELECT last_insert_rowid()')
    const id = result[0].values[0][0] as number
    await this.persist()
    return id
  }

  async deleteIban(id: number): Promise<void> {
    this.db.run('PRAGMA foreign_keys = ON')
    this.db.run('DELETE FROM ibans WHERE id = ?', [id])
    await this.persist()
  }

  // -- Payments --

  getPaymentsForIban(ibanId: number): Payment[] {
    const result = this.db.exec(
      'SELECT id, amount, reference, created_at, iban_id FROM payments WHERE iban_id = ? ORDER BY created_at DESC',
      [ibanId]
    )
    if (!result.length) return []
    return result[0].values.map(([id, amount, reference, created_at, iban_id]) => ({
      id: id as number,
      amount: amount as number,
      reference: reference as string | null,
      created_at: created_at as string,
      iban_id: iban_id as number,
    }))
  }

  async addPayment(amount: number, reference: string, ibanId: number): Promise<number> {
    this.db.run(
      'INSERT INTO payments (amount, reference, iban_id) VALUES (?, ?, ?)',
      [amount, reference || null, ibanId]
    )
    const result = this.db.exec('SELECT last_insert_rowid()')
    const id = result[0].values[0][0] as number
    await this.persist()
    return id
  }

  async deletePayment(id: number): Promise<void> {
    this.db.run('DELETE FROM payments WHERE id = ?', [id])
    await this.persist()
  }

  // -- Export / Import --

  exportBinary(): Uint8Array {
    return this.db.export()
  }

  async importBinary(data: Uint8Array): Promise<void> {
    this.db.close()
    this.db = new this.SQL.Database(data)
    this.db.run('PRAGMA foreign_keys = ON')
    this._migrateIfNeeded()
    await this.persist()
  }
}
