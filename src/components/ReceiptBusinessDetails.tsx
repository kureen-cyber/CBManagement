import type { ReceiptBusinessDetails as Details } from "@/lib/settings";

export function ReceiptBusinessDetailsBlock({ details }: { details: Details }) {
  const hasText =
    details.address ||
    details.contactNumber ||
    details.email ||
    details.registrationNumber;

  if (!hasText && !details.stampData) return null;

  return (
    <div className="receipt-business-details" style={{ marginTop: "0.65rem" }}>
      {hasText ? (
        <div
          className="muted"
          style={{ fontSize: "0.82rem", lineHeight: 1.45, whiteSpace: "pre-wrap" }}
        >
          {details.address ? <div>{details.address}</div> : null}
          {details.contactNumber ? <div>Tel: {details.contactNumber}</div> : null}
          {details.email ? <div>{details.email}</div> : null}
          {details.registrationNumber ? (
            <div>Reg. #{details.registrationNumber}</div>
          ) : null}
        </div>
      ) : null}
      {details.stampData ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={details.stampData} alt="" className="receipt-company-stamp" />
      ) : null}
    </div>
  );
}
