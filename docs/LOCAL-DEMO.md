# Local end-to-end demo (no Microsoft identity required)

This mode uses sample records in memory. It does not connect to Dataverse, Azure, or Microsoft Graph, and it does not send email.

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

1. Switch between **West Midlands** and **North West**. Confirm that the product rows and prices change while the customer flow remains the same.
2. Open **Outlook email + cards preview**. Expand each JSON section to inspect the Adaptive Card payload.
3. Open the signed survey form. Select products, change quantities, submit, and confirm that the dashboard shows the new survey status, selected-row count, and subtotal.
4. Use **Reset sample records**, then open the installation form and submit a response. Confirm its status on the dashboard.
5. Download the Word file. Confirm that the header/footer and totals layout stay fixed while its product table uses the currently selected region.
6. Check `http://127.0.0.1:4280/api/health`; it must report `"mode": "local-mock"`.

The records reset whenever the server stops. A reset also invalidates previously issued signed links, demonstrating token-revocation behavior.

## After the administrator supplies access

Keep the local test as the regression baseline. Then configure Azure app settings, create the Dataverse application user and security role, grant the approved Graph application permissions, and run the integration test plan. Never reuse a local-demo value as a production credential.
