import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import eslintPlugin from "vite-plugin-eslint";
import istanbul from "vite-plugin-istanbul";
import svgr from "vite-plugin-svgr";
import tsconfigPaths from "vite-tsconfig-paths";

// @ts-ignore
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, ".");
    const isCoverage = process.env.VITE_COVERAGE === "true";
    const sourcemap = isCoverage ? "inline" : undefined;

    const htmlPlugin = () => {
        return {
            name: "html-transform",
            transformIndexHtml(html: string) {
                return html.replace(/%(.*?)%/g, function (match, p1) {
                    return env[p1];
                });
            },
        };
    };

    const istanbulPlugin = isCoverage
        ? istanbul({
              checkProd: false,
              exclude: ["node_modules"],
              extension: [".js", ".jsx", ".ts", ".tsx"],
              forceBuildInstrument: true,
              include: "src/*",
              requireEnv: true,
          })
        : undefined;

    return {
        base: "./",
        build: {
            assetsDir: "static",
            emptyOutDir: true,
            outDir: "../internal/server/public_html",
            rollupOptions: {
                output: {
                    assetFileNames: ({ name }) => {
                        if (name && name.endsWith(".css")) {
                            return "static/css/[name].[hash].[ext]";
                        }

                        return "static/media/[name].[hash].[ext]";
                    },
                    chunkFileNames: `static/js/[name].[hash].js`,
                    entryFileNames: `static/js/[name].[hash].js`,
                },
            },
            sourcemap,
        },
        server: {
            open: false,
            port: 3000,
        },
        test: {
            coverage: {
                provider: "c8",
            },
            environment: "happy-dom",
            globals: true,
            onConsoleLog(log) {
                if (log.includes('No routes matched location "blank"')) return false;
            },
            setupFiles: ["src/setupTests.js"],
        },
        plugins: [eslintPlugin({ cache: false }), htmlPlugin(), istanbulPlugin, react(), svgr(), tsconfigPaths()],
    };
});
