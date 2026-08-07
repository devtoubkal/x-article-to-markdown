function extractTwitterData() {
  var article = document.querySelector('article')
  if (!article) return { error: 'No article found on this page' }

  var bodyEl =
    article.querySelector('[data-testid="twitterArticleRichTextView"]') ||
    article.querySelector('.x-article-body') ||
    null

  var author = findAuthor(article, bodyEl)
  if (!author) return { error: 'Could not find author info' }

  var timeEl = article.querySelector('time')
  var metaDate = article.querySelector('meta[itemprop="datePublished"]')
  var datetime = timeEl ? timeEl.getAttribute('datetime') : metaDate ? metaDate.getAttribute('content') : ''
  var date = datetime ? String(datetime).split('T')[0] : ''
  var baseUrl = window.location.href

  var titleWrap = article.querySelector('[data-testid="twitter-article-title"]')
  var titleEl =
    (titleWrap && titleWrap.querySelector('span')) ||
    titleWrap ||
    article.querySelector('h1') ||
    null
  var title = bodyEl && titleEl ? (titleEl.textContent || '').trim() : ''

  var blocks = []

  if (bodyEl) {
    walk(bodyEl, blocks)
    var cover = pickCoverImage(article, bodyEl)
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

  function findAuthor(article, bodyEl) {
    var section = article.querySelector('[data-testid="User-Name"]')
    if (section) {
      var spans = section.querySelectorAll('span')
      for (var i = 0; i < spans.length; i++) {
        var t = (spans[i].textContent || '').trim()
        if (/^@[A-Za-z0-9_]+$/.test(t)) {
          return { handle: t, displayName: sectionDisplayName(section, t) }
        }
      }
      var links = section.querySelectorAll('a')
      for (var k = links.length - 1; k >= 0; k--) {
        var handleText = (links[k].textContent || '').trim()
        if (/^@[A-Za-z0-9_]+$/.test(handleText)) {
          return { handle: handleText, displayName: sectionDisplayName(section, handleText) }
        }
      }
    }
    var schema = article.querySelector('[itemprop="author"]')
    if (schema) {
      var schemaHandle = schema.querySelector('meta[itemprop="alternateName"]')
      var schemaName = schema.querySelector('meta[itemprop="name"]')
      if (schemaHandle) {
        var sh = (schemaHandle.getAttribute('content') || '').trim()
        if (/^[A-Za-z0-9_]+$/.test(sh)) {
          return {
            handle: '@' + sh,
            displayName: (schemaName && schemaName.getAttribute('content') || '').trim(),
          }
        }
      }
    }
    var all = article.querySelectorAll('a')
    for (var j = 0; j < all.length; j++) {
      var a = all[j]
      if (bodyEl && bodyEl.contains(a)) continue
      var at = (a.textContent || '').trim()
      var href = a.getAttribute('href') || ''
      if (!/^@[A-Za-z0-9_]+$/.test(at)) continue
      if (isProfileLink(href)) return { handle: at, displayName: '' }
    }
    return null
  }

  function sectionDisplayName(section, exclude) {
    var links = section.querySelectorAll('a')
    for (var i = 0; i < links.length; i++) {
      var t = (links[i].textContent || '').trim()
      if (t && t !== exclude) return t
    }
    var spans = section.querySelectorAll('span')
    for (var j = 0; j < spans.length; j++) {
      var st = (spans[j].textContent || '').trim()
      if (st && st !== exclude) return st
    }
    return ''
  }

  function isProfileLink(href) {
    var path = href.replace(/^https?:\/\/[^/]+\/?/, '/')
    if (!/^\/[^\/]/.test(path)) return false
    if (/\/status\//.test(path)) return false
    if (/^\/i\//.test(path)) return false
    if (/hashtag/.test(path)) return false
    return true
  }

  function pickCoverImage(article, bodyEl) {
    var exact = article.querySelector('img[alt="Article cover image"]')
    if (exact && imageUrl(exact)) return { src: exact.getAttribute('src'), alt: exact.getAttribute('alt') || '' }
    var imgs = article.querySelectorAll('img')
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i]
      if (bodyEl.contains(img)) continue
      if (imageUrl(img)) {
        return { src: img.getAttribute('src'), alt: img.getAttribute('alt') || '' }
      }
    }
    return null
  }

  function walk(root, out) {
    for (var i = 0; i < root.childNodes.length; i++) {
      var node = root.childNodes[i]

      if (node.nodeType === 3) {
        var txt = node.textContent.replace(/\s+/g, ' ').trim()
        if (txt) out.push({ type: 'text', value: txt })
        continue
      }

      if (node.nodeType !== 1) continue
      var el = node
      if (isNoise(el)) continue
      var tag = (el.tagName || '').toLowerCase()

      if (tag === 'time') continue

      if (tag === 'img') {
        if (imageUrl(el)) out.push(makeImage(el))
        continue
      }

      if (tag === 'a' && el.querySelector('img')) {
        var img = el.querySelector('img')
        if (imageUrl(img)) out.push(makeImage(img))
        continue
      }

      if (tag === 'h1' || tag === 'h2' || tag === 'h3' ||
          tag === 'h4' || tag === 'h5' || tag === 'h6') {
        var hVal = inline(el).trim()
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
        var pVal = inline(el).trim()
        if (pVal) out.push({ type: 'text', value: pVal })
        continue
      }

      if (tag === 'ul' || tag === 'ol') {
        var list = { type: 'list', ordered: tag === 'ol', items: [] }
        var items = el.children
        for (var j = 0; j < items.length; j++) {
          var li = items[j]
          if ((li.tagName || '').toLowerCase() !== 'li' || isNoise(li)) continue
          var itemBlocks = []
          walk(li, itemBlocks)
          list.items.push(itemBlocks)
        }
        if (list.items.length) out.push(list)
        continue
      }

      if (tag === 'blockquote') {
        var quoteBlocks = []
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

      var leafValue = inline(el).trim()
      if (leafValue) out.push({ type: 'text', value: leafValue })
    }
  }

  function hasBlockContent(el) {
    return !!el.querySelector('p, h1, h2, h3, h4, h5, h6, ul, ol, li, blockquote, pre, table')
  }

  function isFigure(el) {
    if (el.textContent.replace(/\s+/g, '') !== '') return false
    var imgs = el.querySelectorAll('img')
    for (var i = 0; i < imgs.length; i++) {
      if (imageUrl(imgs[i])) return true
    }
    return false
  }

  function extractCode(el, out) {
    var codeEl = el.querySelector('pre code') || el.querySelector('code') || el
    var cVal = (codeEl.textContent || '').trim()
    if (!cVal) return
    out.push({ type: 'code', value: cVal, lang: codeLang(el, codeEl) })
  }

  function codeLang(blockEl, codeEl) {
    var sources = [codeEl, blockEl]
    for (var i = 0; i < sources.length; i++) {
      var s = sources[i]
      var attr = s.getAttribute('data-language') || s.getAttribute('data-lang')
      if (attr) return attr
      var m = /(?:^|\s)lang(?:uage)?-([A-Za-z0-9_+#-]+)/.exec(s.getAttribute('class') || '')
      if (m) return m[1]
    }
    if (blockEl.getAttribute('data-testid') === 'markdown-code-block') {
      var spans = blockEl.querySelectorAll('span')
      for (var j = 0; j < spans.length; j++) {
        var t = (spans[j].textContent || '').trim()
        if (!t || t.length > 20) continue
        if (codeEl.contains(spans[j])) continue
        return t
      }
    }
    return ''
  }

  function isNoise(el) {
    var tag = (el.tagName || '').toLowerCase()
    var role = el.getAttribute('role') || ''
    var aria = el.getAttribute('aria-hidden')
    var testid = el.getAttribute('data-testid') || ''
    if (tag === 'button' || tag === 'nav' || tag === 'script' ||
        tag === 'style' || tag === 'svg' || tag === 'path' ||
        tag === 'meta' || tag === 'iframe') return true
    if (role === 'button') return true
    if (aria === 'true') return true
    if (testid === 'sidebarColumn' || testid === 'User-Name') return true
    return false
  }

  function imageUrl(el) {
    var src = el.getAttribute('src') || ''
    if (!src || src.indexOf('http') !== 0) return false
    if (src.indexOf('profile_images') !== -1) return false
    if (src.indexOf('abs.twimg.com/emoji') !== -1) return false
    return true
  }

  function makeImage(el) {
    return { type: 'image', src: el.getAttribute('src'), alt: el.getAttribute('alt') || '' }
  }

  function inline(root) {
    var parts = []
    for (var i = 0; i < root.childNodes.length; i++) {
      var node = root.childNodes[i]

      if (node.nodeType === 3) {
        var raw = node.textContent.replace(/\r\n?/g, '\n')
        if (/^\s*$/.test(raw)) {
          if (raw) parts.push(' ')
        } else if (raw) {
          parts.push(raw)
        }
        continue
      }

      if (node.nodeType !== 1) continue
      var el = node
      if (isNoise(el)) continue
      var tag = (el.tagName || '').toLowerCase()

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

  function inlineStyled(el) {
    var inner = inline(el)
    var s = el.getAttribute('style') || ''
    var color = /color:\s*([^;]+)/.exec(s)
    var fontWeight = /font-weight\s*:\s*([^;]+)/i.exec(s)
    var fontStyle = /font-style\s*:\s*([^;]+)/i.exec(s)
    var strike = /text-decoration[^;]*line-through/i.test(s)
    if (color) inner = '<span style="color: ' + color[1].trim() + ';">' + inner + '</span>'
    if (fontWeight && /(bold)|[6-9]00/.test(fontWeight[1].trim())) inner = '**' + inner + '**'
    if (fontStyle && /italic|oblique/.test(fontStyle[1].trim())) inner = '*' + inner + '*'
    if (strike) inner = '~~' + inner + '~~'
    return inner
  }

  function imgHtml(el) {
    var esc = function (s) { return s.replace(/"/g, '&quot;') }
    var src = el.getAttribute('src') || ''
    var alt = el.getAttribute('alt') || ''
    var tag = '<img src="' + esc(src) + '"'
    if (alt) tag += ' alt="' + esc(alt) + '"'
    return tag + '>'
  }

  function link(el) {
    var href = el.getAttribute('href') || ''
    var img = el.querySelector('img')
    if (img && imageUrl(img)) return imgHtml(img)
    var text = inline(el).trim()
    if (!text) return ''
    if (!href || href.indexOf('javascript:') === 0) return text
    if (href.indexOf('t.co/') !== -1) return text
    if (href.indexOf('/status/') !== -1) return text
    if (href.indexOf('onboarding') !== -1) return text
    if (href.indexOf('sign') !== -1) return text
    return '[' + text + '](' + absoluteUrl(href) + ')'
  }

  function absoluteUrl(href) {
    if (/^https?:\/\//i.test(href)) return href
    if (href.indexOf('//') === 0) return 'https:' + href
    if (href.charAt(0) === '/') {
      var m = baseUrl.match(/^https?:\/\/[^/]+/)
      return m ? m[0] + href : href
    }
    return href
  }
}

function buildMarkdown(data) {
  var handleRaw = data.handle.replace('@', '')
  var handleDisplay = data.handle.indexOf('@') === 0 ? data.handle : '@' + data.handle

  var md = '---\n'
  md += 'source: ' + data.url + '\n'
  md += 'author:\n'
  md += '  - "[' + handleDisplay + '](https://x.com/' + handleRaw + ')"\n'
  md += 'date: ' + data.date + '\n'
  if (data.title) md += 'article-title: "' + String(data.title).replace(/"/g, '\\"') + '"\n'
  md += '---\n\n'

  md += blocksToString(data.blocks || [])

  return md.trim() + '\n'

  function blocksToString(blocks, level) {
    var parts = []
    for (var i = 0; i < blocks.length; i++) {
      var s = blockToString(blocks[i], level || 0)
      if (s) parts.push(s)
    }
    return parts.join('\n\n')
  }

  function blockToString(block, level) {
    if (block.type === 'text') {
      return block.value.replace(/\n/g, '  \n')
    }
    if (block.type === 'heading') {
      var prefix = ''
      for (var i = 0; i < block.level; i++) prefix += '#'
      return prefix + ' ' + block.value
    }
    if (block.type === 'code') {
      var fence = block.lang ? '```' + block.lang : '```'
      return fence + '\n' + block.value + '\n```'
    }
    if (block.type === 'image') {
      var esc = function (s) { return s.replace(/"/g, '&quot;') }
      var tag = '<img src="' + esc(block.src) + '"'
      if (block.alt) tag += ' alt="' + esc(block.alt) + '"'
      return tag + '>'
    }
    if (block.type === 'list') {
      return listToString(block, level)
    }
    if (block.type === 'blockquote') {
      var inner = blocksToString(block.blocks, level)
      return '> ' + inner.split('\n').join('\n> ')
    }
    return ''
  }

  function listToString(list, level) {
    var pad = '  '.repeat(level)
    var lines = []
    for (var i = 0; i < list.items.length; i++) {
      var inner = blocksToString(list.items[i], level + 1)
      var itemLines = inner === '' ? [''] : inner.split('\n')
      var mark = pad + (list.ordered ? (i + 1) + '. ' : '- ')
      lines.push(mark + itemLines[0])
      var cont = pad + '  '
      for (var j = 1; j < itemLines.length; j++) {
        lines.push(cont + itemLines[j])
      }
    }
    return lines.join('\n')
  }
}

function generateFilename(data) {
  var title = data.title || ''
  if (!title && data.blocks && data.blocks.length > 0) {
    for (var i = 0; i < data.blocks.length; i++) {
      var block = data.blocks[i]
      if (block.type === 'text' || block.type === 'heading') {
        title = block.value
        break
      }
    }
  }

  var clean = function (s) {
    return s
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[*#`~]|^\s*>/g, '')
      .replace(/[<>:"/\\|?*#^\[\]\x00-\x1f]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-. ]+|[-. ]+$/g, '')
      .trim()
  }

  var titlePart = clean(title)
  if (!titlePart) titlePart = 'x-article'

  var username = (data.handle || '').replace(/^@/, '')
  var usernamePart = clean(username)

  var name = usernamePart ? titlePart + ' - ' + usernamePart : titlePart
  return name.substring(0, 120)
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { extractTwitterData, buildMarkdown, generateFilename }
}