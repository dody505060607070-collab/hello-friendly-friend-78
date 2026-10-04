import { createClient } from "@supabase/supabase-js";

// عميل مخصّص لقاعدة بيانات "مثراء" — يُستخدم للشات المشترك فقط.
// لا ننشئ جداول ولا نعدّل بياناتهم؛ نقرأ ونكتب في group_messages/profiles فقط.
export const MITHRAA_URL = "https://gfljbkxvcnraitwsdegw.supabase.co";
const MITHRAA_KEY = "sb_publishable_394UeidQaJyUHP67_RAa-g_vP4xfF54";

function mithraaFetch(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (headers.get("Authorization") === `Bearer ${MITHRAA_KEY}`) headers.delete("Authorization");
  headers.set("apikey", MITHRAA_KEY);
  return fetch(input, { ...init, headers });
}

function create() {
  return createClient(MITHRAA_URL, MITHRAA_KEY, {
    global: { fetch: mithraaFetch },
    auth: {
      storageKey: "mithraa-chat-auth",
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _client: ReturnType<typeof create> | undefined;

export const mithraa = new Proxy({} as ReturnType<typeof create>, {
  get(_t, prop, receiver) {
    if (!_client) _client = create();
    return Reflect.get(_client, prop, receiver);
  },
});
