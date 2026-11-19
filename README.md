# MediLedger Pharmacy Suite

PROJECT MASTER PROMPT



PHARMACY POS, INVENTORY & COMPLETE BUSINESS MANAGEMENT SYSTEM



Build a complete, modern, production-ready Pharmacy POS, Inventory, Accounting, and Business Management Web Application.



The application will be built using Lovable AI, connected to Supabase PostgreSQL, synchronized with GitHub, and deployed on Vercel.



This is a real business management application, NOT just a UI prototype or static dashboard.



Every module, button, form, calculation, database operation, search, report, and user permission must work correctly.



---



1. TECHNOLOGY STACK & DEPLOYMENT



Use the following architecture:



- Website Builder: Lovable AI

- Frontend: React + TypeScript

- Build Tool: Vite

- UI: Tailwind CSS + shadcn/ui

- Database: Supabase PostgreSQL

- Authentication: Supabase Auth

- Backend: Supabase Edge Functions and secure PostgreSQL functions where appropriate

- Database Security: Supabase Row Level Security (RLS)

- Charts: Recharts

- Forms: React Hook Form + Zod

- Data Fetching: TanStack Query

- Hosting: Vercel

- Source Code: GitHub



Important requirements:



1. Connect the application to a real Supabase project.

2. Create proper PostgreSQL tables, relationships, indexes, and migrations.

3. Use secure environment variables.

4. Never expose Supabase service-role keys or secret API keys in frontend code.

5. Enable Row Level Security for all sensitive tables.

6. Implement server-side permission checks.

7. Prepare the project for GitHub synchronization and Vercel deployment.

8. Provide a complete deployment guide.

9. Do not use localStorage as the permanent database.

10. Do not create fake backend functionality.



Use Lovable's compatible architecture rather than forcing an incompatible Next.js setup.



---



2. BUSINESS CONFIGURATION



This is a single-pharmacy management system with multiple users.



Default configuration:



- Currency: Bangladeshi Taka (BDT ৳)

- Country: Bangladesh

- Timezone: Asia/Dhaka

- Date Format: DD-MM-YYYY

- Language: Bengali and English

- Default Display Language: English

- Currency Formatting: ৳1,250.00



All prices, purchases, sales, expenses, profits, customer dues, supplier dues, and reports must use BDT.



Create a Settings module where the owner can configure:



- Pharmacy Name

- Pharmacy Logo

- Address

- Phone Number

- Trade Information (optional)

- Receipt Footer

- Currency

- Language

- Tax/VAT Settings

- Invoice Prefix

- Discount Permissions

- Low Stock Threshold

- Expiry Alert Period



---



3. AUTHENTICATION & SEPARATE ADMIN / CASHIER SYSTEM



Create a proper role-based authentication system.



There must be two clearly separated application experiences.



A. ADMIN / OWNER MODE



Admin has full authorized control over the pharmacy.



Admin Dashboard navigation:



1. Dashboard

2. POS / Sales

3. Sales History

4. Medicine Catalog

5. Stock In

6. Stock Out

7. Stock Adjustment

8. Purchase Management

9. Suppliers

10. Customers

11. Customer Due Ledger

12. Supplier Ledger

13. Expenses

14. Profit & Loss

15. Reports

16. Cash Management

17. Day Closing

18. Employees

19. Activity Logs

20. Settings



Admin can:



- View purchase costs.

- View gross and net profit.

- Manage medicine prices.

- Add and edit medicines.

- Manage stock and batches.

- Manage purchases.

- Authorize returns.

- Manage employee accounts.

- Configure cashier permissions.

- View all financial reports.

- Manage customers and suppliers.

- Perform authorized stock adjustments.

- Access audit logs.



B. STAFF / CASHIER MODE



Create a separate, simplified cashier interface.



The cashier must not see the Admin Dashboard or sensitive financial information.



Cashier navigation:



1. POS Billing

2. Sales History (own permitted sales only)

3. Customer Search

4. Due Collection (if authorized)

5. Current Stock Lookup

6. My Account



Cashier permissions:



- Search medicines.

- Scan barcodes.

- Add products to cart.

- Select Box, Strip, or Piece.

- View available selling stock.

- Apply authorized discounts.

- Create invoices.

- Accept payments.

- Print receipts.

- Register customers.

- Collect customer dues if permitted.



Cashier restrictions:



- Cannot view Purchase Price.

- Cannot view Cost Price.

- Cannot view Gross Profit or Net Profit.

- Cannot edit medicine purchase costs.

- Cannot modify stock directly.

- Cannot delete completed sales.

- Cannot modify historical invoices.

- Cannot access Admin financial reports.

- Cannot change user roles or permissions.



Use a single secure authentication system with role-based redirects.



After login:



- Admin goes to Admin Dashboard.

- Cashier goes directly to Cashier POS.



Enforce all permissions through Supabase RLS and secure backend operations. Hiding buttons is not sufficient.



---



4. ADMIN DASHBOARD



Create a clean, premium dashboard with:



Financial Summary Cards:



- Today's Total Sales

- Today's Gross Profit

- Today's Net Profit

- Weekly Sales

- Weekly Profit

- Monthly Sales

- Monthly Profit

- Total Inventory Purchase Value

- Total Inventory MRP Value

- Customer Outstanding Due

- Supplier Outstanding Payable



Inventory Alerts:



- Low Stock Medicines

- Out of Stock

- Near Expiry (30 Days)

- Near Expiry (60 Days)

- Near Expiry (90 Days)

- Expired Medicines



Charts:



- Daily Sales Chart

- Weekly Sales Chart

- Monthly Sales Chart

- Profit Trend Chart

- Top Selling Medicines

- Payment Method Breakdown



Create a Day Closing widget:



- Opening Cash

- Cash Sales

- Cash Due Collections

- Cash Refunds

- Cash Expenses

- Expected Closing Cash

- Actual Cash Count

- Cash Difference



Display clear positive and negative cash discrepancies.



---



5. POS BILLING SYSTEM



Create an extremely fast and beginner-friendly POS.



Medicine Search:



Support instant search by:



- Brand Name

- Generic Name

- Manufacturer

- Strength

- Dosage Form

- Barcode



Show search suggestions instantly.



Medicine cards must show:



- Medicine Name

- Strength

- Manufacturer

- Available Stock

- Selling Price

- Available Units



Cart:



- Add and remove products.

- Increase and decrease quantities.

- Select Box / Strip / Piece.

- Automatically calculate item totals.

- Apply individual item discounts.

- Apply invoice discounts.

- Calculate final payable amount.



Discounts:



- Percentage Discount

- Fixed Amount Discount



Enforce maximum discount limits based on cashier permissions.



Payment Methods:



- Cash

- bKash

- Nagad

- Card

- Bank Transfer

- Customer Due

- Split Payment



Support partial payments.



Keyboard shortcuts:



- F2: Search Medicine

- F3: New Invoice

- F4: Customer Search

- F9: Complete Sale

- Esc: Close Dialog



Allow keyboard navigation for fast billing.



---



6. MEDICINE UNIT CONVERSION



This is a critical requirement.



Support:



- Box

- Strip (পাতা)

- Piece (পিস)



Example:



1 Box = 10 Strips

1 Strip = 10 Pieces

1 Box = 100 Pieces



The system must support configurable conversion for each medicine.



Store inventory in the smallest base unit.



Example:



Available Stock = 1,000 Pieces.



When a cashier sells:



- 1 Box: Deduct 100 Pieces.

- 2 Strips: Deduct 20 Pieces.

- 5 Pieces: Deduct 5 Pieces.



Automatically calculate the correct selling amount.



Different selling prices may be configured for Box, Strip, and Piece.



Prevent selling more stock than available.



Support medicines that are not divisible into smaller units.



---



7. MEDICINE CATALOG



Create a complete medicine database.



Fields:



- Brand Name

- Generic Name

- Manufacturer

- Strength

- Dosage Form

- Barcode

- Category

- Pack Size

- Box Conversion

- Strip Conversion

- Base Unit

- MRP

- Selling Price

- Reorder Level

- Status



Dosage Forms:



Tablet, Capsule, Syrup, Suspension, Injection, Drops, Cream, Ointment, Gel, Inhaler, Spray and other configurable forms.



Features:



- Add Medicine

- Edit Medicine

- Search

- Filter

- Category Management

- Manufacturer Management

- Barcode Support

- Bulk CSV Import

- Excel Import where supported

- CSV / Excel Export

- Duplicate Detection



---



8. SEPARATE STOCK IN MODULE



Create a dedicated Stock In page.



Stock In means inventory entering the pharmacy.



Stock can enter through:



- Purchase

- Customer Return

- Authorized Stock Adjustment

- Opening Stock Entry



Purchase-related Stock In must be linked to the Purchase Invoice.



Stock In Fields:



- Medicine

- Supplier

- Batch Number

- Purchase Quantity

- Purchase Unit

- Base Unit Quantity

- Purchase Price

- Selling Price

- MRP

- Manufacturing Date

- Expiry Date

- Purchase Invoice

- Entry Date

- Recorded By



Every Stock In operation must create a stock movement record.



Never overwrite old batch costs.



---



9. SEPARATE STOCK OUT MODULE



Create a dedicated Stock Out page.



Stock Out means inventory leaving the pharmacy.



Stock Out categories:



1. Sales

2. Expired Stock

3. Damaged Stock

4. Supplier Return

5. Authorized Manual Adjustment

6. Internal Use / Other



Each Stock Out entry must include:



- Medicine

- Batch Number

- Quantity

- Unit

- Reason

- Date

- Reference Invoice (if applicable)

- Authorized By

- Recorded By



Automatically update available stock.



Sales must generate Stock Out records automatically.



Never deduct stock twice.



Use FEFO (First Expiry, First Out) for normal sales.



Expired medicines must be blocked from POS sales.



Maintain complete Stock In / Stock Out history.



---



10. BATCH-WISE INVENTORY MANAGEMENT



Track every batch separately.



Fields:



- Medicine ID

- Batch Number

- Purchase Price

- Selling Price

- MRP

- Original Quantity

- Remaining Quantity

- Manufacturing Date

- Expiry Date

- Purchase Reference



Important:



- Different batches may have different purchase prices.

- Selling a medicine must allocate stock from the correct batch.

- Profit calculations must use the actual allocated batch purchase cost.

- Support FEFO stock allocation.

- Support authorized manual batch selection.



Display clear badges:



- In Stock

- Low Stock

- Out of Stock

- Expiring Soon

- Expired

- Damaged



---



11. PURCHASE & SUPPLIER MANAGEMENT



Create a separate Purchase Management module.



Supplier Information:



- Supplier Name

- Phone

- Address

- Opening Balance

- Current Payable



Purchase Invoice:



- Invoice Number

- Supplier

- Purchase Date

- Medicines

- Batch Details

- Quantities

- Purchase Prices

- Total Amount

- Paid Amount

- Remaining Due

- Payment Method



Support:



- Multiple medicines per invoice.

- Partial payments.

- Purchase Returns.

- Supplier Ledger.

- Supplier Payment History.

- Purchase Reports.

- Purchase Receipt Printing.



Automatically create Stock In records from confirmed purchases.



---



12. CUSTOMER DUE LEDGER (বাকি খাতা)



Customer fields:



- Customer Name

- Phone

- Address

- Opening Balance

- Current Due



Features:



- Add Customer

- Edit Customer

- Customer Purchase History

- Customer Due History

- Partial Payment Collection

- Payment Receipts

- Outstanding Balance

- Customer Ledger



Every due payment must be recorded as an individual transaction.



Automatically update customer balances.



---



13. SALES HISTORY & RETURNS



Create a complete sales history system.



Display:



- Invoice Number

- Date

- Customer

- Cashier

- Total Items

- Gross Amount

- Discount

- Net Amount

- Paid Amount

- Due Amount

- Payment Method

- Status



Support:



- Invoice Details

- Reprint Invoice

- Partial Return

- Full Return

- Refund

- Authorized Cancellation



When a return occurs:



- Restore eligible stock.

- Record returned batch information.

- Reverse corresponding sales revenue.

- Reverse corresponding cost of goods sold.

- Update customer due or payment balances.

- Create a return transaction.



Never permanently delete completed financial records.



---



14. PROFIT & LOSS MANAGEMENT



Calculate actual financial results.



Net Sales = Gross Sales - Discounts - Sales Returns.



Cost of Goods Sold = Actual Batch Cost of Sold Medicines.



Gross Profit = Net Sales - Cost of Goods Sold.



Net Profit = Gross Profit - Operating Expenses - Other Applicable Business Costs.



Include:



- Daily Profit

- Weekly Profit

- Monthly Profit

- Custom Date Range

- Medicine-wise Profit

- Invoice-wise Profit

- Cashier-wise Sales

- Expense Summary



Use precise decimal monetary values.



Allocate invoice-level discounts proportionally across line items.



Do not confuse:



- Sales Revenue

- Cash Received

- Customer Due

- Inventory Value

- Gross Profit

- Net Profit



---



15. EXPENSE MANAGEMENT



Create expense categories:



- Shop Rent

- Electricity

- Internet

- Employee Salary

- Transportation

- Maintenance

- Other Expenses



Fields:



- Category

- Amount

- Date

- Description

- Payment Method

- Recorded By



Provide daily, weekly and monthly reports.



---



16. EMPLOYEE & ACTIVITY MANAGEMENT



Admin can:



- Create Employees

- Edit Employee Profiles

- Activate / Deactivate Accounts

- Assign Roles

- Set Discount Limits

- Configure Permissions



Track:



- Login / Logout

- Sales Created

- Invoice Changes

- Returns

- Stock Adjustments

- Purchases

- Due Collections

- Expenses

- Day Closing



Maintain immutable audit logs.



---



17. CASH MANAGEMENT & DAY CLOSING



Create a dedicated Cash Management module.



Track all actual cash movements.



Include:



- Opening Cash

- Cash Sales

- Cash Due Collections

- Cash Refunds

- Cash Expenses

- Cash Deposits

- Cash Withdrawals

- Expected Balance

- Actual Balance

- Difference



Support employee-wise cash reconciliation.



Prevent unauthorized modifications to completed day-close records.



---



18. REPORTS & EXPORTS



Create a comprehensive reporting center.



Reports:



- Sales Report

- Profit & Loss Report

- Purchase Report

- Stock In Report

- Stock Out Report

- Stock Valuation Report

- Expiry Report

- Low Stock Report

- Customer Due Report

- Supplier Payable Report

- Expense Report

- Employee Sales Report

- Cash Reconciliation Report

- Sales Return Report



Filters:



- Today

- Yesterday

- Last 7 Days

- Last 30 Days

- This Month

- Previous Month

- Custom Date Range



Export to:



- PDF

- CSV

- Excel



---



19. DATABASE STRUCTURE



Use Supabase PostgreSQL with normalized relational tables.



Recommended tables:



- pharmacies

- profiles

- roles

- permissions

- role_permissions

- customers

- suppliers

- medicines

- medicine_units

- medicine_batches

- purchases

- purchase_items

- supplier_payments

- sales

- sale_items

- sale_item_batch_allocations

- sale_payments

- sales_returns

- return_items

- customer_payments

- expenses

- stock_movements

- cash_sessions

- cash_movements

- audit_logs

- pharmacy_settings



Use appropriate foreign keys, unique constraints, indexes, and timestamps.



Use NUMERIC / DECIMAL for financial values, never floating-point money calculations.



Use atomic database transactions for sales, purchases, returns, and stock adjustments.



Prevent duplicate invoices and overselling during concurrent transactions.



---



20. SECURITY & DATA INTEGRITY



Implement:



- Supabase Authentication

- Secure Session Management

- Role-Based Access Control

- Row Level Security

- Server-side Validation

- Protected API Operations

- Secure Environment Variables

- Audit Logs

- Database Constraints

- Rate Limiting where appropriate



A cashier must never be able to retrieve hidden purchase cost or profit information by calling database APIs directly.



Protect all historical financial transactions.



Do not permanently delete financial records.



---



21. UI / UX DESIGN



Design a premium, modern medical-themed application.



Color palette:



- Soft Medical Green

- Clean White

- Medical Blue

- Light Gray

- Dark Slate



Design requirements:



- Clean sidebar navigation

- Modern dashboard cards

- Rounded but professional components

- Clear typography

- Readable data tables

- Easy-to-understand status badges

- Minimal unnecessary animations

- Responsive mobile and desktop layouts

- Loading skeletons

- Empty states

- Confirmation dialogs

- Clear error messages

- Toast notifications



Admin UI should be comprehensive.



Cashier UI should be extremely simple and optimized for speed.



Do not mix Admin and Cashier dashboards.



---



22. THERMAL RECEIPT PRINTING



Support 58mm and 80mm receipt formats.



Include:



- Pharmacy Name

- Logo

- Address

- Phone

- Invoice Number

- Date and Time

- Cashier

- Medicine Details

- Quantity and Unit

- Unit Price

- Subtotal

- Discount

- Net Total

- Paid Amount

- Due Amount

- Payment Method



Create print-optimized layouts.



Ensure correct printing through browser-supported thermal printers.



---



23. SAMPLE DATA & DEMO MODE



Initially create realistic sample data.



Include:



- 50+ sample medicines

- Multiple manufacturers

- Multiple medicine categories

- Different strengths and dosage forms

- Different stock quantities

- Multiple batches

- Different purchase prices

- Different expiry dates

- Sample suppliers

- Sample customers

- Sample employees

- Sample sales

- Sample purchases

- Sample expenses

- Sample due transactions



Make every module interactive with sample data.



Clearly distinguish demo data from real business data.



Do not mix sample transactions with actual production transactions.



Provide a safe way to reset demo data.



---



24. BACKUP & DATA MANAGEMENT



Provide:



- Database backup guidance

- CSV exports

- Medicine catalog backup

- Sales report exports

- Inventory exports

- Secure recovery procedures



Prepare the system for future expansion.



---



25. DEVELOPMENT EXECUTION INSTRUCTIONS



Build this project in phases, but maintain one consistent architecture and database structure.



Phase 1:



- Authentication

- Admin and Cashier separation

- Main Layout

- Medicine Catalog

- Database Schema

- Dashboard



Phase 2:



- Purchase Management

- Stock In

- Stock Out

- Batch Management

- Expiry Alerts



Phase 3:



- POS Billing

- Unit Conversion

- Discounts

- Payment Processing

- Thermal Printing



Phase 4:



- Customer Due

- Supplier Ledger

- Expenses

- Sales Returns

- Cash Management

- Day Closing



Phase 5:



- Profit & Loss

- Reports

- Audit Logs

- Security Testing

- Performance Optimization



IMPORTANT:



Do not stop after generating a visual prototype.



Implement actual database operations and functional workflows.



Do not use hardcoded sample values for production calculations.



Do not create non-functional buttons.



Test the entire purchase-to-stock-to-sale-to-profit workflow.



Verify that Admin and Cashier permissions are genuinely separate.



Verify that Stock In and Stock Out update the same underlying inventory correctly.



Verify that sales, returns, discounts, due payments, expenses, and cash reconciliation produce consistent financial results.



Prepare the final application for GitHub synchronization and Vercel deployment.



Deliver a complete, working Pharmacy POS and Business Management System suitable for real-world use in Bangladesh.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/183ae853-748b-4979-b1a4-a46b81f3598c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
