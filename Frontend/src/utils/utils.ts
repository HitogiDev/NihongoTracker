export function numberWithCommas(x: number | undefined) {
  if (x === undefined || x === null) return '';
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function convertBBCodeToHtml(text: string): string {
  return (
    text
      .replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '<strong>$1</strong>')
      .replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '<em>$1</em>')
      .replace(/\[u\]([\s\S]*?)\[\/u\]/gi, '<u>$1</u>')
      .replace(/\[s\]([\s\S]*?)\[\/s\]/gi, '<s>$1</s>')

      .replace(
        /\[url=([\s\S]*?)\]([\s\S]*?)\[\/url\]/gi,
        '<a href="$1" class="link" target="_blank" rel="noopener noreferrer">$2</a>'
      )
      .replace(
        /\[url\]([\s\S]*?)\[\/url\]/gi,
        '<a href="$1" class="link" target="_blank" rel="noopener noreferrer">$1</a>'
      )

      .replace(
        /\[img\]([\s\S]*?)\[\/img\]/gi,
        '<img src="$1" alt="" class="max-w-full" />'
      )

      // Spoilers - using details/summary for expandable content
      .replace(
        /\[spoiler\]([\s\S]*?)\[\/spoiler\]/gi,
        '<details class="collapse collapse-arrow border border-base-300 pt-1"><summary class="collapse-title text-sm font-medium">Spoiler</summary><div class="collapse-content">$1</div></details>'
      )

      .replace(
        /\[quote\]([\s\S]*?)\[\/quote\]/gi,
        '<blockquote class="border-l-4 border-base-300 pl-4 my-2">$1</blockquote>'
      )

      .replace(
        /\[code\]([\s\S]*?)\[\/code\]/gi,
        '<pre class="mockup-code p-2 my-2"><code>$1</code></pre>'
      )

      // List items (first convert [*] to temporary marker)
      .replace(/\[\*\]([\s\S]*?)(?=\[\*\]|\[\/list\]|$)/gi, '<li>$1</li>')

      // Lists (must come after list items)
      .replace(
        /\[list\]([\s\S]*?)\[\/list\]/gi,
        '<ul class="list-disc pl-6 my-2">$1</ul>'
      )

      .replace(/\n/g, '<br />')
  );
}
