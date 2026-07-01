const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

// ── Data storage: uses a local "EMS_Data" folder inside the project ──────────
const DATA_DIR = path.join(__dirname, 'EMS_Data');

function sanitizeName(name) {
  return (name || 'unknown').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
}

async function ensureCompanyDirectories(companyName) {
  const safeCompany = sanitizeName(companyName);
  const companyDir = path.join(DATA_DIR, safeCompany);
  const uploadsDir = path.join(companyDir, 'uploads');
  try {
    await fs.mkdir(companyDir, { recursive: true });
    await fs.mkdir(uploadsDir, { recursive: true });
  } catch (err) {
    console.error('❌ Failed to create directories for company:', companyName, err);
  }
  return { companyDir, uploadsDir, safeCompany };
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(__dirname));          // serves proj1.html, proj1.js, etc.
app.use('/data', express.static(DATA_DIR)); // serves uploaded files

// ── Helper: save base64 image/doc to disk ────────────────────────────────────
async function saveBase64File(base64Data, empCode, fieldName, companyName) {
  if (!base64Data || !base64Data.startsWith('data:')) {
    return base64Data;
  }
  try {
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return base64Data;

    const mimeType = matches[1];
    const base64Content = matches[2];
    const buffer = Buffer.from(base64Content, 'base64');

    let ext = 'png';
    if (mimeType === 'application/pdf') {
      ext = 'pdf';
    } else {
      const parts = mimeType.split('/');
      if (parts.length === 2) ext = parts[1];
    }

    const safeEmpCode = sanitizeName(empCode);
    const fileName = `${safeEmpCode}_${fieldName}_${Date.now()}.${ext}`;
    const { uploadsDir, safeCompany } = await ensureCompanyDirectories(companyName);
    const filePath = path.join(uploadsDir, fileName);

    await fs.writeFile(filePath, buffer);
    console.log(`✅ Saved file for ${companyName}: ${filePath}`);
    return `/data/${safeCompany}/uploads/${fileName}`;
  } catch (error) {
    console.error(`❌ Error saving base64 file for ${fieldName}:`, error);
    return base64Data;
  }
}

async function processEmployeeImages(employee, companyName) {
  const imageFields = ['photoUrl', 'dlUrl', 'panUrl', 'aadhaarUrl', 'signUrl', 'vtcUrl', 'imeUrl'];
  for (const field of imageFields) {
    if (employee[field]) {
      employee[field] = await saveBase64File(
        employee[field],
        employee.empCode || 'unknown',
        field,
        companyName
      );
    }
  }
  return employee;
}

// ── Disk CRUD helpers ─────────────────────────────────────────────────────────
async function readAllEmployeesFromDisk() {
  const employees = [];
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const jsonPath = path.join(DATA_DIR, entry.name, 'employees.json');
        try {
          const data = await fs.readFile(jsonPath, 'utf8');
          const companyEmps = JSON.parse(data);
          if (Array.isArray(companyEmps)) employees.push(...companyEmps);
        } catch {
          // File might not exist yet for this company
        }
      }
    }
  } catch (err) {
    console.error('Error reading employees from disk:', err);
  }
  return employees.sort((a, b) => (b.id || 0) - (a.id || 0));
}

async function saveEmployeeToDisk(employee) {
  const companyName = employee.establishmentName || 'Unknown_Company';
  const { companyDir } = await ensureCompanyDirectories(companyName);
  const jsonPath = path.join(companyDir, 'employees.json');

  let companyEmps = [];
  try {
    const data = await fs.readFile(jsonPath, 'utf8');
    companyEmps = JSON.parse(data);
    if (!Array.isArray(companyEmps)) companyEmps = [];
  } catch {
    // No file yet
  }

  const index = companyEmps.findIndex(emp => emp.id === employee.id);
  if (index !== -1) {
    companyEmps[index] = employee;
  } else {
    companyEmps.unshift(employee);
  }

  await fs.writeFile(jsonPath, JSON.stringify(companyEmps, null, 2), 'utf8');
}

async function saveIndividualEmployeeToDisk(employee) {
  const companyName = employee.establishmentName || 'Unknown_Company';
  const { companyDir } = await ensureCompanyDirectories(companyName);
  const safeEmpCode = sanitizeName(employee.empCode || 'unknown');
  const individualPath = path.join(companyDir, `${safeEmpCode}.json`);
  
  await fs.writeFile(individualPath, JSON.stringify(employee, null, 2), 'utf8');
  console.log(`✅ Saved individual file for ${employee.name}: ${individualPath}`);
}

async function removeIndividualEmployeeFromDisk(employee) {
  if (!employee) return;
  const companyName = employee.establishmentName || 'Unknown_Company';
  const safeCompany = sanitizeName(companyName);
  const safeEmpCode = sanitizeName(employee.empCode || 'unknown');
  const individualPath = path.join(DATA_DIR, safeCompany, `${safeEmpCode}.json`);
  try {
    await fs.unlink(individualPath);
    console.log(`✅ Removed individual file for ${employee.name}: ${individualPath}`);
  } catch (err) {
    // Ignore if file doesn't exist
  }
}

async function removeEmployeeFromDisk(id) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const jsonPath = path.join(DATA_DIR, entry.name, 'employees.json');
        try {
          const data = await fs.readFile(jsonPath, 'utf8');
          let companyEmps = JSON.parse(data);
          if (Array.isArray(companyEmps)) {
            const before = companyEmps.length;
            companyEmps = companyEmps.filter(emp => emp.id !== id);
            if (companyEmps.length !== before) {
              await fs.writeFile(jsonPath, JSON.stringify(companyEmps, null, 2), 'utf8');
              console.log(`Removed employee ${id} from company ${entry.name}`);
            }
          }
        } catch {
          // ignore
        }
      }
    }
  } catch (err) {
    console.error('Error removing employee from disk:', err);
  }
}

// ── REST API ──────────────────────────────────────────────────────────────────
app.get('/api/employees', async (req, res) => {
  try {
    const data = await readAllEmployeesFromDisk();
    res.json(data);
  } catch (error) {
    console.error('GET /api/employees error:', error);
    res.status(500).json({ message: 'Could not load employees', error: error.message });
  }
});

app.post('/api/employees', async (req, res) => {
  try {
    let newEmployee = { id: Date.now(), ...req.body, createdAt: new Date().toISOString() };
    const companyName = newEmployee.establishmentName || 'Unknown_Company';
    newEmployee = await processEmployeeImages(newEmployee, companyName);
    await saveEmployeeToDisk(newEmployee);
    await saveIndividualEmployeeToDisk(newEmployee);
    res.status(201).json(newEmployee);
  } catch (error) {
    console.error('POST /api/employees error:', error);
    res.status(500).json({ message: 'Could not save employee', error: error.message });
  }
});

app.put('/api/employees/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    let updatedEmployee = { id, ...req.body, updatedAt: new Date().toISOString() };
    const companyName = updatedEmployee.establishmentName || 'Unknown_Company';
    updatedEmployee = await processEmployeeImages(updatedEmployee, companyName);
    await removeEmployeeFromDisk(id);
    await saveEmployeeToDisk(updatedEmployee);
    await saveIndividualEmployeeToDisk(updatedEmployee);
    res.json(updatedEmployee);
  } catch (error) {
    console.error('PUT /api/employees/:id error:', error);
    res.status(500).json({ message: 'Could not update employee', error: error.message });
  }
});

app.delete('/api/employees/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const employees = await readAllEmployeesFromDisk();
    const employee = employees.find(emp => emp.id === id);
    
    await removeEmployeeFromDisk(id);
    if (employee) {
      await removeIndividualEmployeeFromDisk(employee);
    }
    res.status(204).send();
  } catch (error) {
    console.error('DELETE /api/employees/:id error:', error);
    res.status(500).json({ message: 'Could not delete employee', error: error.message });
  }
});

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  await fs.mkdir(DATA_DIR, { recursive: true });
  console.log(`\n🚀 Employee Management System running!`);
  console.log(`   → Open in browser: http://localhost:${PORT}/proj1.html`);
  console.log(`   → Data stored at:  ${DATA_DIR}\n`);
});
