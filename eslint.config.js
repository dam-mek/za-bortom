import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactPlugin from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', 'functions', '.claude'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: '18.3' },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'warn',
    },
  },
  {
    files: ['src/game/**/*.ts'],
    rules: {
      // src/game/ — pure TS. React-правила здесь не применимы: запрещаем сам импорт
      // React и отключаем react-hooks/* (наши функции вроде useFirstAid — обычные хелперы).
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-dom'], message: 'src/game/ должна быть pure (без React)' },
            { group: ['peerjs'], message: 'src/game/ не знает про сеть' },
            { group: ['xstate', '@xstate/*'], message: 'src/game/ не использует XState' },
            { group: ['zustand'], message: 'src/game/ не использует Zustand' },
          ],
        },
      ],
    },
  },
  prettier,
)
