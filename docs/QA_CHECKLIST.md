# Conekt Ads QA Checklist

Complete this checklist against a non-production environment before deployment.

## A. Auth

- [ ] Login as Admin.
- [ ] Login as Member.
- [ ] Logout and confirm protected pages redirect to Login.
- [ ] Confirm an inactive user is blocked.
- [ ] Confirm Member cannot open Users, Audit Logs, or bulk import tools.

## B. Inventory

- [ ] Create Outdoor inventory with address and map coordinates.
- [ ] Create Auto, Bus, and Mobile Van inventory without map coordinates.
- [ ] Confirm inventory and verify its status becomes fresh.
- [ ] Check stale and never-confirmed indicators.
- [ ] Upload inventory photos and refresh the page.
- [ ] Open Bulk Data Upload, select a CSV, and confirm the modal stays open.
- [ ] Validate and commit an inventory CSV.

## C. CRM

- [ ] Create a Brand.
- [ ] Create a Supplier/Owner.
- [ ] Add two contacts and change the primary contact.
- [ ] Link a supplier to inventory.
- [ ] Confirm Supplier/Owner cannot be selected as a campaign client.

## D. Campaign

- [ ] Create a campaign from a Brand, Agency, or Individual.
- [ ] Change campaign status.
- [ ] Set and verify the next follow-up date.

## E. Plan

- [ ] Create Plan v1.
- [ ] Add fresh confirmed inventory.
- [ ] Confirm stale or never-confirmed inventory is blocked.
- [ ] Verify subtotal, tax, grand total, internal cost, and margin.
- [ ] Mark the plan Shared and confirm it becomes locked.
- [ ] Confirm a locked plan cannot be edited.
- [ ] Clone the plan and confirm v2 is a Draft.
- [ ] Mark the plan Won and confirm an Operation is created.

## F. Documents

- [ ] Generate Plan Proposal.
- [ ] Generate Quotation.
- [ ] Generate Internal Cost Sheet.
- [ ] Generate Work Order.
- [ ] Generate Purchase Order.
- [ ] Upload at least one proof and generate Execution Report.
- [ ] Confirm client-facing PDFs omit internal cost and margin.

## G. Share

- [ ] Create a share link from a Draft plan.
- [ ] Open the link without authentication.
- [ ] Confirm only client-safe fields are visible.
- [ ] Confirm view count increases.
- [ ] Open the map and click a pin; confirm tracking increases.
- [ ] Disable the share and confirm the public link stops working.

## H. Operations

- [ ] Confirm a Work Order is created after a plan is Won.
- [ ] Track creative received.
- [ ] Track PO sent.
- [ ] Schedule and complete mounting.
- [ ] Upload proof images.
- [ ] Confirm progress and status recalculate.
- [ ] Generate an Execution Report.

## I. Dashboard

- [ ] Check My Work counts.
- [ ] Check campaign pipeline values.
- [ ] Check inventory health counts.
- [ ] Check operations summary and overdue items.
- [ ] Confirm recent activity loads.

## J. Data Migration

- [ ] Download each CSV template.
- [ ] Upload a valid CSV from Inventory > Bulk Data Upload.
- [ ] Validate an invalid CSV and review row-level errors.
- [ ] Confirm duplicate rows are skipped.
- [ ] Commit valid rows only.
- [ ] Download the error CSV.

## K. Security

- [ ] Confirm CORS accepts only configured frontend origins.
- [ ] Confirm private creative and PO uploads are not publicly accessible.
- [ ] Confirm public shares omit costs, margins, internal notes, and supplier details.
- [ ] Confirm Admin-only APIs return 403 for Members.
- [ ] Confirm development login is disabled in production.
- [ ] Confirm cookies use secure production settings.

## L. UI Polish

- [ ] Check mobile navigation at 390px, including backdrop and Escape close.
- [ ] Check Dashboard, Inventory, CRM, Campaigns, Plans, and Operations on mobile.
- [ ] Check public shared plan, media cards, pricing, and map on mobile.
- [ ] Check Plan Builder Draft and locked states at desktop and mobile sizes.
- [ ] Check inventory and proof upload previews.
- [ ] Check map marker popup stays inside the mobile viewport.
- [ ] Check important actions show confirmation before changing state.
- [ ] Tab through Login, Inventory form, Plan Builder, and Operations controls.
