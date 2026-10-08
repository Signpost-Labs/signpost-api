module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.eslint.json',
    tsconfigRootDir: __dirname,
    ecmaVersion: 2020,
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: {
    node: true,
    jest: true,
    es2021: true
  },
  rules: {
    '@typescript-eslint/no-unused-vars': 'off',
    // New console.* calls in src/ must go through the structured logger
    // (src/utils/logger.ts) so logs stay level-gated, redacted and
    // correlation-id tagged. See overrides below for the deliberate exceptions.
    'no-console': 'error',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-var-requires': 'off',
    'no-empty': 'off',
    // Catch imports of packages not declared in dependencies/devDependencies.
    // This prevents a repeat of issue #1417 where @envelop/core was used via
    // a transitive dependency without being declared directly.
    'import/no-extraneous-dependencies': ['error', { devDependencies: ['tests/**/*.ts', 'scripts/**/*.ts', '**/*.test.ts', '**/*.spec.ts'] }]
  },
  overrides: [
    {
      // The logger itself writes to the console; nothing else should.
      // (logger.ts also uses console.debug/console.info, which the base
      // allowlist (warn/error only) doesn't cover.)
      files: ['src/utils/logger.ts'],
      rules: { 'no-console': 'off' }
    }
    ,
    {
      // The unredacted audit path deliberately bypasses the structured
      // logger: logger.* calls are gated by config.logLevel, but audit-trail
      // entries (src/services/audit.ts) must never be suppressible via
      // LOG_LEVEL for compliance reasons.
      files: ['src/utils/logRedaction.ts'],
      rules: { 'no-console': 'off' }
    }
    ,
    {
      // config.ts cannot use the structured logger: logger.ts imports config
      // for logLevel gating, and config's own startup/validation logging runs
      // during its own module evaluation (the config binding is still in TDZ),
      // so importing logger here would be a circular dependency that crashes
      // startup.
      files: ['src/config.ts'],
      rules: { 'no-console': 'off' }
    }
    ,
    {
      // Browser bundle (eventStream.ts uses navigator.locks/BroadcastChannel/
      // EventSource with zero imports) and the Next.js API routes under
      // pages/api: the backend logger pulls node-only dependencies
      // (AsyncLocalStorage, process.env-validated config which throws on
      // missing secrets), so it must not be coupled into the frontend.
      files: ['src/frontend/**/*.ts'],
      rules: { 'no-console': 'off' }
    }
    ,
    {
      // Tests sometimes import helpers or types that are intentionally unused
      // during setup; treat unused vars as warnings in tests to avoid CI failures.
      // Console output in tests (debug/progress) is fine and stays out of src/.
      files: ['tests/**/*.ts'],
      rules: {
        '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        'no-console': 'off'
      }
    }
    ,
    {
      // scripts/*.ts are standalone CLI tools meant to print directly to the
      // terminal for a human operator (banners, progress, summaries). The
      // shared logger prepends level tags and is gated by config.logLevel,
      // which would mangle formatted output and can suppress it entirely —
      // neither is appropriate for a script whose job is to report its own
      // progress. console is intentional here, not an oversight.
      files: ['scripts/*.ts'],
      rules: { 'no-console': 'off' }
    }
  ]
};
