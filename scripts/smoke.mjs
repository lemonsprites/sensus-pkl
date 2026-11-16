import "dotenv/config";

const base = process.env.SMOKE_BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`;
let pass = 0;
let fail = 0;

function check(name, ok, extra = "") {
  if (ok) {
    pass += 1;
    console.log(`PASS  ${name}`);
  } else {
    fail += 1;
    console.log(`FAIL  ${name}${extra ? ` :: ${extra}` : ""}`);
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${base}/api${path}`, options);
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, body };
}

const health = await request("/health");
check("health ok", health.status === 200 && health.body?.ok === true, JSON.stringify(health.body));

const email = process.env.SEED_SUPERADMIN_EMAIL;
const password = process.env.SEED_SUPERADMIN_PASSWORD;

if (!email || !password) {
  check("SEED_SUPERADMIN_EMAIL/PASSWORD tersedia", false);
} else {
  const login = await request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  check("login SUPERADMIN", login.status === 200 && !!login.body?.data?.token, String(login.status));

  const token = login.body?.data?.token;
  const auth = { Authorization: `Bearer ${token}` };

  const hierarchy = await request("/hierarki", { headers: auth });
  check(
    "hierarki",
    hierarchy.status === 200 && Array.isArray(hierarchy.body?.data?.buildings),
    String(hierarchy.status),
  );

  const dashboard = await request("/dashboard?tab=PERLU_DOKUMEN&limit=1", { headers: auth });
  check("dashboard admin", dashboard.status === 200 && !!dashboard.body?.data?.counts, String(dashboard.status));

  const code = process.env.SMOKE_KODE_REGISTER;
  if (code) {
    const scan = await request(`/scan/${encodeURIComponent(code)}`, { headers: auth });
    check("scan kode register", scan.status === 200, String(scan.status));
  }
}

console.log(`\nSMOKE pass=${pass} fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);
