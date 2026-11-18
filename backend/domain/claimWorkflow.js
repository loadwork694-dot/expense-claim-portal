const transitions = {
  Manager: {
    Submitted: {
      approve: 'Manager Approved',
      reject: 'Rejected'
    }
  },
  Accounts: {
    'Manager Approved': {
      approve: 'Accounts Approved',
      reject: 'Rejected'
    },
    'Accounts Approved': {
      paid: 'Paid'
    }
  }
};

exports.getNextStatus = (role, currentStatus, action) => (
  transitions[role]?.[currentStatus]?.[action] || null
);

exports.canReviewClaim = ({ role, actorId, employeeId }) => (
  actorId !== employeeId && ['Manager', 'Accounts'].includes(role)
);
