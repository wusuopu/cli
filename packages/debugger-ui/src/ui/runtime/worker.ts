declare var __fbBatchedBridge: any;

interface Message {
  data: {
    id: string;
    method: string;
    url: string;
    visibilityState: string;
    inject: {[index: string]: string};
    arguments: any;
  };
}

type SendReplyFunction = (result: any | null, error?: string) => void;

function filterConsoleMethods(key: string): boolean {
  return (
    typeof console[key as keyof Console] === 'function' && key !== 'assert'
  );
}

function setUpProxyLogger(onLog: (name: string, args: Array<any>) => void) {
  const consoleProxy = Object.keys(console)
    .filter(filterConsoleMethods)
    .reduce((acc, methodName) => {
      return {
        ...acc,
        [methodName]: new Proxy(console[methodName as keyof Console], {
          apply: (target, thisArg, args) => {
            onLog(methodName, args);
            return target.apply(thisArg, args);
          },
        }),
      };
    }, {});

  console = Object.assign({}, console, consoleProxy);
}

class RuntimeWorker {
  visibilityState = '';
  hasWarned = false;

  constructor() {
    setUpProxyLogger((logType: string, args: Array<any>) => {
      self.postMessage({logType, args});
    });
  }

  setDebuggerVisibility(data: Message['data'], _sendReply: SendReplyFunction) {
    this.visibilityState = data.visibilityState;
  }

  showVisibilityWarning() {
    // Wait until `YellowBox` gets initialized before displaying the warning.
    if (this.hasWarned || console.warn.toString().includes('[native code]')) {
      return;
    }
    this.hasWarned = true;
    const warning =
      'Remote debugger is in a background tab which may cause apps to ' +
      'perform slowly. Fix this by foregrounding the tab (or opening it in ' +
      'a separate window).';
    console.warn(warning);
  }

  getHandler(handler: string) {
    switch (handler) {
      case 'setDebuggerVisibility':
        return this.setDebuggerVisibility;
      case 'executeApplicationScript':
        return this.executeApplicationScript;
      default:
        return null;
    }
  }

  executeApplicationScript(
    data: Message['data'],
    sendReply: SendReplyFunction,
  ) {
    const scriptURL = new URL(data.url);
    let error;

    for (let key in data.inject) {
      // @ts-ignore
      self[key] = JSON.parse(data.inject[key]);
    }

    try {
      self.importScripts(scriptURL.href);
    } catch (e) {
      error = e.message;
    } finally {
      sendReply(null, error);
    }
  }

  handleMessage(message: Message) {
    const {data} = message;

    if (this.visibilityState === 'hidden') {
      this.showVisibilityWarning();
    }

    const sendReply: SendReplyFunction = (result, error) => {
      self.postMessage({replyID: data.id, result, error});
    };

    const handler = this.getHandler(data.method);

    if (handler) {
      // Special cased handlers
      handler.call(this, data, sendReply);
    } else {
      // Other methods get called on the bridge
      let returnValue = [[], [], [], 0];
      try {
        if (typeof __fbBatchedBridge === 'object') {
          returnValue = __fbBatchedBridge[data.method].apply(
            null,
            data.arguments,
          );
        }
      } finally {
        sendReply(JSON.stringify(returnValue));
      }
    }
  }
}

onmessage = (() => {
  const runtimeWorker = new RuntimeWorker();

  return (message: Message) => {
    runtimeWorker.handleMessage(message);
  };
})();
