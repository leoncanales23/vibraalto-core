export type CommandState = 'invoke' | 'form' | 'dissolve' | 'transform';

export interface CommandEvent<TPayload = unknown> {
  state: CommandState;
  payload?: TPayload;
  createdAt: number;
}

export type CommandListener<TPayload = unknown> = (event: CommandEvent<TPayload>) => void;

const allowedStates: CommandState[] = ['invoke', 'form', 'dissolve', 'transform'];

class EventBus {
  private listeners = new Map<CommandState | '*', Set<CommandListener>>();
  private _current: CommandState = 'invoke';

  get current(): CommandState {
    return this._current;
  }

  on<TPayload = unknown>(state: CommandState | '*', listener: CommandListener<TPayload>): () => void {
    const pool = this.listeners.get(state) ?? new Set<CommandListener>();
    pool.add(listener as CommandListener);
    this.listeners.set(state, pool);
    return () => pool.delete(listener as CommandListener);
  }

  once<TPayload = unknown>(state: CommandState | '*', listener: CommandListener<TPayload>): () => void {
    const disposer = this.on(state, (event) => {
      disposer();
      listener(event as CommandEvent<TPayload>);
    });
    return disposer;
  }

  emit<TPayload = unknown>(state: CommandState, payload?: TPayload): void {
    if (!allowedStates.includes(state)) {
      throw new Error(`Estado de comando no permitido: ${state}`);
    }

    this._current = state;
    const event: CommandEvent<TPayload> = {
      state,
      payload,
      createdAt: performance.now(),
    };

    this.dispatch(state, event);
    this.dispatch('*', event);
  }

  transition<TPayload = unknown>(next: CommandState, payload?: TPayload): void {
    if (next === this._current && payload === undefined) return;
    this.emit(next, payload);
  }

  private dispatch(state: CommandState | '*', event: CommandEvent): void {
    const pool = this.listeners.get(state);
    if (!pool) return;
    pool.forEach((listener) => listener(event));
  }
}

export const commandBus = new EventBus();

export function bindCommandSequence(sequence: CommandState[], callback: () => void): () => void {
  let index = 0;
  return commandBus.on('*', ({ state }) => {
    if (state === sequence[index]) {
      index += 1;
      if (index === sequence.length) {
        callback();
        index = 0;
      }
    } else {
      index = state === sequence[0] ? 1 : 0;
    }
  });
}
