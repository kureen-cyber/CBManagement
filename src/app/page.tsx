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
