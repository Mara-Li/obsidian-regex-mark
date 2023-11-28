import { removeTags } from './cmPlugin'
import { SettingOption } from './setting'

export function MarkdownProcesser(data: SettingOption[], element: HTMLElement) {
  const paragraph = element.findAll('p')

  for (const p of paragraph) {
    let ignore = true
    console.log(p)
    for (const d of data) {
      if (!d.regex || !d.class || d.regex === '' || d.class === '')
        continue
      const regex = new RegExp(removeTags(d.regex), 'g')
      console.log(p.textContent)
      if (regex.test(p.textContent || '')) {
        console.log(p.textContent, 'not ignore')
        ignore = false
        break
      }
    }
    if (ignore)
      continue

    const treeWalker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT)
    const textNodes = []
    while (treeWalker.nextNode()) {
      textNodes.push(treeWalker.currentNode)
    }
    for (const node of textNodes) {
      let text = node.textContent
      if (text) {
        for (const d of data) {
          if (!d.regex || !d.class || d.regex === '' || d.class === '')
            continue
          const regex = new RegExp(removeTags(d.regex), 'g')
          if (!d.hide)
            text = text.replace(regex, `<span class="${d.class}" data-contents="$&">$&</span>`)
          else {
            const group = removeTags(d.regex).match(/\((.*?)\)/)
            if (!group)
              continue
            text = text.replace(regex, `<span class="${d.class}" data-contents="$1">$1</span>`)

          }
        }
        const span = document.createElement('span')
        span.innerHTML = text
        console.log(node)
        if (node.parentNode)
          node.parentNode.replaceChild(span, node)
      }
    }
  }
}