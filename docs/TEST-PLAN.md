# Opportunity and Order demonstration test plan

## Automated tests

- Valid and invalid response transitions.
- GUID validation and duplicate product selection removal.
- Submitted products limited to the immutable Opportunity snapshot.
- Slot search respects London time, business hours, busy periods and weekends.
- Survey and installation cards contain Action.Http and public-form fallback.

## Dataverse integration tests

1. Read one Opportunity, Contact, Region and Price List.
2. Fall back from Opportunity Price List to Region Franchise Account Default Price List.
3. Missing contact email, surveyor mailbox or Price List returns a controlled error.
4. Automatic scheduling disabled on Region prevents sending.
5. Create exactly one related survey Appointment.
6. Save the token ID and immutable product snapshot on Opportunity.
7. Duplicate trigger reuses the active Opportunity token.
8. Accept saves product selection and feedback on Opportunity only.
9. Decline/reschedule saves response and reason on Opportunity only.
10. Installation accept/decline/reschedule saves directly on Order Confirmation only.
11. Installation reschedule does not modify start/finish dates.
12. No Quote, Task, Survey Session, Installation Session or Region Product Rule record is created.

## Public-form security tests

- Modified, expired, wrong-audience and wrong-record token.
- Product ID not in Opportunity snapshot.
- Replayed terminal response.
- Forwarded Outlook card where actor does not match recipient.
- HTML/script injection in reason and feedback.
- Rate limit, oversized body and repeated failed requests.

## Email/client tests

- Plain HTML/link in Outlook, Gmail and mobile clients.
- Outlook Actionable Message only in test-provider scope.
- Link opens in private browsing without SharePoint authentication.
- Keyboard, screen reader, zoom and mobile layout.

## Demonstration evidence

- Before/after screenshots of Opportunity and Order Confirmation.
- Email and public survey/installation form screenshots.
- Related Appointment screenshot.
- Audit history for response fields.
- Evidence that no new custom table and no Quote/Task was created.
- `npm.cmd run check` output.
