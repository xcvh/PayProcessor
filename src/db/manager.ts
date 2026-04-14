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

  async mergeFrom(data: Uint8Array): Promise<{ recipients: number; ibans: number; payments: number }> {
    const src = new this.SQL.Database(data)
    src.run('PRAGMA foreign_keys = ON')

    // Migrate old schema in the source db if needed
    const hasEntries = src.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='entries'")
    if (hasEntries.length) {
      const SCHEMA = `CREATE TABLE IF NOT EXISTS recipients (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS ibans (id INTEGER PRIMARY KEY AUTOINCREMENT, iban TEXT NOT NULL, recipient_id INTEGER NOT NULL, FOREIGN KEY (recipient_id) REFERENCES recipients (id) ON DELETE CASCADE, UNIQUE (iban, recipient_id));
CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY AUTOINCREMENT, amount REAL NOT NULL, reference TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, iban_id INTEGER NOT NULL, FOREIGN KEY (iban_id) REFERENCES ibans (id) ON DELETE CASCADE);`
      src.run(SCHEMA)
      const rows = src.exec('SELECT name, iban, amount, reference FROM entries')
      if (rows.length) {
        for (const [name, iban, amount, reference] of rows[0].values) {
          src.run('INSERT OR IGNORE INTO recipients (name) VALUES (?)', [name])
          const recId = src.exec('SELECT id FROM recipients WHERE name = ?', [name])[0].values[0][0]
          src.run('INSERT OR IGNORE INTO ibans (iban, recipient_id) VALUES (?, ?)', [iban, recId])
          const ibanId = src.exec('SELECT id FROM ibans WHERE iban = ? AND recipient_id = ?', [iban, recId])[0].values[0][0]
          src.run('INSERT INTO payments (amount, reference, iban_id) VALUES (?, ?, ?)', [amount, reference ?? null, ibanId])
        }
      }
      src.run('DROP TABLE entries')
    }

    let addedRecipients = 0, addedIbans = 0, addedPayments = 0

    const recipientRows = src.exec('SELECT id, name FROM recipients ORDER BY id')
    if (recipientRows.length) {
      for (const [srcRecId, name] of recipientRows[0].values) {
        this.db.run('INSERT OR IGNORE INTO recipients (name) VALUES (?)', [name])
        const inserted = this.db.exec('SELECT changes()')[0].values[0][0] as number
        addedRecipients += inserted

        const ourRecId = this.db.exec('SELECT id FROM recipients WHERE name = ?', [name])[0].values[0][0] as number

        const ibanRows = src.exec('SELECT id, iban FROM ibans WHERE recipient_id = ?', [srcRecId])
        if (!ibanRows.length) continue

        for (const [srcIbanId, iban] of ibanRows[0].values) {
          this.db.run('INSERT OR IGNORE INTO ibans (iban, recipient_id) VALUES (?, ?)', [iban, ourRecId])
          const ibanInserted = this.db.exec('SELECT changes()')[0].values[0][0] as number
          addedIbans += ibanInserted

          const ourIbanId = this.db.exec('SELECT id FROM ibans WHERE iban = ? AND recipient_id = ?', [iban, ourRecId])[0].values[0][0] as number

          const paymentRows = src.exec(
            'SELECT amount, reference, created_at FROM payments WHERE iban_id = ?',
            [srcIbanId]
          )
          if (!paymentRows.length) continue

          for (const [amount, reference, created_at] of paymentRows[0].values) {
            // Skip exact duplicates (same iban, amount, reference)
            const exists = this.db.exec(
              'SELECT COUNT(*) FROM payments WHERE iban_id = ? AND amount = ? AND reference IS ?',
              [ourIbanId, amount, reference ?? null]
            )[0].values[0][0] as number
            if (!exists) {
              this.db.run(
                'INSERT INTO payments (amount, reference, created_at, iban_id) VALUES (?, ?, ?, ?)',
                [amount, reference ?? null, created_at, ourIbanId]
              )
              addedPayments++
            }
          }
        }
      }
    }

    src.close()
    await this.persist()
    return { recipients: addedRecipients, ibans: addedIbans, payments: addedPayments }
  }
}
