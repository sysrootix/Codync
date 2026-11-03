import { memo, useEffect, useState, type ReactNode } from 'react'
import { parseMarkdown, type Block } from './markdown-blocks.ts'
import { Hairline, IconButton } from '../../components/Controls'
import { HStack, VStack } from '../../components/Stack'
import { Text } from '../../components/Text'
import './markdown.css'

// The Mac's Markdown for messages: the blocks from `markdown-blocks.ts`, with inline styling like
// `AttributedString(markdown:)`.

/** Inline Markdown: `code` (tinted), **bold**, *italic*, ~~strike~~, [links](url). */
export function inline(text: string, key = 'i'): ReactNode[] {
  const out: ReactNode[] = []
  // Code spans first: nothing inside them is styled.
  text.split(/(`[^`\n]+`)/).forEach((part, i) => {
    if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) {
      out.push(
        <code key={`${key}${i}`} className="md-code-span">
          {part.slice(1, -1)}
        </code>,
      )
    } else if (part) out.push(...emphasis(part, `${key}${i}-`))
  })
  return out
}

const pattern = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|~~([^~]+)~~|\*([^*\n]+)\*|(?<![\w])_([^_\n]+)_(?![\w])/
function emphasis(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = []
  let rest = text
  let n = 0
  while (rest) {
    const m = pattern.exec(rest)
    if (!m) {
      out.push(rest)
      break
    }
    if (m.index > 0) out.push(rest.slice(0, m.index))
    const k = `${key}${n++}`
    if (m[1] !== undefined) {
      const url = m[2]!
      out.push(
        <a key={k} href={url} title={url} className="md-link" onClick={(e) => { e.preventDefault(); window.codync.app.openExternal(url) }}>
          {emphasis(m[1], `${k}-`)}
        </a>,
      )
    } else if (m[3] !== undefined || m[4] !== undefined) out.push(<strong key={k} className="md-strong">{emphasis(m[3] ?? m[4]!, `${k}-`)}</strong>)
    else if (m[5] !== undefined) out.push(<s key={k}>{emphasis(m[5], `${k}-`)}</s>)
    else out.push(<em key={k}>{emphasis(m[6] ?? m[7]!, `${k}-`)}</em>)
    rest = rest.slice(m.index + m[0].length)
  }
  return out
}

const MarkdownBlock = memo(function MarkdownBlock({ block }: { block: Block }) {
  switch (block.kind) {
    case 'paragraph':
      return <div className="md-text md-spaced md-body">{inline(block.text)}</div>
    case 'heading':
      return (
        <div className={`md-text md-spaced md-heading-${Math.min(block.level, 3)}`}>
          {inline(block.text)}
        </div>
      )
    case 'bullet':
      return (
        <HStack align="baseline" gap={6} className="md-spaced md-body" style={{ paddingLeft: block.depth * 16 }}>
          <Text tone="secondary" className="md-marker">{block.marker}</Text>
          <span className="md-text md-bullet-text">{inline(block.text)}</span>
        </HStack>
      )
    case 'rule':
      return <Hairline className="md-rule" />
    case 'table': {
      const columns = Math.max(block.header.length, ...block.rows.map((r) => r.length))
      const cols = Array.from({ length: columns }, (_, i) => i)
      return (
        <div className="md-table-scroll">
          <table className="md-table md-body">
            <thead>
              <tr>
                {cols.map((i) => (
                  <th key={i}><Text weight="semibold">{inline(block.header[i] ?? '', `h${i}`)}</Text></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {cols.map((i) => <td key={i}>{inline(row[i] ?? '', `${r}-${i}`)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
    case 'quote':
      return <div className="md-text md-spaced md-body md-quote">{inline(block.text)}</div>
    case 'code':
      return <CodeBlock text={block.text} language={block.language} />
  }
}, (a, b) => JSON.stringify(a.block) === JSON.stringify(b.block))

/** Fenced code: its language and a copy button above it. */
function CodeBlock({ text, language }: { text: string; language: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(t)
  }, [copied])
  const copy = () => {
    window.codync.app.copy(text)
    setCopied(true)
  }
  return (
    <div className="md-code">
      <HStack justify="space-between" align="center" className="md-code-bar">
        <Text size="caption" tone="secondary" className="md-code-language">{language.trim().split(/\s/)[0] ?? ''}</Text>
        <IconButton title="Copy" icon={copied ? 'checkmark' : 'square.on.square'} size={22} onClick={copy} />
      </HStack>
      <div className="md-code-scroll">
        <pre className="md-code-text">{text}</pre>
      </div>
    </div>
  )
}

/** The desktop's Markdown for messages; a block that didn't change keeps its rendering. */
export const MarkdownText = memo(function MarkdownText({ text }: { text: string }) {
  const blocks = parseMarkdown(text)
  return (
    <VStack gap={10} shrink className="markdown selectable">
      {blocks.map((b, i) => (
        <MarkdownBlock key={i} block={b} />
      ))}
    </VStack>
  )
})
