const sidebarModules = [

    // Dashboard
    {
        key: "dashboard",
        name: "Dashboard",
        route: "/dashboard",
        group: "Dashboard"
    },

    // Sales & CRM
    {
        key: "crm-sales",
        name: "CRM & Sales",
        route: "/crmsales",
        group: "Sales & CRM"
    },
    {
        key: "orders",
        name: "Orders",
        route: "/orders",
        group: "Sales & CRM"
    },
    {
        key: "products",
        name: "Products",
        route: "/products",
        group: "Sales & CRM"
    },

    // Management
    {
        key: "tasks",
        name: "Tasks",
        route: "/tasks",
        group: "Management"
    },
    {
        key: "checklists",
        name: "Checklists",
        route: "/checklists",
        group: "Management"
    },
    {
        key: "users",
        name: "Users",
        route: "/users",
        group: "Management"
    },
    {
        key: "permissions",
        name: "Permissions",
        route: "/permissions",
        group: "Management"
    },
    {
        key: "reports",
        name: "Reports",
        route: "/reports",
        group: "Management"
    },
    {
        key: "tickets",
        name: "Tickets",
        route: "/tickets",
        group: "Management"
    },
    {
        key: "categories",
        name: "Categories",
        route: "/category",
        group: "Management"
    },
    {
        key: "hr-onboarding",
        name: "HR Onboarding",
        route: "/hr-onboarding",
        group: "Management"
    }

];

module.exports = sidebarModules;





// const sidebarModules = [

//     // DASHBOARD
//     {
//         key: "dashboard",
//         name: "Dashboard",
//         route: "/dashboard",
//         group: "Dashboard",
//         showInSidebar: true
//     },

//     // SALES & CRM
//     {
//         key: "crm-sales",
//         name: "CRM & Sales",
//         route: "/crmsales",
//         group: "Sales & CRM",
//         showInSidebar: true
//     },
//     {
//         key: "leads",
//         name: "Leads",
//         route: "/leads",
//         parentKey: "crm-sales",
//         group: "Sales & CRM",
//         showInSidebar: false
//     },
//     {
//         key: "leads-add",
//         name: "Add Leads",
//         route: "/leads/add",
//         parentKey: "crm-sales",
//         group: "Sales & CRM",
//         showInSidebar: false
//     },
//     {
//         key: "leads-profile",
//         name: "Leads Profile",
//         route: "/leads/profile/:id",
//         parentKey: "crm-sales",
//         group: "Sales & CRM",
//         showInSidebar: false
//     },
//     {
//         key: "customers",
//         name: "Customers",
//         route: "/customers",
//         parentKey: "crm-sales",
//         group: "Sales & CRM",
//         showInSidebar: false
//     },
//     {
//         key: "customers-add",
//         name: "Add Customers",
//         route: "/customers/add",
//         parentKey: "crm-sales",
//         group: "Sales & CRM",
//         showInSidebar: false
//     },
//     {
//         key: "deals",
//         name: "Deals",
//         route: "/deals",
//         parentKey: "crm-sales",
//         group: "Sales & CRM",
//         showInSidebar: false
//     },
//     {
//         key: "deals-add",
//         name: "Add Deals",
//         route: "/deals/add",
//         parentKey: "crm-sales",
//         group: "Sales & CRM",
//         showInSidebar: false
//     },
//     {
//         key: "followups",
//         name: "Followups",
//         route: "/followups",
//         parentKey: "crm-sales",
//         group: "Sales & CRM",
//         showInSidebar: false
//     },
//     {
//         key: "followups-add",
//         name: "Add Followup",
//         route: "/followups/add",
//         parentKey: "crm-sales",
//         group: "Sales & CRM",
//         showInSidebar: false
//     },
//     {
//         key: "followups-view",
//         name: "View Followup",
//         route: "/followups/view/:id",
//         parentKey: "crm-sales",
//         group: "Sales & CRM",
//         showInSidebar: false
//     },

//     // ORDERS
//     {
//         key: "orders",
//         name: "Orders",
//         route: "/orders",
//         group: "Sales & CRM",
//         showInSidebar: true
//     },
//     {
//         key: "orders-view",
//         name: "Order Details",
//         route: "/orders/view/:id",
//         parentKey: "orders",
//         group: "Sales & CRM",
//         showInSidebar: false
//     },

//     // PRODUCTS
//     {
//         key: "products",
//         name: "Products",
//         route: "/products",
//         group: "Sales & CRM",
//         showInSidebar: true
//     },

//     // TASKS
//     {
//         key: "tasks",
//         name: "Tasks",
//         route: "/tasks",
//         group: "Management",
//         showInSidebar: true
//     },
//     {
//         key: "tasks-add",
//         name: "Add Task",
//         route: "/tasks/addtask",
//         parentKey: "tasks",
//         group: "Management",
//         showInSidebar: false
//     },
//     {
//         key: "tasks-view",
//         name: "Task Details",
//         route: "/tasks/taskview/:id",
//         parentKey: "tasks",
//         group: "Management",
//         showInSidebar: false
//     },

//     // CHECKLISTS
//     {
//         key: "checklists",
//         name: "Checklists",
//         route: "/checklists",
//         group: "Management",
//         showInSidebar: true
//     },
//     {
//         key: "checklists-add",
//         name: "Add Checklist",
//         route: "/checklists/add",
//         parentKey: "checklists",
//         group: "Management",
//         showInSidebar: false
//     },
//     {
//         key: "checklists-edit",
//         name: "Edit Checklist",
//         route: "/checklists/edit/:id",
//         parentKey: "checklists",
//         group: "Management",
//         showInSidebar: false
//     },

//     // USERS
//     {
//         key: "users",
//         name: "Users",
//         route: "/users",
//         group: "Management",
//         showInSidebar: true
//     },
//     {
//         key: "users-add",
//         name: "Add User",
//         route: "/users/add-user",
//         parentKey: "users",
//         group: "Management",
//         showInSidebar: false
//     },
//     {
//         key: "users-profile",
//         name: "User Profile",
//         route: "/users/profile/:id",
//         parentKey: "users",
//         group: "Management",
//         showInSidebar: false
//     },

//     // PERMISSIONS
//     {
//         key: "permissions",
//         name: "Permissions",
//         route: "/permissions",
//         group: "Management",
//         showInSidebar: true
//     },
//     {
//         key: "admin-permissions",
//         name: "Admin Permissions",
//         route: "/adminpermission",
//         parentKey: "permissions",
//         group: "Management",
//         showInSidebar: false
//     },

//     // REPORTS
//     {
//         key: "reports",
//         name: "Reports",
//         route: "/reports",
//         group: "Management",
//         showInSidebar: true
//     },

//     // TICKETS
//     {
//         key: "tickets",
//         name: "Tickets",
//         route: "/tickets",
//         group: "Management",
//         showInSidebar: true
//     },

//     // CATEGORIES
//     {
//         key: "categories",
//         name: "Categories",
//         route: "/category",
//         group: "Management",
//         showInSidebar: true
//     },

//     // HR ONBOARDING
//     {
//         key: "hr-onboarding",
//         name: "HR Onboarding",
//         route: "/hr-onboarding",
//         group: "Management",
//         showInSidebar: true
//     },
//     {
//         key: "hr-onboarding-add",
//         name: "Add Employee Documents",
//         route: "/hr-onboarding/add",
//         parentKey: "hr-onboarding",
//         group: "Management",
//         showInSidebar: false
//     },
//     {
//         key: "hr-candidate-profile",
//         name: "Candidate Profile",
//         route: "/hr-onboarding/candidate/:id",
//         parentKey: "hr-onboarding",
//         group: "Management",
//         showInSidebar: false
//     },

//     // SETTINGS
//     {
//         key: "settings",
//         name: "Settings",
//         route: "/settings",
//         group: "Management",
//         showInSidebar: true
//     }

// ];

// module.exports = sidebarModules;
