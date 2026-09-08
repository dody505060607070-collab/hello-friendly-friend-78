import { createFileRoute } from "@tanstack/react-router";

const BASE_URL = "https://friendly-fellow-kit.lovable.app";

/** الصفحات العامة القابلة للأرشفة فقط (لا لوحة تحكم ولا بوابة عميل). */
const STATIC_PATHS = [
  "/",
  "/rent",
  "/sale",
  "/about",
  "/contact",
  "/list-property",
  "/privacy",
  "/terms",
];

function xmlEscape(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!,
  );
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const paths = new Set(STATIC_PATHS);

        try {
          const { createClient } = await import("@supabase/supabase-js");
          const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
          const supabase = createClient(process.env["SUPABASE_URL"]!, key, {
            auth: { persistSession: false, autoRefreshToken: false },
            global: {
              fetch: (input, init) => {
                const headers = new Headers(init?.headers);
                if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`)
                  headers.delete("Authorization");
                headers.set("apikey", key);
                return fetch(input, { ...init, headers });
              },
            },
          });

          const pageSize = 1000;
          for (let offset = 0; ; ) {
            const { data, error } = await supabase
              .from("properties")
              .select("code")
              .eq("is_visible", true)
              .order("code")
              .range(offset, offset + pageSize - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;
            for (const row of data)
              if (row.code) paths.add(`/properties/${encodeURIComponent(row.code)}`);
            offset += data.length;
          }
        } catch (error) {
          return new Response(`Sitemap generation failed: ${String(error)}`, {
            status: 500,
            headers: { "Cache-Control": "no-store" },
          });
        }

        const urls = [...paths]
          .map((path) => `<url><loc>${xmlEscape(new URL(path, BASE_URL).href)}</loc></url>`)
          .join("");

        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
          {
            headers: {
              "Content-Type": "application/xml",
              "Cache-Control": "public, max-age=3600",
            },
          },
        );
      },
    },
  },
});
