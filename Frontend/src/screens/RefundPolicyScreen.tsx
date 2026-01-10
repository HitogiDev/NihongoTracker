function RefundPolicyScreen() {
  return (
    <div className="container mx-auto px-4 py-8 pt-32 max-w-4xl">
      <h1 className="text-4xl font-bold mb-4">Refund Policy</h1>
      <p className="text-base-content/70 mb-8">
        Last Updated: December 25, 2025
      </p>

      <div className="prose prose-lg max-w-none">
        <p className="mb-8">
          At NihongoTracker, we want you to be completely satisfied with your
          subscription. This Refund Policy outlines our practices regarding
          refunds for our premium subscription services.
        </p>

        {/* 1. Subscription Services */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">1. Subscription Services</h2>
          <p className="mb-4">
            NihongoTracker offers optional premium subscriptions that provide
            additional features and benefits. Our subscription tiers are:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
            <li>
              <strong>Donator</strong> - $1/month
            </li>
            <li>
              <strong>Immersion Enthusiast</strong> - $5/month
            </li>
            <li>
              <strong>Avid Consumer</strong> - $10/month
            </li>
          </ul>
          <p>
            For detailed information about what each tier includes, please visit
            our{' '}
            <a href="/pricing" className="text-primary hover:underline">
              Support page
            </a>
            .
          </p>
        </section>

        {/* 2. Free Trial Period */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">2. Free Trial Period</h2>
          <p>
            NihongoTracker's core features are free to use. Premium
            subscriptions do not include a free trial period. We encourage you
            to explore our free features before subscribing to understand the
            value our premium tiers provide.
          </p>
        </section>

        {/* 3. Refund Eligibility */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">3. Refund Eligibility</h2>

          <h3 className="text-xl font-semibold mb-3 mt-6">
            3.1 Within 14 Days of Purchase
          </h3>
          <p className="mb-4">
            If you are not satisfied with your subscription, you may request a
            full refund within 14 days of your initial purchase or renewal. To
            be eligible for a refund:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
            <li>The request must be made within 14 days of the charge</li>
            <li>
              You must not have previously received a refund for the same
              subscription
            </li>
            <li>
              Your account must be in good standing (not suspended or banned)
            </li>
          </ul>

          <h3 className="text-xl font-semibold mb-3 mt-6">3.2 After 14 Days</h3>
          <p className="mb-4">
            After the 7-day period, refunds are generally not provided. However,
            we may consider refund requests on a case-by-case basis for
            exceptional circumstances, such as:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>
              Technical issues that prevented you from using premium features
            </li>
            <li>Accidental duplicate charges</li>
            <li>Unauthorized transactions (with appropriate verification)</li>
          </ul>
        </section>

        {/* 4. How to Request a Refund */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">
            4. How to Request a Refund
          </h2>
          <p className="mb-4">To request a refund, please:</p>
          <ol className="list-decimal list-inside space-y-2 ml-4 mb-4">
            <li>
              Email us at{' '}
              <a
                href="mailto:support@nihongotracker.app"
                className="text-primary hover:underline"
              >
                support@nihongotracker.app
              </a>
            </li>
            <li>Include your account username or email</li>
            <li>Provide the date of the transaction</li>
            <li>Explain the reason for your refund request</li>
          </ol>
          <p>
            We will review your request and respond within 5 business days. If
            approved, refunds will be processed to your original payment method
            within 5-10 business days, depending on your payment provider.
          </p>
        </section>

        {/* 5. Cancellation Policy */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">5. Cancellation Policy</h2>
          <p className="mb-4">
            You may cancel your subscription at any time through your account
            settings or payment provider dashboard. Upon cancellation:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>
              Your premium benefits will remain active until the end of your
              current billing period
            </li>
            <li>You will not be charged for subsequent billing periods</li>
            <li>
              No partial refunds are provided for the remaining time in your
              current billing period
            </li>
            <li>
              Your account will automatically revert to our free tier when your
              subscription ends
            </li>
          </ul>
        </section>

        {/* 6. Non-Refundable Items */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">6. Non-Refundable Items</h2>
          <p className="mb-4">The following are not eligible for refunds:</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>One-time donations made through Ko-fi or similar platforms</li>
            <li>
              Subscriptions cancelled after using premium features extensively
            </li>
            <li>
              Accounts that have been suspended or terminated for violating our{' '}
              <a href="/terms" className="text-primary hover:underline">
                Terms of Service
              </a>
            </li>
            <li>
              Requests made more than 14 days after purchase (except in
              exceptional circumstances)
            </li>
          </ul>
        </section>

        {/* 7. Chargebacks */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">7. Chargebacks</h2>
          <p>
            If you believe you have been charged in error, please contact us
            first before initiating a chargeback with your payment provider.
            Filing a chargeback without first attempting to resolve the issue
            with us may result in permanent suspension of your account. We are
            committed to resolving any billing issues fairly and promptly.
          </p>
        </section>

        {/* 8. Changes to Pricing */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">8. Changes to Pricing</h2>
          <p>
            We reserve the right to modify our subscription prices at any time.
            If we increase prices, we will provide existing subscribers with at
            least 30 days' notice before the new prices take effect. You may
            cancel your subscription before the price change takes effect if you
            do not wish to continue at the new price.
          </p>
        </section>

        {/* 9. Service Availability */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">9. Service Availability</h2>
          <p>
            While we strive to maintain 99.9% uptime, we do not guarantee
            uninterrupted access to our services. Brief service interruptions
            for maintenance or technical issues do not qualify for refunds.
            However, if our service experiences extended downtime (more than 72
            consecutive hours) affecting premium features, we will provide
            pro-rata credits or refunds upon request.
          </p>
        </section>

        {/* 10. Contact Us */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">10. Contact Us</h2>
          <p className="mb-4">
            If you have any questions about our Refund Policy or need assistance
            with a refund request, please contact us:
          </p>
          <ul className="list-none space-y-2">
            <li>
              <strong>Email:</strong>{' '}
              <a
                href="mailto:support@nihongotracker.app"
                className="text-primary hover:underline"
              >
                support@nihongotracker.app
              </a>
            </li>
            <li>
              <strong>Website:</strong> https://nihongotracker.app
            </li>
          </ul>
        </section>

        {/* 11. Policy Updates */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">11. Policy Updates</h2>
          <p>
            We may update this Refund Policy from time to time. Any changes will
            be posted on this page with an updated "Last Updated" date. Your
            continued use of our subscription services after any changes
            indicates your acceptance of the updated policy.
          </p>
        </section>

        <div className="divider my-8"></div>

        <div className="text-center text-base-content/60">
          <p className="font-semibold">NihongoTracker</p>
          <p className="text-sm">A Japanese immersion tracker</p>
          <p className="text-sm mt-2">
            See also:{' '}
            <a href="/terms" className="text-primary hover:underline">
              Terms of Service
            </a>{' '}
            |{' '}
            <a href="/privacy" className="text-primary hover:underline">
              Privacy Policy
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

export default RefundPolicyScreen;
