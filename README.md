# 🎧 SupportDesk Pro — Customer Support Ticket Management System

A fully client-side **Customer Support Ticket Management System** with a real-time analytics dashboard. Built with vanilla HTML, CSS, and JavaScript — no frameworks, no backend, no install required.

> Designed to replicate the look and feel of enterprise BPM tools used at companies like WNS, Concentrix, and Teleperformance.

---

## 📸 Preview

| Dashboard | Tickets View | New Ticket Form |
|-----------|-------------|-----------------|
| KPI cards, pie chart, bar chart, recent activity | Filterable ticket cards with status controls | Validated form with priority selector |

---

## 🚀 Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-username/supportdesk-pro.git

# 2. Navigate into the folder
cd supportdesk-pro

# 3. Open in browser — no server needed
open index.html        # macOS
start index.html       # Windows
xdg-open index.html    # Linux
```

No `npm install`. No build step. Just open and use.

---

## 📁 Project Structure

```
supportdesk-pro/
├── index.html      # App shell: sidebar, views, modal, toast
├── style.css       # Dark enterprise theme, responsive layout
├── script.js       # All app logic: CRUD, SLA, charts, storage
└── README.md
```

---

## ✨ Features

### Core Ticket Management
- **Create tickets** with Customer Name, Issue Type, Priority, and Description
- **Update status** inline (Open → In Progress → Resolved / Delayed)
- **Delete tickets** with a confirmation modal
- **Edit tickets** via a full update modal with internal notes

### Analytics Dashboard
- **5 KPI cards** — Total, Resolved, Pending, High Priority, Avg Satisfaction
- **Doughnut chart** — Tickets by status (Chart.js)
- **Bar chart** — Tickets by issue type (Chart.js)
- **Recent Activity table** — Last 6 tickets at a glance

### SLA (Service Level Agreement) Engine
| Priority | SLA Deadline |
|----------|-------------|
| High     | 4 hours     |
| Medium   | 24 hours    |
| Low      | 72 hours    |

Tickets approaching their deadline are flagged **"SLA At Risk"** and breached tickets are automatically escalated to **"Delayed"** status.

### Customer Satisfaction (CSAT)
- Agents assign a **1–5 star rating** when resolving a ticket
- Dashboard displays the **rolling average** across all rated tickets

### Filtering & Search
- Filter by **Status**, **Priority**, and **Issue Type**
- Live **search by customer name**
- One-click **Clear Filters** reset

### Data Persistence
- All data stored in **browser localStorage** — survives page refresh and browser restart
- No account or login required

### UI / UX
- Dark enterprise design with a professional color palette
- Fully **responsive** — works on desktop, tablet, and mobile
- Animated toast notifications for all actions
- Live clock in the top bar

---

## 🛠️ Tech Stack

| Technology | Usage |
|---|---|
| HTML5 | Semantic app structure |
| CSS3 | Custom dark theme, CSS Grid, Flexbox, animations |
| Vanilla JavaScript (ES6+) | All app logic, DOM manipulation |
| [Chart.js 4](https://www.chartjs.org/) | Doughnut & bar charts (CDN) |
| [Google Fonts](https://fonts.google.com/) | Syne (headings) + DM Sans (body) |
| localStorage API | Client-side data persistence |

---

## 📋 Ticket Data Model

```js
{
  id:          "TKT-0001",         // Auto-generated unique ID
  customer:    "Aisha Bhopal",     // Customer full name
  type:        "Billing",          // Billing | Technical | General
  priority:    "High",             // Low | Medium | High
  description: "Incorrect charge…",
  status:      "Open",             // Open | In Progress | Resolved | Delayed
  rating:      null,               // 1–5 (set on resolution)
  notes:       "",                 // Internal agent notes
  createdAt:   "2025-04-25T…",    // ISO timestamp
  updatedAt:   "2025-04-25T…",
  resolvedAt:  null
}
```

---

## 🔑 Key Implementation Details

**SLA Auto-Escalation** — `applySLA()` runs on every view render. It computes ticket age in hours and automatically sets status to `"Delayed"` if the SLA deadline is breached, requiring no manual intervention.

**Chart Lifecycle Management** — Chart instances are stored in module-level variables (`statusChartInst`, `typeChartInst`). Before each re-render, `.destroy()` is called to prevent canvas memory leaks.

**XSS Prevention** — All user input is sanitized through a DOM-based `escapeHtml()` helper before being injected into innerHTML.

**Centralized State** — A single `tickets[]` array is the source of truth. Every operation mutates this array and calls `saveToStorage()` to sync with localStorage.

---

## 🗺️ Roadmap / Possible Extensions

- [ ] Export tickets to CSV / PDF
- [ ] Role-based views (Agent vs Supervisor)
- [ ] Email notification simulation
- [ ] Dark/Light theme toggle
- [ ] Ticket assignment to agents
- [ ] Priority-based SLA countdown timer
- [ ] Backend integration (Node.js + MongoDB)

---

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add some feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

---

## 📄 License

[MIT](https://choosealicense.com/licenses/mit/) — free to use, modify, and distribute.

---

## 👤 Author

**Your Name**
- GitHub: [@your-username](https://github.com/your-username)
- LinkedIn: [your-linkedin](https://linkedin.com/in/your-linkedin)

---

> ⭐ If this project helped you, please give it a star on GitHub!
