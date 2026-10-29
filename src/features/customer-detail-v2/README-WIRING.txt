ELH CUSTOMER DETAIL V2 - WIRING GUIDE

1) IMPORT
Add to your entry or customer page file:

import { CustomerDetailPageV2 } from "./features/customer-detail-v2";

2) REPLACE POPUP DETAIL
Remove old popup render block and replace it with route/page render.

Recommended:
- In customer list: when user click icon eye or row action
  navigate to /khach-hang/{id} or set selectedCustomerId in page state.
- Render CustomerDetailPageV2 instead of modal.

3) PASS PROPS
Expected props:
- customer
- form
- onChange(field, value)
- onSave()
- historyItems
- historyFilters
- onHistoryFilterChange(key, value)
- projectOptions
- sourceOptions
- staffOptions [{value,label}]
- statusOptions
- interestOptions
- readonlyLegacy

4) LIST UX
In list table/card, add one action button:
- icon eye + label "Xem"
This is clearer than forcing user to click customer name.

5) STATUS COLOR
Use getStatusMeta(label) everywhere:
- header badge
- form status
- history item badge
This prevents the same status from showing different colors.

6) NO POPUP
This module is designed for full-page detail, not modal.

7) SCROLL
History panel already supports independent scroll for long activity logs.