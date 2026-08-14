import Link from "next/link";
import type { Metadata } from "next";
import { OnboardingVideo } from "@/components/OnboardingVideo";

export const metadata: Metadata = {
  title: "Complete Business Management — CBManagement",
  description:
    "CBManagement is Complete Business Management for Caribbean small businesses: POS, inventory, customers, payments, and reports in one place.",
};

export default function LandingPage() {
  return (
    <div className="landing">
      <header className="landing-top">
        <Link href="/" className="landing-brand">
          <span className="landing-brand-full">Complete Business Management</span>
          <span className="landing-brand-short">CBManagement</span>
        </Link>
        <div className="landing-top-actions">
          <Link href="/login" className="btn btn-secondary">
            Sign in
          </Link>
          <Link href="/signup" className="btn btn-primary">
            Sign up
          </Link>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <p className="landing-kicker">CBManagement</p>
          <h1>Complete Business Management</h1>
          <p className="landing-lede">
            One affordable app for Caribbean small businesses to sell, track stock, know their
            customers, and see the money — without spreadsheets and WhatsApp chaos.
          </p>
          <div className="landing-cta-row">
            <Link href="/signup" className="btn btn-primary landing-cta">
              Create your free account now
            </Link>
          </div>
        </div>
        <div className="landing-hero-media">
          <OnboardingVideo />
        </div>
      </section>

      <section className="landing-section" id="about">
        <h2>What CBManagement is built to do</h2>
        <p className="landing-section-lede">
          Complete Business Management means your shop’s selling, stock, people, and cash live in
          one system — designed for Trinidad &amp; Tobago and the wider Caribbean.
        </p>
        <ul className="landing-intent-list">
          <li>
            <strong>Sell with POS</strong>
            <span>Ring up retail and fixed-price services, print receipts, and name your tills.</span>
          </li>
          <li>
            <strong>Know your customers</strong>
            <span>Keep contacts and payment history without hunting through chat threads.</span>
          </li>
          <li>
            <strong>Control inventory</strong>
            <span>Register items in your own categories — grocery, hygiene, gifts, and more.</span>
          </li>
          <li>
            <strong>See the money</strong>
            <span>Reports with period controls and daily earnings so you know what came in.</span>
          </li>
        </ul>

        <div className="landing-guide" id="getting-started">
          <h3>Once you&apos;re in the app</h3>
          <p className="landing-section-lede">
            Follow the path that matches how you work — retail shop or service industry.
          </p>
          <div className="landing-guide-grid">
            <div className="landing-guide-path">
              <h4>Retail customers</h4>
              <ol className="landing-steps">
                <li>Create your account</li>
                <li>Verify your email</li>
                <li>Sign in</li>
                <li>Populate your inventory stock list</li>
                <li>Add customers</li>
                <li>Add employees</li>
                <li>Create a sales transaction</li>
                <li>Record an expense</li>
                <li>View your reports</li>
              </ol>
            </div>
            <div className="landing-guide-path">
              <h4>Service industry</h4>
              <ol className="landing-steps">
                <li>Create a quotation</li>
                <li>Register a job</li>
                <li>Create an invoice</li>
                <li>Upload payments</li>
                <li>Generate receipts</li>
                <li>Record an expense</li>
                <li>View your reports</li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section landing-final-cta">
        <h2>Start free with CBManagement</h2>
        <p className="landing-section-lede">
          Create your free account and run Complete Business Management from one place.
        </p>
        <Link href="/signup" className="btn btn-primary landing-cta">
          Create your free account now
        </Link>
      </section>

      <footer className="landing-footer">
        <span>Complete Business Management · CBManagement</span>
        <span>Trinidad &amp; Tobago · Caribbean SMEs</span>
      </footer>
    </div>
  );
}
