import { createLocation } from './LocationUtils.js';
import {
  addLeadingSlash,
  stripTrailingSlash,
  hasBasename,
  stripBasename,
  createPath
} from './PathUtils.js';
import createTransitionManager from './createTransitionManager.js';
import {
  canUseDOM,
  getConfirmation,
  supportsHistory,
  supportsPopStateOnHashChange,
  isExtraneousPopstateEvent
} from './DOMUtils.js';
import invariant from './invariant.js';
import warning from './warning.js';

/**
 * 调用 history.pushState() 或者 history.replaceState() 不会触发 popstate 事件. popstate 事件只会在浏览器某些行为下触发,
 *  比如点击 后退、前进 按钮(或者在 JavaScript 中调用 history.back()、history.forward()、history.go()方法).
 * 
 * @link https://developer.mozilla.org/zh-CN/docs/Web/API/Window/onpopstate
 */
const PopStateEvent = 'popstate';
const HashChangeEvent = 'hashchange';

/**
 * window.history.state
 */
function getHistoryState() {
  try {
    return window.history.state || {};
  } catch (e) {
    // IE 11 sometimes throws when accessing window.history.state
    // See https://github.com/ReactTraining/history/pull/289
    return {};
  }
}

/**
 * Creates a history object that uses the HTML5 history API including
 * pushState, replaceState, and the popstate event.
 */
function createBrowserHistory(props = {}) {
  invariant(canUseDOM, 'Browser history needs a DOM');

  const globalHistory = window.history;
  const canUseHistory = supportsHistory();
  const needsHashChangeListener = !supportsPopStateOnHashChange();

  const {
    // 设为 true 则使用 window.location.href 直接刷新整个页面
    forceRefresh = false,
    getUserConfirmation = getConfirmation,
    // location.key 的长度
    keyLength = 6
  } = props;
  const basename = props.basename
    ? stripTrailingSlash(addLeadingSlash(props.basename))
    : '';

  function getDOMLocation(historyState) {
    const { key, state } = historyState || {};
    const { pathname, search, hash } = window.location;

    let path = pathname + search + hash;

    warning(
      !basename || hasBasename(path, basename),
      'You are attempting to use a basename on a page whose URL path does not begin ' +
        'with the basename. Expected path "' +
        path +
        '" to begin with "' +
        basename +
        '".'
    );

    if (basename) path = stripBasename(path, basename);

    return createLocation(path, state, key);
  }

  /**
   * 创建一个长度为 keyLength 的 36 位随机字符串
   */
  function createKey() {
    return Math.random()
      .toString(36)
      .substr(2, keyLength);
  }

  const transitionManager = createTransitionManager();

  /**
   * 更新 history.action 和 history.location，触发监听器
   */
  function setState(nextState) {
    Object.assign(history, nextState);
    history.length = globalHistory.length;
    transitionManager.notifyListeners(history.location, history.action);
  }

  function handlePopState(event) {
    // Ignore extraneous popstate events in WebKit.
    if (isExtraneousPopstateEvent(event)) return;
    // getDOMLocation(event.state) 获取地址栏的 location 信息
    handlePop(getDOMLocation(event.state));
  }

  function handleHashChange() {
    handlePop(getDOMLocation(getHistoryState()));
  }

  let forceNextPop = false;

  function handlePop(location) {
    if (forceNextPop) {
      forceNextPop = false;
      setState();
    } else {
      const action = 'POP';

      transitionManager.confirmTransitionTo(
        location,
        action,
        getUserConfirmation,
        ok => {
          if (ok) {
            setState({ action, location });
          } else {
            revertPop(location);
          }
        }
      );
    }
  }

  /**
   * 撤销 pop
   * @param {*} fromLocation 
   */
  function revertPop(fromLocation) {
    const toLocation = history.location;

    // TODO: We could probably make this more reliable by
    // keeping a list of keys we've seen in sessionStorage.
    // Instead, we just default to 0 for keys we don't know.

    let toIndex = allKeys.indexOf(toLocation.key);

    if (toIndex === -1) toIndex = 0;

    let fromIndex = allKeys.indexOf(fromLocation.key);

    if (fromIndex === -1) fromIndex = 0;

    const delta = toIndex - fromIndex;

    if (delta) {
      forceNextPop = true;
      go(delta);
    }
  }

  /**
   * 初始 location，从浏览器地址栏拿的 pathname search hash，从 window.history.state 拿的 state
   */
  const initialLocation = getDOMLocation(getHistoryState());
  /**
   * location.key 组成的数组
   * 
   * history 内部自己维护的路由栈，这里使用的 location.key 来做标识
   */
  let allKeys = [initialLocation.key];

  /**
   * basename + locationObj 对应的字符串
   */
  function createHref(location) {
    return basename + createPath(location);
  }

  // path => string | {
  //   pathname?: string,
  //   search?: string,
  //   hash?: string,
  //   state?: any
  // }
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
    // 创建 locationObj
    // if (state !== undefined && location.state === undefined) 
    // path 中如果已经存在 state，则传进来的第二个参数 state 会无效
    const location = createLocation(path, state, createKey(), history.location);

    // history.push({
    //   pathname: '/user/lxfriday',
    //   search: 'time=20200610',
    //   hash: '0800'
    // });
    // search 前自动补全 ?，hash 前自动补全 #
    // {
    //   hash: "#0800",
    //   key: "53e1ty", // key 是由 createKey() 随机生成的
    //   pathname: "/user/lxfriday",
    //   search: "?time=20200610",
    //   state: {s1: "this is s1"}
    // }
    // console.log('createBrowserHistory -> location', location);

    transitionManager.confirmTransitionTo(
      location,
      action,
      getUserConfirmation,
      ok => {
        if (!ok) return;

        const href = createHref(location);
        const { key, state } = location;

        // Returns true if the HTML5 history API is supported
        // 能否使用 history api，一般都是 true
        if (canUseHistory) {
          // href => /base/user/lxfriday?time=20200610#0800
          // 新页面中可以通过 history.state 拿到 pushState 传过来的值
          globalHistory.pushState({ key, state }, null, href);

          // 默认为 false，不使用刷新页面的方式
          if (forceRefresh) {
            window.location.href = href;
          } else {
            // 获取 history.location 中的 key 在路由栈的位置
            const prevIndex = allKeys.indexOf(history.location.key);
            // 复制一份新的路由栈
            const nextKeys = allKeys.slice(0, prevIndex + 1);
            // 推入最新的 location.key
            nextKeys.push(location.key);
            // 更改内部路由栈
            allKeys = nextKeys;
            // 更新 history，并触发监听器
            setState({ action, location });
          }
        } else {
          // 不能使用 history api，版本比较老
          warning(
            state === undefined,
            'Browser history cannot push state in browsers that do not support HTML5 history'
          );

          window.location.href = href;
        }
      }
    );
  }

  // path => string | {
  //   pathname?: string,
  //   search?: string,
  //   hash?: string,
  //   state?: any
  // }
  function replace(path, state) {
    // 如果 path 是对象，pathObj 中包含 state 而且第二个参数 state 也不为空，则第二个参数 state 会被忽略
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
    // 创建 locationObj
    // if (state !== undefined && location.state === undefined) 
    // path 中如果已经存在 state，则传进来的第二个参数 state 会无效
    const location = createLocation(path, state, createKey(), history.location);

    transitionManager.confirmTransitionTo(
      location,
      action,
      getUserConfirmation,
      ok => {
        if (!ok) return;

        // basename + locationObj 对应的字符串
        const href = createHref(location);
        const { key, state } = location;

        // 现代浏览器中都是 true
        if (canUseHistory) {
          // 使用 replaceState 更改页面
          globalHistory.replaceState({ key, state }, null, href);

          // 是否强制整页刷新
          if (forceRefresh) {
            // location.replace 强制整页刷新
            window.location.replace(href);
          } else {
            // 更新 history 自己维护的路由栈
            // 找到 history.location.key 在路由栈中的位置
            const prevIndex = allKeys.indexOf(history.location.key);
            // 用当前的 location.key 直接替换老页面的 key
            if (prevIndex !== -1) allKeys[prevIndex] = location.key;
            // 更新 state
            setState({ action, location });
          }
        } else {
          warning(
            state === undefined,
            'Browser history cannot replace state in browsers that do not support HTML5 history'
          );

          window.location.replace(href);
        }
      }
    );
  }

  function go(n) {
    globalHistory.go(n);
  }

  function goBack() {
    go(-1);
  }

  function goForward() {
    go(1);
  }

  let listenerCount = 0;

  function checkDOMListeners(delta) {
    listenerCount += delta;

    if (listenerCount === 1 && delta === 1) {
      // 监听 popstate 事件，
      // https://developer.mozilla.org/zh-CN/docs/Web/API/Window/onpopstate
      window.addEventListener(PopStateEvent, handlePopState);

      if (needsHashChangeListener)
        window.addEventListener(HashChangeEvent, handleHashChange);
    } else if (listenerCount === 0) {
      window.removeEventListener(PopStateEvent, handlePopState);

      if (needsHashChangeListener)
        window.removeEventListener(HashChangeEvent, handleHashChange);
    }
  }

  /**
   * 防止 block 重复，防止重复添加监听器
   */
  let isBlocked = false;

  /**
   * 阻塞地址更改，调用 transitionManager.confirmTransitionTo 时会依据 prompt 来决定是否阻塞地址更改
   */
  function block(prompt = false) {
    const unblock = transitionManager.setPrompt(prompt);

    // 防止多次添加 DOMListeners
    if (!isBlocked) {
      checkDOMListeners(1);
      isBlocked = true;
    }

    return () => {
      if (isBlocked) {
        isBlocked = false;
        // 去除 DOMListeners
        checkDOMListeners(-1);
      }

      return unblock();
    };
  }

  /**
   * 监听 popstate
   * @param {*} listener 
   */
  function listen(listener) {
    const unlisten = transitionManager.appendListener(listener);
    checkDOMListeners(1);

    return () => {
      checkDOMListeners(-1);
      unlisten();
    };
  }

  const history = {
    length: globalHistory.length,
    action: 'POP',
    location: initialLocation,
    createHref,
    push,
    replace,
    go,
    goBack,
    goForward,
    block,
    listen
  };

  return history;
}

export default createBrowserHistory;
