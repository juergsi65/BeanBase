import { useState } from 'react'
import { errMsg } from './errors'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { db, TABLES, type RowInput } from './db'
import type { AppUser, Data, TableMap, TableName } from '../types'

const empty = Object.fromEntries(TABLES.map((t) => [t, []])) as unknown as Data

export function useData(user: AppUser | null | undefined) {
  const qc = useQueryClient()
  const key = ['data', user?.id]
  const query = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: async () => Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, (await db.list(t)) ?? []]))) as Data,
  })
  const [mutationError, setMutationError] = useState<string | null>(null)
  // Ladefehler wird abgeleitet statt per Effect kopiert; „schließen“ merkt sich den weggeklickten Fehler
  const [dismissed, setDismissed] = useState<Error | null>(null)
  const error = mutationError ?? (query.error && query.error !== dismissed ? query.error.message : null)
  const setError = (msg: string | null) => {
    setMutationError(msg)
    if (msg === null) setDismissed(query.error)
  }

  const patch = (fn: (d: Data) => Data) => qc.setQueryData<Data>(key, (d) => fn(d ?? empty))
  // Tabellen-Liste generisch ersetzen (Typ-Zuordnung pro Tabelle gilt per Konstruktion)
  const setRows = <T extends TableName>(d: Data, table: T, rows: TableMap[T][]): Data => ({ ...d, [table]: rows })
  const wrap =
    <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
    async (...args: A) => {
      try {
        setError(null)
        return await fn(...args)
      } catch (e) {
        setError(errMsg(e))
        throw e
      }
    }

  const add = wrap(async <T extends TableName>(table: T, row: RowInput<T>) => {
    const rec = await db.insert(table, row)
    patch((d) => setRows(d, table, [rec, ...(d[table] as TableMap[T][])]))
    return rec
  })
  const update = wrap(async <T extends TableName>(table: T, id: string, changes: RowInput<T>) => {
    const rec = await db.update(table, id, changes)
    patch((d) => setRows(d, table, (d[table] as TableMap[T][]).map((r) => (r.id === id ? rec : r))))
    return rec
  })
  const remove = wrap(async (table: TableName, id: string) => {
    await db.remove(table, id)
    patch((d) => {
      const next = setRows(d, table, (d[table] as { id: string }[]).filter((r) => r.id !== id) as TableMap[typeof table][])
      const fk = ({ beans: 'bean_id', machines: 'machine_id', grinders: 'grinder_id' } as const)[table as 'beans' | 'machines' | 'grinders']
      if (fk) next.brews = next.brews.map((b) => (b[fk] === id ? { ...b, [fk]: null } : b))
      if (table === 'beans') next.bean_stock = next.bean_stock.filter((st) => st.bean_id !== id)
      return next
    })
  })

  return { ...(query.data ?? empty), loading: query.isLoading, error, setError, add, update, remove, reload: query.refetch }
}

export type DataApi = ReturnType<typeof useData>
