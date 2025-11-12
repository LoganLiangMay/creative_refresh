/**
 * List All Campaigns
 * Shows all campaigns including enabled, paused, and removed
 */

require('dotenv').config({ path: '../.env.local' });
const { GoogleAdsApi } = require('google-ads-api');

async function listAllCampaigns() {
  console.log('\n📋 Listing all campaigns in your account...\n');

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
    // Query for all campaigns (not just drafts)
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        campaign.campaign_budget,
        campaign.base_campaign
      FROM campaign
      ORDER BY campaign.id DESC
    `;

    const campaigns = await customer.query(query);

    if (!campaigns || campaigns.length === 0) {
      console.log('❌ No campaigns found\n');
      return;
    }

    console.log(`✅ Found ${campaigns.length} total campaign(s)\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Separate campaigns by type
    const regular = [];
    const drafts = [];

    campaigns.forEach(row => {
      const c = row.campaign;
      if (c.base_campaign) {
        drafts.push(c);
      } else {
        regular.push(c);
      }
    });

    // Display regular campaigns
    console.log(`📢 Regular Campaigns (${regular.length}):\n`);
    if (regular.length === 0) {
      console.log('   (none found)\n');
    } else {
      regular.forEach((c, i) => {
        const statusIcon = c.status === 'ENABLED' ? '✅' : c.status === 'PAUSED' ? '⏸️' : '❌';
        const isTarget = c.id === '1358949011';
        const marker = isTarget ? ' ⭐ YOUR AD IS HERE!' : '';

        console.log(`${i + 1}. ${c.name}${marker}`);
        console.log(`   ID: ${c.id}`);
        console.log(`   Status: ${c.status} ${statusIcon}`);
        console.log(`   Type: ${c.advertising_channel_type}`);
        console.log('');
      });
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Display drafts
    console.log(`📝 Draft Campaigns (${drafts.length}):\n`);
    if (drafts.length === 0) {
      console.log('   (none found)\n');
    } else {
      drafts.slice(0, 10).forEach((c, i) => {
        console.log(`${i + 1}. ${c.name}`);
        console.log(`   ID: ${c.id}`);
        console.log(`   Status: ${c.status}`);
        console.log('');
      });

      if (drafts.length > 10) {
        console.log(`   ... and ${drafts.length - 10} more drafts\n`);
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Find the target campaign
    const targetCampaign = campaigns.find(row => row.campaign.id === '1358949011');

    if (targetCampaign) {
      const c = targetCampaign.campaign;
      console.log('🎯 Your Ad Campaign Found!\n');
      console.log(`   Name: ${c.name}`);
      console.log(`   ID: ${c.id}`);
      console.log(`   Status: ${c.status}`);
      console.log(`   Type: ${c.advertising_channel_type}`);
      console.log('');
      console.log('💡 To view in Google Ads UI:');
      console.log(`   1. Click "Campaigns" in the left sidebar`);
      console.log(`   2. Look for "${c.name}"`);
      console.log(`   3. Or use the search box to find campaign ID: ${c.id}`);
      console.log('');
      console.log('🔗 Direct link:');
      console.log(`   https://ads.google.com/aw/campaigns/detail?campaignId=${c.id}\n`);
    } else {
      console.log('⚠️  Target campaign (ID: 1358949011) not found in this account.\n');
      console.log('This could mean:');
      console.log('   - The campaign was created in a different account');
      console.log('   - The campaign was removed');
      console.log('   - You need to check the account you\'re logged into\n');
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

listAllCampaigns();
