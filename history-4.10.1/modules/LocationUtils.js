// 类似 path.resolve
// resolvePathname('about', '/company/jobs'); // /company/about
// resolvePathname('../jobs', '/company/team/ceo'); // /company/jobs
import resolvePathname from 'resolve-pathname';

// 值是否相等
// valueEqual({ a: 'a' }, { a: 'a' }); // true
// valueEqual({ a: 'a' }, { a: 'b' }); // false
// valueEqual([1, 2, 3], [1, 2, 3]);   // true
import valueEqual from 'value-equal';

import { parsePath } from './PathUtils.js';

/**
 * {
 *    pathname,
 *    search,
 *    hash,
 *    key?,
 *    state?,
 * }
 * 
 * 创建一个 location object
 * @param {*} path string | object
 * @param {*} state 
 * @param {*} key 
 * @param {*} currentLocation 
 */
export function createLocation(path, state, key, currentLocation) {
  let location;
  if (typeof path === 'string') {
    // Two-arg form: push(path, state)
    // 把 path 字符串解析成 locationObj 对象
    location = parsePath(path);
    location.state = state;
  } else {
    // One-arg form: push(location)
    location = { ...path };
    // pathname
    if (location.pathname === undefined) location.pathname = '';
    // search
    if (location.search) {
      if (location.search.charAt(0) !== '?')
        location.search = '?' + location.search;
    } else {
      location.search = '';
    }
    // hash
    if (location.hash) {
      if (location.hash.charAt(0) !== '#') location.hash = '#' + location.hash;
    } else {
      location.hash = '';
    }
    // state
    // lcoation 中包含 state 的时候，会直接忽略第二个参数 state
    if (state !== undefined && location.state === undefined)
      location.state = state;
  }

  try {
    // decode
    // 比如 pathname 传递的 %E6%90%9C%E7%8B%97
    // 经过处理之后就是 搜狗
    location.pathname = decodeURI(location.pathname);
  } catch (e) {
    if (e instanceof URIError) {
      throw new URIError(
        'Pathname "' +
          location.pathname +
          '" could not be decoded. ' +
          'This is likely caused by an invalid percent-encoding.'
      );
    } else {
      throw e;
    }
  }

  // key browserHistory 会用到
  if (key) location.key = key;

  if (currentLocation) {
    // Resolve incomplete/relative pathname relative to current location.
    if (!location.pathname) {
      location.pathname = currentLocation.pathname;
    } else if (location.pathname.charAt(0) !== '/') {
      // 要解决相对路径的问题
      // 比如先 history.push('/demo/hello');
      // 然后 history.push({ pathname: 'sougou',}); 结果是跳到 /demo/sougou
      // 如果 history.push({ pathname: '/sougou',}); 则是跳到 /sougou
      location.pathname = resolvePathname(
        location.pathname,
        currentLocation.pathname
      );
    }
  } else {
    // When there is no prior location and pathname is empty, set it to /
    if (!location.pathname) {
      location.pathname = '/';
    }
  }

  return location;
}

/**
 * pathname、search、hash、key、state 是否完全相等
 * @param {*} a 
 * @param {*} b 
 */
export function locationsAreEqual(a, b) {
  return (
    a.pathname === b.pathname &&
    a.search === b.search &&
    a.hash === b.hash &&
    a.key === b.key &&
    // 是否肉眼看起来相同
    valueEqual(a.state, b.state)
  );
}
