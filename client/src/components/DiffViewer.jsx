import { FileCode2, FileWarning } from 'lucide-react'
import { EmptyState, Skeleton } from './ui'

const maximumRows = 3000

function parseDiff(text) {
  const rows = []
  let oldLine = 0
  let newLine = 0
  let inHunk = false
  for (const line of text.split('\n')) {
    if (line.startsWith('diff --git')) {
      inHunk = false
      continue
    }
    if (line.startsWith('@@')) {
      const match = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)/)
      oldLine = Number(match?.[1] || 0)
      newLine = Number(match?.[2] || 0)
      inHunk = true
      rows.push({ type: 'hunk', text: line })
    } else if (!inHunk) {
      continue
    } else if (line.startsWith('+')) {
      rows.push({ type: 'add', text: line.slice(1), newNumber: newLine++ })
    } else if (line.startsWith('-')) {
      rows.push({ type: 'remove', text: line.slice(1), oldNumber: oldLine++ })
    } else if (line.startsWith('\\')) {
      rows.push({ type: 'note', text: line.slice(2) })
    } else if (line.startsWith(' ')) {
      rows.push({ type: 'context', text: line.slice(1), oldNumber: oldLine++, newNumber: newLine++ })
    }
  }
  return rows
}

const rowStyles = {
  add: 'bg-diff-add',
  remove: 'bg-diff-remove',
  hunk: 'bg-info/[0.07] text-info/90',
  note: 'text-subtle italic',
  context: ''
}

const signs = { add: '+', remove: '-', context: ' ', hunk: '', note: '' }

export default function DiffViewer({ result, loading, error }) {
  if (loading && !result) {
    return (
      <div className="space-y-2 p-5">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-4" style={{ width: `${40 + ((index * 37) % 55)}%` }} />
        ))}
      </div>
    )
  }
  if (error) return <EmptyState icon={FileWarning} title="Could not load diff" description={error} />
  if (!result) {
    return <EmptyState icon={FileCode2} title="Select a file" description="Choose a changed file to see what was added and removed." />
  }
  if (result.binary) return <EmptyState icon={FileWarning} title="Binary file" description="A text diff is not available for binary files." />
  if (result.tooLarge) return <EmptyState icon={FileWarning} title="File too large" description="This file is too large to preview here. Open it in your editor instead." />

  const rows = parseDiff(result.diff)
  if (rows.length === 0) {
    return <EmptyState icon={FileCode2} title="No line changes" description="Only the file name or permissions changed." />
  }
  const additions = rows.filter((row) => row.type === 'add').length
  const deletions = rows.filter((row) => row.type === 'remove').length

  return (
    <div>
      <div className="flex items-center gap-3 border-b border-line px-5 py-2 font-mono text-xs">
        <span className="text-accent">+{additions}</span>
        <span className="text-danger">-{deletions}</span>
        {(result.truncated || rows.length > maximumRows) && <span className="text-warning">Diff truncated</span>}
      </div>
      <div className="max-h-[32rem] overflow-auto">
        <table className="w-full border-collapse font-mono text-xs leading-5">
          <tbody>
            {rows.slice(0, maximumRows).map((row, index) => (
              <tr key={index} className={rowStyles[row.type]}>
                {row.type === 'hunk' || row.type === 'note' ? (
                  <td colSpan={4} className="whitespace-pre px-4 py-1">
                    {row.text}
                  </td>
                ) : (
                  <>
                    <td className="w-10 select-none border-r border-line px-2 text-right text-subtle">{row.oldNumber ?? ''}</td>
                    <td className="w-10 select-none border-r border-line px-2 text-right text-subtle">{row.newNumber ?? ''}</td>
                    <td className={`w-5 select-none pl-2 ${row.type === 'add' ? 'text-accent' : row.type === 'remove' ? 'text-danger' : ''}`}>
                      {signs[row.type]}
                    </td>
                    <td className="whitespace-pre pr-4 text-fg">{row.text || ' '}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
