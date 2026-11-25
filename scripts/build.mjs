const apiUrl = process.env.BUN_PUBLIC_API_URL ?? "";
const supabaseUrl = process.env.BUN_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.BUN_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
const appRedirectUrl = process.env.BUN_PUBLIC_APP_REDIRECT_URL ?? "";

const result = await Bun.build({
  entrypoints: ["./src/index.html"],
  outdir: "./dist",
  sourcemap: "external",
  target: "browser",
  minify: true,
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    __PSYCONNECT_API_URL__: JSON.stringify(apiUrl),
    __PSYCONNECT_SUPABASE_URL__: JSON.stringify(supabaseUrl),
    __PSYCONNECT_SUPABASE_ANON_KEY__: JSON.stringify(supabaseAnonKey),
    __PSYCONNECT_APP_REDIRECT_URL__: JSON.stringify(appRedirectUrl),
  },
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

console.log(`Built ${result.outputs.length} files in dist/`);
