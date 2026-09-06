import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

// NOTE: eslint-config-next 16 ships NATIVE flat config (arrays of config objects).
// Do not wrap it in FlatCompat/@eslint/eslintrc — that throws
// "Converting circular structure to JSON". Spread the arrays directly.
const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts", "out/**"],
  },
];

export default eslintConfig;
