import { createFileRoute } from "@tanstack/react-router";

/** يقدّم ملفات التخزين المحلي على الخادم (Hostinger VPS). */
export const Route = createFileRoute("/api/public/files/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const key = (params as Record<string, string>)["_splat"] ?? "";
        if (!key) return new Response("Not found", { status: 404 });
        try {
          const { readLocalFile, mimeFor } = await import("@/lib/storage.server");
          const bytes = await readLocalFile(key);
          return new Response(new Uint8Array(bytes), {
            headers: {
              "Content-Type": mimeFor(key),
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
