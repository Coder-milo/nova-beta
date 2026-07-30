declare module 'quill' {
  interface QuillOptions {
    theme?: string
    placeholder?: string
    modules?: Record<string, unknown>
    formats?: string[]
  }

  interface QuillRange {
    index: number
    length: number
  }

  class Quill {
    constructor(container: HTMLElement | string, options?: QuillOptions)
    clipboard: { dangerouslyPasteHTML(html: string): void }
    root: HTMLDivElement
    on(event: string, handler: (...args: unknown[]) => void): void
    getSemanticHTML(): string
    getLength(): number
    getSelection(focus?: boolean): QuillRange | null
    setSelection(index: number, length?: number): void
    insertEmbed(index: number, type: string, value: unknown, source?: string): void
    insertText(index: number, text: string, formats?: Record<string, unknown>, source?: string): void
    formatText(index: number, length: number, formats: Record<string, unknown>, source?: string): void
    getModule(name: string): { addHandler(format: string, handler: () => void): void } & Record<string, unknown>
    focus(): void
  }

  export default Quill
}

declare module 'quill/dist/quill.snow.css'
