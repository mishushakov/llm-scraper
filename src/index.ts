import { Browser } from 'playwright'
import OpenAI from 'openai'
import { Schema, z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

type ScraperLoadOptions = {
  mode: 'html' | 'text' | 'image'
  closeOnFinish?: boolean
}

type ScraperLoadResult = {
  url: string
  content: string
  mode: ScraperLoadOptions['mode']
}

type ScraperRunOptions = {
  schema: z.ZodSchema<any>
  model?: OpenAI.Chat.ChatModel
} & ScraperLoadOptions

export default class LLMScraper {
  constructor(private browser: Browser) {
    this.browser = browser
  }

  // Load pages in the browser
  private async load(
    url: string | string[],
    options: ScraperLoadOptions = { mode: 'html', closeOnFinish: true }
  ): Promise<ScraperLoadResult[]> {
    const context = await this.browser.newContext()
    const urls = Array.isArray(url) ? url : [url]

    const content = await Promise.all(
      urls.map(async (url) => {
        const page = await context.newPage()
        await page.goto(url)

        let content

        if (options.mode === 'html') {
          content = await page.content()
        }

        if (options.mode === 'text') {
          const readable = await page.evaluate(async () => {
            const readability = await import(
              // @ts-ignore
              'https://cdn.skypack.dev/@mozilla/readability'
            )

            return new readability.Readability(document).parse()
          })

          content = `${readable.title}\n${readable.textContent}`
        }

        if (options.mode === 'image') {
          const image = await page.screenshot()
          content = image.toString('base64')
        }

        await page.close()
        return {
          url,
          content,
          mode: options.mode,
        }
      })
    )

    await context.close()
    if (options.closeOnFinish) {
      await this.browser.close()
    }

    return content
  }

  // Prepare the pages for further processing
  private preparePages(
    pages: ScraperLoadResult[]
  ): OpenAI.Chat.Completions.ChatCompletionContentPart[] {
    return pages.map((page) => {
      if (page.mode === 'image') {
        return {
          type: 'image_url',
          image_url: { url: `data:image/jpeg;base64,${page.content}` },
        }
      }

      return { type: 'text', text: page.content }
    })
  }

  // Generate completion using OpenAI
  private async generateCompletion(
    model: OpenAI.Chat.ChatModel = 'gpt-4-turbo',
    schema: z.ZodSchema<any>,
    pages: ScraperLoadResult[]
  ): Promise<z.infer<typeof schema>> {
    const openai = new OpenAI()
    const content = this.preparePages(pages)
    const completion = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content }],
      functions: [
        {
          name: 'extract_content',
          description: 'Extracts the content from given pages',
          parameters: zodToJsonSchema(schema),
        },
      ],
      function_call: { name: 'extract_content' },
    })

    const c = completion.choices[0].message.function_call?.arguments
    return JSON.parse(c ? c : 'null')
  }

  // Load pages and generate completion
  async run(url: string | string[], options: ScraperRunOptions): Promise<z.infer<typeof options['schema']>> {
    const pages = await this.load(url, options)
    return await this.generateCompletion(options.model, options.schema, pages)
  }
}
