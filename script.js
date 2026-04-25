/* ============================================================
   SupportDesk Pro — script.js
   Full application logic: ticket management, analytics, SLA,
   charts, localStorage persistence, ratings.
   ============================================================ */

"use strict";

/* ===================== CONSTANTS & CONFIG ===================== */

// SLA deadlines (in hours) per priority
const SLA_HOURS = { High: 4, Medium: 24, Low: 72 };

// Chart.js global defaults for dark theme
Chart.defaults.color = "#8b949e";
Chart.defaults.borderColor = "#30363d";
Chart.defaults.font.family = "'DM Sans', sans-serif";

/* ===================== STATE ===================== */

let tickets   = [];   // Array of ticket objects
let ticketIdCounter = 1;

// Chart instances (to destroy before re-rendering)
let statusChartInst = null;
let typeChartInst   = null;

/* ===================== LOCALSTORAGE ===================== */

/**
 * Load tickets from localStorage on app start.
 * Falls back to empty array if nothing stored.
 */
function loadFromStorage() {
  try {
    const raw = localStorage.getItem("supportdesk_tickets");
    if (raw) {
      const parsed = JSON.parse(raw);
      tickets = parsed.tickets || [];
      ticketIdCounter = parsed.nextId || 1;
    }
  } catch (e) {
    console.warn("Could not load from storage:", e);
    tickets = [];
    ticketIdCounter = 1;
  }
}

/**
 * Save current state to localStorage.
 */
function saveToStorage() {
  try {
    localStorage.setItem("supportdesk_tickets", JSON.stringify({
      tickets,
      nextId: ticketIdCounter
    }));
  } catch (e) {
    console.warn("Could not save to storage:", e);
  }
}

/* ===================== TICKET CRUD ===================== */

/**
 * Create a new ticket object.
 * @param {string} customer - Customer full name
 * @param {string} type     - Issue type (Billing / Technical / General)
 * @param {string} priority - Priority level (Low / Medium / High)
 * @param {string} desc     - Problem description
 * @returns {Object} ticket
 */
function createTicket(customer, type, priority, desc) {
  const now = new Date();
  return {
    id:          `TKT-${String(ticketIdCounter++).padStart(4, "0")}`,
    customer,
    type,
    priority,
    description: desc,
    status:      "Open",
    rating:      null,          // 1-5 stars, set on resolution
    createdAt:   now.toISOString(),
    updatedAt:   now.toISOString(),
    resolvedAt:  null
  };
}

/**
 * Add a ticket to the list and persist.
 */
function addTicket(ticket) {
  tickets.unshift(ticket);  // newest first
  saveToStorage();
}

/**
 * Delete a ticket by ID.
 */
function deleteTicket(id) {
  tickets = tickets.filter(t => t.id !== id);
  saveToStorage();
}

/**
 * Update a ticket's status (and apply resolution timestamp).
 * Also auto-applies SLA "Delayed" flag if time exceeded.
 * @param {string} id     - Ticket ID
 * @param {string} status - New status string
 * @param {number|null} rating - Star rating (only when resolving)
 */
function updateTicketStatus(id, status, rating = null) {
  const ticket = tickets.find(t => t.id === id);
  if (!ticket) return;

  ticket.status    = status;
  ticket.updatedAt = new Date().toISOString();

  if (status === "Resolved") {
    ticket.resolvedAt = new Date().toISOString();
    if (rating !== null) ticket.rating = rating;
  }

  saveToStorage();
}

/* ===================== SLA LOGIC ===================== */

/**
 * Evaluate SLA status for all open/in-progress tickets.
 * If a ticket's age exceeds SLA_HOURS for its priority, mark as "Delayed".
 * Resolved tickets are exempt.
 */
function applySLA() {
  const now = Date.now();
  tickets.forEach(t => {
    if (t.status === "Resolved") return;
    const ageHours = (now - new Date(t.createdAt).getTime()) / 3600000;
    const limit    = SLA_HOURS[t.priority];
    if (ageHours > limit && t.status !== "Delayed") {
      t.status    = "Delayed";
      t.updatedAt = new Date().toISOString();
    }
  });
  saveToStorage();
}

/* ===================== ANALYTICS HELPERS ===================== */

/**
 * Compute aggregate analytics from current tickets array.
 */
function computeAnalytics() {
  const total    = tickets.length;
  const resolved = tickets.filter(t => t.status === "Resolved").length;
  const pending  = tickets.filter(t => t.status !== "Resolved").length;
  const high     = tickets.filter(t => t.priority === "High").length;
  const delayed  = tickets.filter(t => t.status === "Delayed").length;

  // Average rating
  const rated    = tickets.filter(t => t.rating !== null);
  const avgRating = rated.length
    ? (rated.reduce((s, t) => s + t.rating, 0) / rated.length).toFixed(1)
    : null;

  // By status
  const byStatus = {
    "Open":        tickets.filter(t => t.status === "Open").length,
    "In Progress": tickets.filter(t => t.status === "In Progress").length,
    "Resolved":    resolved,
    "Delayed":     delayed
  };

  // By type
  const byType = {
    "Billing":   tickets.filter(t => t.type === "Billing").length,
    "Technical": tickets.filter(t => t.type === "Technical").length,
    "General":   tickets.filter(t => t.type === "General").length
  };

  return { total, resolved, pending, high, delayed, avgRating, ratingCount: rated.length, byStatus, byType };
}

/* ===================== VIEW SWITCHING ===================== */

/**
 * Show a named view panel and update nav state.
 * @param {string} viewName - "dashboard" | "tickets" | "new"
 * @param {HTMLElement} navEl - The clicked nav element (for active styling)
 */
function switchView(viewName, navEl) {
  // Hide all views
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  // Show target view
  const target = document.getElementById(`view-${viewName}`);
  if (target) target.classList.add("active");

  // Update nav active state
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  if (navEl) navEl.classList.add("active");

  // Update page title
  const titles = { dashboard: "Dashboard Overview", tickets: "All Tickets", new: "New Support Ticket" };
  document.getElementById("pageTitle").textContent = titles[viewName] || "";

  // Re-render relevant view
  if (viewName === "dashboard") renderDashboard();
  if (viewName === "tickets")   renderTickets();

  // Close sidebar on mobile
  if (window.innerWidth <= 768) {
    document.getElementById("sidebar").classList.remove("open");
  }

  return false; // prevent anchor navigation
}

/* ===================== DASHBOARD RENDER ===================== */

/**
 * Render all dashboard components: KPI cards, charts, recent table.
 */
function renderDashboard() {
  applySLA();
  const a = computeAnalytics();

  // Update KPI cards
  setText("kpiTotal",        a.total);
  setText("kpiResolved",     a.resolved);
  setText("kpiPending",      a.pending);
  setText("kpiHigh",         a.high);
  setText("kpiTotalTrend",   `${a.total} total`);
  setText("kpiResolvedPct",  a.total ? `${Math.round(a.resolved / a.total * 100)}%` : "0%");
  setText("kpiPendingPct",   a.total ? `${Math.round(a.pending  / a.total * 100)}%` : "0%");
  setText("kpiDelayed",      `${a.delayed} delayed`);
  setText("kpiRating",       a.avgRating !== null ? `${a.avgRating} ★` : "—");
  setText("kpiRatingCount",  `${a.ratingCount} rating${a.ratingCount !== 1 ? "s" : ""}`);

  // Nav badge
  setText("totalBadge", a.total);

  // Charts
  renderStatusChart(a.byStatus);
  renderTypeChart(a.byType);

  // Recent tickets table (last 6)
  renderRecentTable();
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* ---- Status Pie Chart ---- */
function renderStatusChart(byStatus) {
  const ctx = document.getElementById("statusChart").getContext("2d");
  if (statusChartInst) statusChartInst.destroy();

  statusChartInst = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: Object.keys(byStatus),
      datasets: [{
        data:            Object.values(byStatus),
        backgroundColor: ["#388bfd", "#8b5cf6", "#2ea043", "#da3633"],
        borderColor:     "#1c2333",
        borderWidth:     3,
        hoverOffset:     8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "65%",
      plugins: {
        legend: {
          position: "bottom",
          labels: { padding: 14, boxWidth: 12, borderRadius: 4, useBorderRadius: true }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.parsed} tickets`
          }
        }
      }
    }
  });
}

/* ---- Issue Type Bar Chart ---- */
function renderTypeChart(byType) {
  const ctx = document.getElementById("typeChart").getContext("2d");
  if (typeChartInst) typeChartInst.destroy();

  typeChartInst = new Chart(ctx, {
    type: "bar",
    data: {
      labels:   Object.keys(byType),
      datasets: [{
        label:           "Tickets",
        data:            Object.values(byType),
        backgroundColor: ["rgba(245,158,11,.75)", "rgba(56,139,253,.75)", "rgba(139,92,246,.75)"],
        borderColor:     ["#f59e0b", "#388bfd", "#8b5cf6"],
        borderWidth:     2,
        borderRadius:    6,
        borderSkipped:   false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y} tickets` } }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 },
          grid: { color: "rgba(48,54,61,.6)" }
        }
      }
    }
  });
}

/* ---- Recent Tickets Table ---- */
function renderRecentTable() {
  const tbody = document.getElementById("recentTableBody");
  const recent = tickets.slice(0, 6);

  if (recent.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px;">No tickets yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = recent.map(t => `
    <tr>
      <td>${t.id}</td>
      <td style="color:var(--text-primary);font-weight:500">${escapeHtml(t.customer)}</td>
      <td>${chipHtml("type", t.type)}</td>
      <td>${chipHtml("priority", t.priority)}</td>
      <td>${chipHtml("status", t.status)}</td>
      <td>${formatDate(t.createdAt)}</td>
    </tr>
  `).join("");
}

/* ===================== TICKETS VIEW RENDER ===================== */

/**
 * Read filter values and render matching ticket cards.
 */
function renderTickets() {
  applySLA();

  const fStatus   = document.getElementById("filterStatus").value;
  const fPriority = document.getElementById("filterPriority").value;
  const fType     = document.getElementById("filterType").value;
  const fSearch   = document.getElementById("filterSearch").value.trim().toLowerCase();

  const filtered = tickets.filter(t => {
    if (fStatus   && t.status   !== fStatus)   return false;
    if (fPriority && t.priority !== fPriority) return false;
    if (fType     && t.type     !== fType)     return false;
    if (fSearch   && !t.customer.toLowerCase().includes(fSearch)) return false;
    return true;
  });

  const grid       = document.getElementById("ticketsGrid");
  const emptyState = document.getElementById("emptyState");

  if (filtered.length === 0) {
    grid.innerHTML    = "";
    emptyState.style.display = "block";
    return;
  }
  emptyState.style.display = "none";

  grid.innerHTML = filtered.map(t => ticketCardHtml(t)).join("");

  // Also update nav badge
  setText("totalBadge", tickets.length);
}

/**
 * Generate HTML for a single ticket card.
 */
function ticketCardHtml(t) {
  const priClass = `pri-${t.priority.toLowerCase()}`;
  const stars    = t.rating ? "★".repeat(t.rating) + "☆".repeat(5 - t.rating) : "";
  const slaInfo  = getSLAInfo(t);

  return `
    <div class="ticket-card ${priClass}" id="card-${t.id}">
      <div class="ticket-card-head">
        <div>
          <div class="ticket-id">${t.id}</div>
          <div class="ticket-customer">${escapeHtml(t.customer)}</div>
        </div>
        <div style="text-align:right;">
          ${chipHtml("status", t.status)}
        </div>
      </div>

      <div class="ticket-chips">
        ${chipHtml("priority", t.priority)}
        ${chipHtml("type", t.type)}
        ${slaInfo ? `<span class="chip chip-delayed">${slaInfo}</span>` : ""}
      </div>

      <div class="ticket-desc" title="${escapeHtml(t.description)}">${escapeHtml(t.description)}</div>

      <div class="ticket-meta">
        Created: ${formatDate(t.createdAt)}
        ${t.resolvedAt ? " · Resolved: " + formatDate(t.resolvedAt) : ""}
        ${t.rating ? ` · <span class="stars-display">${stars}</span>` : ""}
      </div>

      <div class="ticket-actions">
        <select class="status-select" onchange="quickUpdateStatus('${t.id}', this.value)" ${t.status === "Resolved" ? "disabled" : ""}>
          <option value="Open"        ${t.status === "Open"        ? "selected" : ""}>Open</option>
          <option value="In Progress" ${t.status === "In Progress" ? "selected" : ""}>In Progress</option>
          <option value="Delayed"     ${t.status === "Delayed"     ? "selected" : ""}>Delayed</option>
          <option value="Resolved"    ${t.status === "Resolved"    ? "selected" : ""}>Resolved</option>
        </select>
        <button class="btn-action" onclick="openUpdateModal('${t.id}')">Edit</button>
        <button class="btn-danger" onclick="confirmDelete('${t.id}')">Delete</button>
      </div>
    </div>
  `;
}

/**
 * Quickly update status from the inline select dropdown.
 * If resolving, open modal to capture rating.
 */
function quickUpdateStatus(id, newStatus) {
  if (newStatus === "Resolved") {
    // Open the full modal to capture a rating
    openUpdateModal(id, newStatus);
  } else {
    updateTicketStatus(id, newStatus);
    renderTickets();
    renderDashboard();
    showToast(`Ticket updated to "${newStatus}"`, "success");
  }
}

/**
 * Compute SLA warning string if ticket is close to or past deadline.
 * Returns empty string if no warning needed.
 */
function getSLAInfo(t) {
  if (t.status === "Resolved") return "";
  const ageHours = (Date.now() - new Date(t.createdAt).getTime()) / 3600000;
  const limit    = SLA_HOURS[t.priority];
  if (ageHours > limit) return "⚠ SLA Breached";
  if (ageHours > limit * 0.75) return "⏱ SLA At Risk";
  return "";
}

function clearFilters() {
  document.getElementById("filterStatus").value   = "";
  document.getElementById("filterPriority").value = "";
  document.getElementById("filterType").value     = "";
  document.getElementById("filterSearch").value   = "";
  renderTickets();
}

/* ===================== MODAL ===================== */

let currentModalId = null;
let selectedRating  = 0;

/**
 * Open the update modal for a given ticket.
 * @param {string} id           - Ticket ID
 * @param {string} [preStatus]  - Pre-select a status
 */
function openUpdateModal(id, preStatus = null) {
  const ticket = tickets.find(t => t.id === id);
  if (!ticket) return;
  currentModalId = id;
  selectedRating = ticket.rating || 0;

  document.getElementById("modalTitle").textContent = `Update: ${ticket.id}`;

  const isResolved = preStatus === "Resolved" || ticket.status === "Resolved";

  document.getElementById("modalBody").innerHTML = `
    <label>Customer</label>
    <div style="color:var(--text-primary);font-weight:600;padding:4px 0 12px">${escapeHtml(ticket.customer)}</div>

    <label>Status</label>
    <select id="modalStatus">
      <option value="Open"        ${(preStatus||ticket.status) === "Open"        ? "selected" : ""}>Open</option>
      <option value="In Progress" ${(preStatus||ticket.status) === "In Progress" ? "selected" : ""}>In Progress</option>
      <option value="Delayed"     ${(preStatus||ticket.status) === "Delayed"     ? "selected" : ""}>Delayed</option>
      <option value="Resolved"    ${(preStatus||ticket.status) === "Resolved"    ? "selected" : ""}>Resolved</option>
    </select>

    <div id="ratingSection" style="display:${isResolved ? "block" : "none"}">
      <label>Customer Satisfaction (1–5 ★)</label>
      <div class="star-rating" id="starRating">
        ${[1,2,3,4,5].map(n => `
          <button class="star-btn ${selectedRating >= n ? "active" : ""}"
                  data-val="${n}"
                  onclick="setRating(${n})">★</button>
        `).join("")}
      </div>
    </div>

    <label style="margin-top:18px;">Notes (optional)</label>
    <textarea id="modalNotes" rows="3" placeholder="Add an internal note…">${ticket.notes || ""}</textarea>

    <div class="modal-actions">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="saveModal()">Save Changes</button>
    </div>
  `;

  // Show/hide rating section dynamically
  document.getElementById("modalStatus").addEventListener("change", function() {
    document.getElementById("ratingSection").style.display =
      this.value === "Resolved" ? "block" : "none";
  });

  document.getElementById("modalOverlay").classList.add("open");
}

function setRating(n) {
  selectedRating = n;
  document.querySelectorAll(".star-btn").forEach(btn => {
    btn.classList.toggle("active", parseInt(btn.dataset.val) <= n);
  });
}

function closeModal() {
  document.getElementById("modalOverlay").classList.remove("open");
  currentModalId = null;
  selectedRating  = 0;
}

function saveModal() {
  if (!currentModalId) return;
  const status = document.getElementById("modalStatus").value;
  const notes  = document.getElementById("modalNotes").value;
  const rating = status === "Resolved" && selectedRating > 0 ? selectedRating : null;

  // Persist notes on the ticket object
  const ticket = tickets.find(t => t.id === currentModalId);
  if (ticket) ticket.notes = notes;

  updateTicketStatus(currentModalId, status, rating);
  closeModal();
  renderTickets();
  renderDashboard();
  showToast("Ticket updated successfully", "success");
}

/* ===================== DELETE ===================== */

function confirmDelete(id) {
  const ticket = tickets.find(t => t.id === id);
  if (!ticket) return;

  currentModalId = id;
  document.getElementById("modalTitle").textContent = "Confirm Delete";
  document.getElementById("modalBody").innerHTML = `
    <p style="color:var(--text-secondary);margin-bottom:20px;">
      Are you sure you want to permanently delete ticket <strong style="color:var(--text-primary)">${ticket.id}</strong>
      for <strong style="color:var(--text-primary)">${escapeHtml(ticket.customer)}</strong>?
      This action cannot be undone.
    </p>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-danger" onclick="execDelete('${id}')">Delete Ticket</button>
    </div>
  `;
  document.getElementById("modalOverlay").classList.add("open");
}

function execDelete(id) {
  deleteTicket(id);
  closeModal();
  renderTickets();
  renderDashboard();
  showToast("Ticket deleted", "error");
}

/* ===================== NEW TICKET FORM ===================== */

/**
 * Validate form fields.
 * Returns true if valid, false if there are errors.
 */
function validateForm() {
  let valid = true;
  const clearErr = id => { document.getElementById(id).textContent = ""; };
  const setErr   = (id, msg) => { document.getElementById(id).textContent = msg; valid = false; };

  clearErr("errName"); clearErr("errType"); clearErr("errPriority"); clearErr("errDesc");

  const name     = document.getElementById("custName").value.trim();
  const type     = document.getElementById("issueType").value;
  const priority = document.querySelector('input[name="priority"]:checked');
  const desc     = document.getElementById("description").value.trim();

  if (!name)     setErr("errName",     "Customer name is required.");
  if (!type)     setErr("errType",     "Please select an issue type.");
  if (!priority) setErr("errPriority", "Please select a priority.");
  if (!desc)     setErr("errDesc",     "Description cannot be empty.");

  return valid;
}

/**
 * Handle form submission.
 */
function submitTicket() {
  if (!validateForm()) return;

  const name     = document.getElementById("custName").value.trim();
  const type     = document.getElementById("issueType").value;
  const priority = document.querySelector('input[name="priority"]:checked').value;
  const desc     = document.getElementById("description").value.trim();

  const ticket = createTicket(name, type, priority, desc);
  addTicket(ticket);
  resetForm();
  showToast(`Ticket ${ticket.id} created for ${name}`, "success");

  // Navigate to tickets view
  switchView("tickets", document.querySelector('[data-view="tickets"]'));
}

/**
 * Reset the new ticket form to default state.
 */
function resetForm() {
  document.getElementById("custName").value    = "";
  document.getElementById("issueType").value   = "";
  document.getElementById("description").value = "";

  // Reset priority to Medium
  const radios = document.querySelectorAll('input[name="priority"]');
  radios.forEach(r => { r.checked = r.value === "Medium"; });

  // Clear errors
  ["errName", "errType", "errPriority", "errDesc"].forEach(id => {
    document.getElementById(id).textContent = "";
  });
}

/* ===================== CHIP HTML HELPERS ===================== */

function chipHtml(kind, value) {
  const classMap = {
    // priority
    priority: { Low: "chip-low", Medium: "chip-medium", High: "chip-high" },
    // status
    status: {
      "Open": "chip-open",
      "In Progress": "chip-inprogress",
      "Resolved": "chip-resolved",
      "Delayed": "chip-delayed"
    },
    // type
    type: { Billing: "chip-billing", Technical: "chip-technical", General: "chip-general" }
  };
  const cls = (classMap[kind] || {})[value] || "";
  return `<span class="chip ${cls}">${escapeHtml(value)}</span>`;
}

/* ===================== UTILITY ===================== */

/**
 * Escape HTML entities to prevent XSS.
 */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(str || ""));
  return div.innerHTML;
}

/**
 * Format an ISO date string to readable format.
 */
function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    + " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Show a toast notification.
 * @param {string} msg  - Message text
 * @param {string} type - "success" | "error" | "info"
 */
function showToast(msg, type = "info") {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.className   = `toast ${type} show`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.classList.remove("show"); }, 3200);
}

/* ===================== CLOCK ===================== */

function updateClock() {
  const el = document.getElementById("currentTime");
  if (el) {
    el.textContent = new Date().toLocaleString("en-IN", {
      weekday: "short", day: "2-digit", month: "short",
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
  }
}

/* ===================== MOBILE SIDEBAR ===================== */

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
}

/* ===================== SEED DATA ===================== */

/**
 * Seed a few sample tickets on first run, so the dashboard isn't empty.
 */
function seedSampleData() {
  const samples = [
    { customer: "Aisha Bhopal",   type: "Billing",   priority: "High",   desc: "Incorrect charge of ₹4,200 applied to my account this billing cycle. Need immediate reversal." },
    { customer: "Rohan Sharma",   type: "Technical", priority: "Medium", desc: "Application crashes on login after the latest update on all Android devices." },
    { customer: "Priya Nair",     type: "General",   priority: "Low",    desc: "Requesting account information and latest plan upgrade options." },
    { customer: "Dev Menon",      type: "Technical", priority: "High",   desc: "API integration broken — 503 errors being returned from all endpoints since 09:00 IST." },
    { customer: "Sunita Kapoor",  type: "Billing",   priority: "Medium", desc: "Double payment processed for invoice #INV-2025-0441. Requesting refund." },
    { customer: "Arjun Reddy",    type: "General",   priority: "Low",    desc: "Account password reset not working. Email confirmation not being received." }
  ];

  samples.forEach((s, i) => {
    const t = createTicket(s.customer, s.type, s.priority, s.desc);

    // Stagger created times so charts look realistic
    const pastMs = (samples.length - i) * 3.2 * 3600000;
    t.createdAt = new Date(Date.now() - pastMs).toISOString();
    t.updatedAt = t.createdAt;

    // Mark some as in-progress or resolved for demo
    if (i === 2) { t.status = "Resolved"; t.rating = 5; t.resolvedAt = new Date().toISOString(); }
    if (i === 4) { t.status = "In Progress"; }

    tickets.push(t);
  });

  saveToStorage();
}

/* ===================== INIT ===================== */

/**
 * Bootstrap the application.
 */
function init() {
  loadFromStorage();

  // Seed sample data on very first visit
  if (tickets.length === 0) {
    seedSampleData();
  }

  // Run SLA check
  applySLA();

  // Render initial view (dashboard)
  renderDashboard();

  // Start clock
  updateClock();
  setInterval(updateClock, 1000);

  // Refresh SLA & charts every 2 minutes
  setInterval(() => {
    applySLA();
    const activeView = document.querySelector(".view.active");
    if (activeView && activeView.id === "view-dashboard") renderDashboard();
    if (activeView && activeView.id === "view-tickets")   renderTickets();
  }, 120000);

  console.log("✅ SupportDesk Pro initialized.");
}

// Kick off when DOM is ready
document.addEventListener("DOMContentLoaded", init);
