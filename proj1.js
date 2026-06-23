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
                <tr style="cursor: pointer;" onclick="loadEmployeeToForm('${emp.empCode}')">
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
    const getUploadData = (id) => {
        const input = document.getElementById(id);
        return input ? (input.dataset.previewUrl || "") : "";
    };

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
        presentPin: document.getElementById("presentPin").value.trim(),
        
        // Photo and Upload Documents
        photo: document.getElementById("preview")?.src || "",
        dlUpload: getUploadData("dlUpload"),
        panUpload: getUploadData("panUpload"),
        aadhaarUpload: getUploadData("aadhaarUpload"),
        signUpload: getUploadData("signUpload"),
        vtcUpload: getUploadData("vtcUpload"),
        imeUpload: getUploadData("imeUpload")
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
    const idCard = document.getElementById("idCard");
    const printContainer = document.getElementById("printProfileContainer");
    if (idCard && printContainer) {
        printContainer.innerHTML = idCard.outerHTML;
        printContainer.classList.add("active");
        window.print();
        printContainer.classList.remove("active");
        printContainer.innerHTML = "";
    } else {
        window.print();
    }
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
    const previewUrl = input && input.dataset.previewUrl;

    if (!file && !previewUrl) {
        alert("Please select or upload a file first.");
        return;
    }

    const modal = new bootstrap.Modal(document.getElementById("previewModal"));
    const imagePreview = document.getElementById("imagePreview");
    const pdfPreview = document.getElementById("pdfPreview");

    imagePreview.classList.add("d-none");
    pdfPreview.classList.add("d-none");
    imagePreview.src = "";
    pdfPreview.src = "";

    let fileUrl = "";
    let isImage = false;

    if (file) {
        fileUrl = URL.createObjectURL(file);
        isImage = file.type.startsWith("image/");
    } else if (previewUrl) {
        fileUrl = previewUrl;
        isImage = previewUrl.startsWith("data:image/");
    }

    if (isImage) {
        imagePreview.src = fileUrl;
        imagePreview.classList.remove("d-none");
    } else {
        pdfPreview.src = fileUrl;
        pdfPreview.classList.remove("d-none");
    }

    modal.show();
}

function populateEmployeeForm(emp) {
    if (!emp) return;

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || "";
    };

    setVal("establishmentName", emp.establishmentName);
    setVal("ownerName", emp.ownerName);
    setVal("empCode", emp.empCode);
    setVal("name", emp.name);
    setVal("fatherName", emp.fatherName);
    setVal("bloodGroup", emp.bloodGroup);
    setVal("gender", emp.gender);
    setVal("birthDate", emp.birthDate);
    setVal("nationality", emp.nationality);
    setVal("education", emp.education);
    setVal("panNo", emp.panNo);
    setVal("aadhaarNo", emp.aadhaarNo);
    setVal("mobile", emp.mobile);
    setVal("identificationMark", emp.identificationMark);
    setVal("email", emp.email);
    setVal("designation", emp.designation);
    setVal("department", emp.department);
    setVal("joiningDate", emp.joiningDate);
    setVal("employmentType", emp.employmentType);
    setVal("bankName", emp.bankName);
    setVal("accountNo", emp.accountNo);
    setVal("addressCategory", emp.addressCategory);
    setVal("permPO", emp.permPO);
    setVal("permDistrict", emp.permDistrict);
    setVal("permState", emp.permState);
    setVal("permPin", emp.permPin);

    if (document.getElementById("presentCategory")) {
        setVal("presentCategory", emp.presentCategory);
    }
    setVal("presentPO", emp.presentPO);
    setVal("presentDistrict", emp.presentDistrict);
    setVal("presentState", emp.presentState);
    setVal("presentPin", emp.presentPin);

    // Photo preview
    const previewImg = document.getElementById("preview");
    if (previewImg) {
        previewImg.src = emp.photo || "https://via.placeholder.com/150";
    }

    // Set file dataset previews
    const setUploadDataset = (id, val) => {
        const input = document.getElementById(id);
        if (input) {
            input.value = ""; // Reset file upload selector
            input.dataset.previewUrl = val || "";
        }
    };

    setUploadDataset("dlUpload", emp.dlUpload);
    setUploadDataset("panUpload", emp.panUpload);
    setUploadDataset("aadhaarUpload", emp.aadhaarUpload);
    setUploadDataset("signUpload", emp.signUpload);
    setUploadDataset("vtcUpload", emp.vtcUpload);
    setUploadDataset("imeUpload", emp.imeUpload);
}

async function loadEmployeeToForm(empCode) {
    try {
        const emp = await findEmployeeByCode(empCode);
        if (emp) {
            populateEmployeeForm(emp);
            createIDCard();
        } else {
            alert("Employee not found");
        }
    } catch (error) {
        console.error(error);
        alert("Error loading employee details");
    }
}

async function performSearch() {
    const query = document.getElementById("search")?.value.trim().toLowerCase() || "";
    try {
        const response = await fetch(`${API_BASE}/employees`);
        if (!response.ok) throw new Error("Failed to load employees");

        const employees = await response.json();
        const filtered = employees.filter(emp => {
            return (
                (emp.empCode && emp.empCode.toLowerCase().includes(query)) ||
                (emp.name && emp.name.toLowerCase().includes(query)) ||
                (emp.designation && emp.designation.toLowerCase().includes(query)) ||
                (emp.mobile && emp.mobile.toLowerCase().includes(query)) ||
                (emp.establishmentName && emp.establishmentName.toLowerCase().includes(query))
            );
        });

        const tableBody = document.getElementById("employeeTable");
        if (tableBody) {
            tableBody.innerHTML = "";
            filtered.forEach(emp => {
                const row = `
                    <tr style="cursor: pointer;" onclick="loadEmployeeToForm('${emp.empCode}')">
                        <td>${emp.empCode || "N/A"}</td>
                        <td>${emp.name || "N/A"}</td>
                        <td>${emp.designation || "N/A"}</td>
                        <td>${emp.mobile || "N/A"}</td>
                    </tr>`;
                tableBody.innerHTML += row;
            });
        }

        const totalEmpEl = document.getElementById("totalEmp");
        if (totalEmpEl) totalEmpEl.innerText = filtered.length;
    } catch (error) {
        console.error("Error searching employees:", error);
    }
}

// Wire search event listeners
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("searchBtn")?.addEventListener("click", performSearch);
    const searchInput = document.getElementById("search");
    if (searchInput) {
        searchInput.addEventListener("keyup", function (e) {
            if (e.key === "Enter") performSearch();
        });
    }
});

async function printAllEmployees() {
    try {
        const response = await fetch(`${API_BASE}/employees`);
        if (!response.ok) throw new Error("Failed to load employees");

        const employees = await response.json();
        const printContainer = document.getElementById("printReportContainer");
        if (printContainer) {
            let html = `
                <div class="p-4">
                    <h2 class="text-center mb-4">Employee Report</h2>
                    <table class="table table-bordered table-striped">
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Name</th>
                                <th>Establishment</th>
                                <th>Designation</th>
                                <th>Mobile</th>
                                <th>Joining Date</th>
                            </tr>
                        </thead>
                        <tbody>`;
            
            employees.forEach(emp => {
                html += `
                    <tr>
                        <td>${emp.empCode || "N/A"}</td>
                        <td>${emp.name || "N/A"}</td>
                        <td>${emp.establishmentName || "N/A"}</td>
                        <td>${emp.designation || "N/A"}</td>
                        <td>${emp.mobile || "N/A"}</td>
                        <td>${emp.joiningDate || "N/A"}</td>
                    </tr>`;
            });
            
            html += `
                        </tbody>
                    </table>
                </div>`;
                
            printContainer.innerHTML = html;
            printContainer.classList.add("active");
            window.print();
            printContainer.classList.remove("active");
            printContainer.innerHTML = "";
        }
    } catch (error) {
        console.error("Error exporting report:", error);
        alert("Failed to export report");
    }
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

