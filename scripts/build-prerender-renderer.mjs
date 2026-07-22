import { rspack } from "@rspack/core";
import renderConfig from "./rspack.prerender.config.mjs";

await new Promise((resolve, reject) => {
  const compiler = rspack(renderConfig);
  compiler.run((error, stats) => {
    const finish = (result) => {
      compiler.close((closeError) => {
        if (closeError) {
          reject(
            new Error(
              `Could not close the prerender renderer compiler: ${closeError.message}. Check for locked files under dist/prerender-renderer, then rerun just build-prerender-renderer.`,
            ),
          );
          return;
        }
        result();
      });
    };
    if (error) {
      finish(() =>
        reject(
          new Error(
            `Prerender renderer compilation failed: ${error.message}. Fix scripts/rspack.prerender.config.mjs or the reported source error, then rerun just build-prerender-renderer.`,
          ),
        ),
      );
      return;
    }
    if (stats?.hasErrors()) {
      finish(() =>
        reject(
          new Error(
            `${stats.toString({ colors: false })}\nFix the reported prerender renderer errors, then rerun just build-prerender-renderer.`,
          ),
        ),
      );
      return;
    }
    finish(resolve);
  });
});
