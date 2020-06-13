// rollup 插件 ---------------------------
// js 代码解析
import babel from 'rollup-plugin-babel';
// https://www.npmjs.com/package/@rollup/plugin-node-resolve
// 定位 module
import nodeResolve from 'rollup-plugin-node-resolve';
// https://github.com/rollup/plugins/tree/master/packages/commonjs
// 转换 CommonJS modules 代码 为 ES6 代码
import commonjs from 'rollup-plugin-commonjs';
// https://www.npmjs.com/package/@rollup/plugin-replace
// 替换指定字符串
import replace from 'rollup-plugin-replace';
// https://github.com/TrySound/rollup-plugin-size-snapshot
// 对打包出来的文件生成包体积报告，生成 .size-snapshot.json
import { sizeSnapshot } from 'rollup-plugin-size-snapshot';
// 文件压缩 xx.min.js
import { uglify } from 'rollup-plugin-uglify';
// rollup 插件 ---------------------------

import pkg from './package.json';
// 入口文件
const input = './modules/index.js';
// umd 包全局命名：window.History
const globalName = 'History';

function external(id) {
  return !id.startsWith('.') && !id.startsWith('/');
}

const cjs = [
  {
    input,
    output: { file: `cjs/${pkg.name}.js`, format: 'cjs' },
    external,
    plugins: [
      babel({ exclude: /node_modules/ }),
      replace({ 'process.env.NODE_ENV': JSON.stringify('development') }),
    ],
  },
  {
    input,
    output: { file: `cjs/${pkg.name}.min.js`, format: 'cjs' },
    external,
    plugins: [
      babel({ exclude: /node_modules/ }),
      replace({ 'process.env.NODE_ENV': JSON.stringify('production') }),
      uglify(),
    ],
  },
];

const esm = [
  {
    input,
    output: { file: `esm/${pkg.name}.js`, format: 'esm' },
    external,
    plugins: [
      babel({
        exclude: /node_modules/,
        runtimeHelpers: true,
        plugins: [['@babel/transform-runtime', { useESModules: true }]],
      }),
      sizeSnapshot(),
    ],
  },
];

const umd = [
  {
    input,
    output: { file: `umd/${pkg.name}.js`, format: 'umd', name: globalName },
    plugins: [
      babel({
        exclude: /node_modules/,
        runtimeHelpers: true,
        plugins: [['@babel/transform-runtime', { useESModules: true }]],
      }),
      nodeResolve(),
      commonjs({ include: /node_modules/ }),
      replace({ 'process.env.NODE_ENV': JSON.stringify('development') }),
      sizeSnapshot(),
    ],
  },
  {
    input,
    output: { file: `umd/${pkg.name}.min.js`, format: 'umd', name: globalName },
    plugins: [
      babel({
        exclude: /node_modules/,
        runtimeHelpers: true,
        plugins: [['@babel/transform-runtime', { useESModules: true }]],
      }),
      nodeResolve(),
      commonjs({ include: /node_modules/ }),
      replace({ 'process.env.NODE_ENV': JSON.stringify('production') }),
      sizeSnapshot(),
      uglify(),
    ],
  },
];

let config;
switch (process.env.BUILD_ENV) {
  case 'cjs':
    config = cjs;
    break;
  case 'esm':
    config = esm;
    break;
  case 'umd':
    config = umd;
    break;
  default:
    config = cjs.concat(esm).concat(umd);
}

export default config;
