let count = 0;
const API_BASE = "/api";

// Load employees on page load
document.addEventListener("DOMContentLoaded", function () {
    loadEmployees();
});

async function loadEmployees() {
    try {
        const response = await fetch(`${API_BASE}/employees`);
        if (!response.ok) throw new Error("Failed to load employees");

        const employees = await response.json();
        const tableBody = document.getElementById("employeeTable");
        tableBody.innerHTML = "";
        
        employees.forEach(emp => {
            const row = `
                <tr>
                    <td>${emp.empCode || "N/A"}</td>
                    <td>${emp.name || "N/A"}</td>
                    <td>${emp.designation || "N/A"}</td>
                    <td>${emp.mobile || "N/A"}</td>
                </tr>`;
            tableBody.innerHTML += row;
        });
        
        count = employees.length;
        document.getElementById("totalEmp").innerText = count;
    } catch (error) {
        console.error("Error loading employees:", error);
        // Silently fail on load
    }
}

function getEmployeeFormData() {
    return {
        establishmentName: document.getElementById("establishmentName").value.trim(),
        ownerName: document.getElementById("ownerName").value.trim(),
        empCode: document.getElementById("empCode").value.trim(),
        name: document.getElementById("name").value.trim(),
        fatherName: document.getElementById("fatherName").value.trim(),
        bloodGroup: document.getElementById("bloodGroup").value,
        gender: document.getElementById("gender").value,
        birthDate: document.getElementById("birthDate").value,
        nationality: document.getElementById("nationality").value.trim(),
        education: document.getElementById("education").value.trim(),
        panNo: document.getElementById("panNo").value.trim(),
        aadhaarNo: document.getElementById("aadhaarNo").value.trim(),
        mobile: document.getElementById("mobile").value.trim(),
        identificationMark: document.getElementById("identificationMark").value.trim(),
        email: document.getElementById("email").value.trim(),
        designation: document.getElementById("designation").value.trim(),
        department: document.getElementById("department").value.trim(),
        joiningDate: document.getElementById("joiningDate").value,
        employmentType: document.getElementById("employmentType").value,
        bankName: document.getElementById("bankName").value.trim(),
        accountNo: document.getElementById("accountNo").value.trim(),
        addressCategory: document.getElementById("addressCategory").value,
        permPO: document.getElementById("permPO").value.trim(),
        permDistrict: document.getElementById("permDistrict").value.trim(),
        permState: document.getElementById("permState").value.trim(),
        permPin: document.getElementById("permPin").value.trim(),
        presentCategory: document.getElementById("presentCategory")?.value || "",
        presentPO: document.getElementById("presentPO").value.trim(),
        presentDistrict: document.getElementById("presentDistrict").value.trim(),
        presentState: document.getElementById("presentState").value.trim(),
        presentPin: document.getElementById("presentPin").value.trim()
    };
}

function restrictInput(input, options = {}) {
    const {
        allowLetters = false,
        allowDigits = true,
        maxLength = null,
        uppercase = false
    } = options;

    const allowedChars = `${allowLetters ? 'A-Za-z' : ''}${allowDigits ? '0-9' : ''}`;
    const allowedPattern = new RegExp(`[^${allowedChars}]`, 'g');

    input.addEventListener('input', () => {
        let value = input.value;

        if (allowedChars) {
            value = value.replace(allowedPattern, '');
        }

        if (uppercase) value = value.toUpperCase();
        if (maxLength) value = value.slice(0, maxLength);

        input.value = value;
    });
}

async function addEmployee() {
    const employee = getEmployeeFormData();

    if (!employee.empCode || !employee.name) {
        alert("Please enter Employee Code and Employee Name.");
        return;
    }

    try {
        console.log("Sending employee data:", employee);
        const response = await fetch(`${API_BASE}/employees`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(employee)
        });

        console.log("Response status:", response.status);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || errorData.message || "Failed to save employee");
        }

        const savedEmployee = await response.json();
        console.log("Employee saved:", savedEmployee);
        alert("Employee saved successfully!");
        
        // Clear form and reload employees
        loadEmployees();
    } catch (error) {
        console.error("Error details:", error);
        alert(`Error saving employee: ${error.message}`);
    }
}

async function findEmployeeByCode(empCode) {
    const response = await fetch(`${API_BASE}/employees`);
    if (!response.ok) throw new Error("Failed to load employees");
    const employees = await response.json();
    return employees.find((item) => item.empCode === empCode) || null;
}

async function updateEmployee() {
    const employee = getEmployeeFormData();

    if (!employee.empCode || !employee.name) {
        alert("Please enter Employee Code and Employee Name to update.");
        return;
    }

    try {
        const existing = await findEmployeeByCode(employee.empCode);
        if (!existing) {
            alert("Employee not found. Save the employee first.");
            return;
        }

        const response = await fetch(`${API_BASE}/employees?id=${existing.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(employee)
        });

        if (!response.ok) throw new Error("Failed to update employee");

        alert("Employee updated successfully");
        loadEmployees();
    } catch (error) {
        console.error(error);
        alert("Could not update employee.");
    }
}

async function deleteEmployee() {
    const employee = getEmployeeFormData();

    if (!employee.empCode) {
        alert("Please enter Employee Code to delete.");
        return;
    }

    try {
        const existing = await findEmployeeByCode(employee.empCode);
        if (!existing) {
            alert("Employee not found.");
            return;
        }

        const response = await fetch(`${API_BASE}/employees?id=${existing.id}`, {
            method: "DELETE"
        });

        if (!response.ok) throw new Error("Failed to delete employee");

        alert("Employee deleted successfully");
        loadEmployees();
    } catch (error) {
        console.error(error);
        alert("Could not delete employee.");
    }
}

function generatePDF() {
    createIDCard();
    window.print();
}

function createIDCard() {
    document.getElementById("idCard").style.display = "block";
    document.getElementById("cardCompany").innerText = document.getElementById("establishmentName").value || "Company Name";
    document.getElementById("cardOwner").innerText = document.getElementById("ownerName").value || "Owner Name";
    document.getElementById("cardName").innerText = document.getElementById("name").value || "Employee Name";
    document.getElementById("cardFather").innerText = document.getElementById("fatherName").value || "Father / Spouse Name";
    document.getElementById("cardCode").innerText = document.getElementById("empCode").value || "Employee Code";
    document.getElementById("cardDesignation").innerText = document.getElementById("designation").value || "Designation";
    document.getElementById("cardGender").innerText = document.getElementById("gender").value || "Gender";
    document.getElementById("cardBloodGroup").innerText = document.getElementById("bloodGroup").value || "Blood Group";
    document.getElementById("cardMobile").innerText = document.getElementById("mobile").value || "Mobile Number";
    document.getElementById("cardPan").innerText = document.getElementById("panNo").value || "PAN Number";
    document.getElementById("cardAadhaar").innerText = document.getElementById("aadhaarNo").value || "Aadhaar Number";

    const presentAddress = [
        document.getElementById("presentPO").value.trim(),
        document.getElementById("presentDistrict").value.trim(),
        document.getElementById("presentState").value.trim(),
        document.getElementById("presentPin").value.trim()
    ].filter(Boolean).join(", ");

    document.getElementById("cardAddress").innerText = presentAddress || "Present Address";
    document.getElementById("cardEmail").innerText = document.getElementById("email").value || "Email Address";
    document.getElementById("cardPhoto").src = document.getElementById("preview").src || "https://via.placeholder.com/78";

    const qrData = [
        "Employee Code: " + (document.getElementById("empCode").value || ""),
        "Name: " + (document.getElementById("name").value || ""),
        "Designation: " + (document.getElementById("designation").value || ""),
        "Mobile: " + (document.getElementById("mobile").value || "")
    ].join("\n");

    const qrBox = document.getElementById("qrcode");
    if (qrBox) {
        qrBox.innerHTML = "";
        new QRCode(qrBox, {
            text: qrData,
            width: 72,
            height: 72
        });
    }
}

function previewFile(input) {
    const file = input.files && input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
        input.dataset.previewUrl = event.target.result;
    };
    reader.readAsDataURL(file);
}

function showPreview(inputId) {
    const input = document.getElementById(inputId);
    const file = input && input.files && input.files[0];
    const modal = new bootstrap.Modal(document.getElementById("previewModal"));
    const imagePreview = document.getElementById("imagePreview");
    const pdfPreview = document.getElementById("pdfPreview");

    if (!file) {
        alert("Please select a file first.");
        return;
    }

    const fileUrl = URL.createObjectURL(file);
    const isImage = file.type.startsWith("image/");

    imagePreview.classList.add("d-none");
    pdfPreview.classList.add("d-none");
    imagePreview.src = "";
    pdfPreview.src = "";

    if (isImage) {
        imagePreview.src = fileUrl;
        imagePreview.classList.remove("d-none");
    } else {
        pdfPreview.src = fileUrl;
        pdfPreview.classList.remove("d-none");
    }

    modal.show();
}

document.getElementById("photoInput")?.addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
        document.getElementById("preview").src = event.target.result;
    };
    reader.readAsDataURL(file);
});

function copyPermanentAddress() {
    const sameAsPermanent = document.getElementById("sameAsPermanent");
    if (!sameAsPermanent) return;

    const permanentFields = {
        presentPO: document.getElementById("permPO")?.value || "",
        presentDistrict: document.getElementById("permDistrict")?.value || "",
        presentState: document.getElementById("permState")?.value || "",
        presentPin: document.getElementById("permPin")?.value || ""
    };

    document.getElementById("presentPO").value = sameAsPermanent.value === "yes" ? permanentFields.presentPO : "";
    document.getElementById("presentDistrict").value = sameAsPermanent.value === "yes" ? permanentFields.presentDistrict : "";
    document.getElementById("presentState").value = sameAsPermanent.value === "yes" ? permanentFields.presentState : "";
    document.getElementById("presentPin").value = sameAsPermanent.value === "yes" ? permanentFields.presentPin : "";
}

const panNoField = document.getElementById("panNo");
if (panNoField) restrictInput(panNoField, { allowLetters: true, allowDigits: true, maxLength: 10, uppercase: true });

const aadhaarNoField = document.getElementById("aadhaarNo");
if (aadhaarNoField) restrictInput(aadhaarNoField, { allowLetters: false, allowDigits: true, maxLength: 12 });

const permPinField = document.getElementById("permPin");
if (permPinField) restrictInput(permPinField, { allowLetters: false, allowDigits: true, maxLength: 6 });

const presentPinField = document.getElementById("presentPin");
if (presentPinField) restrictInput(presentPinField, { allowLetters: false, allowDigits: true, maxLength: 6 });

const mobileField = document.getElementById("mobile");
if (mobileField) restrictInput(mobileField, { allowLetters: false, allowDigits: true, maxLength: 10 });

const accountNoField = document.getElementById("accountNo");
if (accountNoField) restrictInput(accountNoField, { allowLetters: false, allowDigits: true, maxLength: 20 });

const sameAsPermanent = document.getElementById("sameAsPermanent");
if (sameAsPermanent) {
    sameAsPermanent.addEventListener("change", copyPermanentAddress);

    ["permPO", "permDistrict", "permState", "permPin"].forEach((id) => {
        const field = document.getElementById(id);
        if (field) {
            field.addEventListener("input", () => {
                if (sameAsPermanent.value === "yes") {
                    copyPermanentAddress();
                }
            });
        }
    });
}

