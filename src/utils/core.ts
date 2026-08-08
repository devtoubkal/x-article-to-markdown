export type TextBlock = { type: 'text'; value: string }
export type HeadingBlock = { type: 'heading'; level: number; value: string }
export type CodeBlock = { type: 'code'; value: string; lang?: string }
export type ImageBlock = { type: 'image'; src: string; alt: string }
export type ListBlock = { type: 'list'; ordered: boolean; items: Block[][] }
export type BlockquoteBlock = { type: 'blockquote'; blocks: Block[] }
export type Block = TextBlock | HeadingBlock | CodeBlock | ImageBlock | ListBlock | BlockquoteBlock

export interface Author {
  handle: string
  displayName: string
}

export interface ExtractedArticle {
  displayName: string
  handle: string
  date: string
  title: string
  blocks: Block[]
  url: string
  isArticle: boolean
}

export interface ExtractError {
  error: string
}

export type ExtractionResult = ExtractedArticle | ExtractError

export interface MarkdownInput {
  handle: string
  url: string
  date: string
  title?: string
  blocks?: Block[]
}

export function extractTwitterData(): ExtractionResult {
  const article = document.querySelector('article')
  if (!article) return { error: 'No article found on this page' }

  const bodyEl =
    article.querySelector('[data-testid="twitterArticleRichTextView"]') ||
    article.querySelector('.x-article-body') ||
    null

  const author = findAuthor(article, bodyEl)
  if (!author) return { error: 'Could not find author info' }

  const timeEl = article.querySelector('time')
  const metaDate = article.querySelector('meta[itemprop="datePublished"]')
  const datetime = timeEl ? timeEl.getAttribute('datetime') : metaDate ? metaDate.getAttribute('content') : ''
  const date = datetime ? String(datetime).split('T')[0] : ''
  const baseUrl = window.location.href

  const titleWrap = article.querySelector('[data-testid="twitter-article-title"]')
  const titleEl =
    (titleWrap && titleWrap.querySelector('span')) ||
    titleWrap ||
    article.querySelector('h1') ||
    null
  const title = bodyEl && titleEl ? (titleEl.textContent || '').trim() : ''

  const blocks: Block[] = []

  if (bodyEl) {
    walk(bodyEl, blocks)
    const cover = pickCoverImage(article, bodyEl)
    if (cover) blocks.unshift({ type: 'image', src: cover.src, alt: cover.alt })
  } else {
    walk(article, blocks)
  }

  return {
    displayName: author.displayName,
    handle: author.handle,
    date: date,
    title: title,
    blocks: blocks,
    url: baseUrl,
    isArticle: !!bodyEl,
  }

  function findAuthor(article: Element, bodyEl: Element | null): Author | null {
    const section = article.querySelector('[data-testid="User-Name"]')
    if (section) {
      const spans = section.querySelectorAll('span')
      for (let i = 0; i < spans.length; i++) {
        const t = (spans[i].textContent || '').trim()
        if (/^@[A-Za-z0-9_]+$/.test(t)) {
          return { handle: t, displayName: sectionDisplayName(section, t) }
        }
      }
      const links = section.querySelectorAll('a')
      for (let k = links.length - 1; k >= 0; k--) {
        const handleText = (links[k].textContent || '').trim()
        if (/^@[A-Za-z0-9_]+$/.test(handleText)) {
          return { handle: handleText, displayName: sectionDisplayName(section, handleText) }
        }
      }
    }
    const schema = article.querySelector('[itemprop="author"]')
    if (schema) {
      const schemaHandle = schema.querySelector('meta[itemprop="alternateName"]')
      const schemaName = schema.querySelector('meta[itemprop="name"]')
      if (schemaHandle) {
        const sh = (schemaHandle.getAttribute('content') || '').trim()
        if (/^[A-Za-z0-9_]+$/.test(sh)) {
          return {
            handle: '@' + sh,
            displayName: (schemaName && schemaName.getAttribute('content') || '').trim(),
          }
        }
      }
    }
    const all = article.querySelectorAll('a')
    for (let j = 0; j < all.length; j++) {
      const a = all[j]
      if (bodyEl && bodyEl.contains(a)) continue
      const at = (a.textContent || '').trim()
      const href = a.getAttribute('href') || ''
      if (!/^@[A-Za-z0-9_]+$/.test(at)) continue
      if (isProfileLink(href)) return { handle: at, displayName: '' }
    }
    return null
  }

  function sectionDisplayName(section: Element, exclude: string): string {
    const links = section.querySelectorAll('a')
    for (let i = 0; i < links.length; i++) {
      const t = (links[i].textContent || '').trim()
      if (t && t !== exclude) return t
    }
    const spans = section.querySelectorAll('span')
    for (let j = 0; j < spans.length; j++) {
      const st = (spans[j].textContent || '').trim()
      if (st && st !== exclude) return st
    }
    return ''
  }

  function isProfileLink(href: string): boolean {
    const path = href.replace(/^https?:\/\/[^/]+\/?/, '/')
    if (!/^\/[^\/]/.test(path)) return false
    if (/\/status\//.test(path)) return false
    if (/^\/i\//.test(path)) return false
    if (/hashtag/.test(path)) return false
    return true
  }

  function pickCoverImage(article: Element, bodyEl: Element): { src: string; alt: string } | null {
    const exact = article.querySelector('img[alt="Article cover image"]')
    if (exact && imageUrl(exact)) return { src: exact.getAttribute('src')!, alt: exact.getAttribute('alt') || '' }
    const imgs = article.querySelectorAll('img')
    for (let i = 0; i < imgs.length; i++) {
      const img = imgs[i]
      if (bodyEl.contains(img)) continue
      if (imageUrl(img)) {
        return { src: img.getAttribute('src')!, alt: img.getAttribute('alt') || '' }
      }
    }
    return null
  }

  function walk(root: Element, out: Block[]) {
    for (let i = 0; i < root.childNodes.length; i++) {
      const node = root.childNodes[i]

      if (node.nodeType === 3) {
        const txt = node.textContent!.replace(/\s+/g, ' ').trim()
        if (txt) out.push({ type: 'text', value: txt })
        continue
      }

      if (node.nodeType !== 1) continue
      const el = node as Element
      if (isNoise(el)) continue
      const tag = (el.tagName || '').toLowerCase()

      if (tag === 'time') continue

      if (tag === 'img') {
        if (imageUrl(el)) out.push(makeImage(el))
        continue
      }

      if (tag === 'a' && el.querySelector('img')) {
        const img = el.querySelector('img')!
        if (imageUrl(img)) out.push(makeImage(img))
        continue
      }

      if (tag === 'h1' || tag === 'h2' || tag === 'h3' ||
          tag === 'h4' || tag === 'h5' || tag === 'h6') {
        const hVal = inline(el).trim()
        if (hVal) out.push({ type: 'heading', level: parseInt(tag[1], 10), value: hVal })
        continue
      }

      if (tag === 'pre') {
        extractCode(el, out)
        continue
      }

      if (tag === 'div' && el.getAttribute('data-testid') === 'markdown-code-block') {
        extractCode(el, out)
        continue
      }

      if (tag === 'p') {
        const pVal = inline(el).trim()
        if (pVal) out.push({ type: 'text', value: pVal })
        continue
      }

      if (tag === 'ul' || tag === 'ol') {
        const list: ListBlock = { type: 'list', ordered: tag === 'ol', items: [] }
        const items = el.children
        for (let j = 0; j < items.length; j++) {
          const li = items[j]
          if ((li.tagName || '').toLowerCase() !== 'li' || isNoise(li)) continue
          const itemBlocks: Block[] = []
          walk(li, itemBlocks)
          list.items.push(itemBlocks)
        }
        if (list.items.length) out.push(list)
        continue
      }

      if (tag === 'blockquote') {
        const quoteBlocks: Block[] = []
        walk(el, quoteBlocks)
        if (quoteBlocks.length) out.push({ type: 'blockquote', blocks: quoteBlocks })
        continue
      }

      if (hasBlockContent(el)) {
        walk(el, out)
        continue
      }

      if (isFigure(el)) {
        walk(el, out)
        continue
      }

      const leafValue = inline(el).trim()
      if (leafValue) out.push({ type: 'text', value: leafValue })
    }
  }

  function hasBlockContent(el: Element): boolean {
    return !!el.querySelector('p, h1, h2, h3, h4, h5, h6, ul, ol, li, blockquote, pre, table')
  }

  function isFigure(el: Element): boolean {
    if (el.textContent!.replace(/\s+/g, '') !== '') return false
    const imgs = el.querySelectorAll('img')
    for (let i = 0; i < imgs.length; i++) {
      if (imageUrl(imgs[i])) return true
    }
    return false
  }

  function extractCode(el: Element, out: Block[]) {
    const codeEl = el.querySelector('pre code') || el.querySelector('code') || el
    const cVal = (codeEl.textContent || '').trim()
    if (!cVal) return
    out.push({ type: 'code', value: cVal, lang: codeLang(el, codeEl) })
  }

  function codeLang(blockEl: Element, codeEl: Element): string {
    const sources = [codeEl, blockEl]
    for (let i = 0; i < sources.length; i++) {
      const s = sources[i]
      const attr = s.getAttribute('data-language') || s.getAttribute('data-lang')
      if (attr) return attr
      const m = /(?:^|\s)lang(?:uage)?-([A-Za-z0-9_+#-]+)/.exec(s.getAttribute('class') || '')
      if (m) return m[1]
    }
    if (blockEl.getAttribute('data-testid') === 'markdown-code-block') {
      const spans = blockEl.querySelectorAll('span')
      for (let j = 0; j < spans.length; j++) {
        const t = (spans[j].textContent || '').trim()
        if (!t || t.length > 20) continue
        if (codeEl.contains(spans[j])) continue
        return t
      }
    }
    return ''
  }

  function isNoise(el: Element): boolean {
    const tag = (el.tagName || '').toLowerCase()
    const role = el.getAttribute('role') || ''
    const aria = el.getAttribute('aria-hidden')
    const testid = el.getAttribute('data-testid') || ''
    if (tag === 'button' || tag === 'nav' || tag === 'script' ||
        tag === 'style' || tag === 'svg' || tag === 'path' ||
        tag === 'meta' || tag === 'iframe') return true
    if (role === 'button') return true
    if (aria === 'true') return true
    if (testid === 'sidebarColumn' || testid === 'User-Name') return true
    return false
  }

  function imageUrl(el: Element): boolean {
    const src = el.getAttribute('src') || ''
    if (!src || src.indexOf('http') !== 0) return false
    if (src.indexOf('profile_images') !== -1) return false
    if (src.indexOf('abs.twimg.com/emoji') !== -1) return false
    return true
  }

  function makeImage(el: Element): ImageBlock {
    return { type: 'image', src: el.getAttribute('src')!, alt: el.getAttribute('alt') || '' }
  }

  function inline(root: Element): string {
    const parts: string[] = []
    for (let i = 0; i < root.childNodes.length; i++) {
      const node = root.childNodes[i]

      if (node.nodeType === 3) {
        const raw = node.textContent!.replace(/\r\n?/g, '\n')
        if (/^\s*$/.test(raw)) {
          if (raw) parts.push(' ')
        } else if (raw) {
          parts.push(raw)
        }
        continue
      }

      if (node.nodeType !== 1) continue
      const el = node as Element
      if (isNoise(el)) continue
      const tag = (el.tagName || '').toLowerCase()

      if (tag === 'br') { parts.push('\n'); continue }
      if (tag === 'strong' || tag === 'b') { parts.push('**' + inline(el) + '**'); continue }
      if (tag === 'em' || tag === 'i') { parts.push('*' + inline(el) + '*'); continue }
      if (tag === 'del' || tag === 's' || tag === 'strike') { parts.push('~~' + inline(el) + '~~'); continue }
      if (tag === 'code') { parts.push('`' + (el.textContent || '') + '`'); continue }
      if (tag === 'a') { parts.push(link(el)); continue }
      if (tag === 'img') {
        if (imageUrl(el)) parts.push(imgHtml(el))
        continue
      }

      parts.push(inlineStyled(el))
    }
    return parts.join('')
  }

  function inlineStyled(el: Element): string {
    let inner = inline(el)
    const s = el.getAttribute('style') || ''
    const color = /color:\s*([^;]+)/.exec(s)
    const fontWeight = /font-weight\s*:\s*([^;]+)/i.exec(s)
    const fontStyle = /font-style\s*:\s*([^;]+)/i.exec(s)
    const strike = /text-decoration[^;]*line-through/i.test(s)
    if (color) inner = '<span style="color: ' + color[1].trim() + ';">' + inner + '</span>'
    if (fontWeight && /(bold)|[6-9]00/.test(fontWeight[1].trim())) inner = '**' + inner + '**'
    if (fontStyle && /italic|oblique/.test(fontStyle[1].trim())) inner = '*' + inner + '*'
    if (strike) inner = '~~' + inner + '~~'
    return inner
  }

  function imgHtml(el: Element): string {
    const esc = function (s: string) { return s.replace(/"/g, '&quot;') }
    const src = el.getAttribute('src') || ''
    const alt = el.getAttribute('alt') || ''
    let tag = '<img src="' + esc(src) + '"'
    if (alt) tag += ' alt="' + esc(alt) + '"'
    return tag + '>'
  }

  function link(el: Element): string {
    const href = el.getAttribute('href') || ''
    const img = el.querySelector('img')
    if (img && imageUrl(img)) return imgHtml(img)
    const text = inline(el).trim()
    if (!text) return ''
    if (!href || href.indexOf('javascript:') === 0) return text
    if (href.indexOf('t.co/') !== -1) return text
    if (href.indexOf('/status/') !== -1) return text
    if (href.indexOf('onboarding') !== -1) return text
    if (href.indexOf('sign') !== -1) return text
    return '[' + text + '](' + absoluteUrl(href) + ')'
  }

  function absoluteUrl(href: string): string {
    if (/^https?:\/\//i.test(href)) return href
    if (href.indexOf('//') === 0) return 'https:' + href
    if (href.charAt(0) === '/') {
      const m = baseUrl.match(/^https?:\/\/[^/]+/)
      return m ? m[0] + href : href
    }
    return href
  }
}

export function buildMarkdown(data: MarkdownInput): string {
  const handleRaw = data.handle.replace('@', '')
  const handleDisplay = data.handle.indexOf('@') === 0 ? data.handle : '@' + data.handle

  let md = '---\n'
  md += 'source: ' + data.url + '\n'
  md += 'author:\n'
  md += '  - "[' + handleDisplay + '](https://x.com/' + handleRaw + ')"\n'
  md += 'date: ' + data.date + '\n'
  if (data.title) md += 'article-title: "' + String(data.title).replace(/"/g, '\\"') + '"\n'
  md += '---\n\n'

  md += blocksToString(data.blocks || [])

  return md.trim() + '\n'

  function blocksToString(blocks: Block[], level?: number): string {
    const parts: string[] = []
    for (let i = 0; i < blocks.length; i++) {
      const s = blockToString(blocks[i], level || 0)
      if (s) parts.push(s)
    }
    return parts.join('\n\n')
  }

  function blockToString(block: Block, level: number): string {
    if (block.type === 'text') {
      return block.value.replace(/\n/g, '  \n')
    }
    if (block.type === 'heading') {
      let prefix = ''
      for (let i = 0; i < block.level; i++) prefix += '#'
      return prefix + ' ' + block.value
    }
    if (block.type === 'code') {
      const fence = block.lang ? '```' + block.lang : '```'
      return fence + '\n' + block.value + '\n```'
    }
    if (block.type === 'image') {
      const esc = function (s: string) { return s.replace(/"/g, '&quot;') }
      let tag = '<img src="' + esc(block.src) + '"'
      if (block.alt) tag += ' alt="' + esc(block.alt) + '"'
      return tag + '>'
    }
    if (block.type === 'list') {
      return listToString(block, level)
    }
    if (block.type === 'blockquote') {
      const inner = blocksToString(block.blocks, level)
      return '> ' + inner.split('\n').join('\n> ')
    }
    return ''
  }

  function listToString(list: ListBlock, level: number): string {
    const pad = '  '.repeat(level)
    const lines: string[] = []
    for (let i = 0; i < list.items.length; i++) {
      const inner = blocksToString(list.items[i], level + 1)
      const itemLines = inner === '' ? [''] : inner.split('\n')
      const mark = pad + (list.ordered ? (i + 1) + '. ' : '- ')
      lines.push(mark + itemLines[0])
      const cont = pad + '  '
      for (let j = 1; j < itemLines.length; j++) {
        lines.push(cont + itemLines[j])
      }
    }
    return lines.join('\n')
  }
}

export function generateFilename(data: Partial<ExtractedArticle>): string {
  let title = data.title || ''
  if (!title && data.blocks && data.blocks.length > 0) {
    for (let i = 0; i < data.blocks.length; i++) {
      const block = data.blocks[i]
      if (block.type === 'text' || block.type === 'heading') {
        title = block.value
        break
      }
    }
  }

  const clean = function (s: string) {
    return s
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[*#`~]|^\s*>/g, '')
      .replace(/[<>:"/\\|?*#^\[\]\x00-\x1f]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-. ]+|[-. ]+$/g, '')
      .trim()
  }

  let titlePart = clean(title)
  if (!titlePart) titlePart = 'x-article'

  const username = (data.handle || '').replace(/^@/, '')
  const usernamePart = clean(username)

  const name = usernamePart ? titlePart + ' - ' + usernamePart : titlePart
  return name.substring(0, 120)
}