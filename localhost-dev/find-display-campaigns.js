/**
 * Find Display Campaigns and Ad Groups
 * Helps identify which campaigns can be used for Responsive Display Ads
 */

require('dotenv').config({ path: '../.env.local' });
const { GoogleAdsApi, enums } = require('google-ads-api');

async function findDisplayCampaigns() {
  console.log('\n🔍 Searching for Display Campaigns...\n');

  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
  });

  const customer = client.Customer({
    customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
  });

  try {
    // Query for Display campaigns
    const campaignsQuery = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type
      FROM campaign
      WHERE campaign.advertising_channel_type = 'DISPLAY'
        AND campaign.status IN ('ENABLED', 'PAUSED')
      ORDER BY campaign.id
    `;

    const campaigns = await customer.query(campaignsQuery);

    if (!campaigns || campaigns.length === 0) {
      console.log('❌ No Display campaigns found in your account.\n');
      console.log('📝 You need to create a Display campaign first:\n');
      console.log('Option 1: Create via Google Ads UI');
      console.log('   1. Go to https://ads.google.com');
      console.log('   2. Click "Campaigns" → "+ New Campaign"');
      console.log('   3. Choose goal (e.g., "Sales" or "Leads")');
      console.log('   4. Select campaign type: "Display"');
      console.log('   5. Complete setup and create campaign');
      console.log('   6. Then run this script again');
      console.log('');
      console.log('Option 2: I can help you create one via the API');
      console.log('   Let me know if you want to create a test Display campaign!\n');
      return;
    }

    console.log(`✅ Found ${campaigns.length} Display campaign(s):\n`);

    for (let i = 0; i < campaigns.length; i++) {
      const row = campaigns[i];
      const c = row.campaign;

      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Campaign ${i + 1}: ${c.name}`);
      console.log(`   ID: ${c.id}`);
      console.log(`   Status: ${c.status === 'ENABLED' ? '✅ ENABLED' : '⏸️  PAUSED'}`);
      console.log(`   Type: DISPLAY ✅`);
      console.log('');

      // Get ad groups for this campaign
      const adGroupsQuery = `
        SELECT
          ad_group.id,
          ad_group.name,
          ad_group.status,
          ad_group.type
        FROM ad_group
        WHERE campaign.id = ${c.id}
          AND ad_group.status IN ('ENABLED', 'PAUSED')
        ORDER BY ad_group.id
      `;

      const adGroups = await customer.query(adGroupsQuery);

      if (adGroups && adGroups.length > 0) {
        console.log(`   📁 Ad Groups (${adGroups.length}):`);
        adGroups.forEach((agRow, j) => {
          const ag = agRow.ad_group;
          const statusIcon = ag.status === 'ENABLED' ? '✅' : '⏸️';
          console.log(`      ${j + 1}. ${ag.name}`);
          console.log(`         ID: ${ag.id} ${statusIcon}`);
          console.log(`         Type: ${ag.type}`);
        });
        console.log('');

        // Show recommended configuration
        if (i === 0 && adGroups.length > 0) {
          const firstAdGroup = adGroups[0].ad_group;
          console.log('💡 Recommended Configuration for .env.local:');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log(`GOOGLE_ADS_CAMPAIGN_ID=${c.id}`);
          console.log(`GOOGLE_ADS_AD_GROUP_ID=${firstAdGroup.id}`);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('');
        }
      } else {
        console.log('   ⚠️  No ad groups found in this campaign');
        console.log('   You need to create an ad group before publishing ads.');
        console.log('');
      }
    }

    console.log('\n✅ Ready to test! Copy the configuration above to .env.local\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.errors) {
      error.errors.forEach(err => {
        console.error('   -', err.message);
      });
    }
  }
}

findDisplayCampaigns();
