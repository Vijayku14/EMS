import { getStore } from "@netlify/blobs";
import fs from "fs/promises";
import fsNormal from "fs";
import path from "path";
import PDFDocument from "pdfkit";

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

function decodeBase64Image(base64Str) {
  if (!base64Str || !base64Str.startsWith('data:image/')) return null;
  const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) return null;
  return Buffer.from(matches[2], 'base64');
}

function createPDF(employee, filePath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fsNormal.createWriteStream(filePath);
      doc.pipe(stream);

      // Title
      doc.fillColor('#0d6efd').fontSize(24).text('EMPLOYEE PROFILE REPORT', { align: 'center' });
      doc.moveDown(1);
      
      // Horizontal Line
      doc.strokeColor('#ccc').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(1);

      // Draw Photo if available
      let photoY = doc.y;
      let photoBuffer = decodeBase64Image(employee.photo);
      if (photoBuffer) {
        try {
          doc.image(photoBuffer, 445, photoY, { width: 100, height: 100 });
        } catch (e) {
          console.error("Error embedding photo in PDF:", e);
        }
      }

      // Column widths and offsets
      const col1X = 50;
      const col2X = 250;
      doc.fillColor('#333').fontSize(10);

      const renderField = (label, val, x, y) => {
        doc.font('Helvetica-Bold').text(`${label}: `, x, y, { continued: true });
        doc.font('Helvetica').text(val || 'N/A');
      };

      let currentY = photoY;
      const step = 18;

      renderField('Employee Code', employee.empCode, col1X, currentY);
      renderField('Establishment', employee.establishmentName, col2X, currentY);
      currentY += step;

      renderField('Full Name', employee.name, col1X, currentY);
      renderField('Owner Name', employee.ownerName, col2X, currentY);
      currentY += step;

      renderField('Father/Spouse', employee.fatherName, col1X, currentY);
      renderField('Gender', employee.gender, col2X, currentY);
      currentY += step;

      renderField('Birth Date', employee.birthDate, col1X, currentY);
      renderField('Blood Group', employee.bloodGroup, col2X, currentY);
      currentY += step;

      renderField('Nationality', employee.nationality, col1X, currentY);
      renderField('Education', employee.education, col2X, currentY);
      currentY += step;

      renderField('PAN Number', employee.panNo, col1X, currentY);
      renderField('Aadhaar Number', employee.aadhaarNo, col2X, currentY);
      currentY += step;

      renderField('Mobile', employee.mobile, col1X, currentY);
      renderField('Email', employee.email, col2X, currentY);
      currentY += step;

      renderField('Designation', employee.designation, col1X, currentY);
      renderField('Department', employee.department, col2X, currentY);
      currentY += step;

      renderField('Joining Date', employee.joiningDate, col1X, currentY);
      renderField('Employment Type', employee.employmentType, col2X, currentY);
      currentY += step;

      renderField('Identification Mark', employee.identificationMark, col1X, currentY);
      currentY += step * 1.5;

      // Make sure currentY goes below photo
      if (currentY < photoY + 110) {
        currentY = photoY + 110;
      }

      // Address section
      doc.strokeColor('#eee').lineWidth(1).moveTo(50, currentY).lineTo(545, currentY).stroke();
      currentY += 10;
      
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#0d6efd').text('ADDRESS DETAILS', col1X, currentY);
      currentY += 18;
      doc.fillColor('#333').fontSize(10);

      const permAddress = [employee.permPO, employee.permDistrict, employee.permState, employee.permPin].filter(Boolean).join(', ');
      renderField('Permanent Address', permAddress, col1X, currentY);
      currentY += step * 1.5;

      const presentAddress = [employee.presentPO, employee.presentDistrict, employee.presentState, employee.presentPin].filter(Boolean).join(', ');
      renderField('Present Address', presentAddress, col1X, currentY);
      currentY += step * 2;

      // Signature section
      let signBuffer = decodeBase64Image(employee.signUpload);
      if (signBuffer) {
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#0d6efd').text('SIGNATURE', col1X, currentY);
        currentY += 15;
        try {
          doc.image(signBuffer, col1X, currentY, { width: 120, height: 40 });
        } catch (e) {
          console.error("Error embedding signature in PDF:", e);
        }
      }

      doc.end();
      stream.on('finish', () => resolve(true));
      stream.on('error', (err) => reject(err));
    } catch (error) {
      reject(error);
    }
  });
}

async function saveLocalBackup(employee) {
  try {
    const projectRoot = process.cwd();
    const dataDir = path.join(projectRoot, "EMS_Data");
    const companyName = employee.establishmentName || "Unknown_Company";
    const safeCompany = sanitizeName(companyName);
    const safeEmpCode = sanitizeName(employee.empCode || "unknown");
    const companyDir = path.join(dataDir, safeCompany);
    
    await fs.mkdir(companyDir, { recursive: true });
    
    // Save JSON
    const jsonPath = path.join(companyDir, `${safeEmpCode}.json`);
    await fs.writeFile(jsonPath, JSON.stringify(employee, null, 2), "utf8");
    console.log(`[Local Backup] Saved individual JSON file: ${jsonPath}`);

    // Save PDF
    const pdfPath = path.join(companyDir, `${safeEmpCode}.pdf`);
    await createPDF(employee, pdfPath);
    console.log(`[Local Backup] Saved individual PDF file: ${pdfPath}`);
  } catch (err) {
    console.warn("[Local Backup] Failed to write local backup:", err.message);
  }
}

async function removeLocalBackup(employee) {
  try {
    const projectRoot = process.cwd();
    const dataDir = path.join(projectRoot, "EMS_Data");
    const companyName = employee.establishmentName || "Unknown_Company";
    const safeCompany = sanitizeName(companyName);
    const safeEmpCode = sanitizeName(employee.empCode || "unknown");
    
    const jsonPath = path.join(dataDir, safeCompany, `${safeEmpCode}.json`);
    const pdfPath = path.join(dataDir, safeCompany, `${safeEmpCode}.pdf`);
    
    try {
      await fs.unlink(jsonPath);
    } catch (e) {}
    try {
      await fs.unlink(pdfPath);
    } catch (e) {}
    console.log(`[Local Backup] Deleted individual files`);
  } catch (err) {
    // Ignore
  }
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
      await saveLocalBackup(newEmployee);
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
      await saveLocalBackup(updatedEmployee);
      return response(200, updatedEmployee);
    }

    // ── DELETE /api/employees?id=xxx ───────────────────────────────────────
    if (method === "DELETE") {
      if (!id) return response(400, { message: "Missing employee id" });
      const employees = await readAllEmployees(store);
      const employee = employees.find(emp => emp.id === id);
      
      await removeEmployee(store, id);
      if (employee) {
        await removeLocalBackup(employee);
      }
      return response(200, { success: true });
    }

    return response(405, { message: "Method not allowed" });
  } catch (err) {
    console.error("Handler error:", err);
    return response(500, { message: "Internal server error", error: err.message });
  }
};
