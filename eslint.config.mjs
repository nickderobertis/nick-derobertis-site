import nx from "@nx/eslint-plugin";
import parser from "@typescript-eslint/parser";
export default [
  { ignores: [".nx/**", "coverage/**", "dist/**", "node_modules/**"] },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: { parser },
    plugins: { "@nx": nx },
    rules: {
      "@nx/enforce-module-boundaries": [
        "error",
        {
          enforceBuildableLibDependency: true,
          depConstraints: [
            {
              sourceTag: "type:shared",
              onlyDependOnLibsWithTags: ["type:shared"],
            },
            {
              sourceTag: "type:layout",
              onlyDependOnLibsWithTags: ["type:shared"],
            },
            {
              sourceTag: "type:app",
              onlyDependOnLibsWithTags: ["type:shared", "type:layout"],
            },
            {
              sourceTag: "type:remote",
              onlyDependOnLibsWithTags: ["type:shared", "type:remote"],
            },
            {
              sourceTag: "scope:bio",
              onlyDependOnLibsWithTags: ["type:shared"],
            },
            {
              sourceTag: "scope:courses",
              onlyDependOnLibsWithTags: ["type:shared"],
            },
            {
              sourceTag: "scope:software",
              onlyDependOnLibsWithTags: ["type:shared"],
            },
            {
              sourceTag: "scope:skills",
              onlyDependOnLibsWithTags: ["type:shared"],
            },
            {
              sourceTag: "scope:research",
              onlyDependOnLibsWithTags: ["type:shared", "scope:software"],
            },
            {
              sourceTag: "scope:timeline",
              onlyDependOnLibsWithTags: ["type:shared"],
            },
            { sourceTag: "type:e2e", onlyDependOnLibsWithTags: ["type:app"] },
          ],
        },
      ],
    },
  },
];
