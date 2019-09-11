declare class Telegraf {
  constructor(token: string)
  telegram: Telegraf.Telegram
  webhookCallback: (
    path: string,
    option: {} | null,
    port: string | number
  ) => any
  use: (middleware: any) => void
  start: (callback: (context: Telegraf.Context) => Promise<void>) => void
  command: (
    command: string,
    callback: (context: Telegraf.Context) => Promise<void>
  ) => void
  action: (
    action: string,
    callback: (context: Telegraf.Context) => Promise<void>
  ) => void
  on: (
    event: 'message',
    callback: (context: Telegraf.Context) => Promise<any>
  ) => void
  help: (callback: (context: Telegraf.Context) => Promise<any>) => void
}

declare module Telegraf {
  interface Telegram {
    setWebhook: (url: string) => void
    sendMessage: (id: number, text: string) => Promise<Message>
  }

  interface Chat {
    id: number
    username?: string
    first_name: string
    last_name?: string
  }

  interface Message {
    message_id: number
    text: string
  }

  interface Scene {
    enter: (scene: string) => Promise<void>
    leave: () => Promise<void>
    reenter: () => Promise<void>
  }

  interface Context {
    webhookReply: boolean
    chat: Chat
    message: Message
    scene: Scene
    reply: (text: string, extra?: {}) => Promise<Message>
    replyWithMarkdown: (markdown: string, extra?: {}) => Promise<Message>
    deleteMessage: (message_id?: number) => Promise<void>
  }
}

declare module 'telegraf' {
  export = Telegraf
}

declare module 'telegraf/scenes/base'
declare module 'telegraf/markup'
declare module 'telegraf/stage'
