import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["cjs", "esm"],
    dts: false,
    clean: true,
    sourcemap: true,
    treeshake: true,
    minify: true,
    external: ["next", "react", "react-dom", "zod"],
});
