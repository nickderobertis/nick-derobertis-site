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
              onlyDependOnLibsWithTags: [
                "type:shared",
                "type:remote",
                "type:data-core",
                "type:data-domain",
              ],
            },
            {
              sourceTag: "type:data-core",
              onlyDependOnLibsWithTags: [],
            },
            {
              sourceTag: "type:data-domain",
              onlyDependOnLibsWithTags: ["type:data-core"],
            },
            {
              sourceTag: "scope:bio",
              onlyDependOnLibsWithTags: ["type:shared"],
            },
            {
              sourceTag: "scope:courses",
              onlyDependOnLibsWithTags: [
                "type:shared",
                "type:data-core",
                "data:courses",
              ],
            },
            {
              sourceTag: "scope:software",
              onlyDependOnLibsWithTags: [
                "type:shared",
                "type:data-core",
                "data:software",
              ],
            },
            {
              sourceTag: "scope:research",
              onlyDependOnLibsWithTags: [
                "type:shared",
                "type:data-core",
                "data:research",
              ],
            },
            {
              sourceTag: "scope:home",
              onlyDependOnLibsWithTags: [
                "type:shared",
                "type:data-core",
                "data:home",
                "scope:home-carousel",
                "scope:home-cards",
                "scope:home-story",
                "scope:home-contact",
                "scope:skills",
              ],
            },
            {
              sourceTag: "scope:home-carousel",
              onlyDependOnLibsWithTags: [
                "type:shared",
                "type:data-core",
                "data:home",
              ],
            },
            {
              sourceTag: "scope:home-cards",
              onlyDependOnLibsWithTags: [
                "type:shared",
                "type:data-core",
                "data:home",
              ],
            },
            {
              sourceTag: "scope:home-story",
              onlyDependOnLibsWithTags: [
                "type:shared",
                "type:data-core",
                "data:home",
              ],
            },
            {
              sourceTag: "scope:home-contact",
              onlyDependOnLibsWithTags: [
                "type:shared",
                "type:data-core",
                "data:home",
              ],
            },
            {
              sourceTag: "scope:timeline",
              onlyDependOnLibsWithTags: [
                "type:shared",
                "type:data-core",
                "data:timeline",
              ],
            },
            {
              sourceTag: "scope:skills",
              onlyDependOnLibsWithTags: [
                "type:shared",
                "type:data-core",
                "data:skills",
              ],
            },
            {
              sourceTag: "scope:awards",
              onlyDependOnLibsWithTags: [
                "type:shared",
                "type:data-core",
                "data:awards",
              ],
            },
            { sourceTag: "type:e2e", onlyDependOnLibsWithTags: ["type:app"] },
          ],
        },
      ],
    },
  },
];
