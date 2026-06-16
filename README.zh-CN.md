# LLM Scraper

<img width="1800" alt="Screenshot 2024-04-20 at 23 11 16" src="https://github.com/mishushakov/llm-scraper/assets/10400064/ab00e048-a9ff-43b6-81d5-2e58090e2e65">

LLM Scraper 是一个 TypeScript 库，允许您使用 LLM 从**任何**网页中提取结构化数据。

<div align="center"><strong><a href="./README.md">English</a> | <a href="./README.zh-CN.md">简体中文</a></strong></div>

> [!IMPORTANT]
> **LLM Scraper 已更新至 2.0 版本。**
>
> **新版本支持 **Vercel AI SDK 6** 并更新了示例。**

### 特性

- 支持 GPT、Sonnet、Gemini、Llama、Qwen 系列模型
- 使用 Zod 或 JSON Schema 定义模式
- TypeScript 实现的全类型安全
- 基于 Playwright 框架
- 流式对象
- [Code-generation](#code-generation)
- 支持 6 种格式化模式：
  - `html` 用于加载预处理过的 HTML
  - `raw_html` 用于加载原始 HTML (无处理)
  - `markdown` 用于加载 Markdown
  - `text` 用于加载提取的文本 (使用 [Readability.js](https://github.com/mozilla/readability))
  - `image` 用于加载屏幕截图 (仅限多模态)
  - `custom` 用于加载自定义内容 (使用自定义函数)

**请给它一个Star！**

<img width="165" alt="Screenshot 2024-04-20 at 22 13 32" src="https://github.com/mishushakov/llm-scraper/assets/10400064/11e2a79f-a835-48c4-9f85-5c104ca7bb49">

## 快速入门

1. 通过 npm 安装所需的依赖项：

   ```
   npm i zod playwright llm-scraper
   ```

2. 初始化您的 LLM：

   **OpenAI**

   ```
   npm i @ai-sdk/openai
   ```

   ```js
   import { openai } from '@ai-sdk/openai'

   const llm = openai('gpt-4o')
   ```

   **Anthropic**

   ```
   npm i @ai-sdk/anthropic
   ```

   ```js
   import { anthropic } from '@ai-sdk/anthropic'

   const llm = anthropic('claude-3-5-sonnet-20240620')
   ```

   **Google**

   ```
   npm i @ai-sdk/google
   ```

   ```js
   import { google } from '@ai-sdk/google'

   const llm = google('gemini-1.5-flash')
   ```

   **Groq**

   ```
   npm i @ai-sdk/openai
   ```

   ```js
   import { createOpenAI } from '@ai-sdk/openai'
   const groq = createOpenAI({
     baseURL: 'https://api.groq.com/openai/v1',
     apiKey: process.env.GROQ_API_KEY,
   })

   const llm = groq('llama3-8b-8192')
   ```

   **Ollama**

   ```
   npm i ollama-ai-provider-v2
   ```

   ```js
   import { ollama } from 'ollama-ai-provider-v2'

   const llm = ollama('llama3')
   ```

3. 创建一个新的 scraper 实例并提供 llm：

   ```js
   import LLMScraper from 'llm-scraper'

   const scraper = new LLMScraper(llm)
   ```

## 示例

在此示例中，我们将从 HackerNews 提取头条新闻：

```ts
import { chromium } from 'playwright'
import { z } from 'zod'
import { Output } from 'ai'
import { openai } from '@ai-sdk/openai'
import LLMScraper from 'llm-scraper'

// 启动一个浏览器实例
const browser = await chromium.launch()

// 初始化 LLM 提供程序
const llm = openai('gpt-4o')

// 创建一个新的 LLMScraper
const scraper = new LLMScraper(llm)

// 打开新页面
const page = await browser.newPage()
await page.goto('https://news.ycombinator.com')

// 定义用于提取内容的模式
const schema = z.object({
  top: z
    .array(
      z.object({
        title: z.string(),
        points: z.number(),
        by: z.string(),
        commentsURL: z.string(),
      })
    )
    .length(5)
    .describe('Hacker News 上的前 5 个头条新闻'),
})

// 运行 scraper
const { data } = await scraper.run(page, Output.object({ schema }), {
  format: 'html',
})

// 显示来自 LLM 的结果
console.log(data.top)

await page.close()
await browser.close()
```

输出

```js
[
  {
    title: "Palette lighting tricks on the Nintendo 64",
    points: 105,
    by: "ibobev",
    commentsURL: "https://news.ycombinator.com/item?id=44014587",
  },
  {
    title: "Push Ifs Up and Fors Down",
    points: 187,
    by: "goranmoomin",
    commentsURL: "https://news.ycombinator.com/item?id=44013157",
  },
  {
    title: "JavaScript's New Superpower: Explicit Resource Management",
    points: 225,
    by: "olalonde",
    commentsURL: "https://news.ycombinator.com/item?id=44012227",
  },
  {
    title: ""We would be less confidential than Google" Proton threatens to quit Switzerland",
    points: 65,
    by: "taubek",
    commentsURL: "https://news.ycombinator.com/item?id=44014808",
  },
  {
    title: "OBNC – Oberon-07 Compiler",
    points: 37,
    by: "AlexeyBrin",
    commentsURL: "https://news.ycombinator.com/item?id=44013671",
  }
]
```

更多示例可以在 [examples](./examples) 文件夹中找到。

## 流式传输

将 `run` 函数替换为 `stream` 以获取部分对象流。

```ts
// 以流模式运行 scraper
const { stream } = await scraper.stream(page, Output.object({ schema }))

// 从 LLM 流式传输结果
for await (const data of stream) {
  console.log(data.top)
}
```

## 代码生成

借助 `generate` 函数，你可以生成可复用的 Playwright 脚本，该脚本能够按照预设的结构化规则（Schema）抓取内容。

```ts
// 生成代码并在页面上运行
const { code } = await scraper.generate(page, Output.object({ schema }))
const result = await page.evaluate(code)
const data = schema.parse(result)

// 显示解析后的结果
console.log(data.top)
```

## 贡献

作为一个开源项目，我们欢迎来自社区的贡献。如果您遇到任何错误或想要进行一些改进，请随时提出 issue 或 pull request。
