const assert = require("assert");

async function runValidationTests() {
  const apiBase = "http://localhost:4000";

  console.log("=== Running Payment Validation API Tests ===");

  // 1. Test normal initiation with numeric amount
  console.log("1. Testing normal payment initiation with numeric amount (80)...");
  let res = await fetch(`${apiBase}/api/public/payments/initiate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      order_id: "VLT-TEST-1",
      amount: 80,
      currency: "DZD",
      method: "card"
    })
  });
  let data = await res.json();
  assert.strictEqual(res.status, 201, `Expected status 201, got ${res.status}`);
  assert.strictEqual(data.type, "redirect", `Expected redirect type, got ${data.type}`);
  console.log("✓ Normal payment initiation succeeded!");

  // 1.5. Test raw string amount rejection
  console.log("1.5. Testing raw string amount rejection ('80 DZD')...");
  res = await fetch(`${apiBase}/api/public/payments/initiate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      order_id: "VLT-TEST-1.5",
      amount: "80 DZD",
      currency: "DZD",
      method: "card"
    })
  });
  data = await res.json();
  assert.strictEqual(res.status, 400, `Expected status 400, got ${res.status}`);
  assert.strictEqual(data.error, "Invalid payment amount", `Expected 'Invalid payment amount', got '${data.error}'`);
  console.log("✓ Raw string amount rejected correctly!");

  // 2. Test invalid non-numeric amount rejection
  console.log("2. Testing invalid non-numeric amount rejection...");
  res = await fetch(`${apiBase}/api/public/payments/initiate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      order_id: "VLT-TEST-2",
      amount: "abc DZD",
      currency: "DZD",
      method: "card"
    })
  });
  data = await res.json();
  assert.strictEqual(res.status, 400, `Expected status 400, got ${res.status}`);
  assert.strictEqual(data.error, "Invalid payment amount", `Expected 'Invalid payment amount', got '${data.error}'`);
  console.log("✓ Invalid non-numeric amount rejected correctly!");

  // 3. Test negative amount rejection
  console.log("3. Testing negative amount rejection...");
  res = await fetch(`${apiBase}/api/public/payments/initiate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      order_id: "VLT-TEST-3",
      amount: -100,
      currency: "DZD",
      method: "card"
    })
  });
  data = await res.json();
  assert.strictEqual(res.status, 400, `Expected status 400, got ${res.status}`);
  assert.strictEqual(data.error, "Invalid payment amount", `Expected 'Invalid payment amount', got '${data.error}'`);
  console.log("✓ Negative amount rejected correctly!");

  // 4. Test zero amount in Sandbox mode WITHOUT test_free flag
  console.log("4. Testing zero amount in Sandbox mode without test_free flag...");
  res = await fetch(`${apiBase}/api/public/payments/initiate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      order_id: "VLT-TEST-4",
      amount: 0,
      currency: "DZD",
      method: "card"
    })
  });
  data = await res.json();
  assert.strictEqual(res.status, 400, `Expected status 400, got ${res.status}`);
  assert.match(data.error, /only allowed in Sandbox mode if explicitly marked as test_free/);
  console.log("✓ Zero amount in Sandbox mode without test_free flag rejected correctly!");

  // 5. Test zero amount in Sandbox mode WITH test_free flag
  console.log("5. Testing zero amount in Sandbox mode with test_free: true flag...");
  res = await fetch(`${apiBase}/api/public/payments/initiate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      order_id: "VLT-TEST-5",
      amount: 0,
      currency: "DZD",
      method: "card",
      test_free: true
    })
  });
  data = await res.json();
  assert.strictEqual(res.status, 201, `Expected status 201, got ${res.status}`);
  console.log("✓ Zero amount in Sandbox mode with test_free: true flag succeeded!");

  // 6. Test zero amount in Live mode (even with test_free flag)
  console.log("6. Logging in as admin to configure Live mode...");
  const loginRes = await fetch(`${apiBase}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "admin",
      password: "AdminPassword123!"
    })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  assert.ok(token, "Admin login failed");

  console.log("Updating payment_mode to live...");
  const setLiveRes = await fetch(`${apiBase}/api/settings`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      payment_mode: "live"
    })
  });
  assert.strictEqual(setLiveRes.status, 200, "Failed to set live mode");

  try {
    console.log("Testing zero amount in production (live) mode with test_free: true...");
    res = await fetch(`${apiBase}/api/public/payments/initiate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order_id: "VLT-TEST-6",
        amount: 0,
        currency: "DZD",
        method: "card",
        test_free: true
      })
    });
    data = await res.json();
    assert.strictEqual(res.status, 400, `Expected status 400, got ${res.status}`);
    assert.match(data.error, /Zero amount transactions are not allowed in production mode/);
    console.log("✓ Zero amount rejected in Live mode correctly!");
  } finally {
    console.log("Restoring payment_mode to test...");
    const restoreRes = await fetch(`${apiBase}/api/settings`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        payment_mode: "test"
      })
    });
    assert.strictEqual(restoreRes.status, 200, "Failed to restore test mode");
    console.log("Restored sandbox mode (test).");
  }

  console.log("\n🎉 ALL VALIDATION TESTS PASSED SUCCESSFULLY! 🎉");
}

runValidationTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
