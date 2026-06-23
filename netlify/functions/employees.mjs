import { getStore } from "@netlify/blobs";

// ─── CORS helper ─────────────────────────────────────────────────────────────
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

function response(statusCode, body) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status: statusCode,
    headers: CORS_HEADERS,
  });
}

// ─── Blob store helpers ───────────────────────────────────────────────────────
function getEmployeeStore() {
  return getStore("employees");
}

function sanitizeName(name) {
  return (name || "unknown").trim().replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function readAllEmployees(store) {
  try {
    const { blobs } = await store.list();
    const all = [];
    for (const blob of blobs) {
      try {
        const raw = await store.get(blob.key);
        if (!raw) continue;
        const companyEmps = JSON.parse(raw);
        if (Array.isArray(companyEmps)) all.push(...companyEmps);
      } catch {
        // skip corrupt blob
      }
    }
    // Newest first
    return all.sort((a, b) => (b.id || 0) - (a.id || 0));
  } catch (err) {
    console.error("readAllEmployees error:", err);
    return [];
  }
}

async function getCompanyEmployees(store, companyName) {
  const key = sanitizeName(companyName);
  try {
    const raw = await store.get(key);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function saveCompanyEmployees(store, companyName, employees) {
  const key = sanitizeName(companyName);
  await store.set(key, JSON.stringify(employees));
}

async function saveEmployee(store, employee) {
  const companyName = employee.establishmentName || "Unknown_Company";
  const companyEmps = await getCompanyEmployees(store, companyName);

  const index = companyEmps.findIndex((e) => e.id === employee.id);
  if (index !== -1) {
    companyEmps[index] = employee;
  } else {
    companyEmps.unshift(employee);
  }

  await saveCompanyEmployees(store, companyName, companyEmps);
}

async function removeEmployee(store, id) {
  try {
    const { blobs } = await store.list();
    for (const blob of blobs) {
      try {
        const raw = await store.get(blob.key);
        if (!raw) continue;
        let companyEmps = JSON.parse(raw);
        if (!Array.isArray(companyEmps)) continue;
        const before = companyEmps.length;
        companyEmps = companyEmps.filter((e) => e.id !== id);
        if (companyEmps.length !== before) {
          await store.set(blob.key, JSON.stringify(companyEmps));
        }
      } catch {
        // skip
      }
    }
  } catch (err) {
    console.error("removeEmployee error:", err);
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async (req, context) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  let store;
  try {
    store = getEmployeeStore();
  } catch (err) {
    // Fallback for local dev without Netlify Blobs context
    console.warn("Blobs not available:", err.message);
    store = null;
  }

  // ── Fallback ─────────────────────────────────────────────────────────────
  if (!store) {
    return response(503, {
      message:
        "Storage not available. Run via `netlify dev` or deploy to Netlify for full functionality.",
    });
  }

  const method = req.method;
  const url = new URL(req.url);
  const idParam = url.searchParams.get("id");
  const id = idParam ? Number(idParam) : null;

  try {
    // ── GET /api/employees ─────────────────────────────────────────────────
    if (method === "GET") {
      const employees = await readAllEmployees(store);
      return response(200, employees);
    }

    // ── POST /api/employees ────────────────────────────────────────────────
    if (method === "POST") {
      const text = await req.text();
      const body = JSON.parse(text || "{}");
      const newEmployee = {
        id: Date.now(),
        ...body,
        createdAt: new Date().toISOString(),
      };
      await saveEmployee(store, newEmployee);
      return response(201, newEmployee);
    }

    // ── PUT /api/employees?id=xxx ──────────────────────────────────────────
    if (method === "PUT") {
      if (!id) return response(400, { message: "Missing employee id" });
      const text = await req.text();
      const body = JSON.parse(text || "{}");
      const updatedEmployee = {
        id,
        ...body,
        updatedAt: new Date().toISOString(),
      };
      // Remove from old company slot first (handles company name change)
      await removeEmployee(store, id);
      await saveEmployee(store, updatedEmployee);
      return response(200, updatedEmployee);
    }

    // ── DELETE /api/employees?id=xxx ───────────────────────────────────────
    if (method === "DELETE") {
      if (!id) return response(400, { message: "Missing employee id" });
      await removeEmployee(store, id);
      return response(200, { success: true });
    }

    return response(405, { message: "Method not allowed" });
  } catch (err) {
    console.error("Handler error:", err);
    return response(500, { message: "Internal server error", error: err.message });
  }
};
