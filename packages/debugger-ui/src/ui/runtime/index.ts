interface RuntimeConfig {
  onEvent: (eventType: RuntimeEventType, messages: Array<any>) => void;
}

enum RuntimeEventType {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  CONSOLE = 'CONSOLE',
}

export default class Runtime {
  onEvent: any = null;
  worker: Worker | null = null;
  socket: WebSocket | null = null;

  constructor({onEvent}: RuntimeConfig) {
    this.onEvent = onEvent;

    this.init();
  }

  init() {
    this.socket = new WebSocket(
      'ws://' +
        'localhost:8081' +
        // window.location.host +
        '/debugger-proxy?role=debugger&name=Chrome',
    );
    this.socket.onopen = () => {
      this.onEvent(RuntimeEventType.CONNECTING);
    };

    this.socket.onmessage = (message: MessageEvent) => {
      if (!message.data) {
        return;
      }

      const command = JSON.parse(message.data);
      this.handleCommand(command);
    };

    this.socket.onclose = (error: CloseEvent) => {
      this.stop();
      this.onEvent(RuntimeEventType.DISCONNECTED, error && error.reason);

      setTimeout(() => {
        this.init();
      }, 500);
    };
  }

  start() {
    this.worker = new Worker('./worker.ts');
    this.worker.onmessage = (message: MessageEvent) => {
      if (message.data.logType) {
        this.onEvent(RuntimeEventType.CONSOLE, message.data);
      }

      if (this.socket) {
        this.socket.send(JSON.stringify(message.data));
      }
    };

    window.onbeforeunload = () => {
      return (
        'If you reload this page, it is going to break the debugging session. ' +
        'You should press' +
        // this.refreshShortcut +
        'in simulator to reload.'
      );
    };
  }

  stop() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      window.onbeforeunload = null;
    }
  }

  handleCommand(command: any) {
    if (command.$event === 'client-disconnected') {
      this.stop();
      this.onEvent(RuntimeEventType.DISCONNECTED);
      return;
    }

    if (!command.method) {
      return;
    }

    switch (command.method) {
      case 'prepareJSRuntime': {
        this.stop();
        console.clear();
        this.start();
        if (this.socket) {
          this.socket.send(JSON.stringify({replyID: command.id}));
        }
        this.onEvent(RuntimeEventType.CONNECTED, command.id);
        break;
      }
      case '$disconnected': {
        this.stop();
        this.onEvent(RuntimeEventType.DISCONNECTED);
        break;
      }
      default: {
        // Otherwise, pass through to the worker.
        if (this.worker) {
          this.worker.postMessage(command);
        }
      }
    }
  }
}
