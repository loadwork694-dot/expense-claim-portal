const nodemailer = require('nodemailer');

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function statusDetails(status) {
  const details = {
    Submitted: 'Your claim has been submitted and is waiting for Manager review.',
    'Manager Approved': 'The Manager has approved your claim. It is now waiting for Accounts review.',
    'Accounts Approved': 'Accounts has approved your claim. It is now waiting for payment.',
    Paid: 'Payment for your claim has been completed.',
    Rejected: 'Your claim was rejected. Please review the reason below.'
  };
  return details[status] || `The status of your claim changed to ${status}.`;
}

function createTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_SECURE } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD) {
    throw new Error('Email alerts are not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASSWORD.');
  }

  const port = Number(SMTP_PORT);
  const secure = SMTP_SECURE !== undefined ? SMTP_SECURE === 'true' : port === 465;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    family: 4,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });
}

exports.sendStatusChangeEmail = async (claim, action, comment) => {
  const { SMTP_USER, MAIL_FROM } = process.env;
  const employeeName = escapeHtml(claim.employee?.name);
  const categoryName = escapeHtml(claim.category?.name || 'Expense');
  const status = escapeHtml(claim.status);
  const amount = Number(claim.amount || 0).toFixed(2);
  const commentText = escapeHtml(comment);

  await createTransporter().sendMail({
    from: MAIL_FROM || SMTP_USER,
    to: claim.employee.email,
    subject: `Expense claim update: ${claim.status}`,
    text: [
      `Hello ${claim.employee.name},`,
      '',
      `Your expense claim for ${claim.category.name} (Rs ${amount}) is now ${claim.status}.`,
      statusDetails(claim.status),
      comment ? `Comment: ${comment}` : '',
      '',
      'Expense Claim Portal'
    ].filter(Boolean).join('\n'),
    html: `
      <div style="margin:0;padding:32px;background:#06120d;font-family:Arial,sans-serif;color:#eff8f3">
        <div style="max-width:600px;margin:0 auto;border:1px solid #204a37;border-radius:16px;background:#0e241a;overflow:hidden">
          <div style="padding:22px 24px;border-bottom:1px solid #204a37">
            <strong style="color:#31d3a0;font-size:13px;letter-spacing:1px">EXPENSE CLAIM PORTAL</strong>
          </div>
          <div style="padding:24px">
            <p style="margin:0 0 16px">Hello ${employeeName},</p>
            <p style="margin:0 0 20px;color:#b8cbc1">${statusDetails(claim.status)}</p>
            <div style="border:1px solid #315343;border-radius:12px;padding:16px;background:#10271c">
              <div style="margin-bottom:10px;color:#91a89b;font-size:12px">Claim status</div>
              <div style="margin-bottom:16px;color:#31d3a0;font-size:22px;font-weight:bold">${status}</div>
              <div style="color:#b8cbc1">Category: <strong style="color:#eff8f3">${categoryName}</strong></div>
              <div style="margin-top:6px;color:#b8cbc1">Amount: <strong style="color:#eff8f3">Rs ${amount}</strong></div>
              ${commentText ? `<div style="margin-top:14px;border-top:1px solid #315343;padding-top:14px;color:#b8cbc1">Comment / reason:<br><strong style="color:#eff8f3">${commentText}</strong></div>` : ''}
            </div>
          </div>
        </div>
      </div>
    `
  });
};

exports.sendSignupDecisionEmail = async (user, approved, role) => {
  const { SMTP_USER, MAIL_FROM } = process.env;
  const outcome = approved ? 'approved' : 'not approved';
  await createTransporter().sendMail({
    from: MAIL_FROM || SMTP_USER,
    to: user.email,
    subject: `Expense Claim Portal signup ${outcome}`,
    text: [
      `Hello ${user.name},`,
      '',
      `Your signup request for the ${role} role has been ${outcome}.`,
      approved ? 'You can now sign in to the Expense Claim Portal.' : '',
      '',
      'Expense Claim Portal'
    ].filter(Boolean).join('\n')
  });
};