import { Browser, BrowserContext } from 'playwright'
import Turndown from 'turndown'
import OpenAI from 'openai'
import { LlamaModel } from 'node-llama-cpp'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  ScraperCompletionResult,
  generateLlamaCompletions,
  generateOpenAICompletions,
} from './models.js'
import { existsSync, readFileSync } from 'fs'
import { parse } from 'node-html-parser';

export type ScraperLoadOptions = {
  mode?: 'html' | 'text' | 'markdown' | 'image'
  closeOnFinish?: boolean
}

export type ScraperLoadResult = {
  url: string
  content: string
  mode: ScraperLoadOptions['mode']
}

export type ScraperRunOptions<T extends z.ZodSchema<any>> = {
  schema: T
  model?: string
  prompt?: string
  temperature?: number
} & ScraperLoadOptions

export default class LLMScraper {
  private context: BrowserContext | null = null;

  constructor(private browser: Browser | null = null, private client: OpenAI | LlamaModel) {
    this.browser = browser
    this.client = client
  }

  private logger(text: string, ...args: any) {
    console.log(`\x1b[36m[${this.constructor.name}]\x1b[0m ${text}`, ...args);
  }

  // Load pages in the browser
  private async load(
    url: string | string[],
    options: ScraperLoadOptions = { mode: 'html' }
  ): Promise<Promise<ScraperLoadResult>[]> {
    if (!this.browser) throw new Error('`browser` parameter must be defined in new LLMScraper(...args) args to use web loader.');
    this.context = await this.browser.newContext()
    const urls = Array.isArray(url) ? url : [url]

    const pages = urls.map(async (url) => {
      const page = await this.context.newPage()
      await page.goto(url)

      let content

      if (options.mode === 'html') {
        content = await page.content()
      }

      if (options.mode === 'markdown') {
        const body = await page.innerHTML('body')
        content = new Turndown().turndown(body)
      }

      if (options.mode === 'text') {
        const readable = await page.evaluate(async () => {
          const readability = await import(
            // @ts-ignore
            'https://cdn.skypack.dev/@mozilla/readability'
          )

          return new readability.Readability(document).parse()
        })

        content = `Page Title: ${readable.title}\n${readable.textContent}`
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

    return pages
  }

  // Load files from relative local URLs as FS objects.
  private async loadFiles(
    filePaths: string | string[],
    options: ScraperLoadOptions = { mode: 'html' }
  ): Promise<Promise<ScraperLoadResult>[]> {
    const paths = Array.isArray(filePaths) ? filePaths : [filePaths]
    const pages = [];

    for (const filePath of paths) {
      if (!existsSync(filePath)) {
        this.logger(`${filePath} does not exist - skipping`);
        continue;
      };

      const htmlString = readFileSync(filePath, { encoding: 'utf-8' });
      if (!htmlString) {
        this.logger(`${filePath} content is empty - skipping`);
        continue;
      };

      const page = parse(htmlString);
      let content

      if (options.mode === 'html') {
        content = page.toString();
      }

      if (options.mode === 'markdown') {
        const body = page.querySelector('body').innerHTML;
        content = new Turndown().turndown(body)
      }

      if (options.mode === 'text') {
        const readability = await import(
          // @ts-ignore
          'https://cdn.skypack.dev/@mozilla/readability'
        )
        const readable = new readability.Readability(page.toString()).parse()

        content = `Page Title: ${readable.title}\n${readable.textContent}`
      }

      if (options.mode === 'image') {
        this.logger(`'image' mode for options is not supported for local files.`);
        continue;
      };

      pages.push({
        filePath,
        content,
        mode: options.mode,
      })
    }

    return pages
  }

  private async loadRawHTML(
    htmlString: string | string[],
    options: ScraperLoadOptions = { mode: 'html' }
  ): Promise<Promise<ScraperLoadResult>[]> {
    const roots = Array.isArray(htmlString) ? htmlString : [htmlString]
    const pages = [];

    for (const htmlRoot of roots) {
      if (!htmlRoot) {
        this.logger(`HTML content is empty - skipping`);
        continue;
      };

      const page = parse(htmlRoot);
      let content

      if (options.mode === 'html') {
        content = page.toString();
      }

      if (options.mode === 'markdown') {
        const body = page.querySelector('body').innerHTML;
        content = new Turndown().turndown(body)
      }

      if (options.mode === 'text') {
        const readability = await import(
          // @ts-ignore
          'https://cdn.skypack.dev/@mozilla/readability'
        )
        const readable = new readability.Readability(page.toString()).parse()

        content = `Page Title: ${readable.title}\n${readable.textContent}`
      }

      if (options.mode === 'image') {
        this.logger(`'image' mode for options is not supported for local files.`);
        continue;
      };

      pages.push({
        htmlRoot, // maybe don't want to return entire HTML string back?
        content,
        mode: options.mode,
      })
    }

    return pages
  }

  // Generate completion using OpenAI
  private generateCompletions<T extends z.ZodSchema<any>>(
    pages: Promise<ScraperLoadResult>[],
    options: ScraperRunOptions<T>
  ): Promise<ScraperCompletionResult<T>>[] {
    const schema = zodToJsonSchema(options.schema)
    const loader = pages.map(async (page, i) => {
      switch (this.client.constructor) {
        case OpenAI:
          return generateOpenAICompletions<T>(
            this.client as OpenAI,
            options.model,
            await page,
            schema,
            options?.prompt,
            options?.temperature
          )
        case LlamaModel:
          return generateLlamaCompletions<T>(
            this.client,
            await page,
            schema,
            options?.prompt,
            options?.temperature
          )
        default:
          throw new Error('Invalid client')
      }
    })

    Promise.all(loader).then(() => {
      if (options.closeOnFinish) {
        this.close()
      }
    })

    return loader
  }

  // TODO: Simplify this implementation
  // as each entry will need another function
  // and probably makes more sense to have one entry
  // and delegate to the proper function.
  // Load pages and generate completion
  async run<T extends z.ZodSchema<any>>(
    url: string | string[],
    options: ScraperRunOptions<T>
  ) {
    const pages = await this.load(url, options)
    return this.generateCompletions<T>(pages, options)
  }

  async runFiles<T extends z.ZodSchema<any>>(
    filePaths: string | string[],
    options: ScraperRunOptions<T>
  ) {
    const pages = await this.loadFiles(filePaths, options);
    return this.generateCompletions<T>(pages, options)
  }

  async rawHTML<T extends z.ZodSchema<any>>(
    htmlString: string | string[],
    options: ScraperRunOptions<T>
  ) {
    const pages = await this.loadRawHTML(htmlString, options);
    return this.generateCompletions<T>(pages, options)
  }

  // Close the current context and the browser
  async close() {
    await this.context?.close()
    await this.browser?.close()
  }
}
