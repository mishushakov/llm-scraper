import cheerio from 'cheerio';

function sanitizeElemAttributes(
  $: cheerio.Root,
  removeDataAttrs = true,
  removeUnderscoreAttrs = true,
  removeAngularAttrs = true,
  removeAlpineAttrs = true,
  removeXmlAttrs = true,
  removeGoogleAttrs = true,
  removeIdAttrs = true,
  uidKey = 'data-webtasks-id'
): void {
  $('*').each((_, elem) => {
    const attribs = (elem as cheerio.TagElement).attribs;
    const keysToRemove: string[] = [];

    Object.keys(attribs).forEach((key) => {
      if (removeUnderscoreAttrs && key.startsWith('_')) {
        keysToRemove.push(key);
      }
      if (removeAngularAttrs && key.startsWith('ng')) {
        keysToRemove.push(key);
      }
      if (removeAlpineAttrs && key.startsWith('x-')) {
        keysToRemove.push(key);
      }
      if (removeXmlAttrs && key.startsWith('xml')) {
        keysToRemove.push(key);
      }
      if (removeGoogleAttrs && key.startsWith('js')) {
        keysToRemove.push(key);
      }
      if (key === uidKey) {
        return;
      }
      if (removeDataAttrs && key.startsWith('data-')) {
        keysToRemove.push(key);
      }
      if (removeIdAttrs && key === 'id') {
        keysToRemove.push(key);
      }
    });

    keysToRemove.forEach((key) => {
      $(elem).removeAttr(key);
    });
  });
}

function removeHtmlComments($: cheerio.Root): void {
  $('*').contents().each((_, elem) => {
    if (elem.type === 'comment') {
      $(elem).remove();
    }
  });
}

function pruneTree($: cheerio.Root): void {
  const nodes = $('*').get().reverse();
  nodes.forEach((node) => {
    while (node) {
      const parent = node.parent;
      const hasDirectTextNode = $(node).contents().filter(function () {
        return this.type === 'text' && this.data.trim().length > 0;
      }).length > 0;

      if (!hasDirectTextNode) {
        $(node).removeAttr('class');
        $(node).children().each((_, child) => {
          $(parent).prepend($(child));
        });
        $(node).remove();
      }
      node = parent;
    }
  });

  $('script').remove();
  $('style').remove();
}

function getTreeReprSimple(
  $: cheerio.Root,
  keepHtmlBrackets = false,
  copy = true,
  postfix = '\nAbove are the pruned HTML contents of the page.'
): string | null {
  let tree: cheerio.Root;

  if (copy) {
    tree = cheerio.load($.html());
  } else {
    tree = $;
  }

  let treeRepr = tree.html();
  treeRepr = treeRepr.replace(/<text>(.*?)<\/text>/g, '$1');
  if (!keepHtmlBrackets) {
    treeRepr = treeRepr.replace(/\/>/g, '$/$>');
    treeRepr = treeRepr.replace(/<\/(.+?)>/g, ')');
    treeRepr = treeRepr.replace(/<(.+?)>/g, '($1');
    treeRepr = treeRepr.replace(/\$\/\$/, ')');
  }

  const htmlEscapeTable = [
    ['&quot;', '"'],
    ['&amp;', '&'],
    ['&lt;', '<'],
    ['&gt;', '>'],
    ['&nbsp;', ' '],
    ['&ndash;', '-'],
    ['&rsquo;', "'"],
    ['&lsquo;', "'"],
    ['&ldquo;', '"'],
    ['&rdquo;', '"'],
    ['&#39;', "'"],
    ['&#40;', '('],
    ['&#41;', ')'],
  ];

  htmlEscapeTable.forEach(([k, v]) => {
    treeRepr = treeRepr.replace(new RegExp(k, 'g'), v);
  });

  treeRepr = treeRepr.replace(/\s+/g, ' ').trim();
  treeRepr = treeRepr.replace(/\) +\)/g, '))');
  treeRepr = treeRepr.replace(/\( +\(/g, '((');

  if (postfix) {
    treeRepr += postfix;
  }
  return treeRepr;
}

const clean = (htmlString: string) => {
  const $ = cheerio.load(htmlString);
  pruneTree($);
  removeHtmlComments($);
  sanitizeElemAttributes($);
  return getTreeReprSimple($, true, false, '')
}

export {
  clean,
  getTreeReprSimple,
  pruneTree,
  removeHtmlComments,
  sanitizeElemAttributes
}