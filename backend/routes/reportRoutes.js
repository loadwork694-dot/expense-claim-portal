const express = require('express');
const ExcelJS = require('exceljs');
const { protect, authorize } = require('../middleware/authMiddleware');
const { buildMonthlyReport } = require('../services/reportService');

const router = express.Router();

router.use(protect, authorize('Accounts', 'Admin'));

router.get('/monthly', async (req, res) => {
  try {
    const report = await buildMonthlyReport(req.query.month);
    return res.json(report);
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ message: error.message });
    }
    console.error('Monthly report failed:', error);
    return res.status(500).json({ message: 'Unable to create the monthly report.' });
  }
});

router.get('/monthly.xlsx', async (req, res) => {
  try {
    const report = await buildMonthlyReport(req.query.month);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Expense Claim Portal';
    workbook.created = new Date();

    const summary = workbook.addWorksheet('Monthly Summary');
    summary.addRows([
      ['Expense Claim Portal', `Monthly report: ${report.month}`],
      ['Claims', report.claimCount],
      ['Total claimed (Rs)', report.totalAmount],
      ['Paid (Rs)', report.paidAmount],
      [],
      ['Category', 'Claims', 'Total (Rs)', 'Paid (Rs)'],
      ...report.byCategory.map((row) => [row.name, row.claimCount, row.amount, row.paidAmount]),
      [],
      ['Department', 'Claims', 'Total (Rs)', 'Paid (Rs)'],
      ...report.byDepartment.map((row) => [row.name, row.claimCount, row.amount, row.paidAmount]),
      [],
      ['Employee', 'Email', 'Department', 'Claims', 'Total (Rs)', 'Paid (Rs)'],
      ...report.byEmployee.map((row) => [
        row.name, row.email, row.department, row.claimCount, row.amount, row.paidAmount
      ])
    ]);
    summary.getRow(1).font = { bold: true, size: 15 };
    summary.columns = [
      { width: 28 }, { width: 32 }, { width: 22 }, { width: 16 }, { width: 20 }, { width: 18 }
    ];

    const details = workbook.addWorksheet('Claims');
    details.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Employee', key: 'employee', width: 24 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Amount (Rs)', key: 'amount', width: 16 },
      { header: 'Status', key: 'status', width: 22 },
      { header: 'Note', key: 'note', width: 42 },
      { header: 'Rejection reason', key: 'rejectReason', width: 42 }
    ];
    details.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    details.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF12382D' } };
    report.claims.forEach((claim) => {
      details.addRow({
        date: new Date(claim.date).toLocaleDateString(),
        employee: claim.employee?.name || '',
        email: claim.employee?.email || '',
        department: claim.department || claim.employee?.department || 'General',
        category: claim.category?.name || '',
        amount: claim.amount,
        status: claim.status,
        note: claim.note,
        rejectReason: claim.rejectReason
      });
    });
    details.autoFilter = { from: 'A1', to: 'I1' };

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="expense-report-${report.month}.xlsx"`);
    return res.status(200).send(buffer);
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ message: error.message });
    }
    console.error('Excel report export failed:', error);
    return res.status(500).json({ message: 'Unable to export the monthly report.' });
  }
});

module.exports = router;
