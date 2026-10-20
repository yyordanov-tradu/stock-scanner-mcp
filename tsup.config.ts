import { defineConfig } from "tsup";

// tsup strips the `node:` prefix by default, which turns `node:sqlite` into a
// bare `sqlite` specifier that Node cannot resolve. Keep the prefix intact.
export default defineConfig({
  removeNodeProtocol: false,
});
