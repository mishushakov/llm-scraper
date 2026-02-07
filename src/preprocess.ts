import { type Page } from 'playwright'
import Turndown from 'turndown'

import cleanup from './cleanup.js'

export type PreProcessOptions =
  | {
      format?: 'html' | 'text' | 'markdown' | 'raw_html'
    }
  | {
      format: 'custom'
      formatFunction: (page: Page) => Promise<string> | string
    }
  | {
      format: 'image'
      fullPage?: boolean
    }

export type PreProcessResult = {
  url: string
  content: string
  format: PreProcessOptions['format']
}

export async function preprocess(
  page: Page,
  options: PreProcessOptions = { format: 'html' }
): Promise<PreProcessResult> {
  const url = page.url()
  const format = options.format ?? 'html'
  let content

  if (format === 'raw_html') {
    content = await page.content()
  }

  if (format === 'markdown') {
    const body = await page.innerHTML('body')
    content = new Turndown().turndown(body)
  }

  if (format === 'text') {
    const readable = await page.evaluate(async () => {
      const readability = await import(
        // @ts-ignore
        'https://cdn.skypack.dev/@mozilla/readability'
      )

      return new readability.Readability(document).parse()
    })

    content = `Page Title: ${readable.title}\n${readable.textContent}`
  }

  if (format === 'html') {
    await page.evaluate(cleanup)
    content = await page.content()
  }

  if (format === 'image') {
    const image = await page.screenshot({
      fullPage: 'fullPage' in options ? options.fullPage : undefined,
    })
    content = image.toString('base64')
  }

  if (format === 'custom') {
    if (
      !('formatFunction' in options) ||
      typeof options.formatFunction !== 'function'
    ) {
      throw new Error('customPreprocessor must be provided in custom mode')
    }

    content = await options.formatFunction(page)
  }

  return {
    url,
    content,
    format,
  }
}
