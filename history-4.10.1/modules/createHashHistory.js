import { createLocation } from './LocationUtils.js';
import {
  addLeadingSlash,
  stripLeadingSlash,
  stripTrailingSlash,
  hasBasename,
  stripBasename,
  createPath,
} from './PathUtils.js';
import createTransitionManager from './createTransitionManager.js';
import {
  canUseDOM,
  getConfirmation,
  supportsGoWithoutReloadUsingHash,
} from './DOMUtils.js';
import invariant from './invariant.js';
import warning from './warning.js';

const HashChangeEvent = 'hashchange';

const HashPathCoders = {
  hashbang: {
    encodePath: (path) =>
      path.charAt(0) === '!' ? path : '!/' + stripLeadingSlash(path),
    decodePath: (path) => (path.charAt(0) === '!' ? path.substr(1) : path),
  },
  noslash: {
    encodePath: stripLeadingSlash,
    decodePath: addLeadingSlash,
  },
  slash: {
    encodePath: addLeadingSlash,
    decodePath: addLeadingSlash,
  },
};

// 去除 hash 字符串：stripHash('/a/b#hash?d') => "/a/b"
function stripHash(url) {
  const hashIndex = url.indexOf('#');
  return hashIndex === -1 ? url : url.slice(0, hashIndex);
}

// 当前浏览器的 hash
// #/lxfriday/12 => /lxfriday/12
function getHashPath() {
  // We can't use window.location.hash here because it's not
  // consistent across browsers - Firefox will pre-decode it!
  const href = window.location.href;
  const hashIndex = href.indexOf('#');
  return hashIndex === -1 ? '' : href.substring(hashIndex + 1);
}

function pushHashPath(path) {
  window.location.hash = path;
}

// 修改 window.location.href # 后面的那一串为 path
function replaceHashPath(path) {
  window.location.replace(stripHash(window.location.href) + '#' + path);
}

function createHashHistory(props = {}) {
  invariant(canUseDOM, 'Hash history needs a DOM');

  const globalHistory = window.history;
  const canGoWithoutReload = supportsGoWithoutReloadUsingHash();

  const { getUserConfirmation = getConfirmation, hashType = 'slash' } = props;
  const basename = props.basename
    ? stripTrailingSlash(addLeadingSlash(props.basename))
    : '';

  const { encodePath, decodePath } = HashPathCoders[hashType];

  // 以当前 hash path 创建 location object
  function getDOMLocation() {
    let path = decodePath(getHashPath());

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

    return createLocation(path);
  }

  const transitionManager = createTransitionManager();

  // 设置 action、location 到 history 对象上
  function setState(nextState) {
    Object.assign(history, nextState);
    // history 是在最底部声明的那个对象，与 window.history 很类似
    history.length = globalHistory.length;
    transitionManager.notifyListeners(history.location, history.action);
  }

  let forceNextPop = false;
  let ignorePath = null;

  // pathname search hash 完全一致
  function locationsAreEqual(a, b) {
    return (
      a.pathname === b.pathname && a.search === b.search && a.hash === b.hash
    );
  }

  function handleHashChange() {
    // 获取当前浏览器的 hash
    const path = getHashPath();
    // encodePath => 在首部添加 /
    const encodedPath = encodePath(path);

    if (path !== encodedPath) {
      // Ensure we always have a properly-encoded hash.
      replaceHashPath(encodedPath);
    } else {
      // 最新的 location object
      const location = getDOMLocation();
      const prevLocation = history.location;

      // A hashchange doesn't always == location change.
      if (!forceNextPop && locationsAreEqual(prevLocation, location)) return;

      // Ignore this change; we already setState in push/replace.
      // push/replace 中都会把即将要变更的地址赋值给 ignorePath，表示要忽略此地址
      if (ignorePath === createPath(location)) return;

      ignorePath = null;

      handlePop(location);
    }
  }

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
        (ok) => {
          if (ok) {
            setState({ action, location });
          } else {
            revertPop(location);
          }
        }
      );
    }
  }

  function revertPop(fromLocation) {
    const toLocation = history.location;

    // TODO: We could probably make this more reliable by
    // keeping a list of paths we've seen in sessionStorage.
    // Instead, we just default to 0 for paths we don't know.

    let toIndex = allPaths.lastIndexOf(createPath(toLocation));

    if (toIndex === -1) toIndex = 0;

    let fromIndex = allPaths.lastIndexOf(createPath(fromLocation));

    if (fromIndex === -1) fromIndex = 0;

    const delta = toIndex - fromIndex;

    if (delta) {
      forceNextPop = true;
      go(delta);
    }
  }

  // Ensure the hash is encoded properly before doing anything else.
  const path = getHashPath();
  const encodedPath = encodePath(path);

  if (path !== encodedPath) replaceHashPath(encodedPath);

  const initialLocation = getDOMLocation();
  // 整体页面路由栈
  let allPaths = [createPath(initialLocation)];

  // Public interface

  function createHref(location) {
    const baseTag = document.querySelector('base');
    let href = '';
    if (baseTag && baseTag.getAttribute('href')) {
      href = stripHash(window.location.href);
    }
    return href + '#' + encodePath(basename + createPath(location));
  }

  function push(path, state) {
    warning(
      state === undefined,
      'Hash history cannot push state; it is ignored'
    );

    const action = 'PUSH';
    const location = createLocation(
      path,
      undefined,
      undefined,
      // 地址改变之前的 location 信息
      history.location
    );

    console.log('history.location', history.location);

    // http://localhost:5000/#/lxfriday/lxfriday/14?name=lx#friday => {pathname: "/lxfriday/lxfriday/14", search: "?name=lx", hash: "#friday", state: undefined}
    // 地址即将要变成的 location 信息
    console.log('---> location', location);

    transitionManager.confirmTransitionTo(
      location,
      action,
      getUserConfirmation,
      (ok) => {
        if (!ok) return;

        const path = createPath(location);
        // encodedPath 编码之后的新 hash
        // encodePath 加一个首 /
        const encodedPath = encodePath(basename + path);
        const hashChanged = getHashPath() !== encodedPath;
        console.log('getHashPath()', getHashPath()); // #/lxfriday/12 => /lxfriday/12
        console.log('encodedPath', encodedPath);

        if (hashChanged) {
          // We cannot tell if a hashchange was caused by a PUSH, so we'd
          // rather setState here and ignore the hashchange. The caveat here
          // is that other hash histories in the page will consider it a POP.
          ignorePath = path;

          // window.location.hash = encodedPath;
          pushHashPath(encodedPath);

          // history.location 是当前的
          const prevIndex = allPaths.lastIndexOf(createPath(history.location));
          // nextPaths 是最新的路由栈
          const nextPaths = allPaths.slice(0, prevIndex + 1);

          nextPaths.push(path);
          allPaths = nextPaths;

          setState({ action, location });
        } else {
          warning(
            false,
            'Hash history cannot PUSH the same path; a new entry will not be added to the history stack'
          );

          setState();
        }
      }
    );
  }

  function replace(path, state) {
    warning(
      state === undefined,
      'Hash history cannot replace state; it is ignored'
    );

    const action = 'REPLACE';
    const location = createLocation(
      path,
      undefined,
      undefined,
      history.location
    );

    transitionManager.confirmTransitionTo(
      location,
      action,
      getUserConfirmation,
      (ok) => {
        if (!ok) return;

        const path = createPath(location);
        const encodedPath = encodePath(basename + path);
        const hashChanged = getHashPath() !== encodedPath;

        if (hashChanged) {
          // We cannot tell if a hashchange was caused by a REPLACE, so we'd
          // rather setState here and ignore the hashchange. The caveat here
          // is that other hash histories in the page will consider it a POP.
          ignorePath = path;
          // location.replace 替换当前的页面地址
          replaceHashPath(encodedPath);
        }

        const prevIndex = allPaths.indexOf(createPath(history.location));

        if (prevIndex !== -1) allPaths[prevIndex] = path;

        setState({ action, location });
      }
    );
  }

  function go(n) {
    warning(
      canGoWithoutReload,
      'Hash history go(n) causes a full page reload in this browser'
    );

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
      window.addEventListener(HashChangeEvent, handleHashChange);
    } else if (listenerCount === 0) {
      window.removeEventListener(HashChangeEvent, handleHashChange);
    }
  }

  let isBlocked = false;

  // 路由切换时，阻塞跳转
  // prompt(location, action) prompt 可以为字符串或者函数，函数的话执行的结果会给 getUserConfirmation 的第一个参数
  function block(prompt = false) {
    const unblock = transitionManager.setPrompt(prompt);

    if (!isBlocked) {
      checkDOMListeners(1);
      isBlocked = true;
    }

    return () => {
      if (isBlocked) {
        isBlocked = false;
        checkDOMListeners(-1);
      }

      return unblock();
    };
  }

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
    listen,
  };

  return history;
}

export default createHashHistory;
