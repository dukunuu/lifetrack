import { For, Show } from 'solid-js';

type MarkdownProps = {
  content: string;
};

type Token =
  | { type: 'text'; text: string }
  | { type: 'link'; text: string; url: string }
  | { type: 'code'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'italic'; text: string };

const tokenRegex = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]]+\]\([^)]+\))/g;

const sanitizeUrl = (url: string) => {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return null;
};

const parseInline = (input: string): Token[] => {
  const tokens: Token[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null = tokenRegex.exec(input);

  while (match !== null) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      tokens.push({ type: 'text', text: input.slice(lastIndex, index) });
    }

    const raw = match[0];
    if (raw.startsWith('**')) {
      tokens.push({ type: 'bold', text: raw.slice(2, -2) });
    } else if (raw.startsWith('*')) {
      tokens.push({ type: 'italic', text: raw.slice(1, -1) });
    } else if (raw.startsWith('`')) {
      tokens.push({ type: 'code', text: raw.slice(1, -1) });
    } else if (raw.startsWith('[')) {
      const linkMatch = raw.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        tokens.push({ type: 'link', text: linkMatch[1], url: linkMatch[2] });
      } else {
        tokens.push({ type: 'text', text: raw });
      }
    } else {
      tokens.push({ type: 'text', text: raw });
    }

    lastIndex = index + raw.length;
    match = tokenRegex.exec(input);
  }

  if (lastIndex < input.length) {
    tokens.push({ type: 'text', text: input.slice(lastIndex) });
  }

  return tokens;
};

const renderToken = (token: Token) => {
  switch (token.type) {
    case 'bold':
      return <strong>{token.text}</strong>;
    case 'italic':
      return <em>{token.text}</em>;
    case 'code':
      return <code class="bg-base-300/60 rounded px-1 py-0.5 text-[12px]">{token.text}</code>;
    case 'link': {
      const url = sanitizeUrl(token.url);
      if (!url) {
        return <span>{token.text}</span>;
      }
      return (
        <a
          href={url}
          class="text-primary underline decoration-dotted underline-offset-2"
          target="_blank"
          rel="noreferrer"
        >
          {token.text}
        </a>
      );
    }
    default:
      return <span>{token.text}</span>;
  }
};

export default function Markdown(props: MarkdownProps) {
  const lines = () => props.content.split('\n');

  return (
    <span class="whitespace-pre-wrap">
      <For each={lines()}>
        {(line, index) => (
          <>
            <For each={parseInline(line)}>{(token) => renderToken(token)}</For>
            <Show when={index() < lines().length - 1}>
              <br />
            </Show>
          </>
        )}
      </For>
    </span>
  );
}
