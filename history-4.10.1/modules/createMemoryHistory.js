import { createPath } from './PathUtils.js';
import { createLocation } from './LocationUtils.js';
import createTransitionManager from './createTransitionManager.js';
import warning from './warning.js';

/**
 * min(max(n, lowerBound), upperBound)
 * @param {*} n 
 * @param {*} lowerBound 
 * @param {*} upperBound 
 */
function clamp(n, lowerBound, upperBound) {
  return Math.min(Math.max(n, lowerBound), upperBound);
}

/**
 * 内存history，用于ssr或者rn。Creates a history object that stores locations in memory.
 */
function createMemoryHistory(props = {}) {
  const {
    getUserConfirmation,
    // 初始路由栈
    initialEntries = ['/'],
    // 初始路由位置
    initialIndex = 0,
    keyLength = 6
  } = props;

  const transitionManager = createTransitionManager();

  function setState(nextState) {
    Object.assign(history, nextState);
    history.length = history.entries.length;
    transitionManager.notifyListeners(history.location, history.action);
  }

  /**
   * 创建一个长度为 keyLength 的 36 位随机字符串
   */
  function createKey() {
    return Math.random()
      .toString(36)
      .substr(2, keyLength);
  }

  // initialIndex => 0, initialEntries.length - 1 => 0
  const index = clamp(initialIndex, 0, initialEntries.length - 1);
  // 把 initialEntries 转换成 locationObj
  const entries = initialEntries.map(entry =>
    typeof entry === 'string'
      // 如果是字符串，则创建 key
      ? createLocation(entry, undefined, createKey())
      // 如果是对象，则使用自带的 key
      : createLocation(entry, undefined, entry.key || createKey())
  );

  // Public interface

  const createHref = createPath;

  function push(path, state) {
    // 如果 path 是对象，pathObj 中包含 state 而且第二个参数 state 也不为空，则第二个参数 state 会被忽略
    warning(
      !(
        typeof path === 'object' &&
        path.state !== undefined &&
        state !== undefined
      ),
      'You should avoid providing a 2nd state argument to push when the 1st ' +
        'argument is a location-like object that already has state; it is ignored'
    );

    const action = 'PUSH';
    // 由 path 创建 locationObj
    const location = createLocation(path, state, createKey(), history.location);

    transitionManager.confirmTransitionTo(
      location,
      action,
      getUserConfirmation,
      ok => {
        if (!ok) return;

        // history 中存储的 index 属性
        const prevIndex = history.index;
        const nextIndex = prevIndex + 1;

        // 从 history.entries 复制一份
        const nextEntries = history.entries.slice(0);
        if (nextEntries.length > nextIndex) {
          nextEntries.splice(
            nextIndex,
            nextEntries.length - nextIndex,
            location
          );
        } else {
          nextEntries.push(location);
        }

        setState({
          action,
          location,
          index: nextIndex,
          entries: nextEntries
        });
      }
    );
  }

  function replace(path, state) {
    warning(
      !(
        typeof path === 'object' &&
        path.state !== undefined &&
        state !== undefined
      ),
      'You should avoid providing a 2nd state argument to replace when the 1st ' +
        'argument is a location-like object that already has state; it is ignored'
    );

    const action = 'REPLACE';
    const location = createLocation(path, state, createKey(), history.location);

    transitionManager.confirmTransitionTo(
      location,
      action,
      getUserConfirmation,
      ok => {
        if (!ok) return;

        history.entries[history.index] = location;

        setState({ action, location });
      }
    );
  }

  function go(n) {
    const nextIndex = clamp(history.index + n, 0, history.entries.length - 1);

    const action = 'POP';
    const location = history.entries[nextIndex];

    transitionManager.confirmTransitionTo(
      location,
      action,
      getUserConfirmation,
      ok => {
        if (ok) {
          setState({
            action,
            location,
            index: nextIndex
          });
        } else {
          // Mimic the behavior of DOM histories by
          // causing a render after a cancelled POP.
          setState();
        }
      }
    );
  }

  function goBack() {
    go(-1);
  }

  function goForward() {
    go(1);
  }

  function canGo(n) {
    const nextIndex = history.index + n;
    return nextIndex >= 0 && nextIndex < history.entries.length;
  }

  function block(prompt = false) {
    return transitionManager.setPrompt(prompt);
  }

  function listen(listener) {
    return transitionManager.appendListener(listener);
  }

  const history = {
    length: entries.length,
    action: 'POP',
    location: entries[index],
    index,
    entries,
    createHref,
    push,
    replace,
    go,
    goBack,
    goForward,
    canGo,
    block,
    listen
  };

  return history;
}

export default createMemoryHistory;
