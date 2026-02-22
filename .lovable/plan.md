

## Seed Feature Monetization Data and Demo

### What We'll Do

Create and run a seed function that populates the entire feature monetization system with realistic demo data, then walk through how it works in the admin panel.

### Data to Seed

**1. Builder: "Prestige Group"**
- Linked to "Prestige Tranquility" society (where Sagar's Kitchen seller exists)
- Admin user (ms86100@gmail.com) added as builder member

**2. Three Feature Packages:**

| Package | Tier | Features Enabled |
|---------|------|-----------------|
| **Basic** (Free) | bulletin, help_requests, visitor_management, parcel_management | 4 of 18 |
| **Pro** | Basic + marketplace, disputes, finances, construction_progress, snag_management, domestic_help, maintenance | 11 of 18 |
| **Enterprise** | All 18 features | 18 of 18 |

**3. Assignment:** Pro package assigned to Prestige Group builder

### What This Means for the Demo

Once seeded, users in "Prestige Tranquility" society will see the **Pro** package in effect:
- **Enabled:** Marketplace, Bulletin, Disputes, Finances, Construction Progress, Snag Management, Help Requests, Visitor Management, Domestic Help, Parcel Management, Maintenance
- **Disabled:** Inspection, Payment Milestones, Guard Kiosk, Vehicle Parking, Resident Identity Verification, Worker Marketplace, Workforce Management

Navigating to a disabled feature (e.g., Vehicle Parking) will show the "Feature Not Available" gate screen.

Society admins can toggle any feature marked as "society_configurable" within their package scope from the Society Admin page.

### How to Demo

1. Log in as admin (ms86100@gmail.com)
2. Go to **Admin > Features** tab to see all platform features, packages, and the builder assignment
3. Go to **Society Admin** page to see society-level toggles (3-state: Locked/Configurable/Unavailable)
4. Try navigating to a disabled feature -- you'll see the FeatureGate block
5. Change the builder's package from Pro to Enterprise in Admin -- all features unlock
6. Override a feature at society level -- it persists even if the package changes

### Technical Steps

1. Create edge function `seed-feature-packages` that inserts:
   - 1 builder
   - 1 builder-society link
   - 1 builder-member record
   - 3 feature packages with all 18 feature items each
   - 1 builder-feature-package assignment (Pro)
2. Deploy and call the function
3. Verify data is correctly seeded by checking the admin UI

