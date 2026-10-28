import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { broadcastLogout, listenForLogout } from './logoutChannel';

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

describe('broadcastLogout / listenForLogout', () => {
  it('tells a listener the logout was confirmed', () => {
    const onLogout = vi.fn();
    listenForLogout(onLogout);

    broadcastLogout();

    expect(onLogout).toHaveBeenCalledExactlyOnceWith('signed-out');
  });

  it('tells a listener the logout was not confirmed', () => {
    const onLogout = vi.fn();
    listenForLogout(onLogout);

    broadcastLogout('unconfirmed');

    expect(onLogout).toHaveBeenCalledExactlyOnceWith('unconfirmed');
  });

  it('tells a listener the session expired', () => {
    const onLogout = vi.fn();
    listenForLogout(onLogout);

    broadcastLogout('expired');

    expect(onLogout).toHaveBeenCalledExactlyOnceWith('expired');
  });

  it('does not tell the tab that sent the message', () => {
    const onLogout = vi.fn();
    const stop = listenForLogout(onLogout);

    // A listener and a sender are different instances of the same channel.
    const [listener] = FakeBroadcastChannel.instances;
    listener.postMessage('logout');

    expect(onLogout).not.toHaveBeenCalled();
    stop();
  });

  it('uses a channel of its own and sends no data with the message', () => {
    listenForLogout(vi.fn());
    const spy = vi.spyOn(FakeBroadcastChannel.prototype, 'postMessage');

    broadcastLogout();

    expect(FakeBroadcastChannel.instances.map((c) => c.name)).toEqual([
      'careme-auth',
      'careme-auth',
    ]);
    expect(spy).toHaveBeenCalledExactlyOnceWith('logout');
  });

  it('ignores any other message', () => {
    const onLogout = vi.fn();
    listenForLogout(onLogout);
    const sender = new FakeBroadcastChannel('careme-auth');

    sender.postMessage('something-else');
    sender.postMessage({ type: 'logout' });
    sender.postMessage(undefined);

    expect(onLogout).not.toHaveBeenCalled();
  });

  it('closes the sending channel right away', () => {
    broadcastLogout();

    expect(FakeBroadcastChannel.instances).toHaveLength(1);
    expect(FakeBroadcastChannel.instances[0].closed).toBe(true);
  });

  it('stops listening and closes its channel when told to stop', () => {
    const onLogout = vi.fn();
    const stop = listenForLogout(onLogout);
    const [listener] = FakeBroadcastChannel.instances;

    stop();
    broadcastLogout();

    expect(listener.closed).toBe(true);
    expect(onLogout).not.toHaveBeenCalled();
  });

  it('does nothing where BroadcastChannel is not available', () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    const onLogout = vi.fn();

    expect(() => broadcastLogout()).not.toThrow();
    const stop = listenForLogout(onLogout);
    expect(() => stop()).not.toThrow();
    expect(onLogout).not.toHaveBeenCalled();
  });
});
