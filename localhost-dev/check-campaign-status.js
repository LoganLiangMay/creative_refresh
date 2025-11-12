/**
 * Check Campaign Status
 * Checks the specific status of campaign 1358949011
 */

require('dotenv').config({ path: '../.env.local' });
const { GoogleAdsApi, enums } = require('google-ads-api');

async function checkCampaignStatus() {
  console.log('\n🔍 Checking campaign 1358949011 status...\n');

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
    // Query specifically for this campaign
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        campaign.base_campaign,
        campaign.experiment_type,
        campaign.serving_status
      FROM campaign
      WHERE campaign.id = 1358949011
    `;

    const results = await customer.query(query);

    if (!results || results.length === 0) {
      console.log('❌ Campaign 1358949011 NOT FOUND in this account\n');
      console.log('This means the campaign was either:');
      console.log('   1. Removed from the account');
      console.log('   2. Never existed in this account');
      console.log('   3. Belongs to a different customer ID\n');

      console.log('However, we CAN still query the ad we created:');
      console.log('   Ad ID: 783828561722');
      console.log('   This suggests the campaign existed when we created the ad.\n');

      console.log('💡 Let\'s check what campaigns ARE available for Display ads...\n');
      return false;
    }

    const campaign = results[0].campaign;

    console.log('✅ Campaign Found!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`📛 Name: ${campaign.name}`);
    console.log(`🆔 ID: ${campaign.id}`);
    console.log(`📊 Status: ${campaign.status} (${getStatusName(campaign.status)})`);
    console.log(`📢 Type: ${campaign.advertising_channel_type} (${getChannelType(campaign.advertising_channel_type)})`);
    console.log(`🔄 Serving Status: ${campaign.serving_status || 'N/A'}`);
    console.log(`📝 Is Draft: ${campaign.base_campaign ? 'Yes (draft of ' + campaign.base_campaign + ')' : 'No'}`);
    console.log(`🧪 Experiment Type: ${campaign.experiment_type || 'N/A'}\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (campaign.status === 3 || campaign.status === 'PAUSED') {
      console.log('⚠️  This campaign is PAUSED\n');
      console.log('To view it in Google Ads UI:');
      console.log('   1. Go to Campaigns page');
      console.log('   2. Click the filter icon');
      console.log('   3. Select "Status" → Include "Paused"');
      console.log('   4. Apply filter\n');
    } else if (campaign.status === 4 || campaign.status === 'REMOVED') {
      console.log('❌ This campaign is REMOVED\n');
      console.log('To view it in Google Ads UI:');
      console.log('   1. Go to Campaigns page');
      console.log('   2. Click the filter icon');
      console.log('   3. Select "Status" → Include "Removed"');
      console.log('   4. Apply filter\n');
      console.log('⚠️  Note: Removed campaigns cannot be re-enabled.');
      console.log('You may want to create your ad in a different campaign.\n');
    }

    console.log('🔗 Direct link (may not work if removed):');
    console.log(`   https://ads.google.com/aw/campaigns/detail?campaignId=${campaign.id}\n`);

    return true;

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.errors) {
      error.errors.forEach(err => {
        console.error('   -', err.message);
      });
    }
    return false;
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

function getChannelType(type) {
  const typeMap = {
    0: 'UNSPECIFIED',
    1: 'UNKNOWN',
    2: 'SEARCH',
    3: 'DISPLAY',
    4: 'SHOPPING',
    5: 'HOTEL',
    6: 'VIDEO',
    7: 'MULTI_CHANNEL',
    8: 'LOCAL',
    9: 'SMART',
    10: 'PERFORMANCE_MAX',
    11: 'LOCAL_SERVICES',
    12: 'DISCOVERY',
    13: 'TRAVEL'
  };
  return typeMap[type] || type;
}

async function listActiveDisplayCampaigns() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📋 Looking for active Display campaigns...\n');

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
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status
      FROM campaign
      WHERE campaign.advertising_channel_type = 'DISPLAY'
        AND campaign.status IN ('ENABLED', 'PAUSED')
        AND campaign.base_campaign IS NULL
      ORDER BY campaign.status, campaign.name
      LIMIT 10
    `;

    const campaigns = await customer.query(query);

    if (!campaigns || campaigns.length === 0) {
      console.log('❌ No active Display campaigns found\n');
      console.log('💡 You may need to:');
      console.log('   1. Create a new Display campaign, or');
      console.log('   2. Enable an existing paused Display campaign\n');
      return;
    }

    console.log(`✅ Found ${campaigns.length} Display campaign(s):\n`);

    campaigns.forEach((row, i) => {
      const c = row.campaign;
      const statusIcon = c.status === 2 || c.status === 'ENABLED' ? '✅' : '⏸️';
      const statusName = getStatusName(c.status);

      console.log(`${i + 1}. ${c.name}`);
      console.log(`   ID: ${c.id} ${statusIcon} ${statusName}`);
      console.log('');
    });

    console.log('💡 You can update .env.local to use one of these campaigns:\n');
    const firstCampaign = campaigns[0].campaign;
    console.log(`GOOGLE_ADS_CAMPAIGN_ID=${firstCampaign.id}\n`);

  } catch (error) {
    console.error('❌ Error listing campaigns:', error.message);
  }
}

// Run the checks
checkCampaignStatus().then(found => {
  if (!found) {
    listActiveDisplayCampaigns();
  }
});
