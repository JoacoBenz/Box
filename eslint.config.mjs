import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      'no-empty': ['error', { allowEmptyCatch: false }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'prefer-const': 'warn',
      eqeqeq: ['error', 'smart'],
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '__tests__/**/*'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['lib/logger.ts', 'lib/env.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['scripts/**/*', 'prisma/seed*.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'app/generated/**',
    'coverage/**',
  ]),
]);

export default eslintConfig;
