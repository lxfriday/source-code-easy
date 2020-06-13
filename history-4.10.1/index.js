'use strict';

// 环境判断，大多数 npm 包都选择依据 NODE_ENV 引入不同的包
if (process.env.NODE_ENV === 'production') {
  module.exports = require('./cjs/history.min.js');
} else {
  module.exports = require('./cjs/history.js');
}
