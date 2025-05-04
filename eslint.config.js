// eslint.config.js
import js from '@eslint/js'; // Provides recommended JS rules
import ts from 'typescript-eslint'; // Provides TS parser and recommended rules
import svelte from 'eslint-plugin-svelte'; // Provides Svelte parser and rules
import prettier from 'eslint-config-prettier'; // Disables conflicting rules (run last)
import globals from 'globals'; // Provides environment globals like browser, node

export default [
  // 1. Base JS rules
  js.configs.recommended,

  // 2. TypeScript Configuration (applies recommended rules globally for TS)
  ...ts.configs.recommended,

  // 3. Svelte Configuration (applies recommended rules globally for Svelte)
  ...svelte.configs['flat/recommended'],

  // 4. Svelte-specific PARSER config & BROWSER globals
  //    (Keep parser setup here, but move shared rules out)
  {
    files: ['**/*.svelte'], // Target Svelte files specifically
    languageOptions: {
      parser: svelte.parser, // Use the Svelte parser
      parserOptions: {
        parser: ts.parser, // Tell Svelte parser to use the TS parser for script blocks
        extraFileExtensions: ['.svelte'] // Ensure TS parser recognizes .svelte
      },
      globals: {
        ...globals.browser // Apply browser globals ONLY to Svelte files
        // Removed Node globals, added in the general block below
      }
    }
    // Rules moved to the general block below
  },

  // 5. GENERAL Rule Customizations + NODE Globals
  //    (This block applies globally where rules are relevant, AFTER recommended sets)
  {
    languageOptions: {
      globals: {
        ...globals.node // Apply Node.js globals generally (for .ts, .js, potentially Svelte script blocks)
      }
    },
    rules: {
      // Disable base JS rule, prefer TS version
      'no-unused-vars': 'off',

      // Configure the @typescript-eslint/no-unused-vars rule globally
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ]

      // Add any other general rule overrides/customizations here
      // e.g., '@typescript-eslint/no-explicit-any': 'warn',
    }
  },

  // 6. Ignore generated files and node_modules
  {
    ignores: [
      '.svelte-kit/**', // Ignore SvelteKit build outputs
      'node_modules/**',
      'build/**',
      'dist/**'
      // Add any other directories/files you want to ignore
    ]
  },

  // 7. Prettier Configuration (comes last to disable conflicting rules)
  prettier
];
