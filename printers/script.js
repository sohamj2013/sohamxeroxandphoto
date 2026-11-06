 // ==========================================
 // SOHAM XEROX AND PHOTO
 // SUPABASE OWNER DASHBOARD
 // ==========================================

 const supabaseClient = window.supabaseClient;

 let customers = [];
 let works = [];
 let currentUser = null;

 const $ = (id) => document.getElementById(id);

 // ==========================================
 // INITIALIZE
 // ==========================================

 document.addEventListener("DOMContentLoaded", async () => {

     if (!supabaseClient) {
         alert("Supabase connection failed. Check supabase-config.js");
         return;
     }

     $("loginForm").addEventListener("submit", loginOwner);
     $("logoutButton").addEventListener("click", logoutOwner);
     $("customerForm").addEventListener("submit", addCustomer);
     $("workForm").addEventListener("submit", addWork);

     $("dashboard").hidden = true;

     await checkSession();

 });

 // ==========================================
 // OWNER LOGIN
 // ==========================================

 async function loginOwner(event) {

     event.preventDefault();

     const email = $("ownerEmail").value.trim();
     const password = $("ownerPassword").value;

     const message = $("loginMessage");

     message.textContent = "Signing in...";

     const { data, error } = await supabaseClient.auth.signInWithPassword({
         email,
         password
     });

     if (error) {
         message.textContent = error.message;
         return;
     }

     currentUser = data.user;

     await checkOwnerAccess();

 }

 // ==========================================
 // CHECK EXISTING SESSION
 // ==========================================

 async function checkSession() {

     const { data, error } = await supabaseClient.auth.getSession();

     if (error || !data.session) {
         showLogin();
         return;
     }

     currentUser = data.session.user;

     await checkOwnerAccess();

 }

 // ==========================================
 // VERIFY OWNER ROLE
 // ==========================================

 async function checkOwnerAccess() {

     const { data: profile, error } = await supabaseClient
         .from("profiles")
         .select("role")
         .eq("id", currentUser.id)
         .maybeSingle();

     if (error || !profile || profile.role !== "owner") {

         alert("Access denied. Owner account required.");

         await supabaseClient.auth.signOut();

         showLogin();

         return;

     }

     showDashboard();

     await loadDashboardData();

 }

 // ==========================================
 // SHOW LOGIN
 // ==========================================

 function showLogin() {

     $("loginSection").hidden = false;
     $("dashboard").hidden = true;
     $("dashboardNav").hidden = true;

     $("loginSection").style.display = "";

     currentUser = null;

 }

 // ==========================================
 // SHOW DASHBOARD
 // ==========================================

 function showDashboard() {

     $("loginSection").hidden = true;
     $("dashboard").hidden = false;
     $("dashboardNav").hidden = false;

     $("dashboard").scrollIntoView({
         behavior: "smooth"
     });

 }

 // ==========================================
 // LOGOUT
 // ==========================================

 async function logoutOwner() {

     const { error } = await supabaseClient.auth.signOut();

     if (error) {
         alert(error.message);
         return;
     }

     customers = [];
     works = [];

     showLogin();

     alert("Logged out successfully.");

 }

 // ==========================================
 // LOAD CUSTOMERS AND WORKS
 // ==========================================

 async function loadDashboardData() {

     await loadCustomers();
     await loadWorks();

     updateDashboard();

 }

 async function loadCustomers() {

     const { data, error } = await supabaseClient
         .from("customers")
         .select("*")
         .order("created_at", { ascending: false });

     if (error) {
         console.error(error);
         alert("Could not load customers: " + error.message);
         return;
     }

     customers = data || [];

 }

 async function loadWorks() {

     const { data, error } = await supabaseClient
         .from("work_orders")
         .select("*")
         .order("created_at", { ascending: false });

     if (error) {
         console.error(error);
         alert("Could not load work records: " + error.message);
         return;
     }

     works = (data || []).map(work => ({
         ...work,
         customerId: work.customer_id,
         workName: work.work_name,
         date: work.billing_date,
         total: Number(work.total_amount),
         received: Number(work.received_amount),
         remaining: Number(work.total_amount) - Number(work.received_amount)
     }));

 }

 // ==========================================
 // ADD CUSTOMER
 // ==========================================

 async function addCustomer(event) {

     event.preventDefault();

     const name = $("customerName").value.trim();
     const phone = $("customerPhone").value.trim();

     if (!name || !phone) return;

     const { error } = await supabaseClient
         .from("customers")
         .insert({
             name,
             phone
         });

     if (error) {
         alert("Customer could not be saved: " + error.message);
         return;
     }

     event.target.reset();

     await loadCustomers();

     updateDashboard();

     alert("Customer added successfully!");

 }

 // ==========================================
 // CUSTOMER DROPDOWN
 // ==========================================

 function updateCustomerDropdown() {

     const dropdown = $("workCustomer");

     dropdown.innerHTML = '<option value="">Select Customer</option>';

     customers.forEach(customer => {

         const option = document.createElement("option");

         option.value = customer.id;
         option.textContent = customer.name;

         dropdown.appendChild(option);

     });

 }

 // ==========================================
 // ADD WORK
 // ==========================================

 async function addWork(event) {

     event.preventDefault();

     const customerId = $("workCustomer").value;
     const workName = $("workName").value.trim();
     const date = $("billingDate").value;
     const total = Number($("totalAmount").value);
     const received = Number($("receivedAmount").value);
     const status = $("workStatus").value;

     if (
         !customerId ||
         !workName ||
         !date ||
         !Number.isFinite(total) ||
         !Number.isFinite(received) ||
         total < 0 ||
         received < 0 ||
         received > total
     ) {

         alert("Please check all work and payment details.");
         return;

     }

     const { data: work, error } = await supabaseClient
         .from("work_orders")
         .insert({
             customer_id: customerId,
             work_name: workName,
             billing_date: date,
             total_amount: total,
             received_amount: received,
             status
         })
         .select()
         .single();

     if (error) {
         alert("Work could not be saved: " + error.message);
         return;
     }

     if (received > 0) {

         const { error: paymentError } = await supabaseClient
             .from("payments")
             .insert({
                 work_order_id: work.id,
                 amount: received
             });

         if (paymentError) {

             alert(
                 "Work was saved, but payment history could not be saved: " +
                 paymentError.message
             );

         }

     }

     event.target.reset();

     $("receivedAmount").value = 0;

     await loadDashboardData();

     alert("Work record saved successfully!");

 }

 // ==========================================
 // RECORD PAYMENT
 // ==========================================

 async function recordPayment(workId) {

     const work = works.find(w => String(w.id) === String(workId));

     if (!work || work.remaining <= 0) return;

     const payment = prompt(
         "Remaining amount: ₹" + work.remaining +
         "\nEnter amount received:"
     );

     if (payment === null || payment.trim() === "") return;

     const amount = Number(payment);

     if (
         !Number.isFinite(amount) ||
         amount <= 0 ||
         amount > work.remaining
     ) {

         alert("Please enter a valid payment amount.");
         return;

     }

     const newReceived = work.received + amount;

     const { error: paymentError } = await supabaseClient
         .from("payments")
         .insert({
             work_order_id: work.id,
             amount
         });

     if (paymentError) {
         alert("Payment could not be recorded: " + paymentError.message);
         return;
     }

     const { error: updateError } = await supabaseClient
         .from("work_orders")
         .update({
             received_amount: newReceived
         })
         .eq("id", work.id);

     if (updateError) {

         alert(
             "Payment history saved, but work balance update failed. " +
             updateError.message
         );

         return;

     }

     await loadDashboardData();

     alert("Payment recorded successfully!");

 }

 // ==========================================
 // DISPLAY RECORDS
 // ==========================================

 function displayRecords() {

     const table = $("recordsTable");

     table.innerHTML = "";

     if (works.length === 0) {

         const row = document.createElement("tr");
         const cell = document.createElement("td");

         cell.colSpan = 9;
         cell.textContent = "No records yet.";

         row.appendChild(cell);
         table.appendChild(row);

         return;

     }

     works.forEach(work => {

         const customer = customers.find(
             c => String(c.id) === String(work.customerId)
         );

         if (!customer) return;

         const row = document.createElement("tr");

         const values = [
             customer.name,
             customer.phone,
             work.date,
             work.workName,
             "₹" + work.total.toFixed(2),
             "₹" + work.received.toFixed(2),
             "₹" + work.remaining.toFixed(2),
             work.remaining === 0 ? "Paid" : work.status
         ];

         values.forEach(value => {

             const cell = document.createElement("td");

             cell.textContent = value;

             row.appendChild(cell);

         });

         const actionCell = document.createElement("td");

         if (work.remaining > 0) {

             const button = document.createElement("button");

             button.textContent = "Record Payment";
             button.className = "payment-btn";

             button.addEventListener("click", () => {
                 recordPayment(work.id);
             });

             actionCell.appendChild(button);

         } else {

             actionCell.textContent = "Fully Paid";

         }

         row.appendChild(actionCell);

         table.appendChild(row);

     });

 }

 // ==========================================
 // DASHBOARD SUMMARY
 // ==========================================

 function updateDashboard() {

     $("totalCustomers").textContent = customers.length;

     $("totalWorks").textContent = works.length;

     const pending = works.reduce(
         (sum, work) => sum + work.remaining,
         0
     );

     $("pendingPayments").textContent =
         "₹" + pending.toFixed(2);

     updateCustomerDropdown();

     displayRecords();

 }

 // ==========================================
 // AUTHENTICATION STATE
 // ==========================================

 supabaseClient.auth.onAuthStateChange((event, session) => {

     if (event === "SIGNED_OUT") {

         customers = [];
         works = [];

         showLogin();

     }

 });