// Транспортная абстракция поверх PeerJS. Позволяет писать host/client logic
// независимо от того, реальный это WebRTC или in-memory mock.
//
// Реальная реализация — peerjs-transport.ts (создаётся при необходимости).
// Mock — in-memory-transport.ts для тестов.

export interface NetConnection {
  /** Peer-id противоположной стороны. */
  readonly remoteId: string
  send(data: unknown): void
  onData(handler: (data: unknown) => void): () => void
  onClose(handler: () => void): () => void
  close(): void
}

export interface HostTransport {
  /** Открыть peer-сервер. Возвращает свой id, когда готов. */
  open(): Promise<string>
  /** Подписаться на входящие подключения клиентов. */
  onConnection(handler: (conn: NetConnection) => void): () => void
  close(): void
}

export interface ClientTransport {
  /** Открыть peer + подключиться к host'у. Возвращает соединение когда готово. */
  connect(hostId: string): Promise<NetConnection>
  close(): void
}
