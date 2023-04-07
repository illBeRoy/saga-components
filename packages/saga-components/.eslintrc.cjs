module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  overrides: [],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['react', '@typescript-eslint', 'ban', 'prettier'],
  rules: {
    'prettier/prettier': ['error', { singleQuote: true }],
    'react/react-in-jsx-scope': ['off'],
    '@typescript-eslint/ban-types': ['error', { types: { '{}': false } }],
    'ban/ban': [
      'error',
      { name: ['it', 'skip'], message: 'Do not skip tests' },
      { name: ['it', 'only'], message: 'No focused tests' },
      { name: ['describe', 'skip'], message: 'Do not skip tests' },
      { name: ['describe', 'only'], message: 'No focused tests' },
    ],
  },
};
