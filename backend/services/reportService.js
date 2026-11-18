const Claim = require('../models/Claim');

exports.buildMonthlyReport = async (month) => {
  if (typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) {
    const error = new Error('Provide a month in YYYY-MM format.');
    error.status = 400;
    throw error;
  }
  const start = new Date(`${month}-01T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 7) !== month) {
    const error = new Error('The requested month is invalid.');
    error.status = 400;
    throw error;
  }
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));

  const claims = await Claim.find({ date: { $gte: start, $lt: end } })
    .populate('employee', 'name email department')
    .populate('category', 'name')
    .sort({ date: 1 });
  const byCategory = new Map();
  const byEmployee = new Map();
  const byDepartment = new Map();
  let totalAmount = 0;
  let paidAmount = 0;

  const addSummaryRow = (map, key, claim, details = {}) => {
    const row = map.get(key) || { name: key, claimCount: 0, amount: 0, paidAmount: 0 };
    row.claimCount += 1;
    row.amount += claim.amount;
    if (claim.status === 'Paid') {
      row.paidAmount += claim.amount;
    }
    Object.assign(row, details);
    map.set(key, row);
  };

  for (const claim of claims) {
    totalAmount += claim.amount;
    if (claim.status === 'Paid') {
      paidAmount += claim.amount;
    }
    const employeeId = claim.employee._id.toString();
    const department = claim.department || claim.employee.department || 'General';
    addSummaryRow(byCategory, claim.category.name, claim);
    addSummaryRow(byEmployee, employeeId, claim, {
      employeeId,
      name: claim.employee.name,
      email: claim.employee.email,
      department
    });
    addSummaryRow(byDepartment, department, claim);
  }

  return {
    month,
    claimCount: claims.length,
    totalAmount: Number(totalAmount.toFixed(2)),
    paidAmount: Number(paidAmount.toFixed(2)),
    byCategory: [...byCategory.values()],
    byEmployee: [...byEmployee.values()],
    byDepartment: [...byDepartment.values()],
    claims
  };
};
