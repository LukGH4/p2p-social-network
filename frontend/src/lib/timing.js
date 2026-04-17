const marks = []
let verbose = false

export function enableVerbose() { verbose = true }

export function mark(event, extra = {}) {
  const t = Date.now()
  marks.push({ event, t, ...extra })
  if (verbose) console.log('[t]', event, t, Object.keys(extra).length ? extra : '')
}

export function getMarks() { return [...marks] }
export function clearMarks() { marks.length = 0 }
