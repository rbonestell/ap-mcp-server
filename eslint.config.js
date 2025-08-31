import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
	{ ignores: ["dist"] },
	{
		extends: [js.configs.recommended, ...tseslint.configs.recommended],
		files: ["**/*.{ts,tsx}"],
		languageOptions: {
			ecmaVersion: 2020,
			globals: globals.browser,
			parser: tsParser,
			parserOptions: {
				ecmaVersion: 2020,
				sourceType: "module",
			},
		},
		plugins: {
			"@typescript-eslint": tsPlugin,
			"@stylistic": stylistic,
		},
		rules: {
			"@typescript-eslint/no-unused-vars": [
				"warn",
				{ argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
			],
			// Remove formatting rules - let Prettier handle these
			"@typescript-eslint/no-explicit-any": "warn",
		},
	},
	// Prettier config must be last to override conflicting rules
	eslintConfigPrettier
);
