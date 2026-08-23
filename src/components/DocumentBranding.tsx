import { receiptHeaderText, resolveBusinessLogo, type CompanyBranding } from "@/lib/settings";

export function DocumentBranding({
  company,
  documentTitle,
}: {
  company: CompanyBranding;
  documentTitle: string;
}) {
  const logo = resolveBusinessLogo(company);
  const header = receiptHeaderText(company);

  return (
    <div className="document-branding">
      {company.letterheadData ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={company.letterheadData} alt="" className="document-letterhead" />
      ) : null}
      <div style={{ textAlign: "center" }}>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="receipt-logo" />
        ) : null}
        <div className="brand-mark" style={{ fontSize: "1.35rem" }}>
          {header}
        </div>
        <div className="muted" style={{ fontSize: "0.85rem" }}>
          {documentTitle}
        </div>
      </div>
    </div>
  );
}
