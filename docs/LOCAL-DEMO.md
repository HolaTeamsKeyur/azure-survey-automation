# Local end-to-end demo (no Microsoft identity required)

This mode renders the real customer-facing form with a representative Brighton enquiry. It does not connect to Dataverse, Azure, or Microsoft Graph, and it does not send email.

## Start

From the repository root:

```powershell
npm ci
npm run check
npm run demo:local
```

Open `http://127.0.0.1:4280` in a browser. Stop the server with `Ctrl+C`.

If port 4280 is occupied:

```powershell
$env:LOCAL_DEMO_PORT = "4281"
npm run demo:local
```

## One-pass test

1. Confirm the browser opens directly on the branded two-sheet **Customer Enquiry Form / Survey and Quotation Form**—there is no developer dashboard.
2. Confirm enquiry details are already populated and the Brighton product rows/prices are already present.
3. Complete survey measurements and enter quantities for the required products. Confirm line totals, VAT and fitted total calculate in the browser.
4. Submit and confirm that the success page reports the number of product lines added to the opportunity.
5. Separately open `http://127.0.0.1:4280/installation-email-preview`. This is the only place the installation Adaptive Card is demonstrated.
6. Check `http://127.0.0.1:4280/api/health`; it must report `"status": "ok"`.

The in-memory record resets whenever the server stops.

## After the administrator supplies access

Keep the local test as the regression baseline. Then configure Azure app settings, create the Dataverse application user and security role, grant the approved Graph application permissions, and run the integration test plan. Never reuse a local-demo value as a production credential.
