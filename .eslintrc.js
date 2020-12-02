module.exports = {
  root: true,
  env: {
    node: true
  },
  parser: "vue-eslint-parser",
  plugins: [
    '@typescript-eslint'
  ],
  extends: [
    'plugin:vue/essential',
    '@vue/standard',
    '@vue/typescript/recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parserOptions: {
    parser: "@typescript-eslint/parser",
    ecmaVersion: 2020
  },
  rules: {
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off'
  }
}
