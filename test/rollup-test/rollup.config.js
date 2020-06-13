import babel from "@rollup/plugin-babel";
import resolve from "@rollup/plugin-node-resolve";
import { terser } from "rollup-plugin-terser";
import commonjs from "rollup-plugin-commonjs";
import replace from "rollup-plugin-replace";

const config = {
  input: "src/index",
  output: {
    file: "dist/bundle.min.js",
    format: "esm",
    name: "Test",
  },
  plugins: [
    babel({ babelHelpers: "bundled" }),
    terser(),
    resolve(),
    commonjs(),
    replace({
      __DEV__: true,
    }),
  ],
};

export default config;
