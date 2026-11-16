import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { db, TABLES } from './db'

const empty = Object.fromEntries(TABLES.map((t) => [t, []]))

export function useData(user) {
  const qc = useQueryClient()
  const key = ['data', user?.id]
  const query = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: async () => Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, (await db.list(t)) ?? []]))),
  })
  const [error, setError] = useState(null)
  useEffect(() => {
    if (query.error) setError(query.error.message)
  }, [query.error])

  const patch = (fn) => qc.setQueryData(key, (d) => fn(d ?? empty))
  const wrap = (fn) => async (...args) => {
    try {
      setError(null)
      return await fn(...args)
    } catch (e) {
      setError(e.message)
      throw e
    }
  }

  const add = wrap(async (table, row) => {
    const rec = await db.insert(table, row)
    patch((d) => ({ ...d, [table]: [rec, ...d[table]] }))
    return rec
  })
  const update = wrap(async (table, id, changes) => {
    const rec = await db.update(table, id, changes)
    patch((d) => ({ ...d, [table]: d[table].map((r) => (r.id === id ? rec : r)) }))
    return rec
  })
  const remove = wrap(async (table, id) => {
    await db.remove(table, id)
    patch((d) => {
      const next = { ...d, [table]: d[table].filter((r) => r.id !== id) }
      const fk = { beans: 'bean_id', machines: 'machine_id', grinders: 'grinder_id' }[table]
      if (fk) next.brews = next.brews.map((b) => (b[fk] === id ? { ...b, [fk]: null } : b))
      if (table === 'beans') next.bean_stock = next.bean_stock.filter((st) => st.bean_id !== id)
      return next
    })
  })

  return { ...(query.data ?? empty), loading: query.isLoading, error, setError, add, update, remove, reload: query.refetch }
}
