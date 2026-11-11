const sidebarModules = [

    // DASHBOARD
    {
        key: "dashboard",
        name: "Dashboard",
        route: "/dashboard",
        group: "Dashboard",
        showInSidebar: true,
        actions: ["view", "export"],
        description: "Overview metrics, revenue insights, quick stats and recent activity"
    },

    // SALES & CRM
    {
        key: "crm-sales",
        name: "CRM & Sales",
        route: "/crmsales",
        group: "Sales & CRM",
        showInSidebar: true,
        isParent: true,
        actions: ["view"],
        description: "Sales workspace hub, overview and pipeline navigation"
    },
    {
        key: "leads",
        name: "Leads",
        route: "/leads",
        parentKey: "crm-sales",
        group: "Sales & CRM",
        showInSidebar: false,
        actions: ["view", "create", "edit", "delete", "export"],
        description: "View, capture, update status, assign, export and delete sales leads"
    },
    {
        key: "customers",
        name: "Customers & Contacts",
        route: "/customers",
        parentKey: "crm-sales",
        group: "Sales & CRM",
        showInSidebar: false,
        actions: ["view", "create", "edit", "delete", "export"],
        description: "Customer directory, client purchase profiles and contact history"
    },
    {
        key: "deals",
        name: "Deals & Pipeline",
        route: "/deals",
        parentKey: "crm-sales",
        group: "Sales & CRM",
        showInSidebar: false,
        actions: ["view", "create", "edit", "delete", "export"],
        description: "Sales deal stages, quotes, negotiations and revenue projections"
    },
    {
        key: "followups",
        name: "Follow-ups & Meetings",
        route: "/followups",
        parentKey: "crm-sales",
        group: "Sales & CRM",
        showInSidebar: false,
        actions: ["view", "create", "edit", "delete", "export"],
        description: "Client appointments, reminder schedules, calls and interaction logs"
    },

    // ORDERS
    {
        key: "orders",
        name: "Orders Management",
        route: "/orders",
        group: "Sales & CRM",
        showInSidebar: true,
        actions: ["view", "create", "edit", "delete", "export"],
        description: "Jewellery orders, custom manufacturing jobs, dispatch and billing"
    },
    {
        key: "orders-view",
        name: "Order Details",
        route: "/orders/view/:id",
        parentKey: "orders",
        group: "Sales & CRM",
        showInSidebar: false,
        actions: ["view", "edit", "export"],
        description: "Detailed order specifications, gold weight, stone breakup and invoices"
    },

    // PRODUCTS
    {
        key: "products",
        name: "Products & Inventory",
        route: "/products",
        group: "Sales & CRM",
        showInSidebar: true,
        actions: ["view", "create", "edit", "delete", "export"],
        description: "Jewellery product catalogue, categories, gross/net weight and pricing"
    },

    // TASKS
    {
        key: "tasks",
        name: "Tasks & Workflow",
        route: "/tasks",
        group: "Management",
        showInSidebar: true,
        actions: ["view", "create", "edit", "delete", "approve"],
        description: "Internal staff task delegation, deadlines, status and priority tracking"
    },

    // CHECKLISTS
    {
        key: "checklists",
        name: "Checklists & SOPs",
        route: "/checklists",
        group: "Management",
        showInSidebar: true,
        actions: ["view", "create", "edit", "delete"],
        description: "Store opening/closing procedures, security checks and daily audits"
    },

    // USERS
    {
        key: "users",
        name: "Users & Staff",
        route: "/users",
        group: "Management",
        showInSidebar: true,
        actions: ["view", "create", "edit", "delete"],
        description: "Employee user accounts, designations, roles and security credentials"
    },

    // HR ONBOARDING & DEPARTMENT
    {
        key: "hr-onboarding",
        name: "HR & Onboarding",
        route: "/hr-onboarding",
        group: "Management",
        showInSidebar: true,
        isParent: true,
        actions: ["view", "create", "edit", "delete", "export"],
        description: "Employee verification, KYC documentation and candidate onboarding"
    },
    {
        key: "hr-hiring",
        name: "Hiring & Candidates",
        route: "/hr-onboarding",
        parentKey: "hr-onboarding",
        group: "Management",
        showInSidebar: false,
        actions: ["view", "create", "edit", "delete", "export"],
        description: "Recruitment pipeline, job candidates, interviews and offer management"
    },
    {
        key: "hr-leaves",
        name: "Leaves & Attendance",
        route: "/hr-onboarding",
        parentKey: "hr-onboarding",
        group: "Management",
        showInSidebar: false,
        actions: ["view", "create", "edit", "approve"],
        description: "Staff attendance tracking, leave applications and manager approvals"
    },
    {
        key: "hr-payroll",
        name: "Payroll & Compensation",
        route: "/hr-onboarding",
        parentKey: "hr-onboarding",
        group: "Management",
        showInSidebar: false,
        actions: ["view", "create", "edit", "export"],
        description: "Monthly staff salary calculations, deductions, bonuses and payslips"
    },
    {
        key: "hr-resignation",
        name: "Resignations & Clearance",
        route: "/hr-onboarding",
        parentKey: "hr-onboarding",
        group: "Management",
        showInSidebar: false,
        actions: ["view", "create", "edit", "approve"],
        description: "Employee exit requests, notice periods, handovers and no-dues clearance"
    },

    // REPORTS
    {
        key: "reports",
        name: "Reports & Analytics",
        route: "/reports",
        group: "Management",
        showInSidebar: true,
        actions: ["view", "export"],
        description: "Sales analytics, financial turnover, stock reports and audit logs"
    },

    // TICKETS
    {
        key: "tickets",
        name: "Tickets & Demands",
        route: "/tickets",
        group: "Management",
        showInSidebar: true,
        actions: ["view", "create", "edit", "delete"],
        description: "Stock demand slips, vendor tickets, support issues and purchase orders"
    },

    // CATEGORIES
    {
        key: "categories",
        name: "Categories Master",
        route: "/category",
        group: "Management",
        showInSidebar: true,
        actions: ["view", "create", "edit", "delete"],
        description: "Product categories, gold purity karats (18k/22k/24k) and collections"
    },

    // PERMISSIONS
    {
        key: "permissions",
        name: "Roles & Permissions",
        route: "/permissions",
        group: "Management",
        showInSidebar: true,
        actions: ["view", "edit"],
        description: "Role-based access matrix, subpage privileges and user authorizations"
    },

    // SETTINGS
    {
        key: "settings",
        name: "System Settings",
        route: "/settings",
        group: "Management",
        showInSidebar: true,
        actions: ["view", "edit"],
        description: "Workspace configuration, company profile and general preferences"
    },

    // BACKWARD COMPATIBILITY / LEGACY ACTION KEYS
    { key: "leads-add", name: "Add Leads", route: "/leads/add", parentKey: "crm-sales", group: "Sales & CRM", showInSidebar: false, isLegacy: true },
    { key: "leads-profile", name: "Leads Profile", route: "/leads/profile/:id", parentKey: "crm-sales", group: "Sales & CRM", showInSidebar: false, isLegacy: true },
    { key: "customers-add", name: "Add Customers", route: "/customers/add", parentKey: "crm-sales", group: "Sales & CRM", showInSidebar: false, isLegacy: true },
    { key: "deals-add", name: "Add Deals", route: "/deals/add", parentKey: "crm-sales", group: "Sales & CRM", showInSidebar: false, isLegacy: true },
    { key: "followups-add", name: "Add Followup", route: "/followups/add", parentKey: "crm-sales", group: "Sales & CRM", showInSidebar: false, isLegacy: true },
    { key: "followups-view", name: "View Followup", route: "/followups/view/:id", parentKey: "crm-sales", group: "Sales & CRM", showInSidebar: false, isLegacy: true },
    { key: "tasks-add", name: "Add Task", route: "/tasks/addtask", parentKey: "tasks", group: "Management", showInSidebar: false, isLegacy: true },
    { key: "tasks-view", name: "Task Details", route: "/tasks/taskview/:id", parentKey: "tasks", group: "Management", showInSidebar: false, isLegacy: true },
    { key: "checklists-add", name: "Add Checklist", route: "/checklists/add", parentKey: "checklists", group: "Management", showInSidebar: false, isLegacy: true },
    { key: "checklists-edit", name: "Edit Checklist", route: "/checklists/edit/:id", parentKey: "checklists", group: "Management", showInSidebar: false, isLegacy: true },
    { key: "users-add", name: "Add User", route: "/users/add-user", parentKey: "users", group: "Management", showInSidebar: false, isLegacy: true },
    { key: "users-profile", name: "User Profile", route: "/users/profile/:id", parentKey: "users", group: "Management", showInSidebar: false, isLegacy: true },
    { key: "admin-permissions", name: "Admin Permissions", route: "/adminpermission", parentKey: "permissions", group: "Management", showInSidebar: false, isLegacy: true },
    { key: "hr-onboarding-add", name: "Add Employee Documents", route: "/hr-onboarding/add", parentKey: "hr-onboarding", group: "Management", showInSidebar: false, isLegacy: true },
    { key: "hr-candidate-profile", name: "Candidate Profile", route: "/hr-onboarding/candidate/:id", parentKey: "hr-onboarding", group: "Management", showInSidebar: false, isLegacy: true }
];

module.exports = sidebarModules;
