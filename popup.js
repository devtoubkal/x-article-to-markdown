;(async () => {
  const statusEl = document.getElementById('status')
  const hintEl = document.getElementById('hint')
  const downloadBlock = document.getElementById('downloadBlock')
  const downloadBtn = document.getElementById('download')
  const metaTitleEl = document.getElementById('meta-title')
  const metaAuthorEl = document.getElementById('meta-author')
  const metaDateEl = document.getElementById('meta-date')
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

  let host = ''
  try {
    host = new URL(tab.url).hostname
  } catch (e) {}

  if (!host.endsWith('x.com') && !host.endsWith('twitter.com')) {
    statusEl.textContent = 'Only works on X article pages'
    statusEl.className = 'error'
    hintEl.textContent = 'Open an X article page, then click again.'
    return
  }

  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractTwitterData,
    })

    if (!result || result.error) {
      statusEl.textContent = result?.error || 'Could not extract article'
      statusEl.className = 'error'
      return
    }

    if (!result.isArticle) {
      statusEl.textContent = "This page doesn't contain an X article"
      statusEl.className = 'error'
      hintEl.textContent = 'Open an article on X, then click again.'
      return
    }

    metaTitleEl.textContent = result.title || 'Untitled article'
    metaAuthorEl.textContent = [result.displayName, result.handle].filter(Boolean).join(' · ')
    metaDateEl.textContent = result.date || ''

    downloadBtn.addEventListener('click', () => {
      const md = buildMarkdown(result)
      const filename = generateFilename(result) + '.md'
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)

      statusEl.textContent = 'Downloaded ' + filename
      statusEl.className = 'success'
      hintEl.textContent = 'Markdown saved with YAML frontmatter.'
    })

    downloadBlock.hidden = false
    statusEl.textContent = 'Article found — ready to download'
    statusEl.className = 'success'
    hintEl.textContent = 'Choose a location for your markdown file.'
  } catch (err) {
    statusEl.textContent = err.message
    statusEl.className = 'error'
  }
})()