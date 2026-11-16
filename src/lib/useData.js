import { useCallback, useEffect, useState } from 'react'
import { db, TABLES } from './db'

const empty = Object.fromEntries(TABLES.map((t) => [t, []]))

export function useData(user) {
  const [data, setData] = useState(empty)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const entries = await Promise.all(TABLES.map(async (t) => [t, (await db.list(t)) ?? []]))
      setData(Object.fromEntries(entries))
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) reload()
    else setData(empty)
  }, [user, reload])

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
    setData((d) => ({ ...d, [table]: [rec, ...d[table]] }))
    return rec
  })
  const update = wrap(async (table, id, patch) => {
    const rec = await db.update(table, id, patch)
    setData((d) => ({ ...d, [table]: d[table].map((r) => (r.id === id ? rec : r)) }))
    return rec
  })
  const remove = wrap(async (table, id) => {
    await db.remove(table, id)
    setData((d) => {
      const next = { ...d, [table]: d[table].filter((r) => r.id !== id) }
      const fk = { beans: 'bean_id', machines: 'machine_id', grinders: 'grinder_id' }[table]
      if (fk) next.brews = next.brews.map((b) => (b[fk] === id ? { ...b, [fk]: null } : b))
      if (table === 'beans') next.bean_stock = next.bean_stock.filter((st) => st.bean_id !== id)
      return next
    })
  })

  return { ...data, loading, error, setError, add, update, remove, reload }
}
