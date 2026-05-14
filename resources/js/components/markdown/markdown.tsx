import { cn } from '@/lib/utils';
import { useMemo, type ReactNode } from 'react';
import { code as codeHighlighterPlugin } from '@streamdown/code';
import { CodeBlock as StreamdownCodeBlock, Streamdown, type Components } from 'streamdown';

export { CodeBlock } from 'streamdown';

const STREAMDOWN_PLUGINS = { code: codeHighlighterPlugin };

const STREAMDOWN_ALLOWED_TAGS = {
    div: ['style', 'class'],
    span: ['style', 'class'],
    p: ['style', 'class'],
    br: [],
    hr: [],
    img: ['src', 'alt', 'title', 'width', 'height', 'style'],
    table: ['style', 'class'],
    thead: ['style'],
    tbody: ['style'],
    tr: ['style'],
    th: ['style', 'colspan', 'rowspan'],
    td: ['style', 'colspan', 'rowspan'],
    ul: ['style'],
    ol: ['style', 'start'],
    li: ['style'],
    strong: [],
    em: [],
    b: [],
    i: [],
    u: [],
    small: [],
    mark: [],
    sub: [],
    sup: [],
    h1: ['style', 'class'],
    h2: ['style', 'class'],
    h3: ['style', 'class'],
    h4: ['style', 'class'],
    h5: ['style', 'class'],
    h6: ['style', 'class'],
    blockquote: ['style'],
    details: [],
    summary: [],
    section: ['style', 'class'],
    article: ['style', 'class'],
    header: ['style', 'class'],
    footer: ['style', 'class'],
    main: ['style', 'class'],
    aside: ['style', 'class'],
    figure: ['style'],
    figcaption: ['style'],
};

/**
 * Renderer for a custom fenced-code language. Return `null` or `undefined` to
 * fall through to Streamdown's default code block (useful for languages like
 * `json` that double as both data and source code — render a chart if the
 * payload parses as one, otherwise show it as JSON).
 */
export type CustomFenceRenderer = (code: string, language: string) => ReactNode | null;

interface MarkdownProps {
    children: string;
    className?: string;
    /**
     * Custom renderers keyed by fenced-code language. When a fence's language
     * matches a key, the matching renderer is used instead of the default
     * Streamdown code block. Use this for product-specific blocks like
     * ```chart, ```report, etc. Anything not listed falls through to
     * Streamdown's Shiki-highlighted code block.
     */
    customFences?: Record<string, CustomFenceRenderer>;
    /** Merged on top of the wrapper's defaults. */
    components?: Components;
    /**
     * Streamdown setting. Defaults to "streaming" so unterminated bold / tables
     * / fences don't flicker mid-stream. Set "static" once content is complete.
     */
    mode?: 'static' | 'streaming';
    /** Hide Shiki line numbers (default Streamdown shows them). */
    lineNumbers?: boolean;
}

export function Markdown({
    children,
    className,
    customFences,
    components: userComponents,
    mode = 'streaming',
    lineNumbers = false,
}: MarkdownProps) {
    const components = useMemo<Components>(() => {
        const merged: Components = { ...userComponents };

        if (customFences) {
            merged.code = ({ className: codeClass, children: codeChildren, ...rest }) => {
                const match = /language-([\w-]+)/.exec(codeClass || '');
                const language = match?.[1] || '';
                if (!language) {
                    return (
                        <code className={codeClass} {...rest}>
                            {codeChildren}
                        </code>
                    );
                }
                const codeString = String(codeChildren).replace(/\n$/, '');
                if (language in customFences) {
                    const result = customFences[language](codeString, language);
                    if (result != null) return <>{result}</>;
                }
                return <StreamdownCodeBlock code={codeString} language={language} />;
            };
        }

        return merged;
    }, [customFences, userComponents]);

    return (
        <Streamdown
            mode={mode}
            lineNumbers={lineNumbers}
            components={components}
            plugins={STREAMDOWN_PLUGINS}
            allowedTags={STREAMDOWN_ALLOWED_TAGS}
            className={cn('text-sm leading-relaxed', className)}
        >
            {children}
        </Streamdown>
    );
}

export default Markdown;
