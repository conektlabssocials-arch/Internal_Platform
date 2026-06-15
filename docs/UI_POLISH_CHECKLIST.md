# UI Polish Checklist

Use this checklist at 1440px, 1024px, 768px, and 390px before a release.

## Layout

- [ ] Sidebar is stable on desktop and does not cover page content.
- [ ] Mobile hamburger opens the navigation drawer.
- [ ] Drawer closes after navigation, backdrop click, and Escape.
- [ ] Page content has consistent spacing and no horizontal page overflow.
- [ ] Current page and active navigation item are clear.

## Mobile

- [ ] Dashboard cards stack without clipped text.
- [ ] Inventory, CRM, Campaigns, Plans, Operations, Users, and Audit Logs use mobile cards.
- [ ] Primary actions remain reachable without horizontal scrolling.
- [ ] Full-screen workspaces and forms fit a 390px viewport.
- [ ] Sticky headers and action areas do not cover form fields.

## Tables

- [ ] Desktop tables remain readable at 1024px and above.
- [ ] Mobile cards show the most important fields first.
- [ ] Pagination controls wrap without overflow.
- [ ] Long titles, tags, emails, and metadata wrap or truncate intentionally.

## Forms

- [ ] Every input has a visible or accessible label.
- [ ] Required fields are clear.
- [ ] Submit buttons disable while saving.
- [ ] Errors keep the form or modal open.
- [ ] Inventory Outdoor map fits its container.
- [ ] Auto, Bus, and Mobile Van forms hide fixed-location fields.
- [ ] Inventory size and code preview are easy to identify.

## Modals

- [ ] Inventory, Plan Builder, Work Order, and Bulk Data Upload fit mobile screens.
- [ ] Close buttons have accessible labels.
- [ ] Work Order and navigation drawer close with Escape.
- [ ] Important status changes show confirmation dialogs.
- [ ] Destructive confirmation buttons are visually distinct.

## Empty States

- [ ] Inventory explains how to add the first item.
- [ ] CRM empty state names the selected category.
- [ ] Campaigns and Plans explain where records are created.
- [ ] Operations explains that Work Orders come from Won plans.
- [ ] Documents, shares, activity, audit, and import history have useful empty states.

## Loading States

- [ ] Page loading states do not cause layout jumps.
- [ ] Save, upload, generate, and import buttons show busy text.
- [ ] Loading actions cannot be submitted twice.

## Error States

- [ ] API errors use readable messages.
- [ ] Retry is available for page-level failures where practical.
- [ ] Upload validation identifies the file and reason.
- [ ] Import validation identifies row and field errors.

## Public Share

- [ ] Public page has no internal navigation.
- [ ] Campaign, media, map, pricing, and notes fit mobile.
- [ ] Map popup stays inside the viewport.
- [ ] Inventory cards display on mobile.
- [ ] Internal cost, margin, internal notes, supplier details, and activity never appear.

## Accessibility

- [ ] Interactive controls are buttons, links, or labelled form elements.
- [ ] Keyboard focus is visible.
- [ ] Navigation drawer and dialogs have accessible labels.
- [ ] Status uses text as well as color.
- [ ] Images have useful alt text.
- [ ] Map includes nearby usage guidance.

## Final Visual QA

- [ ] No overlapping text or controls.
- [ ] No accidental nested card appearance.
- [ ] Buttons use consistent heights and labels.
- [ ] Green accent is used purposefully without dominating the interface.
- [ ] Dense screens remain scannable for daily operational work.
