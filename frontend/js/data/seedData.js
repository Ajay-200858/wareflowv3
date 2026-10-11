const seedData = {
  users: [
    // passwords will be hashed on initialization if needed. We'll store plain text for the seed script to hash.
    { id: 'u_admin', email: 'admin@wareflow.demo', passPlain: 'password123', role: 'admin', companyId: 'c_demo', name: 'Admin User' },
    { id: 'u_manager', email: 'manager@wareflow.demo', passPlain: 'password123', role: 'manager', companyId: 'c_demo', name: 'Manager User' },
    { id: 'u_employee', email: 'employee@wareflow.demo', passPlain: 'password123', role: 'employee', companyId: 'c_demo', name: 'Arjun Kumar' }
  ],
  company: {
    id: 'c_demo',
    name: 'Apex Distribution Pvt Ltd',
    industry: 'General',
    location: 'Coimbatore',
    status: 'active'
  },
  warehouses: [
    {
      id: 'WH01',
      name: 'Main Hub',
      zones: [
        {
          id: 'Z-A',
          name: 'Zone A',
          racks: [
            { id: 'R-A01', name: 'A01', rows: 5, positionsPerRow: 10 },
            { id: 'R-A02', name: 'A02', rows: 5, positionsPerRow: 10 }
          ]
        },
        {
          id: 'Z-B',
          name: 'Zone B',
          racks: [
            { id: 'R-B01', name: 'B01', rows: 4, positionsPerRow: 8 }
          ]
        }
      ]
    }
  ],
  products: [
    { id: 'P-001', name: 'Coca-Cola 500ml', category: 'Beverages', unit: 'Bottle', price: 40, expiry: '2026-11-28', storageType: 'Rack' },
    { id: 'P-002', name: 'Parle-G Biscuits', category: 'Food', unit: 'Pack', price: 10, expiry: '2025-06-15', storageType: 'Rack' },
    { id: 'P-003', name: 'Samsung USB-C Adapter', category: 'Electronics', unit: 'Box', price: 800, expiry: null, storageType: 'Rack' },
    { id: 'P-004', name: 'Nike Running Shoes', category: 'Fashion', unit: 'Pair', price: 3000, expiry: null, storageType: 'Rack' },
    { id: 'P-005', name: 'Amul Milk 1L', category: 'Food', unit: 'Packet', price: 60, expiry: '2024-10-05', storageType: 'Rack' },
    { id: 'P-006', name: 'Logitech Wireless Mouse', category: 'Electronics', unit: 'Box', price: 1200, expiry: null, storageType: 'Rack' }
  ],
  inventory: [
    { id: 'INV-1', productId: 'P-001', quantity: 1240, location: 'WH01-Z-A-R-A02-2-4' },
    { id: 'INV-2', productId: 'P-002', quantity: 5000, location: 'WH01-Z-A-R-A01-1-1' },
    { id: 'INV-3', productId: 'P-005', quantity: 400, location: 'WH01-Z-A-R-A01-1-2' }
  ],
  employees: [
    { id: 'u_employee', name: 'Arjun Kumar', role: 'Picker', shift: 'Day', workload: 72, performance: 91, completedJobs: 1284, rejectedJobs: 14, onTime: 94 },
    { id: 'E-002', name: 'Priya N', role: 'Packer', shift: 'Day', workload: 84, performance: 88, completedJobs: 980, rejectedJobs: 5, onTime: 92 },
    { id: 'E-003', name: 'Karthik M', role: 'Driver', shift: 'Day', workload: 43, performance: 76, completedJobs: 400, rejectedJobs: 2, onTime: 85 },
    { id: 'E-004', name: 'Divya R', role: 'Picker', shift: 'Evening', workload: 61, performance: 95, completedJobs: 1100, rejectedJobs: 1, onTime: 98 },
    { id: 'E-005', name: 'Sanjay P', role: 'Manager', shift: 'Day', workload: 50, performance: 100, completedJobs: 0, rejectedJobs: 0, onTime: 100 }
  ],
  orders: [
    { id: 'ORD-1042', customer: 'ABC Supermarket', status: 'New', requiredTime: '17:00', dest: 'Coimbatore', items: [{ productId: 'P-001', qty: 100 }, { productId: 'P-002', qty: 50 }], assignedEmployee: null, createdDate: new Date().toISOString() },
    { id: 'ORD-1043', customer: 'XYZ Electronics', status: 'Picking', requiredTime: '14:00', dest: 'Chennai', items: [{ productId: 'P-003', qty: 10 }, { productId: 'P-006', qty: 25 }], assignedEmployee: 'u_employee', createdDate: new Date().toISOString() }
  ],
  jobs: [
    { id: 'JOB-1048', orderId: 'ORD-1043', employeeId: 'u_employee', type: 'Picking', status: 'Assigned', items: [{ productId: 'P-003', qty: 10, location: 'WH01-Z-B-R-B01-1-1' }], estimatedDuration: 18 }
  ],
  recommendations: [
    { id: 'AI-00482', type: 'Storage Optimization', object: 'Coca-Cola 500ml', recommendation: 'Move to WH01-Z-A-R-A02-2-4', confidence: 94, reason: 'High demand + near dispatch', created: new Date().toISOString(), status: 'Pending Review' },
    { id: 'AI-00483', type: 'Employee Assignment', object: 'JOB-1048', recommendation: 'Assign to Arjun Kumar', confidence: 88, reason: 'Available and experienced', created: new Date().toISOString(), status: 'Accepted' }
  ],
  activity: [
    { timestamp: new Date().toISOString(), message: 'System initialized with demo data.' }
  ],
  notifications: [
    { id: 'N-1', type: 'alert', message: 'Low stock for Amul Milk 1L', read: false, timestamp: new Date().toISOString() },
    { id: 'N-2', type: 'info', message: 'Storage recommendation AI-00482 waiting for review', read: false, timestamp: new Date().toISOString() }
  ],
  salaryRules: {
    type: 'Work-based',
    base: 25000,
    pickingRate: 25,
    packingRate: 20,
    deliveryRate: 80,
    overtimeRate: 150,
    performanceBonus: 800
  }
};

window.seedData = seedData;
