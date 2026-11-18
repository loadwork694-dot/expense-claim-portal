const test = require('node:test');
const assert = require('node:assert/strict');
const { canReviewClaim, getNextStatus } = require('./claimWorkflow');

test('manager can only move submitted claims to approval or rejection', () => {
  assert.equal(getNextStatus('Manager', 'Submitted', 'approve'), 'Manager Approved');
  assert.equal(getNextStatus('Manager', 'Submitted', 'reject'), 'Rejected');
  assert.equal(getNextStatus('Manager', 'Manager Approved', 'approve'), null);
});

test('accounts cannot bypass manager approval and can complete payment', () => {
  assert.equal(getNextStatus('Accounts', 'Submitted', 'approve'), null);
  assert.equal(getNextStatus('Accounts', 'Manager Approved', 'approve'), 'Accounts Approved');
  assert.equal(getNextStatus('Accounts', 'Manager Approved', 'reject'), 'Rejected');
  assert.equal(getNextStatus('Accounts', 'Accounts Approved', 'paid'), 'Paid');
  assert.equal(getNextStatus('Accounts', 'Submitted', 'paid'), null);
});

test('other roles cannot change claim status', () => {
  assert.equal(getNextStatus('Employee', 'Submitted', 'approve'), null);
  assert.equal(getNextStatus('Admin', 'Manager Approved', 'paid'), null);
});

test('the manager can review all employee claims but reviewers cannot approve their own', () => {
  assert.equal(canReviewClaim({
    role: 'Manager',
    actorId: 'manager-1',
    employeeId: 'employee-1'
  }), true);
  assert.equal(canReviewClaim({
    role: 'Manager',
    actorId: 'manager-1',
    employeeId: 'manager-1'
  }), false);
  assert.equal(canReviewClaim({
    role: 'Accounts',
    actorId: 'accounts-1',
    employeeId: 'employee-1'
  }), true);
  assert.equal(canReviewClaim({
    role: 'Accounts',
    actorId: 'accounts-1',
    employeeId: 'accounts-1'
  }), false);
});
