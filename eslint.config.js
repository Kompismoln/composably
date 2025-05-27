import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  svelte.configs['flat/recommended'],

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    }
  },

  {
    files: ['**/*.svelte'],
    languageOptions: {
      globals: {
        ...globals.browser
      },
      parser: svelte.parser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.svelte']
      }
    }
  },

  {
    languageOptions: {
      globals: {
        ...globals.node
      }
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ]
    }
  },

  {
    ignores: [
      '.svelte-kit/**',
      'node_modules/**',
      'build/**',
      'dist/**',
      'coverage/**',
      '**/*.js',
      '**/*.svelte', // TODO: get z.infer to work in svelte components
      'vitest-setup-client.ts'
    ]
  }
);
