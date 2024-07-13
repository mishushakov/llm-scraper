export default function cleanup() {
  const elementsToRemove = [
    'script',
    'style',
    'noscript',
    'iframe',
    'svg',
    'img',
    'audio',
    'video',
    'canvas',
    'map',
    'source',
    'dialog',
    'menu',
    'menuitem',
    'track',
    'object',
    'embed',
    'form',
    'input',
    'button',
    'select',
    'textarea',
    'label',
    'option',
    'optgroup',
    'aside',
    'footer',
    'header',
    'nav',
    'head',
  ]

  const attributesToRemove = [
    'style',
    'src',
    'alt',
    'title',
    'role',
    'aria-',
    'tabindex',
    'on',
    'data-',
  ]

  const elementTree = document.querySelectorAll('*')

  elementTree.forEach((element) => {
    if (elementsToRemove.includes(element.tagName.toLowerCase())) {
      element.remove()
    }

    Array.from(element.attributes).forEach((attr) => {
      if (attributesToRemove.some((a) => attr.name.startsWith(a))) {
        element.removeAttribute(attr.name)
      }
    })
  })
}
