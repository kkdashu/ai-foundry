/**
 * AsyncQueue - A queue that supports async/await operations
 * Consumers can await for items, producers can add items asynchronously
 */
export class AsyncQueue<T> {
  private items: T[] = [];
  private resolvers: Array<(value: T | null) => void> = [];
  private closed = false;

  /**
   * Add an item to the queue
   * If there are waiting consumers, immediately resolve one
   */
  async enqueue(item: T): Promise<void> {
    if (this.closed) {
      throw new Error("Cannot enqueue to a closed queue");
    }

    const resolver = this.resolvers.shift();
    if (resolver) {
      // There's a waiting consumer, give them the item immediately
      resolver(item);
    } else {
      // No waiting consumers, store the item
      this.items.push(item);
    }
  }

  /**
   * Get an item from the queue
   * If no items available, wait for one
   * Returns null if queue is closed
   */
  async dequeue(): Promise<T | null> {
    if (this.items.length > 0) {
      return this.items.shift()!;
    }

    if (this.closed) {
      return null;
    }

    // No items available, wait for one
    return new Promise<T | null>((resolve) => {
      this.resolvers.push(resolve);
    });
  }

  /**
   * Close the queue
   * All waiting consumers will receive null
   */
  close(): void {
    this.closed = true;
    // Resolve all waiting consumers with null
    while (this.resolvers.length > 0) {
      const resolver = this.resolvers.shift();
      if (resolver) resolver(null);
    }
  }

  /**
   * Check if queue is closed
   */
  isClosed(): boolean {
    return this.closed;
  }

  /**
   * Get the current size of the queue
   */
  size(): number {
    return this.items.length;
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.items.length === 0;
  }

  /**
   * Get number of waiting consumers
   */
  waitingConsumers(): number {
    return this.resolvers.length;
  }

  /**
   * Clear all items from the queue
   */
  clear(): void {
    this.items = [];
  }

  /**
   * Convert queue to async iterable
   */
  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    while (true) {
      const item = await this.dequeue();
      if (item === null) break;
      yield item;
    }
  }
}
