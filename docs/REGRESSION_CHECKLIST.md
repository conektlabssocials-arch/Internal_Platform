# Release Regression Checklist

Run these checks before every release:

- [ ] Admin and Member login, session refresh, and logout work.
- [ ] Inventory can be created, confirmed, edited, and filtered.
- [ ] Bulk Data Upload remains open after CSV selection and completes validation/import.
- [ ] CRM entity and primary contact workflows work.
- [ ] Campaign creation, status changes, and follow-ups work.
- [ ] Plan create, price calculation, share, lock, clone, and Won flows work.
- [ ] Public share opens without login and exposes client-safe data only.
- [ ] Operation is created from a Won plan and proof updates progress.
- [ ] Plan, quotation, cost sheet, work order, PO, and execution PDFs generate.
- [ ] Inventory/proof uploads are public-safe; creative/PO uploads remain private.
- [ ] Dashboard metrics and recent activity load.
- [ ] Admin Audit Logs load; Members remain blocked.
- [ ] Automated backend and frontend tests pass.
- [ ] Server and client production builds pass.
