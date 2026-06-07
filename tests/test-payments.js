const path = require("path");
const fs = require("fs");

// Set env vars
process.env.JWT_SECRET = "test-jwt-secret-123456";
process.env.PORT = "4001";

const db = require("../backend/src/db");
const payments = require("../backend/src/payments");

const storePath = path.join(__dirname, "..", "backend", "data", "store.json");
let originalStore = null;

async function runTests() {
  console.log("=== Running Voltify Payment System Tests ===");

  // 1. Backup original database
  if (fs.existsSync(storePath)) {
    console.log("Backing up original store.json...");
    originalStore = fs.readFileSync(storePath, "utf8");
  }

  try {
    // 2. Initialize database
    await db.initDb();
    console.log("Database initialized.");

    // Clean start for test values
    const originalOrders = db.listOrders();
    const originalInvoices = db.listInvoices();
    const originalTransactions = db.listTransactions();

    // 3. Create a test order
    const orderId = `VLT-${Math.floor(100000 + Math.random() * 900000)}`;
    const testOrder = {
      id: orderId,
      tracking_number: `TRK-${Math.floor(100000 + Math.random() * 900000)}`,
      customer: "John Doe",
      phone: "0555123456",
      game: "PUBG Mobile",
      pkg: "660 UC",
      price: 1500,
      status: "processing",
      uid: "5123456789",
      created_at: new Date().toISOString()
    };
    db.createOrder(testOrder);
    console.log(`✓ Test Order created: ${orderId}`);

    // Verify order exists
    const orders = db.listOrders();
    const createdOrder = orders.find(o => o.id === orderId);
    if (!createdOrder) throw new Error("Failed to create test order");

    // 4. Create a transaction for this order
    const txn = db.createTransaction({
      order_id: orderId,
      amount: 1500,
      currency: "DZD",
      method: "bank_card",
      provider: "mock",
      status: "pending",
      mode: "test"
    });
    console.log(`✓ Transaction record created: ${txn.id}`);

    // Test Signature Generation
    const secret = process.env.JWT_SECRET;
    const sig = payments.generateTransactionSignature(txn, secret);
    if (!sig) throw new Error("Failed to generate transaction signature");
    txn.signature = sig;
    db.updateTransaction(txn.id, txn);
    console.log(`✓ HMAC-SHA256 signature generated and verified`);

    // Verify signature validation helper works
    const isSigValid = payments.verifyTransactionSignature(txn, secret);
    if (!isSigValid) throw new Error("Signature verification helper failed");
    console.log(`✓ Signature verification verified successfully`);

    // 5. Test Signature Tampering detection
    const tamperedTxn = { ...txn, amount: 99999 }; // altered amount
    const isTamperedValid = payments.verifyTransactionSignature(tamperedTxn, secret);
    if (isTamperedValid) throw new Error("Security Alert: Tampered transaction was accepted!");
    console.log(`✓ Tamper protection verified: Altered transaction rejected`);

    // 6. Test processCompletedTransaction state transitions
    console.log("Simulating mock gateway payment success callback...");
    payments.logTxnEvent(txn, "mock_success_callback", { status: "success" });
    db.updateTransaction(txn.id, txn);

    // Call processing function
    const processedTxn = await payments.processCompletedTransaction(txn.id, { gateway_ref: "MOCK-REF-12345" }, db);
    
    // Assert transaction status
    if (processedTxn.status !== "completed") {
      throw new Error(`Transaction status should be completed, got: ${processedTxn.status}`);
    }
    console.log(`✓ Transaction transitioned to: completed`);

    // Assert order status and payment method updated
    const updatedOrders = db.listOrders();
    const updatedOrder = updatedOrders.find(o => o.id === orderId);
    if (!updatedOrder) throw new Error("Order not found after transaction completion");
    if (updatedOrder.status !== "completed") {
      throw new Error(`Order status should be completed, got: ${updatedOrder.status}`);
    }
    if (updatedOrder.payment !== "BANK_CARD") {
      throw new Error(`Order payment method should be BANK_CARD, got: ${updatedOrder.payment}`);
    }
    console.log(`✓ Order status updated to 'completed' & payment method set to BANK_CARD`);

    // Assert Invoice generated
    const invoices = db.listInvoices();
    const orderInvoice = invoices.find(i => i.order_ref === orderId);
    if (!orderInvoice) throw new Error("No invoice generated for the completed transaction");
    if (orderInvoice.status !== "paid") {
      throw new Error(`Invoice status should be paid, got: ${orderInvoice.status}`);
    }
    if (orderInvoice.total !== 1500) {
      throw new Error(`Invoice total should be 1500, got: ${orderInvoice.total}`);
    }
    console.log(`✓ Paid Invoice automatically generated: ${orderInvoice.id} (${orderInvoice.total} DZD)`);

    // 7. Test manual approval flow (for BaridiMob/Flexy)
    console.log("Testing manual approval flow for BaridiMob...");
    const baridiTxn = db.createTransaction({
      order_id: orderId,
      amount: 1500,
      currency: "DZD",
      method: "baridimob",
      provider: "manual",
      status: "pending_verification",
      mode: "test"
    });
    
    // Simulate submitting proof
    payments.logTxnEvent(baridiTxn, "proof_submitted", { ref_number: "12345678", proof_url: "/uploads/proof-test.jpg" });
    db.updateTransaction(baridiTxn.id, baridiTxn);
    console.log(`✓ Manual proof uploaded for BaridiMob txn: ${baridiTxn.id}`);

    // Approve the transaction manually (Admin Dashboard endpoint simulation)
    const approvedBaridi = await payments.processCompletedTransaction(baridiTxn.id, { approved_by: "test-admin" }, db);
    if (approvedBaridi.status !== "completed") {
      throw new Error(`BaridiMob transaction status should be completed, got: ${approvedBaridi.status}`);
    }
    console.log(`✓ Manual approval successfully transitioned BaridiMob transaction to: completed`);

    console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉");

  } catch (error) {
    console.error("\n❌ TEST FAILED:", error);
    process.exitCode = 1;
  } finally {
    // 8. Restore original store.json
    if (originalStore) {
      console.log("Restoring original store.json...");
      fs.writeFileSync(storePath, originalStore, "utf8");
    } else if (fs.existsSync(storePath)) {
      console.log("Cleaning up test store.json...");
      fs.unlinkSync(storePath);
    }
    console.log("Clean up finished.");
  }
}

runTests();
