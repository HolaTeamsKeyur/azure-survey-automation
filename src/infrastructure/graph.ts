import { DefaultAzureCredential, type TokenCredential } from "@azure/identity";

export interface MailAttachment { name: string; contentType: string; contentBytes: string; }

export class GraphClient {
  constructor(private readonly credential: TokenCredential = new DefaultAzureCredential()) {}

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const access = await this.credential.getToken("https://graph.microsoft.com/.default");
    if (!access) throw new Error("Unable to obtain a Microsoft Graph token.");
    const response = await fetch(`https://graph.microsoft.com/v1.0/${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${access.token}`, "Content-Type": "application/json", ...(init.headers ?? {}) }
    });
    if (!response.ok) throw new Error(`Graph ${init.method ?? "GET"} ${path} failed (${response.status}): ${await response.text()}`);
    return response;
  }

  async getBusyPeriods(mailbox: string, start: string, end: string, timeZone: string): Promise<Array<{ start: Date; end: Date }>> {
    void timeZone;
    const response = await this.request(`users/${encodeURIComponent(mailbox)}/calendar/getSchedule`, {
      method: "POST",
      headers: { Prefer: 'outlook.timezone="UTC"' },
      body: JSON.stringify({ schedules: [mailbox], startTime: { dateTime: start, timeZone: "UTC" }, endTime: { dateTime: end, timeZone: "UTC" }, availabilityViewInterval: 15 })
    });
    const body = await response.json() as { value?: Array<{ scheduleItems?: Array<{ start: { dateTime: string }; end: { dateTime: string } }> }> };
    return (body.value?.[0]?.scheduleItems ?? []).map(item => ({ start: asUtc(item.start.dateTime), end: asUtc(item.end.dateTime) }));
  }

  async sendActionableMail(sender: string, recipient: string, subject: string, fallbackHtml: string, card?: object, attachments: MailAttachment[] = []): Promise<void> {
    const cardMarkup = card ? `<script type="application/adaptivecard+json">${escapeScriptJson(JSON.stringify(card))}</script>` : "";
    await this.request(`users/${encodeURIComponent(sender)}/sendMail`, {
      method: "POST",
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: "HTML", content: `<html><head>${cardMarkup}</head><body>${fallbackHtml}</body></html>` },
          toRecipients: [{ emailAddress: { address: recipient } }],
          attachments: attachments.map(file => ({
            "@odata.type": "#microsoft.graph.fileAttachment",
            name: file.name,
            contentType: file.contentType,
            contentBytes: file.contentBytes
          }))
        },
        saveToSentItems: true
      })
    });
  }
}

function escapeScriptJson(value: string): string { return value.replace(/<\//g, "<\\/"); }
function asUtc(value: string): Date { return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`); }
