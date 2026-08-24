"use client";

const VIDEO_SRC = process.env.NEXT_PUBLIC_ONBOARDING_VIDEO_URL || "/onboarding.mp4";

/**
 * Onboarding video for the marketing landing page.
 * Uses /onboarding.mp4 by default, or NEXT_PUBLIC_ONBOARDING_VIDEO_URL when set.
 */
export function OnboardingVideo() {
  return (
    <div className="landing-video-frame">
      <video
        className="landing-video"
        controls
        playsInline
        preload="metadata"
        aria-label="CBManagement onboarding video — Complete Business Management"
      >
        <source src={VIDEO_SRC} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      <p className="landing-video-caption">
        Onboarding · Retail &amp; service walkthrough · Complete Business Management (CBManagement)
      </p>
    </div>
  );
}
