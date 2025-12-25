function TermsOfServiceScreen() {
  return (
    <div className="container mx-auto px-4 py-8 pt-32 max-w-4xl">
      <h1 className="text-4xl font-bold mb-4">Terms of Service</h1>
      <p className="text-base-content/70 mb-8">
        Last Updated: December 25, 2025
      </p>

      <div className="prose prose-lg max-w-none">
        <p className="mb-8">
          Welcome to NihongoTracker! These Terms of Service ("Terms") govern
          your access to and use of our website, services, and applications
          (collectively, the "Service"). By accessing or using NihongoTracker,
          you agree to be bound by these Terms. If you do not agree to these
          Terms, please do not use our Service.
        </p>

        {/* 1. Acceptance of Terms */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">1. Acceptance of Terms</h2>
          <p>
            By creating an account or using NihongoTracker, you acknowledge that
            you have read, understood, and agree to be bound by these Terms, as
            well as our{' '}
            <a href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </a>
            . We reserve the right to modify these Terms at any time. We will
            notify you of significant changes by posting the updated Terms on
            our website. Your continued use of the Service after such
            modifications constitutes your acceptance of the updated Terms.
          </p>
        </section>

        {/* 2. Eligibility */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">2. Eligibility</h2>
          <p className="mb-4">
            You must be at least 13 years old to use NihongoTracker. By using
            our Service, you represent and warrant that you meet this age
            requirement. If you are under 18, you confirm that you have obtained
            permission from your parent or legal guardian to use this Service.
          </p>
          <p>
            We reserve the right to request proof of age at any time. If we
            discover that a user is under 13 years of age, we will terminate
            their account immediately.
          </p>
        </section>

        {/* 3. Account Registration */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">3. Account Registration</h2>
          <p className="mb-4">
            To use certain features of NihongoTracker, you must create an
            account. When creating an account, you agree to:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
            <li>Provide accurate, current, and complete information</li>
            <li>Maintain and promptly update your account information</li>
            <li>
              Maintain the security of your password and accept all risks of
              unauthorized access
            </li>
            <li>
              Immediately notify us of any unauthorized use of your account
            </li>
            <li>
              Be responsible for all activities that occur under your account
            </li>
          </ul>
          <p>
            You may not create an account using a false identity or
            impersonating another person. We reserve the right to refuse
            service, terminate accounts, or remove content at our sole
            discretion.
          </p>
        </section>

        {/* 4. User Content */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">4. User Content</h2>

          <h3 className="text-xl font-semibold mb-3 mt-6">
            4.1 Content You Provide
          </h3>
          <p className="mb-4">
            NihongoTracker allows you to create and share content, including but
            not limited to profile information, avatar images, immersion logs,
            reviews, and comments ("User Content"). You retain ownership of your
            User Content, but by posting it on our Service, you grant us a
            worldwide, non-exclusive, royalty-free license to use, display,
            reproduce, and distribute your User Content in connection with
            operating and promoting the Service.
          </p>

          <h3 className="text-xl font-semibold mb-3 mt-4">
            4.2 Content Standards
          </h3>
          <p className="mb-4">You agree that your User Content will not:</p>
          <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>Violate any laws or regulations</li>
            <li>Infringe on the intellectual property rights of others</li>
            <li>Contain hate speech, harassment, threats, or bullying</li>
            <li>Include sexually explicit or pornographic material</li>
            <li>Promote violence or illegal activities</li>
            <li>Contain spam, malware, or phishing attempts</li>
            <li>Impersonate any person or entity</li>
            <li>
              Include personal information of others without their consent
            </li>
          </ul>

          <h3 className="text-xl font-semibold mb-3 mt-4">
            4.3 Content Moderation
          </h3>
          <p>
            We reserve the right to review, monitor, and remove any User Content
            that violates these Terms or is otherwise objectionable, at our sole
            discretion and without prior notice. However, we are not obligated
            to monitor all User Content and are not responsible for content
            posted by users.
          </p>
        </section>

        {/* 5. Acceptable Use */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">5. Acceptable Use</h2>
          <p className="mb-4">You agree not to:</p>
          <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
            <li>
              Use the Service for any illegal purpose or in violation of any
              laws
            </li>
            <li>
              Attempt to gain unauthorized access to our systems or other users'
              accounts
            </li>
            <li>
              Interfere with or disrupt the Service or servers/networks
              connected to the Service
            </li>
            <li>
              Use automated systems (bots, scrapers, etc.) to access the Service
              without permission
            </li>
            <li>
              Reverse engineer, decompile, or disassemble any part of the
              Service
            </li>
            <li>Collect or harvest personal information about other users</li>
            <li>
              Manipulate statistics, XP, or other game elements through cheating
              or exploits
            </li>
            <li>
              Create multiple accounts to abuse the Service or gain unfair
              advantages
            </li>
            <li>Sell, trade, or transfer your account to another person</li>
          </ul>
        </section>

        {/* 6. Intellectual Property */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">6. Intellectual Property</h2>

          <h3 className="text-xl font-semibold mb-3 mt-6">6.1 Our Content</h3>
          <p className="mb-4">
            NihongoTracker and its original content (excluding User Content),
            features, and functionality are owned by NihongoTracker and are
            protected by international copyright, trademark, patent, trade
            secret, and other intellectual property laws.
          </p>

          <h3 className="text-xl font-semibold mb-3 mt-6">
            6.2 License to Use
          </h3>
          <p className="mb-4">
            We grant you a limited, non-exclusive, non-transferable, revocable
            license to access and use the Service for personal, non-commercial
            purposes, subject to these Terms.
          </p>

          <h3 className="text-xl font-semibold mb-3 mt-6">
            6.3 Third-Party Content
          </h3>
          <p>
            Our Service integrates with third-party services (AniList, VNDB,
            YouTube) and displays metadata from these sources. All trademarks,
            logos, and copyrights belong to their respective owners. We do not
            claim ownership of any third-party content displayed on our Service.
          </p>
        </section>

        {/* 7. Patreon Subscriptions */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">7. Patreon Subscriptions</h2>

          <h3 className="text-xl font-semibold mb-3 mt-6">
            7.1 Subscription Tiers
          </h3>
          <p className="mb-4">
            NihongoTracker offers optional Patreon subscriptions that provide
            additional benefits. Subscription tiers and benefits are described
            on our Support page. We reserve the right to modify, add, or remove
            benefits at any time, though we will make reasonable efforts to
            notify subscribers of significant changes.
          </p>

          <h3 className="text-xl font-semibold mb-3 mt-6">
            7.2 Billing and Payments
          </h3>
          <p className="mb-4">
            All subscription payments are processed through Patreon. By
            subscribing, you agree to Patreon's Terms of Service and Privacy
            Policy. We are not responsible for any billing issues, refunds, or
            payment disputes with Patreon.
          </p>

          <h3 className="text-xl font-semibold mb-3 mt-6">
            7.3 Linking Your Account
          </h3>
          <p className="mb-4">
            To receive Patreon benefits on NihongoTracker, you must link your
            Patreon account in your Settings using the email address associated
            with your Patreon account. Benefits are applied automatically via
            webhooks and may take a few minutes to activate.
          </p>

          <h3 className="text-xl font-semibold mb-3 mt-6">7.4 Cancellation</h3>
          <p className="mb-4">
            You may cancel your Patreon subscription at any time through
            Patreon. Upon cancellation, you will retain your benefits until the
            end of your current billing period, after which they will be
            automatically removed.
          </p>

          <h3 className="text-xl font-semibold mb-3 mt-6">7.5 Refunds</h3>
          <p>
            We offer refunds within 7 days of purchase for subscription
            payments. For complete details about our refund process,
            eligibility, and how to request a refund, please see our{' '}
            <a href="/refund-policy" className="text-primary hover:underline">
              Refund Policy
            </a>
            .
          </p>
        </section>

        {/* 8. Disclaimers and Limitations of Liability */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">
            8. Disclaimers and Limitations of Liability
          </h2>

          <h3 className="text-xl font-semibold mb-3 mt-6">
            8.1 "As Is" Service
          </h3>
          <p className="mb-4">
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT
            WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT
            LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
            PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE
            SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE.
          </p>

          <h3 className="text-xl font-semibold mb-3 mt-6">
            8.2 Limitation of Liability
          </h3>
          <p className="mb-4">
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, NIHONGOTRACKER AND ITS
            AFFILIATES, OFFICERS, EMPLOYEES, AGENTS, AND LICENSORS WILL NOT BE
            LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
            PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS,
            DATA, USE, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR RELATED TO
            YOUR USE OF THE SERVICE.
          </p>

          <h3 className="text-xl font-semibold mb-3 mt-6">
            8.3 Third-Party Services
          </h3>
          <p>
            We are not responsible for any issues, errors, or damages arising
            from third-party services (AniList, VNDB, YouTube, Firebase,
            Patreon) integrated with our Service. Use of these services is
            subject to their respective terms and policies.
          </p>
        </section>

        {/* 9. Indemnification */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">9. Indemnification</h2>
          <p>
            You agree to indemnify, defend, and hold harmless NihongoTracker and
            its affiliates, officers, directors, employees, and agents from and
            against any claims, liabilities, damages, losses, and expenses,
            including reasonable attorneys' fees, arising out of or in any way
            connected with: (a) your access to or use of the Service; (b) your
            User Content; (c) your violation of these Terms; or (d) your
            violation of any rights of another person or entity.
          </p>
        </section>

        {/* 10. Data Loss and Backups */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">10. Data Loss and Backups</h2>
          <p className="mb-4">
            While we make reasonable efforts to maintain and back up your data,
            we cannot guarantee against data loss or corruption. You are
            responsible for maintaining your own backups of any important data.
            We are not liable for any loss of data or User Content.
          </p>
          <p>
            We recommend periodically exporting your immersion logs and other
            important data as a precaution.
          </p>
        </section>

        {/* 11. Termination */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">11. Termination</h2>

          <h3 className="text-xl font-semibold mb-3 mt-6">11.1 By You</h3>
          <p className="mb-4">
            You may delete your account at any time through your Settings page.
            Upon deletion, your User Content and personal data will be removed
            from our servers, except as required by law or for legitimate
            business purposes.
          </p>

          <h3 className="text-xl font-semibold mb-3 mt-6">11.2 By Us</h3>
          <p className="mb-4">
            We reserve the right to suspend or terminate your account and access
            to the Service at any time, with or without notice, for any reason,
            including but not limited to:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
            <li>Violation of these Terms</li>
            <li>Fraudulent, abusive, or illegal activity</li>
            <li>Extended periods of inactivity</li>
            <li>Requests by law enforcement or government agencies</li>
          </ul>

          <h3 className="text-xl font-semibold mb-3 mt-6">
            11.3 Effect of Termination
          </h3>
          <p>
            Upon termination, your right to use the Service will immediately
            cease. All provisions of these Terms that by their nature should
            survive termination shall survive, including ownership provisions,
            warranty disclaimers, indemnity, and limitations of liability.
          </p>
        </section>

        {/* 12. Governing Law and Dispute Resolution */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">
            12. Governing Law and Dispute Resolution
          </h2>
          <p className="mb-4">
            These Terms shall be governed by and construed in accordance with
            the laws of the Dominican Republic, without regard to its conflict
            of law provisions. Any disputes arising from these Terms or your use
            of the Service shall be resolved through binding arbitration, except
            that either party may seek injunctive or other equitable relief in
            court to prevent infringement of intellectual property rights.
          </p>
        </section>

        {/* 13. Changes to the Service */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">
            13. Changes to the Service
          </h2>
          <p>
            We reserve the right to modify, suspend, or discontinue any part of
            the Service at any time, with or without notice. We will not be
            liable to you or any third party for any modification, suspension,
            or discontinuation of the Service.
          </p>
        </section>

        {/* 14. Severability */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">14. Severability</h2>
          <p>
            If any provision of these Terms is found to be invalid or
            unenforceable, the remaining provisions will continue in full force
            and effect. The invalid or unenforceable provision will be deemed
            modified to the extent necessary to make it valid and enforceable.
          </p>
        </section>

        {/* 15. Entire Agreement */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">15. Entire Agreement</h2>
          <p>
            These Terms, together with our{' '}
            <a href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </a>
            , constitute the entire agreement between you and NihongoTracker
            regarding your use of the Service and supersede any prior agreements
            or understandings.
          </p>
        </section>

        {/* 16. Contact Information */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">16. Contact Information</h2>
          <p className="mb-4">
            If you have any questions about these Terms of Service, please
            contact us:
          </p>
          <ul className="list-none space-y-2">
            <li>
              <strong>Email:</strong> support@nihongotracker.app
            </li>
            <li>
              <strong>Website:</strong> https://nihongotracker.app
            </li>
          </ul>
        </section>

        <div className="divider my-8"></div>

        <div className="text-center text-base-content/60">
          <p className="font-semibold">NihongoTracker</p>
          <p className="text-sm">A Japanese immersion tracker</p>
          <p className="text-sm mt-2">
            See also:{' '}
            <a href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </a>{' '}
            |{' '}
            <a href="/refund-policy" className="text-primary hover:underline">
              Refund Policy
            </a>{' '}
            |{' '}
            <a href="/pricing" className="text-primary hover:underline">
              Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default TermsOfServiceScreen;
