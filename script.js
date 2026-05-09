/* ============================================================
   IUB Hostel Management System — script.js
   
   ARCHITECTURE / VIEW-SWITCHING LOGIC:
   ─────────────────────────────────────
   There are THREE top-level "views":
     1. #landingPage  — shown by default on page load
     2. #adminDashboard — shown only after successful admin login
     3. #studentPortal  — shown when student clicks their portal btn

   The functions showView(id) and hideAllViews() control which
   top-level div is visible at any time. Only one view is shown
   at a time (others get the Bootstrap "d-none" class).

   Within the Admin Dashboard, showAdminSection(name) handles
   which sub-section (stats/bookings/rooms/complaints/addStudent)
   is active by toggling the "d-none" class and updating the
   sidebar "active" button.

   Within the Student Portal, showStudentSection(name) does the
   same for student sub-sections.

   ALL DATA is stored in localStorage under these keys:
     - "iub_students"   : registered student profiles []
     - "iub_bookings"   : room booking applications []
     - "iub_rooms"      : room inventory []
     - "iub_complaints" : student complaints []
   ============================================================ */

"use strict";

// ─── Constants ─────────────────────────────────────────────────
const ADMIN_ID       = "admin";      // Demo admin credentials
const ADMIN_PASSWORD = "iub2024";

const LS_STUDENTS   = "iub_students";
const LS_BOOKINGS   = "iub_bookings";
const LS_ROOMS      = "iub_rooms";
const LS_COMPLAINTS = "iub_complaints";

const TOTAL_ROOMS   = 40;    // Total hostel rooms available


// ─── LocalStorage Helpers ───────────────────────────────────────

/** Read an array from localStorage (returns [] if not set) */
function lsGet(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; }
  catch(e) { return []; }
}

/** Write an array to localStorage */
function lsSet(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}


// ─── View Switching ─────────────────────────────────────────────

/**
 * Hides all top-level views by adding "d-none" to each.
 * Called before showing a specific view.
 */
function hideAllViews() {
  ["landingPage", "adminDashboard", "studentPortal"].forEach(id => {
    document.getElementById(id).classList.add("d-none");
  });
}

/**
 * Show a specific top-level view.
 * @param {string} id - Element ID of the view to show
 */
function showView(id) {
  hideAllViews();
  document.getElementById(id).classList.remove("d-none");
}

/** Called when user clicks "Student" on landing page */
function showStudentPortal() {
  showView("studentPortal");
  // Activate first student section (Register) by default
  showStudentSection("sRegister");
}

/** Returns user to landing page and clears any active state */
function backToLanding() {
  showView("landingPage");
}

/** Logs out admin and returns to landing page */
function logoutAdmin() {
  showView("landingPage");
  showToast("Logged out", "You have been logged out successfully.", "info");
}


// ─── Admin Login ────────────────────────────────────────────────

/**
 * Opens the Bootstrap modal for admin login.
 * Using Bootstrap's Modal JS API directly.
 */
function showLoginModal() {
  const modal = new bootstrap.Modal(document.getElementById("loginModal"));
  modal.show();
  // Clear previous inputs / errors
  document.getElementById("adminId").value = "";
  document.getElementById("adminPassword").value = "";
  document.getElementById("loginError").classList.add("d-none");
}

/** Toggle password visibility in login modal */
function togglePassword() {
  const pwd  = document.getElementById("adminPassword");
  const icon = document.getElementById("eyeIcon");
  if (pwd.type === "password") {
    pwd.type  = "text";
    icon.className = "bi bi-eye-slash";
  } else {
    pwd.type  = "password";
    icon.className = "bi bi-eye";
  }
}

/**
 * Validates the admin login form.
 * On success: closes modal, shows admin dashboard.
 * On failure: shows inline error message.
 */
function handleAdminLogin() {
  const id  = document.getElementById("adminId").value.trim();
  const pwd = document.getElementById("adminPassword").value;
  const err = document.getElementById("loginError");

  if (id === ADMIN_ID && pwd === ADMIN_PASSWORD) {
    // ✅ Correct credentials
    err.classList.add("d-none");
    bootstrap.Modal.getInstance(document.getElementById("loginModal")).hide();
    showView("adminDashboard");
    initAdminDashboard();          // Load data and update UI
  } else {
    // ❌ Wrong credentials — show error
    err.classList.remove("d-none");
    document.getElementById("adminId").focus();
  }
}


// ─── Admin Dashboard ────────────────────────────────────────────

/**
 * Called once when admin logs in.
 * Initialises rooms if not yet set, updates stats, renders tables.
 */
function initAdminDashboard() {
  // Set today's date in the header
  document.getElementById("currentDate").textContent =
    new Date().toLocaleDateString("en-GB", { weekday:"long", year:"numeric", month:"long", day:"numeric" });

  // Seed rooms on first run
  if (!localStorage.getItem(LS_ROOMS)) seedRooms();

  // Show the default "stats" section
  showAdminSection("stats");
  updateStats();
}

/**
 * Controls which sub-section is shown inside the admin dashboard.
 * Hides all sections, then shows the target, and updates sidebar.
 * @param {string} name - One of: "stats" | "bookings" | "rooms" | "complaints" | "addStudent"
 */
function showAdminSection(name) {
  // Map of section names → element IDs and sidebar button IDs
  const sections = {
    stats:      { el: "adminStats",      btn: "sideStats"       },
    bookings:   { el: "adminBookings",   btn: "sideBookings"    },
    rooms:      { el: "adminRooms",      btn: "sideRooms"       },
    complaints: { el: "adminComplaints", btn: "sideComplaints"  },
    addStudent: { el: "adminAddStudent", btn: "sideAddStudent"  },
  };

  // Hide all admin sections
  Object.values(sections).forEach(({ el, btn }) => {
    document.getElementById(el).classList.add("d-none");
    document.getElementById(btn).classList.remove("active");
  });

  // Show chosen section and mark sidebar button active
  const target = sections[name];
  if (target) {
    document.getElementById(target.el).classList.remove("d-none");
    document.getElementById(target.btn).classList.add("active");
  }

  // Refresh content for the section being shown
  if (name === "stats")      { updateStats(); renderRecentTable(); }
  if (name === "bookings")   renderBookingsTable();
  if (name === "rooms")      renderRooms();
  if (name === "complaints") renderComplaintsTable();
}


// ─── Stats ──────────────────────────────────────────────────────

/** Reads localStorage data and updates the 4 stat cards */
function updateStats() {
  const bookings   = lsGet(LS_BOOKINGS);
  const rooms      = lsGet(LS_ROOMS);
  const complaints = lsGet(LS_COMPLAINTS);

  const approved = bookings.filter(b => b.status === "Approved").length;
  const pending  = bookings.filter(b => b.status === "Pending").length;
  const available= rooms.filter(r => r.status === "Available").length;
  const openComp = complaints.filter(c => c.status === "Open").length;

  document.getElementById("statTotalStudents").textContent  = approved;
  document.getElementById("statAvailableRooms").textContent = available;
  document.getElementById("statPending").textContent        = pending;
  document.getElementById("statComplaints").textContent     = openComp;
}

/** Renders the 4-column "recent applications" table on the dashboard */
function renderRecentTable() {
  const bookings = lsGet(LS_BOOKINGS).slice(-8).reverse(); // Last 8
  const tbody = document.getElementById("recentTableBody");
  if (!bookings.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">No applications yet</td></tr>`;
    return;
  }
  tbody.innerHTML = bookings.map(b => `
    <tr>
      <td><strong>${b.name}</strong></td>
      <td>${b.roomType}</td>
      <td>${b.date}</td>
      <td><span class="badge-${b.status.toLowerCase()}">${b.status}</span></td>
    </tr>
  `).join("");
}


// ─── Bookings Table (Management Panel) ─────────────────────────

/**
 * Renders the full bookings table with search/filter applied.
 * Reads filter values from the DOM on each call.
 */
function renderBookingsTable() {
  const bookings = lsGet(LS_BOOKINGS);
  const search   = (document.getElementById("searchBooking")?.value || "").toLowerCase();
  const status   = document.getElementById("filterStatus")?.value || "";

  // Filter data
  let filtered = bookings.filter(b => {
    const matchSearch = b.name.toLowerCase().includes(search) ||
                        b.roll.toLowerCase().includes(search);
    const matchStatus = !status || b.status === status;
    return matchSearch && matchStatus;
  });

  const tbody = document.getElementById("bookingsTableBody");
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No bookings found</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((b, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${b.name}</strong></td>
      <td><code>${b.roll}</code></td>
      <td>${b.roomType}</td>
      <td>${b.date}</td>
      <td><span class="badge-${b.status.toLowerCase()}">${b.status}</span></td>
      <td>
        <div class="d-flex gap-1 flex-wrap">
          ${b.status !== "Approved" ? `<button class="btn-approve" onclick="updateBookingStatus('${b.id}','Approved')">✓ Approve</button>` : ""}
          ${b.status !== "Rejected" ? `<button class="btn-reject"  onclick="updateBookingStatus('${b.id}','Rejected')">✗ Reject</button>`  : ""}
          <button class="btn-delete" onclick="deleteBooking('${b.id}')">🗑</button>
        </div>
      </td>
    </tr>
  `).join("");
}

/**
 * Updates the status of a booking by its unique ID.
 * Also adjusts room availability when approving/rejecting.
 */
function updateBookingStatus(id, newStatus) {
  const bookings = lsGet(LS_BOOKINGS);
  const rooms    = lsGet(LS_ROOMS);
  const idx      = bookings.findIndex(b => b.id === id);
  if (idx === -1) return;

  const oldStatus = bookings[idx].status;
  bookings[idx].status = newStatus;

  // If approving, mark a room as occupied
  if (newStatus === "Approved" && oldStatus !== "Approved") {
    const freeRoom = rooms.find(r => r.status === "Available");
    if (freeRoom) freeRoom.status = "Occupied";
  }
  // If un-approving (to Rejected), free a room
  if (oldStatus === "Approved" && newStatus === "Rejected") {
    const occupied = rooms.find(r => r.status === "Occupied");
    if (occupied) occupied.status = "Available";
  }

  lsSet(LS_BOOKINGS, bookings);
  lsSet(LS_ROOMS, rooms);
  renderBookingsTable();
  updateStats();
  showToast("Updated", `Booking status set to <strong>${newStatus}</strong>.`, "success");
}

/** Permanently deletes a booking by its ID */
function deleteBooking(id) {
  if (!confirm("Delete this booking permanently?")) return;
  const bookings = lsGet(LS_BOOKINGS).filter(b => b.id !== id);
  lsSet(LS_BOOKINGS, bookings);
  renderBookingsTable();
  updateStats();
  showToast("Deleted", "Booking removed successfully.", "info");
}

/**
 * Admin manually adds a student booking.
 * Validates required fields, creates a booking object, saves to LS.
 */
function adminAddStudent() {
  const name     = document.getElementById("aName").value.trim();
  const roll     = document.getElementById("aRoll").value.trim();
  const dept     = document.getElementById("aDept").value.trim();
  const roomType = document.getElementById("aRoomType").value;
  const contact  = document.getElementById("aContact").value.trim();
  const status   = document.getElementById("aStatus").value;
  const msg      = document.getElementById("addStudentMsg");

  if (!name || !roll) {
    msg.innerHTML = alertHTML("danger", "Name and Roll Number are required.");
    return;
  }

  const booking = {
    id: genId(), name, roll, dept, roomType, contact,
    status, date: todayStr(), note: "", source: "admin"
  };

  const bookings = lsGet(LS_BOOKINGS);
  bookings.push(booking);
  lsSet(LS_BOOKINGS, bookings);

  // If status is Approved, auto-assign a room
  if (status === "Approved") {
    const rooms = lsGet(LS_ROOMS);
    const free = rooms.find(r => r.status === "Available");
    if (free) { free.status = "Occupied"; lsSet(LS_ROOMS, rooms); }
  }

  msg.innerHTML = alertHTML("success", `Student <strong>${name}</strong> added successfully!`);
  ["aName","aRoll","aDept","aContact"].forEach(id => document.getElementById(id).value = "");
  updateStats();
  showToast("Added", `${name} has been added.`, "success");
}


// ─── Rooms ──────────────────────────────────────────────────────

/** Seeds 40 rooms into localStorage (called only once) */
function seedRooms() {
  const types = ["Single","Double","Triple"];
  const rooms = [];
  for (let i = 1; i <= TOTAL_ROOMS; i++) {
    rooms.push({
      number: `R${String(i).padStart(3,"0")}`,
      type:   types[(i - 1) % 3],
      status: "Available",
      block:  i <= 15 ? "Block A" : i <= 28 ? "Block B" : "Block C"
    });
  }
  lsSet(LS_ROOMS, rooms);
}

/** Renders the room grid cards */
function renderRooms() {
  const rooms = lsGet(LS_ROOMS);
  const grid  = document.getElementById("roomGrid");
  grid.innerHTML = rooms.map(r => `
    <div class="col-6 col-md-4 col-lg-3 col-xl-2">
      <div class="room-card ${r.status === "Available" ? "available" : "occupied"}">
        <div class="room-number">${r.number}</div>
        <div class="room-type">${r.type}</div>
        <div class="room-type text-muted" style="font-size:0.68rem">${r.block}</div>
        <div class="room-status">${r.status}</div>
      </div>
    </div>
  `).join("");
}

/** Resets all rooms to Available (admin utility) */
function resetRooms() {
  if (!confirm("Reset ALL rooms to Available? This won't change bookings.")) return;
  seedRooms();
  renderRooms();
  updateStats();
  showToast("Reset", "All rooms set to Available.", "info");
}


// ─── Complaints (Admin View) ─────────────────────────────────────

/** Renders complaints in admin view; allows marking as Resolved */
function renderComplaintsTable() {
  const complaints = lsGet(LS_COMPLAINTS);
  const tbody = document.getElementById("complaintsTableBody");
  if (!complaints.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No complaints submitted</td></tr>`;
    return;
  }
  tbody.innerHTML = complaints.map((c, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><code>${c.roll}</code></td>
      <td>${c.subject}</td>
      <td>${c.date}</td>
      <td><span class="badge-${c.status === "Open" ? "open" : "resolved"}">${c.status}</span></td>
      <td>
        ${c.status === "Open"
          ? `<button class="btn-approve" onclick="resolveComplaint('${c.id}')">✓ Resolve</button>`
          : `<span class="text-muted" style="font-size:0.75rem">Resolved</span>`
        }
      </td>
    </tr>
  `).join("");
}

/** Marks a complaint as Resolved */
function resolveComplaint(id) {
  const complaints = lsGet(LS_COMPLAINTS);
  const comp = complaints.find(c => c.id === id);
  if (comp) comp.status = "Resolved";
  lsSet(LS_COMPLAINTS, complaints);
  renderComplaintsTable();
  updateStats();
  showToast("Resolved", "Complaint has been marked as resolved.", "success");
}


// ─── CSV Export ─────────────────────────────────────────────────

/** Exports all bookings to a downloadable CSV file */
function exportCSV() {
  const bookings = lsGet(LS_BOOKINGS);
  if (!bookings.length) { showToast("Empty", "No bookings to export.", "info"); return; }

  const header = ["Name","Roll No","Department","Room Type","Contact","Status","Date Applied"];
  const rows   = bookings.map(b =>
    [b.name, b.roll, b.dept || "-", b.roomType, b.contact || "-", b.status, b.date]
    .map(v => `"${v}"`).join(",")
  );
  const csv = [header.join(","), ...rows].join("\n");

  const blob = new Blob([csv], { type:"text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `IUB_Bookings_${todayStr()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}


// ════════════════════════════════════════════════════════════════
// STUDENT PORTAL
// ════════════════════════════════════════════════════════════════

/**
 * Controls which sub-section is shown inside the student portal.
 * Works identically to showAdminSection() but for student sections.
 * @param {string} name - One of: "sRegister" | "sApply" | "sStatus" | "sComplain"
 */
function showStudentSection(name) {
  const sections = {
    sRegister: { el: "sRegister", btn: "sideRegister" },
    sApply:    { el: "sApply",    btn: "sideApply"    },
    sStatus:   { el: "sStatus",   btn: "sideStatus"   },
    sComplain: { el: "sComplain", btn: "sideComplain" },
  };

  // Hide all student sections and deactivate sidebar items
  Object.values(sections).forEach(({ el, btn }) => {
    document.getElementById(el).classList.add("d-none");
    document.getElementById(btn).classList.remove("active");
  });

  // Show the requested section and mark its sidebar button active
  const target = sections[name];
  if (target) {
    document.getElementById(target.el).classList.remove("d-none");
    document.getElementById(target.btn).classList.add("active");
  }
}


// ─── Student Registration ────────────────────────────────────────

/**
 * Registers a new student profile in localStorage.
 * Validates required fields; prevents duplicate roll numbers.
 */
function registerStudent() {
  const name    = document.getElementById("sRegName").value.trim();
  const roll    = document.getElementById("sRegRoll").value.trim();
  const dept    = document.getElementById("sRegDept").value;
  const sem     = document.getElementById("sRegSem").value;
  const cnic    = document.getElementById("sRegCnic").value.trim();
  const contact = document.getElementById("sRegContact").value.trim();
  const guardian= document.getElementById("sRegGuardian").value.trim();
  const msg     = document.getElementById("registerMsg");

  // Validate required fields
  if (!name || !roll || !dept || !contact) {
    msg.innerHTML = alertHTML("danger", "Please fill all required (*) fields.");
    return;
  }

  // Prevent duplicate registrations for same roll number
  const students = lsGet(LS_STUDENTS);
  if (students.find(s => s.roll === roll)) {
    msg.innerHTML = alertHTML("warning", `Roll number <strong>${roll}</strong> is already registered.`);
    return;
  }

  // Create and save the student object
  const student = { id: genId(), name, roll, dept, sem, cnic, contact, guardian, regDate: todayStr() };
  students.push(student);
  lsSet(LS_STUDENTS, students);

  // Update the sidebar info to reflect logged-in student
  document.getElementById("sidebarStudentName").textContent = name;
  document.getElementById("sidebarStudentId").textContent   = roll;

  msg.innerHTML = alertHTML("success", `Welcome, <strong>${name}</strong>! You are now registered. You can apply for a room.`);
  showToast("Registered!", `${name} registered successfully.`, "success");

  // Clear form
  ["sRegName","sRegRoll","sRegCnic","sRegContact","sRegGuardian"].forEach(id =>
    document.getElementById(id).value = ""
  );
}


// ─── Apply for Room ──────────────────────────────────────────────

/**
 * Submits a room application on behalf of a registered student.
 * The roll number must match an existing student profile.
 */
function applyForRoom() {
  const roll     = document.getElementById("applyRoll").value.trim();
  const roomType = document.getElementById("applyRoomType").value;
  const block    = document.getElementById("applyBlock").value;
  const date     = document.getElementById("applyDate").value;
  const note     = document.getElementById("applyNote").value.trim();
  const msg      = document.getElementById("applyMsg");

  if (!roll) {
    msg.innerHTML = alertHTML("danger", "Please enter your Roll Number.");
    return;
  }

  // Verify the student is registered
  const students = lsGet(LS_STUDENTS);
  const student  = students.find(s => s.roll === roll);
  if (!student) {
    msg.innerHTML = alertHTML("danger", "Roll number not found. Please register first.");
    return;
  }

  // Prevent multiple pending applications
  const bookings = lsGet(LS_BOOKINGS);
  const existing = bookings.find(b => b.roll === roll && b.status === "Pending");
  if (existing) {
    msg.innerHTML = alertHTML("warning", "You already have a <strong>Pending</strong> application. Please wait for admin review.");
    return;
  }

  // Check available rooms
  const rooms = lsGet(LS_ROOMS);
  const freeRoom = rooms.find(r => r.status === "Available");
  if (!freeRoom) {
    msg.innerHTML = alertHTML("warning", "Sorry, no rooms are currently available. Please check back later.");
    return;
  }

  // Create the booking
  const booking = {
    id: genId(), name: student.name, roll, dept: student.dept,
    roomType, block, note, contact: student.contact,
    date: date || todayStr(), status: "Pending"
  };
  bookings.push(booking);
  lsSet(LS_BOOKINGS, bookings);

  msg.innerHTML = alertHTML("success", `Application submitted! Your application ID is <strong>${booking.id}</strong>. Track your status in the "Track Status" section.`);
  document.getElementById("applyRoll").value = "";
  document.getElementById("applyNote").value = "";
  showToast("Applied!", "Room application submitted successfully.", "success");
}


// ─── Track Status ────────────────────────────────────────────────

/**
 * Looks up all bookings for a given roll number and displays them.
 * Shows application status, room type, and date applied.
 */
function checkStatus() {
  const roll   = document.getElementById("statusRoll").value.trim();
  const result = document.getElementById("statusResult");

  if (!roll) {
    result.innerHTML = alertHTML("danger", "Please enter your roll number.");
    return;
  }

  const bookings = lsGet(LS_BOOKINGS).filter(b => b.roll === roll);
  if (!bookings.length) {
    result.innerHTML = alertHTML("warning", "No application found for this roll number.");
    return;
  }

  // Display all applications for this student
  result.innerHTML = bookings.map(b => `
    <div class="status-result-card mb-3">
      <div class="status-row">
        <span class="status-key">👤 Name</span>
        <span class="status-value">${b.name}</span>
      </div>
      <div class="status-row">
        <span class="status-key">🆔 Roll No</span>
        <span class="status-value">${b.roll}</span>
      </div>
      <div class="status-row">
        <span class="status-key">🚪 Room Type</span>
        <span class="status-value">${b.roomType} — ${b.block || "N/A"}</span>
      </div>
      <div class="status-row">
        <span class="status-key">📅 Applied</span>
        <span class="status-value">${b.date}</span>
      </div>
      <div class="status-row">
        <span class="status-key">📋 Status</span>
        <span class="status-value">
          <span class="badge-${b.status.toLowerCase()}">${b.status}</span>
          ${b.status === "Pending"  ? " — Under review by admin" : ""}
          ${b.status === "Approved" ? " — Please collect your room key from the office" : ""}
          ${b.status === "Rejected" ? " — Contact the office for more info" : ""}
        </span>
      </div>
    </div>
  `).join("");
}


// ─── Submit Complaint ────────────────────────────────────────────

/**
 * Submits a new student complaint to localStorage.
 * Validates required fields before saving.
 */
function submitComplaint() {
  const roll     = document.getElementById("compRoll").value.trim();
  const category = document.getElementById("compCategory").value;
  const subject  = document.getElementById("compSubject").value.trim();
  const desc     = document.getElementById("compDesc").value.trim();
  const msg      = document.getElementById("complainMsg");

  if (!roll || !subject || !desc) {
    msg.innerHTML = alertHTML("danger", "Please fill all required fields.");
    return;
  }

  // Verify student exists
  const students = lsGet(LS_STUDENTS);
  const student  = students.find(s => s.roll === roll);
  if (!student) {
    msg.innerHTML = alertHTML("warning", "Roll number not registered. Please register first.");
    return;
  }

  // Create complaint object
  const complaint = {
    id: genId(), roll, name: student.name,
    category, subject, desc,
    date: todayStr(), status: "Open"
  };

  const complaints = lsGet(LS_COMPLAINTS);
  complaints.push(complaint);
  lsSet(LS_COMPLAINTS, complaints);

  msg.innerHTML = alertHTML("success", "Your complaint has been submitted. The hostel office will review it shortly.");
  document.getElementById("compRoll").value    = "";
  document.getElementById("compSubject").value = "";
  document.getElementById("compDesc").value    = "";
  showToast("Complaint Filed", "Your complaint has been submitted.", "info");
}


// ─── Toast Notification ─────────────────────────────────────────

/**
 * Displays a Bootstrap 5 Toast notification.
 * @param {string} title   - Toast header title
 * @param {string} message - Toast body (HTML allowed)
 * @param {string} type    - "success" | "info" | "warning" | "danger"
 */
function showToast(title, message, type = "info") {
  const colorMap = {
    success: "#16a34a",
    info:    "#1a2744",
    warning: "#d97706",
    danger:  "#dc2626"
  };
  const iconMap = {
    success: "bi-check-circle-fill",
    info:    "bi-info-circle-fill",
    warning: "bi-exclamation-triangle-fill",
    danger:  "bi-x-circle-fill"
  };

  document.getElementById("toastTitle").textContent  = title;
  document.getElementById("toastBody").innerHTML      = message;
  document.getElementById("toastIcon").className      = `bi ${iconMap[type] || "bi-info-circle-fill"}`;
  document.getElementById("toastIcon").style.color    = colorMap[type] || colorMap.info;

  const toastEl = document.getElementById("liveToast");
  const toast   = bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 3500 });
  toast.show();
}


// ─── Utility Functions ──────────────────────────────────────────

/** Generates a random unique ID (8 hex chars) */
function genId() {
  return Math.random().toString(16).slice(2, 10).toUpperCase();
}

/** Returns today's date as DD/MM/YYYY */
function todayStr() {
  return new Date().toLocaleDateString("en-GB");
}

/**
 * Returns a Bootstrap alert HTML string.
 * @param {string} type    - "success" | "danger" | "warning" | "info"
 * @param {string} message - Message content (HTML allowed)
 */
function alertHTML(type, message) {
  const icons = { success:"check-circle-fill", danger:"exclamation-triangle-fill", warning:"exclamation-circle-fill", info:"info-circle-fill" };
  return `
    <div class="alert alert-${type} d-flex align-items-center gap-2" role="alert">
      <i class="bi bi-${icons[type] || "info-circle-fill"}"></i>
      <div>${message}</div>
    </div>
  `;
}


// ─── Initialise on Page Load ────────────────────────────────────

/**
 * Entry point. On page load, always show the landing page first.
 * No authentication state is persisted across page refreshes for security.
 */
document.addEventListener("DOMContentLoaded", () => {
  // Always start at landing page
  showView("landingPage");

  // Allow pressing Enter in login fields
  ["adminId","adminPassword"].forEach(id => {
    document.getElementById(id)?.addEventListener("keydown", e => {
      if (e.key === "Enter") handleAdminLogin();
    });
  });
});
