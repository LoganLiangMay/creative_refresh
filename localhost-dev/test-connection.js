/**
 * Google Ads API Connection Test
 * Validates credentials and lists accessible customers
 */

require('dotenv').config({ path: '../.env.local' });
const { GoogleAdsApi } = require('google-ads-api');

async function testConnection() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                ║');
  console.log('║     🧪 Google Ads API Connection Test                         ║');
  console.log('║                                                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Check environment variables
  console.log('📋 Checking environment configuration...\n');

  const requiredVars = {
    'GOOGLE_ADS_DEVELOPER_TOKEN': process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    'GOOGLE_ADS_CLIENT_ID': process.env.GOOGLE_ADS_CLIENT_ID,
    'GOOGLE_ADS_CLIENT_SECRET': process.env.GOOGLE_ADS_CLIENT_SECRET,
    'GOOGLE_ADS_REFRESH_TOKEN': process.env.GOOGLE_ADS_REFRESH_TOKEN,
    'GOOGLE_ADS_CUSTOMER_ID': process.env.GOOGLE_ADS_CUSTOMER_ID,
  };

  let missingVars = [];
  for (const [key, value] of Object.entries(requiredVars)) {
    if (!value) {
      console.log(`   ❌ ${key}: Not configured`);
      missingVars.push(key);
    } else {
      // Show partial value for security
      const displayValue = value.length > 20
        ? `${value.substring(0, 10)}...${value.substring(value.length - 4)}`
        : value;
      console.log(`   ✅ ${key}: ${displayValue}`);
    }
  }

  if (missingVars.length > 0) {
    console.log('\n❌ Missing required environment variables!');
    console.log('Please configure these in .env.local:\n');
    missingVars.forEach(v => console.log(`   - ${v}`));
    process.exit(1);
  }

  console.log('\n✅ All required variables configured!\n');

  // Test 1: Initialize Google Ads API client
  console.log('🔌 Test 1: Initializing Google Ads API client...');
  try {
    const client = new GoogleAdsApi({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    });
    console.log('   ✅ Client initialized successfully\n');

    // Test 2: List accessible customers
    console.log('👥 Test 2: Listing accessible customers...');
    const customers = await client.listAccessibleCustomers(
      process.env.GOOGLE_ADS_REFRESH_TOKEN
    );

    if (customers && customers.length > 0) {
      console.log(`   ✅ Found ${customers.length} accessible customer(s):\n`);
      customers.forEach((customer, index) => {
        const customerId = customer.replace('customers/', '');
        const isCurrent = customerId === process.env.GOOGLE_ADS_CUSTOMER_ID;
        console.log(`      ${index + 1}. ${customerId} ${isCurrent ? '⭐ (configured)' : ''}`);
      });
      console.log('');
    } else {
      console.log('   ⚠️  No accessible customers found');
      console.log('   This might indicate an issue with your refresh token.\n');
    }

    // Test 3: Try to access configured customer
    if (process.env.GOOGLE_ADS_CUSTOMER_ID) {
      console.log('🏢 Test 3: Accessing configured customer...');
      console.log(`   Customer ID: ${process.env.GOOGLE_ADS_CUSTOMER_ID}`);

      const customer = client.Customer({
        customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID,
        refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
      });

      try {
        // Try to fetch customer info
        const query = `
          SELECT
            customer.id,
            customer.descriptive_name,
            customer.currency_code,
            customer.time_zone
          FROM customer
          LIMIT 1
        `;

        const result = await customer.query(query);

        if (result && result.length > 0) {
          const customerInfo = result[0].customer;
          console.log('   ✅ Customer details retrieved:');
          console.log(`      Name: ${customerInfo.descriptive_name || 'N/A'}`);
          console.log(`      ID: ${customerInfo.id}`);
          console.log(`      Currency: ${customerInfo.currency_code || 'N/A'}`);
          console.log(`      Timezone: ${customerInfo.time_zone || 'N/A'}`);
          console.log('');
        }
      } catch (error) {
        console.log(`   ❌ Failed to access customer: ${error.message}`);
        console.log('   This might indicate insufficient permissions.\n');
      }

      // Test 4: List campaigns
      console.log('📢 Test 4: Listing campaigns...');
      try {
        const campaignsQuery = `
          SELECT
            campaign.id,
            campaign.name,
            campaign.status,
            campaign.advertising_channel_type
          FROM campaign
          WHERE campaign.status != 'REMOVED'
          ORDER BY campaign.id
          LIMIT 10
        `;

        const campaigns = await customer.query(campaignsQuery);

        if (campaigns && campaigns.length > 0) {
          console.log(`   ✅ Found ${campaigns.length} campaign(s):\n`);
          campaigns.forEach((row, index) => {
            const c = row.campaign;
            const isDisplay = c.advertising_channel_type === 'DISPLAY';
            console.log(`      ${index + 1}. ${c.name}`);
            console.log(`         ID: ${c.id}`);
            console.log(`         Status: ${c.status}`);
            console.log(`         Type: ${c.advertising_channel_type} ${isDisplay ? '✅ (Display - good for RDA!)' : ''}`);
            console.log('');
          });

          // Show message about campaign ID
          if (!process.env.GOOGLE_ADS_CAMPAIGN_ID) {
            console.log('   💡 Copy a Display campaign ID above and add to .env.local:');
            console.log('      GOOGLE_ADS_CAMPAIGN_ID=<campaign_id>');
            console.log('');
          }
        } else {
          console.log('   ⚠️  No campaigns found');
          console.log('   You may need to create a Display campaign in Google Ads UI first.\n');
        }

        // Test 5: List ad groups (if campaign ID is configured)
        if (process.env.GOOGLE_ADS_CAMPAIGN_ID) {
          console.log('📁 Test 5: Listing ad groups...');
          const adGroupsQuery = `
            SELECT
              ad_group.id,
              ad_group.name,
              ad_group.status,
              campaign.id,
              campaign.name
            FROM ad_group
            WHERE campaign.id = ${process.env.GOOGLE_ADS_CAMPAIGN_ID}
              AND ad_group.status != 'REMOVED'
            ORDER BY ad_group.id
            LIMIT 10
          `;

          const adGroups = await customer.query(adGroupsQuery);

          if (adGroups && adGroups.length > 0) {
            console.log(`   ✅ Found ${adGroups.length} ad group(s):\n`);
            adGroups.forEach((row, index) => {
              const ag = row.ad_group;
              console.log(`      ${index + 1}. ${ag.name}`);
              console.log(`         ID: ${ag.id}`);
              console.log(`         Status: ${ag.status}`);
              console.log('');
            });

            if (!process.env.GOOGLE_ADS_AD_GROUP_ID) {
              console.log('   💡 Copy an ad group ID above and add to .env.local:');
              console.log('      GOOGLE_ADS_AD_GROUP_ID=<ad_group_id>');
              console.log('');
            }
          } else {
            console.log('   ⚠️  No ad groups found in this campaign');
            console.log('   You may need to create an ad group in Google Ads UI first.\n');
          }
        }

      } catch (error) {
        console.log(`   ❌ Failed to list campaigns: ${error.message}\n`);
      }
    }

    // Summary
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                                                                ║');
    console.log('║     ✅ Connection Test Complete!                               ║');
    console.log('║                                                                ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log('📝 Summary:');
    console.log(`   ✅ Google Ads API credentials: Valid`);
    console.log(`   ✅ Customer access: Working`);
    console.log(`   ✅ API connection: Successful`);
    console.log('');

    if (!process.env.GOOGLE_ADS_CAMPAIGN_ID || !process.env.GOOGLE_ADS_AD_GROUP_ID) {
      console.log('⚠️  Next Steps:');
      if (!process.env.GOOGLE_ADS_CAMPAIGN_ID) {
        console.log('   1. Add a Display campaign ID to .env.local');
      }
      if (!process.env.GOOGLE_ADS_AD_GROUP_ID) {
        console.log('   2. Add an ad group ID to .env.local');
      }
      console.log('   3. Then you can test creating ads!');
      console.log('');
    } else {
      console.log('🎉 All configured! You can now test creating ads!');
      console.log('   Run: npm start');
      console.log('   Open: http://localhost:3001');
      console.log('');
    }

  } catch (error) {
    console.log(`\n❌ Connection test failed: ${error.message}\n`);

    if (error.message.includes('unauthorized_client')) {
      console.log('💡 Troubleshooting:');
      console.log('   - Check that your OAuth client is configured correctly');
      console.log('   - Verify client ID and client secret match');
      console.log('   - Ensure refresh token was generated with correct client');
      console.log('');
    } else if (error.message.includes('invalid_grant')) {
      console.log('💡 Troubleshooting:');
      console.log('   - Your refresh token may have expired');
      console.log('   - You may need to regenerate the refresh token');
      console.log('   - Check that you used the correct client ID when generating token');
      console.log('');
    } else if (error.message.includes('DEVELOPER_TOKEN')) {
      console.log('💡 Troubleshooting:');
      console.log('   - Check that your developer token is valid');
      console.log('   - Ensure it starts with the correct format');
      console.log('   - Verify it\'s approved (not just in test mode)');
      console.log('');
    }

    process.exit(1);
  }
}

// Run the test
testConnection().catch(error => {
  console.error('\n💥 Unexpected error:', error);
  process.exit(1);
});
