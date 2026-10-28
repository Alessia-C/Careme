import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { broadcastRefresh, listenForRefresh } from './sessionChannel';

// Minimal in-memory BroadcastChannel: like the real one it delivers a message
// to the other instances with the same name, never to the sender.
class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  closed = false;

  constructor(public name: string) {
    FakeBroadcastChannel.instances.push(this);
  }

  postMessage(data: unknown) {
    FakeBroadcastChannel.instances
      .filter((other) => other !== this && other.name === this.name)
      .filter((other) => !other.closed)
      .forEach((other) => other.onmessage?.({ data }));
  }

  close() {
    this.closed = true;
  }
}

beforeEach(() => {
  FakeBroadcastChannel.instances = [];
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('broadcastRefresh / listenForRefresh', () => {
  it('tells a listener the new expiry', () => {
    const onRefresh = vi.fn();
    listenForRefresh(onRefresh);

    broadcastRefresh(1790000000);

    expect(onRefresh).toHaveBeenCalledWith(1790000000);
  });

  it('ignores messages that are not a number', () => {
    const onRefresh = vi.fn();
    listenForRefresh(onRefresh);
    const [listener] = FakeBroadcastChannel.instances;

    listener.onmessage?.({ data: 'soon' });
    listener.onmessage?.({ data: null });

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('stops listening and closes its channel when unsubscribed', () => {
    const onRefresh = vi.fn();
    const stop = listenForRefresh(onRefresh);

    stop();
    broadcastRefresh(1790000000);

    expect(onRefresh).not.toHaveBeenCalled();
    expect(FakeBroadcastChannel.instances[0].closed).toBe(true);
  });

  it('closes the channel it used to send', () => {
    broadcastRefresh(1790000000);

    expect(FakeBroadcastChannel.instances[0].closed).toBe(true);
  });

  it('does nothing where BroadcastChannel is not available', () => {
    vi.stubGlobal('BroadcastChannel', undefined);

    expect(() => broadcastRefresh(1790000000)).not.toThrow();
    expect(() => listenForRefresh(vi.fn())()).not.toThrow();
  });
});
