/**
 * Find All Display Campaigns
 * Lists all Display campaigns including drafts
 */

require('dotenv').config({ path: '../.env.local' });
const { GoogleAdsApi } = require('google-ads-api');

async function findAllDisplayCampaigns() {
  console.log('\n🔍 Searching for ALL Display campaigns (including drafts)...\n');

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
    // Query for ALL Display campaigns, including drafts
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.base_campaign,
        campaign.experiment_type,
        campaign.advertising_channel_type
      FROM campaign
      WHERE campaign.advertising_channel_type = 'DISPLAY'
      ORDER BY campaign.id DESC
    `;

    const campaigns = await customer.query(query);

    if (!campaigns || campaigns.length === 0) {
      console.log('❌ No Display campaigns found (including drafts)\n');
      return;
    }

    console.log(`✅ Found ${campaigns.length} Display campaign(s):\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const regularCampaigns = [];
    const draftCampaigns = [];

    campaigns.forEach(row => {
      const c = row.campaign;
      if (c.base_campaign) {
        draftCampaigns.push(c);
      } else {
        regularCampaigns.push(c);
      }
    });

    // Show regular campaigns
    console.log(`📢 Regular Display Campaigns (${regularCampaigns.length}):\n`);
    if (regularCampaigns.length === 0) {
      console.log('   (none found)\n');
    } else {
      regularCampaigns.forEach((c, i) => {
        const isTarget = c.id === '1358949011';
        const marker = isTarget ? ' ⭐ TARGET CAMPAIGN' : '';
        const statusName = getStatusName(c.status);

        console.log(`${i + 1}. ${c.name}${marker}`);
        console.log(`   ID: ${c.id}`);
        console.log(`   Status: ${statusName}`);
        console.log('');
      });
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Show draft campaigns
    console.log(`📝 Draft Display Campaigns (${draftCampaigns.length}):\n`);
    if (draftCampaigns.length === 0) {
      console.log('   (none found)\n');
    } else {
      draftCampaigns.forEach((c, i) => {
        const isTarget = c.id === '1358949011';
        const marker = isTarget ? ' ⭐ TARGET CAMPAIGN - YOUR AD IS HERE!' : '';
        const statusName = getStatusName(c.status);

        console.log(`${i + 1}. ${c.name}${marker}`);
        console.log(`   ID: ${c.id}`);
        console.log(`   Status: ${statusName}`);
        console.log(`   Base Campaign: ${c.base_campaign}`);
        console.log('');
      });
    }

    // Check if target campaign was found
    const found = campaigns.find(row => row.campaign.id === '1358949011');
    if (found) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('✅ Found target campaign: GDN_Test_AFS (1358949011)\n');

      if (found.campaign.base_campaign) {
        console.log('⚠️  This is a DRAFT campaign');
        console.log('   In Google Ads UI, it should appear under "Drafts in progress"');
        console.log('   But it might be paginated or filtered out.\n');
        console.log('💡 Try in Google Ads UI:');
        console.log('   1. Clear all filters');
        console.log('   2. Use the search box to search for "GDN_Test_AFS"');
        console.log('   3. Or search by ID: "1358949011"\n');
      }
    } else {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('❌ Target campaign 1358949011 NOT in Display campaigns list\n');
      console.log('But we can still query the ad (783828561722)...\n');
    }

    // Recommend active campaigns
    if (regularCampaigns.length > 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('💡 Recommendation: Use an active Display campaign instead\n');

      const activeCampaigns = regularCampaigns.filter(c => c.status === 2 || c.status === 'ENABLED');
      if (activeCampaigns.length > 0) {
        console.log('These campaigns are ENABLED and ready to use:\n');
        activeCampaigns.slice(0, 3).forEach((c, i) => {
          console.log(`${i + 1}. ${c.name}`);
          console.log(`   GOOGLE_ADS_CAMPAIGN_ID=${c.id}\n`);
        });
      } else {
        const pausedCampaigns = regularCampaigns.filter(c => c.status === 3 || c.status === 'PAUSED');
        if (pausedCampaigns.length > 0) {
          console.log('These campaigns are PAUSED (you could enable them):\n');
          pausedCampaigns.slice(0, 3).forEach((c, i) => {
            console.log(`${i + 1}. ${c.name}`);
            console.log(`   GOOGLE_ADS_CAMPAIGN_ID=${c.id}\n`);
          });
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.errors) {
      error.errors.forEach(err => {
        console.error('   -', err.message);
      });
    }
  }
}

function getStatusName(status) {
  const statusMap = {
    0: 'UNSPECIFIED',
    1: 'UNKNOWN',
    2: 'ENABLED',
    3: 'PAUSED',
    4: 'REMOVED'
  };
  return statusMap[status] || status;
}

findAllDisplayCampaigns();
