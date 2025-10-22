function PrivacyPolicyScreen() {
  return (
    <div className="container mx-auto px-4 py-8 pt-32 max-w-4xl">
      <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
      <p className="text-base-content/70 mb-8">
        Last Updated: October 18, 2025
      </p>

      <div className="prose prose-lg max-w-none">
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Introduction</h2>
          <p>
            Welcome to NihongoTracker ("we," "our," or "us"). We are committed
            to protecting your privacy and ensuring the security of your
            personal information. This Privacy Policy explains how we collect,
            use, disclose, and safeguard your information when you use our
            Japanese immersion tracking platform.
          </p>
          <p>
            By using NihongoTracker, you agree to the collection and use of
            information in accordance with this policy. Please also review our{' '}
            <a href="/terms" className="text-primary hover:underline">
              Terms of Service
            </a>{' '}
            which govern your use of our platform.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Information We Collect</h2>

          <h3 className="text-xl font-semibold mb-3 mt-6">
            Information You Provide to Us
          </h3>

          <div className="mb-4">
            <h4 className="font-semibold mb-2">Account Information:</h4>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Username</li>
              <li>Email address (optional, for Patreon linking)</li>
              <li>Password (encrypted and hashed)</li>
              <li>Discord ID (optional, for external integrations)</li>
            </ul>
          </div>

          <div className="mb-4">
            <h4 className="font-semibold mb-2">Profile Information:</h4>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Avatar image</li>
              <li>Banner image</li>
              <li>Profile customization settings (themes, preferences)</li>
              <li>Timezone settings</li>
            </ul>
          </div>

          <div className="mb-4">
            <h4 className="font-semibold mb-2">Immersion Data:</h4>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>
                Logs of your Japanese immersion activities (anime, manga, visual
                novels, books, videos, audio)
              </li>
              <li>Media titles and metadata</li>
              <li>Time spent, pages read, episodes watched, characters read</li>
              <li>Personal notes and tags on your logs</li>
              <li>Goals and progress tracking data</li>
            </ul>
          </div>

          <div className="mb-4">
            <h4 className="font-semibold mb-2">
              Patreon Information (Optional):
            </h4>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Patreon email address (for benefit verification)</li>
              <li>Patreon ID (provided by Patreon webhook)</li>
              <li>Subscription tier information</li>
              <li>Subscription status</li>
            </ul>
          </div>

          <h3 className="text-xl font-semibold mb-3 mt-6">
            Information Collected Automatically
          </h3>

          <div className="mb-4">
            <h4 className="font-semibold mb-2">Usage Data:</h4>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>IP address</li>
              <li>Browser type and version</li>
              <li>Device information</li>
              <li>Pages visited and features used</li>
              <li>Date and time of access</li>
              <li>Referral source</li>
            </ul>
          </div>

          <div className="mb-4">
            <h4 className="font-semibold mb-2">
              Cookies and Similar Technologies:
            </h4>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Authentication tokens (for keeping you logged in)</li>
              <li>Theme preferences</li>
              <li>Session data</li>
            </ul>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">
            How We Use Your Information
          </h2>

          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-semibold mb-2">Core Functionality</h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Provide and maintain the NihongoTracker service</li>
                <li>Create and manage your account</li>
                <li>Track and display your immersion progress</li>
                <li>Calculate XP, levels, and streaks</li>
                <li>Generate statistics and visualizations</li>
                <li>Enable comparison and ranking features</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2">Community Features</h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Display public profiles and leaderboards</li>
                <li>Enable club functionality and social interactions</li>
                <li>Show shared logs and media activity</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2">
                Patreon Integration
              </h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Verify your Patreon subscription status</li>
                <li>Apply appropriate benefits based on your tier</li>
                <li>Process supporter badges and premium features</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">
            Information Sharing and Disclosure
          </h2>
          <p className="mb-4">
            We do not sell, trade, or rent your personal information to third
            parties. We may share your information only in the following
            circumstances:
          </p>

          <h3 className="text-xl font-semibold mb-3 mt-6">
            Public Information
          </h3>
          <p className="mb-2">
            The following information is publicly visible on your profile:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
            <li>Username</li>
            <li>Avatar and banner</li>
            <li>Public immersion statistics (total XP, level, streaks)</li>
            <li>Public logs (if you choose to make them public)</li>
            <li>Club memberships</li>
          </ul>

          <h3 className="text-xl font-semibold mb-3 mt-6">
            Third-Party Services
          </h3>

          <div className="space-y-4">
            <div>
              <h4 className="font-semibold">AniList API:</h4>
              <p>
                We use AniList to fetch anime and manga metadata. We may send
                search queries based on your logged media. No personal
                information is shared with AniList.
              </p>
            </div>

            <div>
              <h4 className="font-semibold">VNDB API:</h4>
              <p>
                We use VNDB to fetch visual novel metadata. We may send search
                queries based on your logged media. No personal information is
                shared with VNDB.
              </p>
            </div>

            <div>
              <h4 className="font-semibold">YouTube Data API:</h4>
              <p>
                We use YouTube API to fetch video metadata. We may send video
                IDs based on your logged media. No personal information is
                shared with YouTube.
              </p>
            </div>

            <div>
              <h4 className="font-semibold">Firebase Storage:</h4>
              <p>
                We use Firebase to store uploaded images (avatars, banners).
                Images are stored securely and accessed only by our application.
                Google's privacy policy applies to Firebase services.
              </p>
            </div>

            <div>
              <h4 className="font-semibold">Patreon:</h4>
              <p>
                If you link your Patreon account, we share your Patreon email
                with Patreon's servers to verify your subscription. We receive
                webhook notifications about your subscription status. Patreon's
                privacy policy applies to their services.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Data Security</h2>
          <p className="mb-4">
            We implement appropriate technical and organizational security
            measures to protect your personal information:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>
              <strong>Encryption:</strong> Passwords are hashed using bcrypt
            </li>
            <li>
              <strong>HTTPS:</strong> All data transmission is encrypted using
              SSL/TLS
            </li>
            <li>
              <strong>Access Control:</strong> Limited access to personal data
              by authorized personnel only
            </li>
            <li>
              <strong>Regular Backups:</strong> Database backups to prevent data
              loss
            </li>
            <li>
              <strong>Security Monitoring:</strong> Regular security audits and
              monitoring
            </li>
          </ul>
          <p className="mt-4">
            However, no method of transmission over the internet or electronic
            storage is 100% secure. While we strive to use commercially
            acceptable means to protect your personal information, we cannot
            guarantee absolute security.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Your Rights and Choices</h2>
          <p className="mb-4">
            You have the following rights regarding your personal information:
          </p>

          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-semibold mb-2">
                Access and Portability
              </h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>
                  View all your personal data through your profile and settings
                </li>
                <li>Export your immersion logs (feature coming soon)</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2">
                Correction and Update
              </h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>
                  Update your profile information at any time through Settings
                </li>
                <li>Correct or edit your immersion logs</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2">Deletion</h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Delete individual logs or specific data</li>
                <li>
                  Delete your entire account and all associated data through
                  Settings → Clear All Data
                </li>
                <li>Once deleted, data cannot be recovered</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2">Privacy Controls</h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Control which logs are public or private</li>
                <li>Opt out of displaying adult content</li>
                <li>Unlink external integrations (Discord, Patreon)</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Children's Privacy</h2>
          <p>
            NihongoTracker is not intended for children under the age of 13. We
            do not knowingly collect personal information from children under
            13. If you are a parent or guardian and believe your child has
            provided us with personal information, please contact us so we can
            delete it.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Cookies Policy</h2>
          <p className="mb-4">
            We use cookies and similar tracking technologies to track activity
            on our service and store certain information.
          </p>

          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-semibold mb-2">Essential Cookies:</h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Authentication tokens (to keep you logged in)</li>
                <li>Session management</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2">
                Preference Cookies:
              </h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Theme selection (light/dark mode)</li>
                <li>Language preferences</li>
                <li>Timezone settings</li>
              </ul>
            </div>
          </div>

          <p className="mt-4">
            You can instruct your browser to refuse all cookies or to indicate
            when a cookie is being sent. However, if you do not accept cookies,
            you may not be able to use some portions of our service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">
            Changes to This Privacy Policy
          </h2>
          <p className="mb-4">
            We may update our Privacy Policy from time to time. We will notify
            you of any changes by:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Posting the new Privacy Policy on this page</li>
            <li>Updating the "Last Updated" date at the top</li>
            <li>
              Sending a notification through the service (for significant
              changes)
            </li>
          </ul>
          <p className="mt-4">
            We encourage you to review this Privacy Policy periodically for any
            changes. Changes to this Privacy Policy are effective when they are
            posted on this page.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Contact Us</h2>
          <p className="mb-4">
            If you have any questions about this Privacy Policy, or if you wish
            to exercise your privacy rights, please contact us:
          </p>
          <ul className="list-none space-y-2">
            <li>
              <strong>GitHub Issues:</strong>{' '}
              <a
                href="https://github.com/HitogiDev/NihongoTracker/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="link link-primary"
              >
                https://github.com/HitogiDev/NihongoTracker/issues
              </a>
            </li>
            <li>
              <strong>Email:</strong> support@nihongotracker.app
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Consent</h2>
          <p>
            By using NihongoTracker, you hereby consent to our Privacy Policy
            and agree to its terms.
          </p>
        </section>

        <div className="divider my-8"></div>

        <div className="text-center text-base-content/60">
          <p className="font-semibold">NihongoTracker</p>
          <p className="text-sm">A Japanese immersion tracker</p>
        </div>
      </div>
    </div>
  );
}

export default PrivacyPolicyScreen;
