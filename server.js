const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs').promises;
const fsNormal = require('fs');
const PDFDocument = require('pdfkit');

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

async function saveIndividualEmployeeToDisk(employee) {
  const companyName = employee.establishmentName || 'Unknown_Company';
  const { companyDir } = await ensureCompanyDirectories(companyName);
  const safeEmpCode = sanitizeName(employee.empCode || 'unknown');
  
  // Save JSON
  const jsonPath = path.join(companyDir, `${safeEmpCode}.json`);
  await fs.writeFile(jsonPath, JSON.stringify(employee, null, 2), 'utf8');
  console.log(`✅ Saved individual JSON file for ${employee.name}: ${jsonPath}`);

  // Save PDF
  const pdfPath = path.join(companyDir, `${safeEmpCode}.pdf`);
  try {
    await createPDF(employee, pdfPath);
    console.log(`✅ Saved individual PDF file for ${employee.name}: ${pdfPath}`);
  } catch (err) {
    console.error(`❌ Error creating PDF for ${employee.name}:`, err);
  }
}

async function removeIndividualEmployeeFromDisk(employee) {
  if (!employee) return;
  const companyName = employee.establishmentName || 'Unknown_Company';
  const safeCompany = sanitizeName(companyName);
  const safeEmpCode = sanitizeName(employee.empCode || 'unknown');
  const companyDir = path.join(DATA_DIR, safeCompany);
  
  const jsonPath = path.join(companyDir, `${safeEmpCode}.json`);
  const pdfPath = path.join(companyDir, `${safeEmpCode}.pdf`);
  
  try {
    await fs.unlink(jsonPath);
  } catch (err) {}
  try {
    await fs.unlink(pdfPath);
  } catch (err) {}
  console.log(`✅ Removed individual files for ${employee.name}`);
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
