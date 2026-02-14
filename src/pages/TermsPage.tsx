import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TermsPage() {
  return (
    <AppLayout headerTitle="Terms & Conditions" showLocation={false}>
      <div className="p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Terms & Conditions</CardTitle>
            <p className="text-sm text-muted-foreground">Last updated: February 13, 2026</p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <section>
              <h3 className="font-semibold mb-2">1. Acceptance of Terms</h3>
              <p className="text-muted-foreground">
                By downloading, installing, or using Sociva ("the Platform"), you agree to be bound by these Terms and Conditions. If you do not agree, please do not use the Platform.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">2. Eligibility</h3>
              <p className="text-muted-foreground">
                This Platform is exclusively for verified residents of participating residential societies. By using the Platform, you confirm that:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-2">
                <li>You are a current resident of your registered society</li>
                <li>You are at least 18 years of age</li>
                <li>The information you provide during registration is accurate</li>
                <li>You have passed GPS-based location verification and/or invite code verification</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-2">3. Account Registration & Society Membership</h3>
              <p className="text-muted-foreground">
                Users must provide accurate information including name, phone number, block, and flat number. Accounts are subject to GPS-based location verification, society invite code validation, and/or administrator approval. False information may result in account suspension. Users belong to a single society and can only access content within their own society.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">4. Platform Description</h3>
              <p className="text-muted-foreground">
                Sociva is a multi-society community marketplace platform that connects home-based sellers with buyers within verified residential communities. We facilitate transactions but are not a party to the sale of products or services. Sellers are independent individuals responsible for their offerings. The Platform operates as an intermediary under Section 79 of the Information Technology Act, 2000.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">5. Buyer Responsibilities</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Provide accurate delivery information</li>
                <li>Be available to receive orders at the specified time</li>
                <li>Make timely payments for orders</li>
                <li>Communicate respectfully with sellers</li>
                <li>Report any issues through proper channels</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-2">6. Seller Responsibilities</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Maintain safety and quality standards for all products/services</li>
                <li>Provide accurate descriptions and pricing</li>
                <li>Honor accepted orders and deliver on time</li>
                <li>Handle customer complaints professionally</li>
                <li>Comply with all applicable regulations</li>
                <li>Sellers in regulated categories must hold valid licenses as configured by the platform (e.g., FSSAI for food, Clinical Establishment License for medical services)</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-2">7. Regulatory Compliance</h3>
              <p className="text-muted-foreground">
                Sellers in regulated categories must provide valid license or registration documents as required by applicable laws (e.g., FSSAI for food, Clinical Establishment License for medical services). Sociva displays this information for consumer transparency but does not independently verify compliance. Sellers are solely responsible for maintaining valid certifications.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">8. Payments & Coupons</h3>
              <p className="text-muted-foreground">
                The Platform supports Cash on Delivery (COD) and UPI payments. All transactions are between buyers and sellers directly. Sociva does not process or store sensitive payment credentials. Sellers may create promotional coupons with specific terms; buyers may apply valid coupons at checkout. Disputes regarding payments should be resolved between the parties involved.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">9. Order Cancellation</h3>
              <p className="text-muted-foreground">
                Orders may be cancelled before the seller starts preparing. Once preparation begins, cancellation may not be possible. Sellers have the right to cancel orders if unable to fulfill them. Time-sensitive orders may be auto-cancelled if not accepted within the specified timeframe.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">10. Reviews and Ratings</h3>
              <p className="text-muted-foreground">
                Users may leave reviews and ratings after completed orders. Reviews must be honest, respectful, and relevant. Inappropriate reviews may be removed by administrators.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">11. Society Isolation</h3>
              <p className="text-muted-foreground">
                Content on Sociva is strictly scoped to your registered society. You will only see listings, sellers, promotions, and residents from your own society. Cross-society visibility is not permitted.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">12. Prohibited Conduct</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Provide false information or impersonate others</li>
                <li>Harass, abuse, or harm other users</li>
                <li>Sell prohibited items (alcohol, tobacco, controlled substances, etc.)</li>
                <li>Engage in fraudulent transactions</li>
                <li>Attempt to access content outside your registered society</li>
                <li>Violate community guidelines or applicable laws</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-2">13. Limitation of Liability</h3>
              <p className="text-muted-foreground">
                Sociva is a platform connecting community members. We are not liable for the quality, safety, or legality of items sold, the accuracy of listings, the ability of sellers to deliver, or any disputes between users. Use of the Platform is at your own risk.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">14. Tax Compliance</h3>
              <p className="text-muted-foreground">
                Sellers are responsible for their own tax obligations including GST registration and TCS compliance where applicable under Indian tax laws.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">15. Account Termination</h3>
              <p className="text-muted-foreground">
                We reserve the right to suspend or terminate accounts that violate these terms. Users may request account deletion at any time through the app settings.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">16. Grievance Redressal</h3>
              <p className="text-muted-foreground">
                In accordance with the Consumer Protection (E-Commerce) Rules, 2020, a Grievance Officer has been appointed. Grievances can be reported through the app's Help & Support section. The Grievance Officer shall acknowledge complaints within 48 hours and resolve them within 30 days.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">17. Changes to Terms</h3>
              <p className="text-muted-foreground">
                We may modify these Terms at any time. Continued use of the Platform after changes constitutes acceptance of the modified Terms.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">18. Governing Law</h3>
              <p className="text-muted-foreground">
                These Terms shall be governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts in Bangalore, Karnataka.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">19. Contact</h3>
              <p className="text-muted-foreground">
                For questions about these Terms, please contact us through the app's Help & Support section or email support@sociva.com.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
