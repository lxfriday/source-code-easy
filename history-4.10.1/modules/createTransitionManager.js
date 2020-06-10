import warning from './warning.js';

function createTransitionManager() {
  /**
   * history.block(prompt)
   * 
   * prompt 可以是字符串或者函数，函数执行的结果是 window.confirm 的参数
   */
  let prompt = null;

  // 设置 propt 的内容
  function setPrompt(nextPrompt) {
    warning(prompt == null, 'A history supports only one prompt at a time');

    prompt = nextPrompt;

    // prompt 设为 null，取消 block
    return () => {
      if (prompt === nextPrompt) prompt = null;
    };
  }

  function confirmTransitionTo(
    location,
    action,
    getUserConfirmation,
    callback
  ) {
    // TODO: If another transition starts while we're still confirming
    // the previous one, we may end up in a weird state. Figure out the
    // best way to handle this.
    if (prompt != null) {
      const result =
        typeof prompt === 'function' ? prompt(location, action) : prompt;

      if (typeof result === 'string') {
        // function getConfirmation(message, callback) {
        //   callback(window.confirm(message));
        // }
        if (typeof getUserConfirmation === 'function') {
          getUserConfirmation(result, callback);
        } else {
          warning(
            false,
            'A history needs a getUserConfirmation function in order to use a prompt message'
          );

          callback(true);
        }
      } else {
        // Return false from a transition hook to cancel the transition.
        callback(result !== false);
      }
    } else {
      callback(true);
    }
  }

  let listeners = [];

  /**
   * 写的真好啊，发布-订阅
   */
  function appendListener(fn) {
    let isActive = true;

    // 保包装了一个 listener 函数，用于取消订阅
    function listener(...args) {
      if (isActive) fn(...args);
    }

    listeners.push(listener);

    return () => {
      isActive = false;
      // 删除这个 listener 函数
      listeners = listeners.filter((item) => item !== listener);
    };
  }

  function notifyListeners(...args) {
    // 触发所有 listeners 函数
    listeners.forEach((listener) => listener(...args));
  }

  return {
    setPrompt,
    confirmTransitionTo,
    appendListener,
    notifyListeners,
  };
}

export default createTransitionManager;
