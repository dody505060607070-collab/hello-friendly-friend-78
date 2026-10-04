import { createFileRoute } from "@tanstack/react-router";

/** يقدّم ملفات التخزين المحلي على الخادم (Hostinger VPS). */
export const Route = createFileRoute("/api/public/files/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const key = (params as Record<string, string>)["_splat"] ?? "";
        if (!key || !key.startsWith("property-media/")) return new Response("Not found", { status: 404 });
        try {
          const { assertAllowedStorageKey, readLocalFile, mimeFor } = await import("@/lib/storage.server");
          assertAllowedStorageKey(key);
          const bytes = await readLocalFile(key);
          return new Response(new Uint8Array(bytes), {
            headers: {
              "Content-Type": mimeFor(key),
              "X-Content-Type-Options": "nosniff",
              "Content-Security-Policy": "default-src 'none'; sandbox",
              "Cache-Control": "public, max-age=31536000, immutable",
            },
          });
        } catch {
          return new Response("Not found", { status: 404 });
        }
      },
    },
  },
});
