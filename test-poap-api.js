import { config } from 'dotenv';
import { PoapAPI } from './src/poap-api.js';

config();

async function testPoapAPI() {
    const poapAPI = new PoapAPI();
    
    console.log('Testing POAP API connection...');
    
    try {
        // Test getting access token
        console.log('1. Getting access token...');
        const token = await poapAPI.getAccessToken();
        console.log('✅ Access token obtained');
        
        // Test getting user POAPs (Vitalik's address)
        console.log('2. Testing getUserPOAPs...');
        const testAddress = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
        const poaps = await poapAPI.getUserPOAPs(testAddress);
        console.log(`✅ Found ${poaps.length} POAPs for test address`);
        
        if (poaps.length > 0) {
            console.log('First POAP:', poaps[0].event.name);
        }
        
    } catch (error) {
        console.error('❌ POAP API test failed:', error.message);
        console.error('Full error:', error);
    }
}

testPoapAPI();