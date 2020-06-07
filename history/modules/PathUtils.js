// 在开头添加 /
export function addLeadingSlash(path) {
  return path.charAt(0) === '/' ? path : '/' + path;
}

// 去除开头的 /
export function stripLeadingSlash(path) {
  return path.charAt(0) === '/' ? path.substr(1) : path;
}

export function hasBasename(path, prefix) {
  return (
    path.toLowerCase().indexOf(prefix.toLowerCase()) === 0 &&
    '/?#'.indexOf(path.charAt(prefix.length)) !== -1
  );
}

export function stripBasename(path, prefix) {
  return hasBasename(path, prefix) ? path.substr(prefix.length) : path;
}

/**
 * 去除字符串尾部的 /
 *
 * stripTrailingSlash('/a/b/c/')
 *
 * "/a/b/c"
 * @param {*} path
 */
export function stripTrailingSlash(path) {
  return path.charAt(path.length - 1) === '/' ? path.slice(0, -1) : path;
}

export function parsePath(path) {
  let pathname = path || '/';
  let search = '';
  let hash = '';

  const hashIndex = pathname.indexOf('#');
  if (hashIndex !== -1) {
    hash = pathname.substr(hashIndex);
    pathname = pathname.substr(0, hashIndex);
  }

  const searchIndex = pathname.indexOf('?');
  if (searchIndex !== -1) {
    search = pathname.substr(searchIndex);
    pathname = pathname.substr(0, searchIndex);
  }

  return {
    pathname,
    search: search === '?' ? '' : search,
    hash: hash === '#' ? '' : hash,
  };
}

/**
 * 创建字符串 path: pathname + search + hash
 * @param {*} location
 */
export function createPath(location) {
  const { pathname, search, hash } = location;

  let path = pathname || '/';

  if (search && search !== '?')
    path += search.charAt(0) === '?' ? search : `?${search}`;

  if (hash && hash !== '#') path += hash.charAt(0) === '#' ? hash : `#${hash}`;

  return path;
}
