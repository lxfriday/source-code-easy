import babel from "@rollup/plugin-babel";
import { terser } from "rollup-plugin-terser";

const config = {
  input: "src/index",
  output: {
    file: "dist/bundle.min.js",
    format: "esm",
  },
  plugins: [babel({ babelHelpers: "bundled" }), terser()],
};

export default config;
